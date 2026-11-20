// Bản có giao diện: lõi sim chạy 60 tick/giây cố định, Three.js chỉ đọc trạng thái để vẽ.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createSim } from '../sim/sim.js';
import { TPS, TUNING, C } from '../sim/config.js';
import { buildWorld } from './world.js';
import { makePlayer, makeLantern, makeShade, makeMotes, makeFx } from './actors.js';
import { makeAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('ddl.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ddl.' + k, JSON.stringify(v)); } catch { /* bỏ qua */ } },
};

// ---------- renderer
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 2000);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.8);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- thế giới
const world = buildWorld(scene);
const audio = makeAudio();
audio.setVolume(store.get('vol', 0.8));
let sens = store.get('sens', 1);

let sim = null;
let lanternViews = [];
const shadeViews = new Map();
const player = makePlayer(scene);
const motesView = makeMotes(scene);
const fx = makeFx(scene);

function newSim(backdrop = false) {
  for (const v of shadeViews.values()) v.dispose();
  shadeViews.clear();
  const seed = backdrop ? 7 : (Date.now() & 0x7fffffff);
  sim = createSim({
    seed, night: 1,
    scenario: backdrop ? { lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }, { id: 'L5', lit: true }], shades: [{ id: 'S1', pos: [-18, 1, 26] }, { id: 'S2', pos: [28, 1, -12] }] } : null,
  });
  if (!lanternViews.length) lanternViews = sim.s.lanterns.map((l) => makeLantern(scene, l));
  prevPos = [...sim.s.player.pos];
  stats = { motes: 0, lit: 0, stuns: 0 };
}

// ---------- điều khiển
const keys = new Set();
const tapped = new Set();
const btn = { jump: false, interact: false, pulse: false, dash: false };
let mouseRight = false;
let camYaw = 0, camPitch = 0.5, camDist = 9.5;
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  tapped.add(e.code); // giữ lần bấm tới tick kế tiếp, để bấm nhanh không bị mất
  if (e.code === 'KeyE' && mode === 'play') interactHint();
  if (e.code === 'KeyM') audio.setVolume(audio.volume > 0 ? 0 : store.get('vol', 0.8) || 0.8);
  if ((e.code === 'Escape' || e.code === 'KeyP') && mode === 'play') setMode('paused');
  else if ((e.code === 'KeyP') && mode === 'paused') setMode('play');
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); mouseRight = false; if (mode === 'play') setMode('paused'); });
canvas.addEventListener('mousedown', (e) => {
  if (mode !== 'play') return;
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.()?.catch?.(() => {});
  if (e.button === 2) mouseRight = true;
});
window.addEventListener('mouseup', (e) => { if (e.button === 2) mouseRight = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas || mode !== 'play') return;
  camYaw -= e.movementX * 0.0024 * sens;
  camPitch = THREE.MathUtils.clamp(camPitch + e.movementY * 0.0018 * sens, -0.1, 1.15);
});
window.addEventListener('wheel', (e) => { camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.005, 5, 14); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && mode === 'play' && lockedOnce) setMode('paused');
  if (document.pointerLockElement === canvas) lockedOnce = true;
});
let lockedOnce = false;

function readInput() {
  const k = (c) => keys.has(c) || tapped.has(c);
  let x = 0, z = 0;
  if (k('KeyW') || k('ArrowUp')) z += 1;
  if (k('KeyS') || k('ArrowDown')) z -= 1;
  if (k('KeyA') || k('ArrowLeft')) x += 1; // +x là bên trái camera (trục Y hướng lên, nhìn về +Z)
  if (k('KeyD') || k('ArrowRight')) x -= 1;
  btn.jump = k('Space');
  btn.interact = k('KeyE');
  btn.pulse = k('KeyF') || mouseRight;
  btn.dash = k('ShiftLeft') || k('ShiftRight');
  tapped.clear();
  return { move: [x, z], cam_yaw_deg: (camYaw * 180) / Math.PI, ...btn };
}

