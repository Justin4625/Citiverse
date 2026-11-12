"""Bakes the map of Rotterdam from 3D Rotterdam into small files the app can draw itself.

The live 3D Tiles of 3D Rotterdam (gemeente Rotterdam, CC BY 4.0, via the Open Urban Platform
catalogue) are far too heavy for a phone: a single ground tile is 3 MB. This script downloads them
once, flattens every surface to a 2D shape with its type, and writes

  data/map/<x>/<y>.json   one file per grid cell (about 380 x 610 m): the ground as surfaces with a
                          kind (road, cycle, pavement, green, water ...) from the BGT 3D ground, and
                          the buildings as outlines with a height h from the LoD1 buildings
  data/overview.geojson   water, green and roads of the whole area, coarse, for when zoomed out
  data/index.json         the area covered and which cells exist

The app loads the cells around the player (js/mapData.js) and draws them in its own colours
(js/mapStyle.js).

Run again when the area or the source data changes (about 2 GB to download, half an hour):

  python3 -m venv .venv && .venv/bin/pip install shapely numpy
  .venv/bin/python tools/bake_map.py [cache-dir]

Tiles are deleted from cache-dir (default: tools/.cache) once they are baked.
"""

import collections
import gzip
import json
import math
import struct
import subprocess
import sys
from pathlib import Path

import numpy as np
import shapely

BASE = 'https://www.3drotterdam.nl/datasource-data/'
GROUND = '594311c4-f78d-4d6c-a41c-062c87f99f8e'  # BGT 3D
BUILDINGS = '83825457-ab08-4017-bab3-af80d1e6cefa'  # LoD1 blocks

# The city of Rotterdam without the far port area: west, south, east, north.
BBOX = (4.38, 51.86, 4.60, 51.975)
CELL_ZOOM = 15  # the grid of the source tiles: 180 degrees halved 15 times
CELL_DEG = 180 / 2 ** CELL_ZOOM
LNG0, LAT0 = 4.48, 51.915  # origin of the local grid in metres
OVERVIEW_KINDS = ('water', 'green', 'road')
OVERVIEW_SIMPLIFY_M = 6
OVERVIEW_MIN_AREA_M2 = 150
M_PER_DEG = 111320.0
SIMPLIFY_M = 0.8

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'tools' / '.cache'


def fetch(url, keep=True):
    """Downloads through curl (system certificates, retries) into the cache, gzip left as is."""
    path = CACHE / url.removeprefix(BASE)
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['curl', '-sf', '--retry', '3', '-H', 'Accept-Encoding: gzip', '-A', 'Mozilla/5.0', '-o', str(path), url], check=True)
    data = path.read_bytes()
    if not keep:
        path.unlink()
    return gzip.decompress(data) if data[:2] == b'\x1f\x8b' else data


def tiles_in_area(dataset):
    """Urls of all tiles that overlap the play area. Coarse and fine tiles can hold the same
    object, so the callers skip ids they have already seen."""
    root = f'{BASE}{dataset}/'
    west, south, east, north = (math.radians(v) for v in BBOX)
    found = []

    def walk(node, base):
        w, s, e, n = node['boundingVolume']['region'][:4]
        if e < west or w > east or n < south or s > north:
            return
        uri = (node.get('content') or {}).get('uri') or (node.get('content') or {}).get('url')
        if uri and uri.endswith('.json'):
            sub = base + uri
            walk(json.loads(fetch(sub))['root'], sub.rsplit('/', 1)[0] + '/')
        elif uri:
            found.append(base + uri)
        for child in node.get('children', []):
            walk(child, base)

    walk(json.loads(fetch(root + 'tileset.json'))['root'], root)
    return sorted(set(found))


