// The stops, drawn inside the map itself (a MapLibre custom layer with Three.js) so they move in
// the very same frame as the map: no wobble, no lag, no jumps while turning.
//
// They keep the look of the original HTML stops (styles.css, .stop): a round photo pin in the
// theme gradient on a little pole, the Buddy next to it and a soft shadow on the ground.
// far  = waiting: a bit smaller, softer photo, bobbing slowly, with a beam of light above it
//        so you can spot it from far away;
// near = awake: a spinning ring and a glow in the theme colours, ripples on the ground, the
//        Buddy hopping and calling "Help!", the name on a tag. Tap it to play;
// done = collected: the GO stamp on the photo, calm.
// The stop stands up as a flat card that always faces the camera, laid out in the old CSS
// pixels (PX metres each); only the shadow and the ripples lie on the ground.

import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';
import { THEMES, themeOf, buddyUrl, stampUrl } from './brand.js';
import { photoUrl } from './locations.js';

const PLAY_ZOOM = 17.4;
// Metres per old CSS pixel. At the play zoom a screen pixel is about 0.56 m, so this draws the
// stops at about three quarters of their old size.
const PX = 0.42;
const POLE = 20;
const PIN = 58;
const PIN_Y = POLE + PIN / 2; // centre of the pin above the ground
const BUDDY = 40;
const RES = 4; // canvas pixels per CSS pixel in the textures
const NAVY = '#16295c';
const IDLE_FRAME_MS = 33;
const STATE_SCALE = { far: 0.9, near: 1.12, done: 0.86 };