// Phản hồi khi bấm E mà không nạp được (chỉ hiển thị, không đổi luật).
function nearestUnlit() {
  const P = sim.s.player;
  let best = null, bd = Infinity;
  for (const l of sim.s.lanterns) {
    if (l.lit) continue;
    const d = Math.hypot(P.pos[0] - l.pos[0], P.pos[2] - l.pos[2]);
    if (d < bd) { best = l; bd = d; }
  }
  return { l: best, d: bd };
}
function interactHint() {
  const { l, d } = nearestUnlit();
  if (!l) return;
  if (d > TUNING.interact_radius) {
    if (d < 6) toast(`Lại gần cột đèn hơn (còn ${(d - TUNING.interact_radius).toFixed(1)} m)`);
  } else if (sim.s.player.carried === 0) {
    toast('Chưa mang đom đóm nào — hãy đi gom đom đóm trước', true);
  }
}

// ---------- chế độ màn hình
let mode = 'loading';
let introT = 0, resultT = 0;
function setMode(m) {
  mode = m;
  $('title').classList.toggle('hidden', m !== 'title');
  $('intro').classList.toggle('hidden', m !== 'intro');
  $('pause').classList.toggle('hidden', m !== 'paused');
  $('result').classList.toggle('hidden', m !== 'result');
  $('hud').classList.toggle('hidden', !['play', 'paused', 'intro', 'ending'].includes(m));
  if (m === 'paused' || m === 'result' || m === 'title') { if (document.pointerLockElement) document.exitPointerLock(); keys.clear(); mouseRight = false; }
  if (m === 'play') { canvas.requestPointerLock?.()?.catch?.(() => {}); }
}
function startNight() {
  audio.unlock();
  newSim(false);
  camYaw = 0; camPitch = 0.5;
  lockedOnce = false;
  introT = 0;
  setMode('intro');
}
$('btnStart').onclick = startNight;
$('btnResume').onclick = () => setMode('play');
$('btnRestart').onclick = startNight;
$('btnAgain').onclick = startNight;
$('btnMenu').onclick = $('btnMenu2').onclick = () => { newSim(true); setMode('title'); };
$('vol').value = store.get('vol', 0.8);
$('vol').oninput = (e) => { audio.setVolume(+e.target.value); store.set('vol', +e.target.value); };
$('sens').value = sens;
$('sens').oninput = (e) => { sens = +e.target.value; store.set('sens', sens); };

// ---------- HUD
const flamesEl = $('flames'), motesEl = $('motes');
for (let i = 0; i < TUNING.flames; i++) flamesEl.appendChild(Object.assign(document.createElement('div'), { className: 'flame' }));
for (let i = 0; i < TUNING.carry_capacity; i++) motesEl.appendChild(Object.assign(document.createElement('div'), { className: 'mote' }));
let toastTimer = 0;
function toast(text, bad = false) {
  const el = $('toast');
  el.textContent = text;
  el.className = 'toast show' + (bad ? ' bad' : '');
  toastTimer = 2.4;
}
const CIRC = 106.8;
function setCd(el, frac, usable) {
  el.querySelector('.fg').style.strokeDashoffset = String(CIRC * frac);
  el.classList.toggle('cooling', frac > 0);
  el.classList.toggle('ready', frac === 0 && usable);
  el.classList.toggle('nofuel', frac === 0 && !usable);
}
let lastSec = -1;
function updateHud(dt) {
  const s = sim.s, P = s.player;
  [...flamesEl.children].forEach((f, i) => f.classList.toggle('off', i >= P.flames));
  const sec = Math.ceil(s.timeLeft / TPS);
  $('timer').textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  $('timer').classList.toggle('danger', sec <= 30);
  if (mode === 'play' && sec <= 10 && sec !== lastSec && sec > 0) audio.tick();
  lastSec = sec;
  const lit = s.lanterns.filter((l) => l.lit).length;
  $('lanterns').textContent = `${lit}/${s.lanterns.length}`;
  $('score').textContent = s.score;
  [...motesEl.children].forEach((m, i) => m.classList.toggle('on', i < P.carried));
  setCd($('cdDash'), P.dashCd / C.dash_cd_ticks, true);
  setCd($('cdPulse'), P.pulseCd / C.pulse_cd_ticks, P.carried >= TUNING.pulse_cost);
  // nhắc nạp đèn
  let near = null, nd = Infinity;
  for (const l of s.lanterns) {
    if (l.lit) continue;
    const d = Math.hypot(P.pos[0] - l.pos[0], P.pos[2] - l.pos[2]);
    if (d <= TUNING.interact_radius && d < nd) { near = l; nd = d; }
  }
  $('prompt').classList.toggle('hidden', !near);
  if (near) $('promptN').textContent = P.carried > 0 ? `(${near.deposited}/${TUNING.lantern_cost})` : `(${near.deposited}/${TUNING.lantern_cost}) — cần đom đóm`;
  // mũi tên chỉ tới đèn chưa sáng gần nhất khi ngoài màn hình
  let target = null, td = Infinity;
  for (const l of s.lanterns) {
    if (l.lit) continue;
    const d = Math.hypot(P.pos[0] - l.pos[0], P.pos[2] - l.pos[2]);
    if (d < td) { target = l; td = d; }
  }
  const arrow = $('arrow');
  if (target && mode === 'play') {
    const v = new THREE.Vector3(target.pos[0], 3, target.pos[2]).project(camera);
    const behind = v.z > 1;
    const off = behind || Math.abs(v.x) > 0.92 || Math.abs(v.y) > 0.88;
    arrow.classList.toggle('hidden', !off);
    if (off) {
      let x = v.x, y = v.y;
      if (behind) { x = -x; y = -y; }
      const a = Math.atan2(y, x);
      const m = 0.86;
      const k = Math.min(m / Math.abs(Math.cos(a) || 1e-6), m / Math.abs(Math.sin(a) || 1e-6));
      const sx = (Math.cos(a) * k * 0.5 + 0.5) * window.innerWidth, sy = (-Math.sin(a) * k * 0.5 + 0.5) * window.innerHeight;
      arrow.style.left = `${sx}px`; arrow.style.top = `${sy}px`;
      arrow.firstElementChild.style.transform = `rotate(${-a}rad)`;
    }
  } else arrow.classList.add('hidden');
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('show'); }
}