def read_b3dm(data):
    """Returns (triangles as lng/lat/height array [n, 3, 3], batch id per triangle, attributes per batch)."""
    _, _, _, ftj, ftb, btj, btb = struct.unpack('<4sIIIIII', data[:28])
    o = 28
    feature_table = json.loads(data[o:o + ftj] or b'{}')
    o += ftj + ftb
    batch_table = json.loads(data[o:o + btj] or b'{}')
    o += btj + btb
    glb = data[o:]
    json_len = struct.unpack('<I', glb[12:16])[0]
    gltf = json.loads(glb[20:20 + json_len])
    binary = glb[20 + json_len + 8:]

    def accessor(index):
        acc = gltf['accessors'][index]
        view = gltf['bufferViews'][acc['bufferView']]
        dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}[acc['componentType']]
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[acc['type']]
        start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
        stride = view.get('byteStride') or np.dtype(dtype).itemsize * width
        raw = np.frombuffer(binary, dtype='u1', count=stride * (acc['count'] - 1) + np.dtype(dtype).itemsize * width, offset=start)
        rows = np.lib.stride_tricks.as_strided(raw, shape=(acc['count'], np.dtype(dtype).itemsize * width), strides=(stride, 1))
        return np.ascontiguousarray(rows).view(dtype).reshape(acc['count'], width)

    rtc = np.array(feature_table.get('RTC_CENTER', [0, 0, 0]), dtype='f8')
    triangles, batches = [], []

    def visit(index, parent):
        node = gltf['nodes'][index]
        matrix = parent @ np.array(node.get('matrix', np.eye(4).flatten()), dtype='f8').reshape(4, 4).T
        for prim in gltf['meshes'][node['mesh']]['primitives'] if 'mesh' in node else []:
            pos = accessor(prim['attributes']['POSITION']).astype('f8')
            batch = accessor(prim['attributes']['_BATCHID']).astype('i8').flatten()
            order = accessor(prim['indices']).flatten() if 'indices' in prim else np.arange(len(pos))
            local = pos @ matrix[:3, :3].T + matrix[:3, 3]
            # glTF is y-up, 3D Tiles are z-up: (x, y, z) -> (x, -z, y), then the tile's centre.
            ecef = np.stack([local[:, 0], -local[:, 2], local[:, 1]], axis=1) + rtc
            geo = to_geodetic(ecef)
            triangles.append(geo[order].reshape(-1, 3, 3))
            batches.append(batch[order].reshape(-1, 3)[:, 0])
        for child in node.get('children', []):
            visit(child, matrix)

    for index in gltf['scenes'][gltf.get('scene', 0)]['nodes']:
        visit(index, np.eye(4))
    return np.concatenate(triangles), np.concatenate(batches), batch_table.get('attributes', [])


def to_geodetic(ecef):
    """ECEF metres to lng, lat (degrees) and height (WGS84)."""
    a, f = 6378137.0, 1 / 298.257223563
    b = a * (1 - f)
    e2, ep2 = 1 - (b / a) ** 2, (a / b) ** 2 - 1
    x, y, z = ecef[:, 0], ecef[:, 1], ecef[:, 2]
    p = np.hypot(x, y)
    theta = np.arctan2(z * a, p * b)
    lat = np.arctan2(z + ep2 * b * np.sin(theta) ** 3, p - e2 * a * np.cos(theta) ** 3)
    n = a / np.sqrt(1 - e2 * np.sin(lat) ** 2)
    return np.stack([np.degrees(np.arctan2(y, x)), np.degrees(lat), p / np.cos(lat) - n], axis=1)


def to_metres(lnglat):
    out = np.empty_like(lnglat)
    out[..., 0] = (lnglat[..., 0] - LNG0) * M_PER_DEG * math.cos(math.radians(LAT0))
    out[..., 1] = (lnglat[..., 1] - LAT0) * M_PER_DEG
    return out


def to_lnglat(x, y):
    return round(x / (M_PER_DEG * math.cos(math.radians(LAT0))) + LNG0, 6), round(y / M_PER_DEG + LAT0, 6)


def outline(triangles_xy):
    """Union of 2D triangles (walls and other vertical faces have no area and drop out)."""
    rings = np.concatenate([triangles_xy, triangles_xy[:, :1]], axis=1)
    polygons = shapely.polygons(rings)
    polygons = polygons[shapely.area(polygons) > 0.01]
    if not len(polygons):
        return None
    # A hair of overlap closes the cracks between neighbouring triangles.
    shape = shapely.union_all(shapely.buffer(polygons, 0.02, join_style='mitre'))
    return shape if not shape.is_empty else None


def geometry(shape, tolerance=SIMPLIFY_M, min_area=1):
    shape = shapely.simplify(shape, tolerance)
    if shape.is_empty:
        return None
    parts = [p for p in getattr(shape, 'geoms', [shape]) if p.geom_type == 'Polygon' and p.area > min_area]
    if not parts:
        return None
    coords = [[[to_lnglat(x, y) for x, y in ring.coords] for ring in [p.exterior, *[i for i in p.interiors if shapely.Polygon(i).area > min_area]]] for p in parts]
    return {'type': 'Polygon', 'coordinates': coords[0]} if len(coords) == 1 else {'type': 'MultiPolygon', 'coordinates': coords}