// ---------- Textures ----------
const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});
function texture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * RES);
  c.height = Math.ceil(h * RES);
  const g = c.getContext('2d');
  g.scale(RES, RES);
  return [c, g];
}
// Draws `img` into a circle like CSS object-fit: cover with object-position `focus`.
function drawRound(g, img, cx, cy, r, focus = '50% 50%') {
  const scale = (2 * r) / Math.min(img.width, img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const [fx, fy] = focus.split(' ').map((p) => parseFloat(p) / 100);
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  g.drawImage(img, cx - r + (2 * r - w) * fx, cy - r + (2 * r - h) * fy, w, h);
  g.restore();
}

// The pin: theme gradient ring, white edge, the photo with light falling on it like glass, and a
// soft shadow under it. `soft` is the far look (paler photo).
const PIN_BOX = PIN + 24; // room for the shadow
function pinTexture(photo, focus, [a, b], soft) {
  const [c, g] = canvas(PIN_BOX, PIN_BOX);
  const cx = PIN_BOX / 2;
  const cy = PIN_BOX / 2;
  g.save();
  g.shadowColor = 'rgba(22,41,92,0.35)';
  g.shadowBlur = 10;
  g.shadowOffsetY = 4;
  const ring = g.createLinearGradient(cx - PIN / 2, 0, cx + PIN / 2, 0);
  ring.addColorStop(0, a);
  ring.addColorStop(1, b);
  g.fillStyle = ring;
  g.beginPath();
  g.arc(cx, cy, PIN / 2, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(cx, cy, PIN / 2 - 4, 0, Math.PI * 2);
  g.fill();
  const r = PIN / 2 - 6;
  if (soft && 'filter' in g) g.filter = 'saturate(0.55) brightness(1.05)';
  drawRound(g, photo, cx, cy, r, focus);
  g.filter = 'none';
  if (soft) {
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  }
  const glass = g.createRadialGradient(cx - r * 0.36, cy - r * 0.48, 0, cx - r * 0.36, cy - r * 0.48, r * 0.84);
  glass.addColorStop(0, 'rgba(255,255,255,0.55)');
  glass.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glass;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  return texture(c);
}
// The ring that turns round the pin of the stop you are at.
function ringTexture([a, b]) {
  const d = PIN + 14;
  const [c, g] = canvas(d, d);
  const fill = g.createConicGradient ? g.createConicGradient(0, d / 2, d / 2) : g.createLinearGradient(0, 0, d, d);
  fill.addColorStop(0, a);
  fill.addColorStop(0.33, b);
  fill.addColorStop(0.66, '#ffffff');
  fill.addColorStop(1, a);
  g.fillStyle = fill;
  g.beginPath();
  g.arc(d / 2, d / 2, d / 2, 0, Math.PI * 2);
  g.fill();
  return texture(c);
}
function glowTexture(colour) {
  const d = 128;
  const [c, g] = canvas(d, d);
  const grad = g.createRadialGradient(d / 2, d / 2, 0, d / 2, d / 2, d / 2);
  grad.addColorStop(0, colour);
  grad.addColorStop(0.45, colour);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalAlpha = 0.75;
  g.fillStyle = grad;
  g.fillRect(0, 0, d, d);
  return texture(c);
}
// The GO stamp, slapped on the top right of the pin once collected.
function stampTexture(img) {
  const [c, g] = canvas(28, 28);
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(14, 14, 14, 0, Math.PI * 2);
  g.fill();
  drawRound(g, img, 14, 14, 12);
  return texture(c);
}
// The beam: brightest at the pin, fading upwards, with a soft glow round it.
const BEAM = { w: 46, h: 360 };
function beamTexture([a, b]) {
  const [c, g] = canvas(BEAM.w, BEAM.h);
  const x = (BEAM.w - 22) / 2;
  const grad = g.createLinearGradient(0, BEAM.h, 0, 0);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.08, a);
  grad.addColorStop(0.5, b);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.shadowColor = a;
  g.shadowBlur = 12;
  g.globalAlpha = 0.85;
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(x, 8, 22, BEAM.h - 8, 11);
  g.fill();
  return texture(c);
}
// The name on a tag in the theme gradient (only shown at the stop you are at).
function labelTexture(text, [a, b]) {
  const font = '850 13px "Roboto Slab", Georgia, serif';
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const w = Math.ceil(probe.measureText(text.toUpperCase()).width) + 16;
  const h = 22;
  const [c, g] = canvas(w + 4, h + 4);
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(2, 2, w, h, 6);
  g.fill();
  g.font = font;
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  g.fillText(text.toUpperCase(), 10, 2 + h / 2 + 1);
  return { tex: texture(c), w: w + 4, h: h + 4 };
}
// "Help!" in a white speech bubble with its tail on the bottom left.
const HELP = { w: 62, h: 36 };
function helpTexture() {
  const [c, g] = canvas(HELP.w, HELP.h);
  g.shadowColor = 'rgba(22,41,92,0.3)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 3;
  g.fillStyle = '#fff';
  g.beginPath();
  g.roundRect(3, 3, 54, 24, 10);
  g.fill();
  g.beginPath();
  g.moveTo(10, 26);
  g.lineTo(16, 33);
  g.lineTo(22, 26);
  g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = NAVY;
  g.font = '850 12.8px "Roboto Slab", Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('HELP!', 30, 16);
  return texture(c);
}
function groundTexture(stops) {
  const d = 64;
  const [c, g] = canvas(d, d);
  const grad = g.createRadialGradient(d / 2, d / 2, 0, d / 2, d / 2, d / 2);
  for (const [at, colour] of stops) grad.addColorStop(at, colour);
  g.fillStyle = grad;
  g.fillRect(0, 0, d, d);
  return texture(c);
}

// ---------- One stop ----------
const onTop = { transparent: true, depthTest: false, depthWrite: false };
// A flat picture in the card, w x h old pixels, anchored at (ax, ay) of its own size (0..1).
function sprite(w, h, ax = 0.5, ay = 0.5, map = null) {
  const geo = new THREE.PlaneGeometry(w, h).translate((0.5 - ax) * w, (0.5 - ay) * h, 0);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, ...onTop }));
}
function setMap(mesh, tex) {
  mesh.material.map = tex;
  mesh.material.needsUpdate = true;
}