// ---------- sự kiện sim → hình & tiếng
let stats = { motes: 0, lit: 0, stuns: 0 };
let shake = 0;
function handleEvents(events) {
  const P = sim.s.player;
  for (const e of events) {
    switch (e.name) {
      case 'mote_picked': audio.pickup(); fx.burst([P.pos[0], P.pos[1] + 1, P.pos[2]], 0xffe58a, 8, 2); break;
      case 'deposit': {
        stats.motes += e.data.amount; audio.deposit();
        const l = sim.s.lanterns.find((x) => x.id === e.data.lantern_id);
        fx.burst([l.pos[0], 2.5, l.pos[2]], 0xffd27a, 14, 3);
        break;
      }
      case 'lantern_lit': {
        stats.lit++; audio.lit();
        const l = sim.s.lanterns.find((x) => x.id === e.data.lantern_id);
        fx.burst([l.pos[0], 3.2, l.pos[2]], 0xffb347, 60, 6);
        const left = sim.s.lanterns.filter((x) => !x.lit).length;
        toast(left ? `Một ngọn đèn đã sáng — còn ${left}` : 'Cả đảo bừng sáng!');
        break;
      }
      case 'pulse': stats.stuns += e.data.stunned_ids.length; fx.pulse(P.pos); audio.pulse(); break;
      case 'player_hit': audio.hit(); shake = 1; flash(); if (e.data.by === 'fall') toast('Mây rơi xuống biển mây…', true); break;
      case 'shade_spawned': audio.spawn(); if (mode === 'play') toast('Bóng Mực trồi lên từ sương', true); break;
      case 'dash': audio.dash(); break;
      case 'game_over':
        setMode('ending');
        resultT = 1.6;
        if (e.data.result === 'won') audio.win(); else audio.lose();
        break;
    }
  }
}
function flash() {
  const el = $('hitflash');
  el.style.transition = 'none'; el.style.opacity = '1';
  requestAnimationFrame(() => { el.style.transition = 'opacity 0.6s ease-out'; el.style.opacity = '0'; });
}
function showResult() {
  const s = sim.s, won = s.state === 'won';
  $('result').querySelector('.panel').classList.toggle('lost', !won);
  $('resEyebrow').textContent = won ? 'Bình minh lên' : 'Đêm vẫn còn dài';
  $('resTitle').textContent = won ? 'Đảo Bến đã sáng!' : (s.player.flames <= 0 ? 'Ngọn lửa đã tắt' : 'Trời sáng mà đèn chưa đủ');
  $('resText').textContent = won ? 'Năm ngọn Đèn Lồng Lớn lại rực sáng giữa biển mây. Ông Đăng mỉm cười.' : 'Lũ Bóng Mực vẫn còn lẩn trong sương. Thử lại nhé, Mây.';
  $('resScore').textContent = s.score;
  const base = stats.motes * TUNING.score.per_mote + stats.lit * TUNING.score.per_lantern + stats.stuns * TUNING.score.per_stun;
  const rows = [
    ['Đom đóm nạp vào đèn', `${stats.motes} × ${TUNING.score.per_mote}`],
    ['Đèn được thắp', `${stats.lit} × ${TUNING.score.per_lantern}`],
    ['Bóng Mực bị xua', `${stats.stuns} × ${TUNING.score.per_stun}`],
  ];
  if (won) rows.push(['Thưởng thời gian & Ngọn Lửa', `+${s.score - base}`]);
  $('resGrid').innerHTML = rows.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
  setMode('result');
}

