// "Spoorloos" (Privacy, Rotterdam Centraal, Privy).
// A sneak game on a map of the station. Walk to your train (tap where you want to go, or use the
// arrow keys) before it leaves. There is no clock: you have a budget of steps, and only walking
// and waiting in line use it, so standing still to watch a camera is free. On the way, systems collect data about you: sweeping cameras,
// free wifi that grabs your phone, a shop beacon, a check-in pole that links your trip to your
// name, and a fast gate that scans your face. The private route exists, but it costs steps:
// the ticket machine takes a moment and the normal gate has a queue.
// Score: 10 privacy points minus the weight of every trace you left. Miss the train and you
// score nothing.
// AI: Privy turns your traces into a short profile of you. Without AI he lists them.

import { chat, isAvailable } from '../ai.js';
import { escapeHtml, say, endScreen } from './kit.js';

const W = 360;
const H = 520;
const STEPS = 220;
const STEPS_PER_SECOND = 10; // spent while walking or waiting in line, never while standing still
const SPEED = 72; // map units per second
const PLAYER_R = 9;

const COLORS = {
  floor: '#e4e1da',
  hall: '#f5f3ef',
  ink: '#14171c',
  green: '#00a046',
  orange: '#ff6a13',
  orangeDeep: '#c94c00',
  wifi: '#2b7de9',
  beacon: '#e64fa0',
  muted: '#6d747d',
};

const TRACES = {
  ov: { weight: 3, label: 'Ingecheckt op naam', text: 'Je reis staat op je naam. Het OV-bedrijf weet dus dat je hier vandaag was.' },
  gezicht: { weight: 3, label: 'Gezicht gescand', text: 'Een systeem heeft je gezicht gescand. Een wachtwoord kun je veranderen, je gezicht niet.' },
  wifi: { weight: 2, label: 'Wifi zag je telefoon', text: 'Je telefoon maakte contact met de gratis wifi. Zo kunnen ze je telefoon herkennen, ook als je niet inlogt.' },
  beacon: { weight: 2, label: 'Winkel-beacon', text: 'Een kastje in de winkel (een beacon) zag je telefoon langskomen. Zo houden winkels bij wie er langsloopt, en hoe lang.' },
  cam1: { weight: 1, label: 'Camera ziet je', text: 'Een camera in de gang heeft je gefilmd.' },
  cam2: { weight: 1, label: 'Camera ziet je', text: 'Een camera in de hal heeft je gefilmd.' },
};

const BASE_WALLS = [
  [0, 150, 20, 10],
  [60, 150, 90, 10],
  [210, 150, 150, 10],
  [80, 172, 10, 150], // wall between the side corridor and the hall
  [270, 190, 90, 80], // shop
  [126, 300, 104, 12], // benches
];
const LEFT_GATE = [20, 150, 40, 10];
const FACE_GATE = [150, 150, 60, 10];