function buildStop(loc, shared) {
  const colours = THEMES[themeOf(loc.id)];
  const p = {};
  // On the ground.
  p.ground = new THREE.Group();
  p.shadow = new THREE.Mesh(shared.plane, new THREE.MeshBasicMaterial({ map: shared.shadow, transparent: true, depthWrite: false }));
  p.shadow.rotation.x = -Math.PI / 2;
  p.shadow.scale.set(52, 40, 1);
  p.ripples = [0, 1].map(() => {
    const r = new THREE.Mesh(shared.ripple, new THREE.MeshBasicMaterial({ color: '#ffffff', ...onTop }));
    r.rotation.x = -Math.PI / 2;
    return r;
  });
  p.ground.add(p.shadow, ...p.ripples);

  // The card that faces the camera. Origin = the foot of the pole, units = old CSS pixels.
  p.card = new THREE.Group();
  p.beam = sprite(BEAM.w, BEAM.h, 0.5, 0, beamTexture(colours));
  p.beam.position.y = PIN_Y;
  p.pole = sprite(3, POLE, 0.5, 0);
  p.pole.material.color.set(NAVY);
  p.buddy = sprite(BUDDY * 0.62, BUDDY, 0, 0);
  p.buddy.position.x = 6;
  // Everything that floats goes in `pin`, which bobs.
  p.pin = new THREE.Group();
  p.pin.position.y = PIN_Y;
  p.glow = sprite(PIN + 70, PIN + 70, 0.5, 0.5, glowTexture(colours[0]));
  p.ring = sprite(PIN + 14, PIN + 14, 0.5, 0.5, ringTexture(colours));
  p.face = sprite(PIN_BOX, PIN_BOX, 0.5, 0.5);
  p.face.position.y = -2; // the texture's shadow hangs a little below
  p.check = sprite(28, 28, 0.5, 0.5);
  p.check.position.set(PIN / 2 + 8 - 14, PIN / 2 + 8 - 14, 0);
  p.label = sprite(1, 1, 0.5, 0);
  p.label.position.y = PIN / 2 + 6;
  p.pin.add(p.glow, p.ring, p.face, p.check, p.label);
  p.help = sprite(HELP.w, HELP.h, 0.1, 0);
  p.help.position.set(30, 44, 0);
  p.card.add(p.beam, p.pole, p.buddy, p.pin, p.help);

  // Textures as they load.
  loadImage(photoUrl(loc)).then((img) => {
    p.photo = { far: pinTexture(img, loc.focus, colours, true), sharp: pinTexture(img, loc.focus, colours, false) };
    p.refresh?.();
  });
  loadImage(stampUrl(loc.id)).then((img) => setMap(p.check, stampTexture(img)));
  new THREE.TextureLoader().loadAsync(buddyUrl(loc.id)).then((tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    setMap(p.buddy, tex);
  });
  shared.fontsReady.then(() => {
    const { tex, w, h } = labelTexture(loc.name, colours);
    setMap(p.label, tex);
    p.label.scale.set(w, h, 1);
    setMap(p.help, shared.help);
  });

  return { loc, p, state: 'far', shown: 1, shownTarget: 1, near: 0, scale: STATE_SCALE.far, seed: Math.random() * 10 };
}