// ---------- vòng lặp
const clock = new THREE.Clock();
let acc = 0, t = 0;
let prevPos = [0, 0, 0];
const camPos = new THREE.Vector3(0, 12, -14), camLook = new THREE.Vector3();
let wasGrounded = true;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  t += dt;
  const s = sim.s;

  if (mode === 'intro') {
    introT += dt;
    if (introT > 3.6) setMode('play');
  }
  if (mode === 'play') {
    acc += dt;
    while (acc >= 1 / TPS) {
      prevPos = [...s.player.pos];
      wasGrounded = s.player.grounded;
      sim.step(readInput());
      if (wasGrounded && !s.player.grounded && s.player.vel[1] > 5) audio.jump();
      handleEvents(sim.drainEvents());
      acc -= 1 / TPS;
      if (mode !== 'play') break;
    }
  } else acc = 0;
  if (mode === 'ending') { resultT -= dt; if (resultT <= 0) showResult(); }

  const alpha = mode === 'play' ? acc * TPS : 1;
  const P = s.player;
  const ip = [0, 1, 2].map((i) => prevPos[i] + (P.pos[i] - prevPos[i]) * alpha);
  const progress = s.lanterns.filter((l) => l.lit).length / s.lanterns.length;
  world.update(t, progress);
  player.root.visible = mode !== 'title';
  player.update(dt, t, P, ip);
  lanternViews.forEach((v, i) => v.update(dt, t, s.lanterns[i]));
  const pv = new THREE.Vector3(ip[0], ip[1], ip[2]);
  const alive = new Set();
  for (const sh of s.shades) {
    alive.add(sh.id);
    let v = shadeViews.get(sh.id);
    if (!v) { v = makeShade(scene); shadeViews.set(sh.id, v); }
    v.update(dt, t, sh, pv);
  }
  for (const [id, v] of shadeViews) if (!alive.has(id)) { v.dispose(); shadeViews.delete(id); }
  motesView.update(t, s.motes);
  fx.update(dt);

  // camera
  if (mode === 'title' || mode === 'loading') {
    const a = t * 0.045;
    camPos.set(Math.cos(a) * 58, 17 + Math.sin(t * 0.2) * 2, Math.sin(a) * 58);
    camLook.set(0, 2, 0);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  } else {
    const fwd = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
    const target = new THREE.Vector3(ip[0], Math.max(ip[1], -2) + 1.5, ip[2]);
    const introK = mode === 'intro' ? Math.max(0, 1 - introT / 3.2) : 0;
    const dist = camDist + introK * 22;
    const pitch = camPitch + introK * 0.5;
    const desired = target.clone().addScaledVector(fwd, -dist * Math.cos(pitch));
    desired.y += dist * Math.sin(pitch);
    desired.y = Math.max(desired.y, 0.6);
    camPos.lerp(desired, Math.min(1, dt * (mode === 'intro' ? 3 : 10)));
    camLook.lerp(target, Math.min(1, dt * 12));
    camera.position.copy(camPos);
    shake = Math.max(0, shake - dt * 2.5);
    if (shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake * 0.5, (Math.random() - 0.5) * shake * 0.5, 0));
    camera.lookAt(camLook);
  }
  if (mode !== 'title' && mode !== 'loading') updateHud(dt);
  composer.render();
}

newSim(true);
setMode('loading');
requestAnimationFrame(frame);
setTimeout(() => {
  $('loading').style.opacity = '0';
  setTimeout(() => $('loading').remove(), 800);
  setMode('title');
}, 600);

// cho phép kiểm tra nhanh trong console
window.__ddl = { get sim() { return sim; }, get mode() { return mode; }, setMode };