const POLE = { x: 215, y: 405, r: 16 };
const MACHINE = { x: 40, y: 430, r: 20, hold: 2.5 };
const QUEUE = { x: 40, y: 180, r: 20, hold: 1.6 };
const SCAN = { x: 180, y: 176, r: 22 };
const WIFI = { x: 180, y: 245, r: 62 };
const BEACON = { x: 268, y: 232, r: 58 };
const CAMERAS = [
  { id: 'cam1', x: 0, y: 248, dir: 0, sweep: 0.9, range: 95, period: 3.4 },
  { id: 'cam2', x: 360, y: 372, dir: Math.PI, sweep: 0.55, range: 150, period: 4.2 },
];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function circleHitsRect(cx, cy, r, [x, y, w, h]) {
  const nx = Math.max(x, Math.min(cx, x + w));
  const ny = Math.max(y, Math.min(cy, y + h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

function inCone(cam, angle, p) {
  const d = Math.hypot(p.x - cam.x, p.y - cam.y);
  if (d > cam.range) return false;
  let a = Math.atan2(p.y - cam.y, p.x - cam.x) - angle;
  a = Math.atan2(Math.sin(a), Math.cos(a));
  return Math.abs(a) < 0.32;
}

async function profile(traces) {
  const reply = await chat(
    [
      {
        role: 'system',
        content:
          'Je bent Privy, stationsmedewerker op Rotterdam Centraal, in een spel voor jongeren over privacy. Je krijgt een lijst datasporen die een reiziger achterliet. ' +
          'Vertel in maximaal drie korte zinnen, in de jij-vorm, wat bedrijven samen uit deze sporen over de reiziger te weten kunnen komen. Een beetje griezelig, maar niet eng. ' +
          'Verzin geen namen, adressen of andere echte gegevens. Praat zoals tegen een tiener: kort en in gewone woorden.',
      },
      { role: 'user', content: traces.map((t) => `- ${t}`).join('\n') },
    ],
    { temperature: 0.7, maxTokens: 140 },
  );
  return reply && reply.length > 20 && reply.length < 600 ? reply : null;
}

export function mount(el, { onFinish, character }) {
  let canvas = null;
  let ctx = null;
  let scale = 1;
  let raf = null;
  let last = 0;
  let destroyed = false;
  let ended = false;
  let keys = new Set();
  let onKeyDown = null;
  let onKeyUp = null;
  let resize = null;

  const state = {
    p: { x: 180, y: 500 },
    target: null,
    time: STEPS,
    t: 0,
    checkedIn: false,
    machineHold: 0,
    queueHold: 0,
    leftOpen: false,
    faceOpen: false,
    traces: new Set(),
    popups: [],
    message: '',
    messageTime: 0,
  };

  function intro() {
    el.innerHTML = `
      <div class="g">
        ${say(character, `<p>Loop naar het perron: tik waar je heen wilt. Je hebt ${STEPS} stappen, daarna is je trein weg. Stilstaan kost niks, lopen en in de rij staan wel. Maar overal in het station verzamelen systemen gegevens over je. Lukt het jou zonder sporen?</p>`)}
        <ul class="legend">
          <li><i class="lg lg--cam"></i><span><strong>Camera</strong> draait heen en weer. Wacht tot hij de andere kant op kijkt.</span></li>
          <li><i class="lg lg--wifi"></i><span><strong>Gratis wifi</strong> ziet je telefoon als je erlangs loopt.</span></li>
          <li><i class="lg lg--beacon"></i><span><strong>Winkel-beacon</strong> houdt bij wie er langsloopt.</span></li>
          <li><i class="lg lg--pole"></i><span><strong>Incheckpaal</strong> is snel, maar dan staat je reis op je naam. Bij de <strong>automaat</strong> koop je een kaartje zonder naam, maar dat duurt even.</span></li>
          <li><i class="lg lg--gate"></i><span><strong>Poort met gezichtsscan</strong> is snel. Bij het gewone poortje staat een rij.</span></li>
        </ul>
        <button class="btn btn--action g__wide" data-go>Start</button>
      </div>`;
    el.querySelector('[data-go]').addEventListener('click', start);
  }

  function start() {
    el.innerHTML = `
      <div class="g sp">
        <div class="g__bar"><span class="sp__time">${STEPS} stappen over</span><span class="sp__traces">0 sporen</span></div>
        <div class="g__meter"><i class="sp__meter" style="width:100%"></i></div>
        <div class="sp__stage"><canvas aria-label="Plattegrond van het station. Tik waar je heen wilt lopen."></canvas></div>
        <p class="g__hint">Tik op de kaart om te lopen, of gebruik de pijltjestoetsen.</p>
      </div>`;
    canvas = el.querySelector('canvas');
    ctx = canvas.getContext('2d');
    resize = () => {
      const w = canvas.parentElement.clientWidth;
      scale = w / W;
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${H * scale}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(H * scale * dpr);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const toMap = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };
    let dragging = false;
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      state.target = toMap(e);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (dragging) state.target = toMap(e);
    });
    canvas.addEventListener('pointerup', () => (dragging = false));
    onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        keys.add(e.key);
        state.target = null;
      }
    };
    onKeyUp = (e) => keys.delete(e.key);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function walls() {
    const list = [...BASE_WALLS];
    if (!state.leftOpen) list.push(LEFT_GATE);
    if (!state.faceOpen) list.push(FACE_GATE);
    return list;
  }

  function addTrace(id) {
    if (state.traces.has(id)) return;
    state.traces.add(id);
    state.popups.push({ text: TRACES[id].label, x: state.p.x, y: state.p.y - 14, age: 0 });
    navigator.vibrate?.(40);
    el.querySelector('.sp__traces').textContent = `${state.traces.size} ${state.traces.size === 1 ? 'spoor' : 'sporen'}`;
  }

  function say_(text) {
    state.message = text;
    state.messageTime = 2.2;
  }

  function update(dt) {
    state.t += dt;
    const p = state.p;

    // Movement: arrow keys, or walk towards the tapped point.
    let vx = 0;
    let vy = 0;
    if (keys.size) {
      vx = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
      vy = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
    } else if (state.target) {
      const dx = state.target.x - p.x;
      const dy = state.target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 2) {
        vx = dx / d;
        vy = dy / d;
      } else state.target = null;
    }
    const len = Math.hypot(vx, vy) || 1;
    const step = SPEED * dt;
    const ws = walls();
    const nx = Math.max(PLAYER_R, Math.min(W - PLAYER_R, p.x + (vx / len) * step));
    if (!ws.some((w) => circleHitsRect(nx, p.y, PLAYER_R, w))) p.x = nx;
    const ny = Math.max(PLAYER_R, Math.min(H - PLAYER_R, p.y + (vy / len) * step));
    if (!ws.some((w) => circleHitsRect(p.x, ny, PLAYER_R, w))) p.y = ny;
    const moving = vx !== 0 || vy !== 0;
    let busy = moving;

    // Check-in: the pole is instant but personal; the machine is anonymous but takes time.
    if (!state.checkedIn && dist(p, POLE) < POLE.r + PLAYER_R) {
      state.checkedIn = true;
      addTrace('ov');
      say_('Ingecheckt met je OV-chipkaart op naam.');
    }
    if (!state.checkedIn && dist(p, MACHINE) < MACHINE.r + 4) {
      state.machineHold += dt;
      busy = true;
      say_('Kaartje zonder naam kopen… blijf staan.');
      if (state.machineHold >= MACHINE.hold) {
        state.checkedIn = true;
        say_('Kaartje gekocht. Niemand weet wie je bent.');
      }
    } else if (!state.checkedIn) state.machineHold = 0;

    // Gates: only open once you have a ticket.
    if (dist(p, SCAN) < SCAN.r + 4) {
      if (!state.checkedIn) say_('Eerst inchecken of een kaartje kopen!');
      else if (!state.faceOpen) {
        state.faceOpen = true;
        addTrace('gezicht');
      }
    }
    if (!state.leftOpen && dist(p, QUEUE) < QUEUE.r + 4) {
      if (!state.checkedIn) say_('Eerst inchecken of een kaartje kopen!');
      else {
        state.queueHold += dt;
        busy = true;
        say_('In de rij voor het poortje… blijf staan.');
        if (state.queueHold >= QUEUE.hold) {
          state.leftOpen = true;
          say_('Het poortje gaat open.');
        }
      }
    } else if (!state.leftOpen) state.queueHold = 0;

    if (dist(p, WIFI) < WIFI.r) addTrace('wifi');
    if (dist(p, BEACON) < BEACON.r) addTrace('beacon');
    for (const cam of CAMERAS) {
      if (inCone(cam, camAngle(cam), p)) addTrace(cam.id);
    }

    state.popups.forEach((q) => (q.age += dt));
    state.popups = state.popups.filter((q) => q.age < 1.6);
    state.messageTime -= dt;

    if (busy) state.time -= STEPS_PER_SECOND * dt;
    const t = el.querySelector('.sp__time');
    if (t) t.textContent = `${Math.max(0, Math.ceil(state.time))} stappen over`;
    const m = el.querySelector('.sp__meter');
    if (m) {
      m.style.width = `${Math.max(0, state.time / STEPS) * 100}%`;
      m.classList.toggle('is-low', state.time < 60);
    }

    if (p.y < 40) return finish(true);
    if (state.time <= 0) return finish(false);
    return moving;
  }

  const camAngle = (cam) => cam.dir + Math.sin((state.t / cam.period) * Math.PI * 2) * cam.sweep;

  function draw() {
    const c = ctx;
    c.clearRect(0, 0, W, H);
    c.fillStyle = COLORS.hall;
    c.fillRect(0, 0, W, H);

    // Platform with tracks.
    c.fillStyle = COLORS.green;
    c.fillRect(0, 0, W, 40);
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 2;
    for (const y of [10, 22]) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.stroke();
    }
    c.fillStyle = '#fff';
    c.font = '800 12px Archivo, system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('PERRON 9 · TREIN VERTREKT', W / 2, 35);
    c.fillStyle = COLORS.floor;
    c.fillRect(0, 40, W, 110);
    c.fillStyle = COLORS.muted;
    c.font = '800 10px Archivo, system-ui, sans-serif';
    c.fillText('PERRONHAL', W / 2, 100);

    // Zones.
    zone(WIFI, COLORS.wifi, 'GRATIS WIFI');
    zone(BEACON, COLORS.beacon, 'BEACON');

    // Cameras and their cones.
    for (const cam of CAMERAS) {
      const a = camAngle(cam);
      const seen = state.traces.has(cam.id);
      c.fillStyle = seen ? 'rgba(201,76,0,0.28)' : 'rgba(255,106,19,0.2)';
      c.beginPath();
      c.moveTo(cam.x, cam.y);
      c.arc(cam.x, cam.y, cam.range, a - 0.32, a + 0.32);
      c.closePath();
      c.fill();
      c.fillStyle = COLORS.ink;
      c.beginPath();
      c.arc(cam.x, cam.y, 7, 0, Math.PI * 2);
      c.fill();
    }

    // Walls.
    c.fillStyle = COLORS.ink;
    for (const [x, y, w, h] of walls()) c.fillRect(x, y, w, h);
    c.fillStyle = '#fff';
    c.font = '800 11px Archivo, system-ui, sans-serif';
    c.fillText('WINKEL', 315, 234);
    c.fillStyle = COLORS.muted;
    c.font = '700 9px Archivo, system-ui, sans-serif';
    c.fillText('BANKJES', 178, 324);

    // Gates.
    gateLabel(SCAN, state.faceOpen ? COLORS.orangeDeep : COLORS.orange, 'SCAN', state.faceOpen);
    gateLabel(QUEUE, COLORS.muted, 'RIJ', state.leftOpen, state.queueHold / QUEUE.hold);

    // Check-in pole and machine.
    point(POLE, COLORS.orange, 'PAAL');
    point(MACHINE, COLORS.green, 'AUTOMAAT', state.checkedIn ? 0 : state.machineHold / MACHINE.hold);

    // Entrance.
    c.fillStyle = COLORS.muted;
    c.font = '700 10px Archivo, system-ui, sans-serif';
    c.fillText('INGANG', 180, H - 4);

    // Target marker.
    if (state.target) {
      c.strokeStyle = COLORS.ink;
      c.lineWidth = 2;
      c.setLineDash([3, 3]);
      c.beginPath();
      c.arc(state.target.x, state.target.y, 8, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }

    // Player.
    const p = state.p;
    c.fillStyle = 'rgba(20,23,28,0.25)';
    c.beginPath();
    c.ellipse(p.x, p.y + 7, 9, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ff5a5f';
    c.strokeStyle = '#fff';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    if (state.checkedIn) {
      c.fillStyle = COLORS.green;
      c.beginPath();
      c.arc(p.x + 8, p.y - 8, 4, 0, Math.PI * 2);
      c.fill();
    }

    // Floating trace labels.
    c.font = '800 11px Archivo, system-ui, sans-serif';
    for (const q of state.popups) {
      c.globalAlpha = Math.max(0, 1 - q.age / 1.6);
      const y = q.y - q.age * 22;
      const w = c.measureText(q.text).width + 12;
      c.fillStyle = COLORS.orangeDeep;
      c.fillRect(q.x - w / 2, y - 12, w, 16);
      c.fillStyle = '#fff';
      c.fillText(q.text, q.x, y);
    }
    c.globalAlpha = 1;

    if (state.messageTime > 0) {
      c.font = '700 12px Archivo, system-ui, sans-serif';
      const w = c.measureText(state.message).width + 20;
      c.fillStyle = 'rgba(20,23,28,0.88)';
      c.fillRect(W / 2 - w / 2, H / 2 - 16, w, 26);
      c.fillStyle = '#fff';
      c.fillText(state.message, W / 2, H / 2 + 2);
    }
  }

  function zone(z, color, label) {
    const c = ctx;
    c.fillStyle = color + '1f';
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.setLineDash([5, 4]);
    c.beginPath();
    c.arc(z.x, z.y, z.r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.setLineDash([]);
    // Pulsing waves.
    const r = 6 + ((state.t * 18) % 18);
    c.globalAlpha = 1 - r / 24;
    c.beginPath();
    c.arc(z.x, z.y, r, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 1;
    c.fillStyle = color;
    c.font = '800 10px Archivo, system-ui, sans-serif';
    c.fillText(label, z.x, z.y + z.r - 8);
  }

  function point(pt, color, label, progress = 0) {
    const c = ctx;
    c.fillStyle = color;
    c.strokeStyle = COLORS.ink;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(pt.x, pt.y, pt.r - 6, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    if (progress > 0) {
      c.strokeStyle = COLORS.green;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(pt.x, pt.y, pt.r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = COLORS.ink;
    c.font = '800 10px Archivo, system-ui, sans-serif';
    c.fillText(label, pt.x, pt.y + pt.r + 10);
  }

  function gateLabel(g, color, label, open, progress = 0) {
    const c = ctx;
    c.fillStyle = color;
    c.font = '800 10px Archivo, system-ui, sans-serif';
    c.fillText(open ? 'OPEN' : label, g.x, g.y + 4);
    if (progress > 0 && !open) {
      c.strokeStyle = COLORS.green;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(g.x, g.y, g.r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      c.stroke();
    }
  }

  function loop(now) {
    if (destroyed || ended) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    if (ended) return;
    draw();
    raf = requestAnimationFrame(loop);
  }

  function cleanup() {
    cancelAnimationFrame(raf);
    if (onKeyDown) document.removeEventListener('keydown', onKeyDown);
    if (onKeyUp) document.removeEventListener('keyup', onKeyUp);
    if (resize) window.removeEventListener('resize', resize);
  }

  async function finish(made) {
    if (ended) return;
    ended = true;
    cleanup();
    const traces = [...state.traces].map((id) => TRACES[id]);
    const weight = traces.reduce((s, t) => s + t.weight, 0);
    const points = made ? Math.max(0, 10 - weight) : 0;
    el.innerHTML = `<div class="g">${say(character, `<p class="g__thinking">${made ? 'Privy kijkt wat ze nu over je weten…' : 'Je trein rijdt weg…'}</p>`)}</div>`;
    const text = made && traces.length && (await isAvailable()) ? await profile(traces.map((t) => t.text)) : null;
    if (destroyed) return;
    const line = !made
      ? 'Je stappen zijn op en je trein is weg! Privé blijven kost moeite. Probeer het nog een keer. Welke sporen vind je het ergst? En welke vind je niet zo erg?'
      : !traces.length
        ? 'Spoorloos! Niemand weet iets over je. En je hebt je trein ook nog gehaald.'
        : text
          ? escapeHtml(text)
          : 'Dit weten ze nu over je. Eén spoor lijkt niet erg. Maar alles bij elkaar zegt het veel over jou.';
    endScreen(el, {
      big: made ? `${points}/10` : 'Gemist',
      sub: made ? 'privacypunten' : 'De trein is vertrokken',
      character,
      line,
      extra: `${traces.length ? `<ul class="traces">${traces.map((t) => `<li class="w${t.weight}">${escapeHtml(t.text)}</li>`).join('')}</ul>` : ''}
        ${text ? '<p class="g__ai">Een AI heeft dit verhaal gemaakt uit jouw sporen. Bedrijven doen dat in het echt ook.</p>' : ''}
        <p class="g__hint">Je laat overal sporen achter. Alles ontwijken lukt niet, maar je kunt wel kiezen. Je gezicht en reizen op je naam zijn het gevoeligst. Zet ook je wifi uit als je die niet gebruikt.</p>`,
      onDone: () => onFinish({ correct: points, total: 10, summary: 'privacypunten' }),
    });
  }

  intro();
  return () => {
    destroyed = true;
    cleanup();
  };
}