// ---------- The layer ----------
export function createStops3D(map, locations, { origin, onFrame = () => {} }) {
  const ref = maplibregl.MercatorCoordinate.fromLngLat(origin, 0);
  const metre = ref.meterInMercatorCoordinateUnits();
  // Local space: x east, y up, z south, in metres from `origin`.
  const toLocal = new THREE.Matrix4()
    .makeTranslation(ref.x, ref.y, ref.z)
    .scale(new THREE.Vector3(metre, -metre, metre))
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  const localOf = ({ lng, lat }) => {
    const m = maplibregl.MercatorCoordinate.fromLngLat({ lng, lat }, 0);
    return new THREE.Vector3((m.x - ref.x) / metre, 0, (m.y - ref.y) / metre);
  };

  const shared = {
    plane: new THREE.PlaneGeometry(1, 1),
    ripple: new THREE.RingGeometry(0.92, 1, 48),
    shadow: groundTexture([[0, 'rgba(22,41,92,0.42)'], [0.6, 'rgba(22,41,92,0.2)'], [1, 'rgba(22,41,92,0)']]),
    help: null,
    fontsReady: Promise.all([
      document.fonts.load('850 13px "Roboto Slab"'),
    ]).catch(() => {}),
  };
  shared.fontsReady.then(() => (shared.help = helpTexture()));

  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const projection = new THREE.Matrix4();

  const stops = new Map();
  for (const loc of locations) {
    const s = buildStop(loc, shared);
    s.at = localOf(loc);
    s.p.ground.position.copy(s.at);
    s.p.card.position.copy(s.at);
    s.p.refresh = () => applyState(s);
    scene.add(s.p.ground, s.p.card);
    stops.set(loc.id, s);
  }
  function applyState(s) {
    const { p, state } = s;
    if (p.photo) setMap(p.face, state === 'far' ? p.photo.far : p.photo.sharp);
  }

  // For test scripts.
  if (new URLSearchParams(location.search).has('debug')) window.__stops3d = { stops, scene };

  let renderer = null;
  let repaintTimer = 0;
  const right = new THREE.Vector3();
  const forward = new THREE.Vector3();

  function animate(now) {
    const t = now / 1000;
    const bearing = (map.getBearing() * Math.PI) / 180;
    const lookDown = Math.PI / 2 - (map.getPitch() * Math.PI) / 180;
    right.set(Math.cos(bearing), 0, Math.sin(bearing));
    forward.set(Math.sin(bearing), 0, -Math.cos(bearing));
    // Zoomed out, the stops shrink less than the map, so they stay readable.
    const zoomSize = Math.min(2.5, Math.max(0.85, 2 ** ((PLAY_ZOOM - map.getZoom()) * 0.6)));

    // Far stops first, so nearer ones are drawn over them.
    const ordered = [...stops.values()].sort((a, b) => b.at.dot(forward) - a.at.dot(forward));
    ordered.forEach((s, i) => {
      const { p } = s;
      s.shown += (s.shownTarget - s.shown) * 0.15;
      if (Math.abs(s.shownTarget - s.shown) < 0.01) s.shown = s.shownTarget;
      const visible = s.shown > 0.01;
      p.card.visible = p.ground.visible = visible;
      if (!visible) return;
      const near = s.state === 'near';
      const done = s.state === 'done';
      s.near += ((near ? 1 : 0) - s.near) * 0.12;
      // Springy change of size between the states, like the old CSS transition.
      s.scale += (STATE_SCALE[s.state] - s.scale) * 0.14;
      const k = PX * zoomSize * s.scale * (0.3 + 0.7 * s.shown);

      // The card faces the camera exactly, like the flat stops did.
      p.card.rotation.set(-lookDown, -bearing, 0, 'YXZ');
      p.card.scale.setScalar(k);
      p.ground.scale.setScalar(k);
      p.shadow.position.copy(right).multiplyScalar(8);

      const phase = t + s.seed;
      const period = near ? 1.6 : done ? 4.5 : 3.2;
      p.pin.position.y = PIN_Y - 2.5 + 2.5 * Math.cos((phase * 2 * Math.PI) / period);
      p.ring.visible = p.glow.visible = s.near > 0.02;
      p.ring.rotation.z = -t * ((2 * Math.PI) / 2.2);
      p.ring.material.opacity = s.near;
      p.glow.material.opacity = s.near * (0.6 + 0.4 * Math.sin((phase * 2 * Math.PI) / 1.6));
      p.glow.scale.setScalar(1 + 0.15 * Math.sin((phase * 2 * Math.PI) / 1.6));
      p.label.visible = s.near > 0.02;
      p.label.material.opacity = s.near;
      p.check.visible = done;
      p.beam.visible = !done && s.near < 0.98;
      p.beam.material.opacity = (0.8 + 0.15 * Math.sin((phase * 2 * Math.PI) / 2.4)) * (1 - s.near);
      p.beam.scale.y = 1 + 0.08 * Math.sin((phase * 2 * Math.PI) / 2.4);

      // The Buddy sways while it waits and hops when it needs you.
      p.buddy.rotation.z = done || near ? 0 : 0.05 * Math.sin((phase * 2 * Math.PI) / 2.8);
      p.buddy.position.y = near ? 6 * Math.abs(Math.sin((phase * Math.PI) / 0.7)) : 0;
      p.help.visible = s.near > 0.02;
      p.help.material.opacity = s.near;
      const wiggle = (phase % 2.4) / 2.4;
      p.help.rotation.z = wiggle > 0.8 ? 0.14 * Math.sin((wiggle - 0.8) * 5 * 2 * Math.PI) * (1 - wiggle) * 5 : 0;
      p.help.scale.setScalar(0.4 + 0.6 * s.near);

      p.ripples.forEach((r, j) => {
        const q = ((t / 1.8) + j * 0.5) % 1;
        r.visible = s.near > 0.02;
        r.scale.setScalar(20 + 45 * q);
        r.material.opacity = (1 - q) * s.near;
      });

      // Draw order: all beams first, then stop by stop from far to near; the Buddy stands in front
      // of its pin, as on the old stops.
      p.beam.renderOrder = i;
      const base = 100 + i * 20;
      [...p.ripples, p.pole, p.glow, p.ring, p.face, p.check, p.label, p.buddy, p.help].forEach((m, j) => (m.renderOrder = base + j));
    });
  }

  window.addEventListener('menuclosed', () => map.triggerRepaint());
  document.addEventListener('visibilitychange', () => !document.hidden && map.triggerRepaint());

  const layer = {
    id: 'stops-3d',
    type: 'custom',
    renderingMode: '3d',
    onAdd(m, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    },
    render(gl, matrix) {
      animate(performance.now());
      projection.fromArray(matrix).multiply(toLocal);
      camera.projectionMatrix.copy(projection);
      camera.projectionMatrixInverse.copy(projection).invert();
      renderer.resetState();
      renderer.render(scene, camera);
      onFrame();
      // The stops are always gently moving. While the camera stands still, 30 frames a second
      // is plenty for that and saves battery; a moving camera repaints every frame anyway.
      // Nothing to animate while a menu covers the map or the app is in the background.
      clearTimeout(repaintTimer);
      if (!document.body.classList.contains('menu-open') && !document.hidden) {
        repaintTimer = setTimeout(() => map.triggerRepaint(), IDLE_FRAME_MS);
      }
    },
  };

  // Screen position (CSS pixels) of a local point, or null when it is behind the camera.
  const clip = new THREE.Vector4();
  function screenOf(point) {
    clip.set(point.x, point.y, point.z, 1).applyMatrix4(projection);
    if (clip.w <= 0) return null;
    const el = map.getCanvas();
    return { x: ((clip.x / clip.w + 1) / 2) * el.clientWidth, y: ((1 - clip.y / clip.w) / 2) * el.clientHeight };
  }
  const pinCentre = (s) => s.p.pin.localToWorld(new THREE.Vector3(0, 0, 0));
  const pinEdge = (s) => s.p.pin.localToWorld(new THREE.Vector3(PIN / 2, 0, 0));

  return {
    layer,
    setState(id, state) {
      const s = stops.get(id);
      if (!s || s.state === state) return;
      s.state = state;
      applyState(s);
    },
    setShown(id, shown) {
      const s = stops.get(id);
      if (s) s.shownTarget = shown ? 1 : 0;
    },
    isShown: (id) => stops.get(id)?.shownTarget === 1,
    // Where the pin is on screen, for the edge pointer.
    screenPoint(id) {
      const s = stops.get(id);
      return s ? screenOf(pinCentre(s)) : null;
    },
    // The stop under a tap: the pin, or the pole and Buddy below it. The nearest one wins.
    hitTest({ x, y }) {
      let best = null;
      for (const s of stops.values()) {
        if (!s.p.card.visible || s.shown < 0.5) continue;
        const centre = screenOf(pinCentre(s));
        const edge = screenOf(pinEdge(s));
        const foot = screenOf(s.at);
        if (!centre || !edge || !foot) continue;
        const r = Math.max(24, Math.hypot(edge.x - centre.x, edge.y - centre.y) + 6);
        const inPin = Math.hypot(x - centre.x, y - centre.y) < r;
        const inStand = x > foot.x - r * 0.5 && x < foot.x + r * 1.2 && y < foot.y + 8 && y > centre.y;
        if ((inPin || inStand) && (!best || foot.y > best.y)) best = { id: s.loc.id, y: foot.y };
      }
      return best?.id ?? null;
    },
  };
}
