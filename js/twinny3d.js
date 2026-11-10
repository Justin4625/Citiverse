// The Digital Twinny as a small 3D figure (Three.js) that stands on the map: same bean shape as
// the Buddies, coloured per stamp like the SVG version, with a walk cycle and an idle breath.
// Loaded on demand; when WebGL or the CDN is unavailable the caller keeps the SVG Twinny.

import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';
import { twinnyStops } from './twinny.js';

const HEIGHT = 2.44; // top of the head, feet at 0
const VISOR = '#c4c8cf';
const NAVY = '#16295c';

// Canvas size in CSS pixels; the marker anchors its bottom (the feet) on the player's position.
export const SIZE = { width: 50, height: 72 };

function colourAt(stops, fromTop) {
  if (fromTop <= stops[0][0]) return new THREE.Color(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    const [o, c] = stops[i];
    if (fromTop <= o) {
      const [po, pc] = stops[i - 1];
      return new THREE.Color(pc).lerp(new THREE.Color(c), (fromTop - po) / (o - po || 1));
    }
  }
  return new THREE.Color(stops.at(-1)[1]);
}

function badgeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = NAVY;
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = g.fillStyle = '#fff';
  g.lineWidth = 11;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(64, 60, 30, 0.2 * Math.PI, 0.8 * Math.PI);
  g.stroke();
  for (const x of [46, 82]) {
    g.beginPath();
    g.arc(x, 48, 7, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds the Twinny into `container` and returns controls, or throws when WebGL is unavailable.
 */
export function createTwinny3D(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(SIZE.width, SIZE.height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, SIZE.width / SIZE.height, 0.1, 50);
  camera.position.set(0, 2.6, 8.6);
  camera.lookAt(0, 1.25, 0);

  scene.add(new THREE.HemisphereLight('#ffffff', '#8a9bb8', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(-3, 5, 4);
  scene.add(sun);

  // Every coloured part shares one material; colours come from vertex colours, set per stamp.
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0 });
  const coloured = [];
  const part = (geometry, parent, pos, scale) => {
    const mesh = new THREE.Mesh(geometry, skin);
    mesh.position.set(...pos);
    if (scale) mesh.scale.set(...scale);
    parent.add(mesh);
    coloured.push(mesh);
    return mesh;
  };

  const figure = new THREE.Group(); // turns to face the walking direction
  const body = new THREE.Group(); // bobs while walking
  figure.add(body);
  scene.add(figure);

  part(new THREE.CapsuleGeometry(0.52, 0.85, 8, 24), body, [0, 1.495, 0]);

  const limb = (x, y, radius, length, parent) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    parent.add(pivot);
    part(new THREE.CapsuleGeometry(radius, length, 6, 14), pivot, [0, -(length / 2 + radius) + radius * 0.6, 0]);
    return pivot;
  };
  const legL = limb(-0.21, 0.62, 0.17, 0.3, figure);
  const legR = limb(0.21, 0.62, 0.17, 0.3, figure);
  const armL = limb(-0.5, 1.7, 0.11, 0.55, body);
  const armR = limb(0.5, 1.7, 0.11, 0.55, body);
  armL.rotation.z = -0.28;
  armR.rotation.z = 0.28;

  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshStandardMaterial({ color: VISOR, roughness: 0.55 }),
  );
  visor.position.set(0, 1.9, 0.26);
  visor.scale.set(0.42, 0.31, 0.31);
  body.add(visor);
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#14171c', roughness: 0.3 });
  for (const x of [-0.11, 0.11]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), eyeMat);
    eye.position.set(x, 1.92, 0.565);
    eye.scale.set(0.035, 0.065, 0.03);
    body.add(eye);
  }
  const badge = new THREE.Mesh(
    new THREE.CircleGeometry(0.15, 32),
    new THREE.MeshStandardMaterial({ map: badgeTexture(), roughness: 0.5 }),
  );
  badge.position.set(0, 1.36, 0.527);
  body.add(badge);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 32),
    new THREE.MeshBasicMaterial({ color: '#0b1a3d', transparent: true, opacity: 0.22, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  scene.add(shadow);

  // Vertex colours follow the height in the figure's rest pose, so a stripe stays on the same
  // part of the body while the limbs swing.
  function setThemes(themes) {
    const stops = twinnyStops(themes);
    scene.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    for (const mesh of coloured) {
      const pos = mesh.geometry.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        colourAt(stops, 1 - Math.min(Math.max(v.y / HEIGHT, 0), 1)).toArray(colors, i * 3);
      }
      mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
  }

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let walking = false;
  let heading = 0; // radians; 0 faces the viewer
  let phase = 0;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    // Turn smoothly towards the walking direction, and back to the viewer when standing.
    const target = walking ? heading : 0;
    const diff = Math.atan2(Math.sin(target - figure.rotation.y), Math.cos(target - figure.rotation.y));
    figure.rotation.y += diff * Math.min(1, dt * 8);

    if (walking && !still) {
      phase += dt * 9;
      const s = Math.sin(phase);
      legL.rotation.x = s * 0.65;
      legR.rotation.x = -s * 0.65;
      armL.rotation.x = -s * 0.55;
      armR.rotation.x = s * 0.55;
      body.position.y = Math.abs(Math.cos(phase)) * 0.07;
      body.rotation.z = s * 0.04;
    } else {
      // Ease the limbs back and breathe.
      for (const l of [legL, legR, armL, armR]) l.rotation.x *= 0.85;
      body.rotation.z *= 0.85;
      body.position.y = still ? 0 : (Math.sin(now / 600) + 1) * 0.012;
      phase = 0;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setThemes,
    /** @param {boolean} on @param {number} [angle] radians, 0 = towards the viewer, + = to the right */
    setWalking(on, angle = heading) {
      walking = on;
      heading = angle;
    },
  };
}