def cell_of(lng, lat):
    return int((lng + 180) // CELL_DEG), int((90 - lat) // CELL_DEG)


def feature(properties, geom):
    return {'type': 'Feature', 'properties': properties, 'geometry': geom}


def ground_kind(a):
    """Maps a BGT surface to the handful of kinds the map draws; None = not drawn."""
    klass, function, surface, kind = a.get('KLASSE_IMG', ''), a.get('FUNCTIE', ''), a.get('FYSIEKVK', ''), a.get('TYPE', '')
    if klass == 'Waterdeel':
        return 'water'
    if klass == 'Begroeid terreindeel':
        return 'green'
    if klass == 'Ondersteunend waterdeel':
        return 'green'
    if klass == 'Wegdeel':
        if function == 'fietspad':
            return 'cycle'
        if function == 'spoorbaan':
            return 'rail'
        if function in ('voetpad', 'voetgangersgebied', 'voetpad op trap', 'inrit', 'woonerf', 'ruiterpad'):
            return 'pavement'
        return 'road'
    if klass == 'Ondersteunend wegdeel':
        return 'green' if surface in ('groenvoorziening', 'onverhard') else 'pavement'
    if klass == 'Onbegroeid terreindeel':
        if surface == 'zand':
            return 'sand'
        return 'plot' if surface in ('erf', 'onverhard') else 'pavement'
    if klass == 'Pand':
        return 'plot'
    if klass == 'Overbruggingsdeel':
        return 'pavement' if kind == 'dek' else None
    if klass == 'Kunstwerkdeel':
        return 'pavement' if kind in ('steiger', 'perron') else None
    return None


def tiles(dataset):
    """Yields (number, total, url, triangles, batch ids, attributes) per source tile; broken tiles are skipped."""
    urls = tiles_in_area(dataset)
    for i, url in enumerate(urls, 1):
        try:
            yield (i, len(urls), url, *read_b3dm(fetch(url, keep=False)))
        except Exception as error:  # one bad tile should not stop a half-hour run
            print(f'SKIPPED {url}: {error}', flush=True)


def bake_ground(cells, overview):
    skipped, seen = collections.Counter(), set()
    for i, total, url, triangles, batch, attributes in tiles(GROUND):
        xy = to_metres(triangles[:, :, :2])
        shapes = collections.defaultdict(list)
        for b in np.unique(batch):
            a = attributes[b]
            key = a.get('LOKAALID') or (url, int(b))
            if key in seen:
                continue
            seen.add(key)
            kind = ground_kind(a)
            level = a.get('NIVO') or 0
            if kind is None or level < 0:
                skipped[(a.get('KLASSE_IMG'), a.get('TYPE') or a.get('FUNCTIE'))] += 1
                continue
            shape = outline(xy[batch == b])
            if shape is not None:
                shapes[(kind, 1 if level > 0 else 0)].append(shape)
        z, x, y = url.removesuffix('.b3dm').rsplit('/', 3)[-3:]
        cell = (int(x), int(y)) if int(z) == CELL_ZOOM else cell_of(*np.median(triangles[:, 0, :2], axis=0))
        for (kind, level), group in shapes.items():
            merged = shapely.union_all(group)
            geom = geometry(merged)
            if geom:
                cells[cell].append(feature({'kind': kind, 'level': level}, geom))
            if kind in OVERVIEW_KINDS and level == 0:
                coarse = geometry(merged, OVERVIEW_SIMPLIFY_M, OVERVIEW_MIN_AREA_M2)
                if coarse:
                    overview.append(feature({'kind': kind}, coarse))
        print(f'ground {i}/{total}', flush=True)
    print('not drawn:', skipped.most_common(12))


def bake_buildings(cells):
    seen = set()
    for i, total, url, triangles, batch, attributes in tiles(BUILDINGS):
        xy = to_metres(triangles[:, :, :2])
        for b in np.unique(batch):
            a = attributes[b]
            key = a.get('GEBOUWNUMMER') or (url, int(b))
            if key in seen:
                continue
            seen.add(key)
            mine = batch == b
            shape = outline(xy[mine])
            geom = geometry(shape) if shape is not None else None
            if not geom:
                continue
            heights = triangles[mine][:, :, 2]
            height = a.get('measuredHeight') or float(heights.max() - heights.min())
            cells[cell_of(*triangles[mine][:, 0, :2].mean(axis=0))].append(feature({'h': round(float(height), 1)}, geom))
        print(f'buildings {i}/{total}', flush=True)


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(',', ':')))
    return path.stat().st_size


if __name__ == '__main__':
    cells, overview = collections.defaultdict(list), []
    bake_ground(cells, overview)
    bake_buildings(cells)
    data = ROOT / 'data'
    size = sum(dump(data / 'map' / str(x) / f'{y}.json', {'type': 'FeatureCollection', 'features': features}) for (x, y), features in cells.items())
    print(f'{len(cells)} cells, {size / 1e6:.1f} MB')
    print(f'overview: {len(overview)} features, {dump(data / "overview.geojson", {"type": "FeatureCollection", "features": overview}) / 1e6:.2f} MB')
    dump(data / 'index.json', {'zoom': CELL_ZOOM, 'bbox': BBOX, 'cells': sorted(f'{x}/{y}' for x, y in cells)})
