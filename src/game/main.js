// Bản có giao diện: lõi sim chạy 60 tick/giây cố định, Three.js chỉ đọc trạng thái để vẽ.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createSim } from '../sim/sim.js';
import { TPS, TUNING, C, NIGHTS } from '../sim/config.js';
import { buildWorld, groundAt } from './world.js';
import { makePlayer, makeLantern, makeShade, makeMotes, makeFx, makeDrifter, makeCharm, makeWindFx, ACCESS, flushShadeSmoke } from './actors.js';
import { FUEL_UNIT } from '../sim/config.js';
import { makeAudio } from './audio.js';
import { ACTIONS, DEFAULT_KEYS, keyName, loadKeys, duplicates, codesFor } from './controls.js';
import { loadBoard, saveScore } from './scores.js';
import { validName, isoWithOffset } from '../leaderboard.js';
import { benchScenario, benchCamera, BENCH } from '../sim/bench.js';
import { CHAPTERS, CARDS, CARD_IDS, MONSTERS } from '../sim/story.js';
import { PROLOGUE, CHAPTER_TEXT, ENDING, MONSTER_ICON } from './storytext.js';

const LOW_U = TUNING.low_fuel_threshold * FUEL_UNIT, MAX_U = TUNING.fuel_max * FUEL_UNIT;
const litNeeded = (n) => Math.ceil(TUNING.win_ratio * n);
const params = new URLSearchParams(location.search);
const BENCH_MODE = params.get('bench') === '1';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('ddl.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ddl.' + k, JSON.stringify(v)); } catch { /* bỏ qua */ } },
};

// ---------- renderer
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(BENCH_MODE ? 1 : Math.min(window.devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 2400);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.8);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  // cảnh benchmark luôn vẽ đúng 1280×720
  const w = BENCH_MODE ? 1280 : window.innerWidth, h = BENCH_MODE ? 720 : window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- thế giới
const world = buildWorld(scene, renderer);
const audio = makeAudio();
audio.setVolume(store.get('vol', 0.8));
let sens = store.get('sens', 1);

let sim = null;
let night = 1, builtNight = 0;
let lanternViews = [], charmViews = [];
const shadeViews = new Map(), drifterViews = new Map();
const player = makePlayer(scene);
const motesView = makeMotes(scene);
const fx = makeFx(scene);
const windFx = makeWindFx(scene);
let run = { total: 0, nights: [], seed: 0, saved: false }; // tổng điểm các Đêm đã thắng

const QUOTES = {
  1: '“Mây ơi, năm ngọn đèn quanh bến đã tắt cả rồi. Mười đốm đom đóm thắp một đèn, nhưng đèn sẽ cạn dầu: nhớ quay lại châm thêm. Giữ ít nhất ba ngọn sáng tới bình minh nhé.”',
  2: '“Đảo Cau là hai hòn nối nhau bằng cây cầu tre không tay vịn, bước cho vững. Bục đá phù văn sẽ bắn con sang đảo bên kia. Coi chừng Gió Lạc: chúng thích cướp đom đóm của ai mang nhiều.”',
  3: '“Ngọn đèn cao nhất đứng cạnh tháp chuông. Lên tầng bằng hai con dốc, hoặc nhờ bục nhảy. Gió mạnh thổi từng cơn; thấy lá bay là sắp có gió, con nhé.”',
};

function buildNightViews(n) {
  const map = NIGHTS[n];
  if (builtNight !== n) {
    world.setNight(map);
    builtNight = n;
  }
  lanternViews.forEach((v) => v.dispose());
  charmViews.forEach((v) => v.dispose());
  lanternViews = map.lanterns.map((l) => {
    let best = map.islands[0];
    for (const i of map.islands) if (Math.hypot(l.pos[0] - i.c[0], l.pos[2] - i.c[1]) < Math.hypot(l.pos[0] - best.c[0], l.pos[2] - best.c[1])) best = i;
    return makeLantern(scene, l, best.c);
  });
  charmViews = map.charms.map((c) => makeCharm(scene, c));
  player.setGround((x, z) => groundAt(map, x, z));
}

function newSim(n, backdrop = false, story = null) {
  for (const v of shadeViews.values()) v.dispose();
  shadeViews.clear();
  for (const v of drifterViews.values()) v.dispose();
  drifterViews.clear();
  night = n;
  buildNightViews(n);
  const seed = backdrop ? 7 : (Date.now() & 0x7fffffff);
  if (!backdrop && !run.seed) run.seed = seed;
  sim = createSim({
    seed, night: n, story,
    scenario: backdrop ? { lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }, { id: 'L5', lit: true }], shades: [{ id: 'S1', pos: [-18, 1, 26] }, { id: 'S2', pos: [28, 1, -12] }] } : null,
  });
  sim.drainEvents();
  prevPos = [...sim.s.player.pos];
  stats = { motes: 0, lit: 0, relit: 0, stuns: 0 };
  lastLaunch = 0; windWarned = false;
  lowWarned = new Set(); drainWarned = new Set();
  $('nightName').textContent = story ? `Chương ${n} · ${NIGHTS[n].name}` : `Đêm ${n} · ${NIGHTS[n].name}`;
  renderCardStrip();
}

// ---------- điều khiển
const keys = new Set();
const tapped = new Set();
const btn = { jump: false, interact: false, pulse: false, dash: false, ability: false };
let mouseRight = false;
let camYaw = 0, camPitch = 0.5, camDist = 9.5;
let KEYS = loadKeys(store.get('keys', null));
const isAct = (code, a) => codesFor(KEYS, a).includes(code);
let capture = null; // hành động đang chờ nhấn phím mới
window.addEventListener('keydown', (e) => {
  if (capture) { e.preventDefault(); finishCapture(e.code); return; }
  if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'range') return;
  if (e.repeat) return;
  keys.add(e.code);
  tapped.add(e.code); // giữ lần bấm tới tick kế tiếp, để bấm nhanh không bị mất
  if (isAct(e.code, 'interact') && mode === 'play') interactHint();
  if (e.code === 'KeyM' && !Object.values(KEYS).includes('KeyM')) audio.setVolume(audio.volume > 0 ? 0 : store.get('vol', 0.8) || 0.8);
  if (isAct(e.code, 'pause') && mode === 'play') setMode('paused');
  else if (isAct(e.code, 'pause') && mode === 'paused' && e.code !== 'Escape') setMode('play');
  if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code) && mode === 'play') e.preventDefault();
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
window.addEventListener('wheel', (e) => { camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.005, 5, 16); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && mode === 'play' && lockedOnce) setMode('paused');
  if (document.pointerLockElement === canvas) lockedOnce = true;
});
let lockedOnce = false;

function readInput() {
  const k = (a) => codesFor(KEYS, a).some((c) => keys.has(c) || tapped.has(c));
  let x = 0, z = 0;
  if (k('up')) z += 1;
  if (k('down')) z -= 1;
  if (k('left')) x += 1; // +x là bên trái camera (trục Y hướng lên, nhìn về +Z)
  if (k('right')) x -= 1;
  btn.jump = k('jump');
  btn.interact = k('interact');
  btn.pulse = k('pulse') || mouseRight;
  btn.dash = k('dash');
  btn.ability = k('ability');
  tapped.clear();
  return { move: [x, z], cam_yaw_deg: (camYaw * 180) / Math.PI, ...btn };
}

// Đèn mà phím E sẽ tác động: giống luật sim (chưa sáng, hoặc sáng mà chưa đầy dầu và đang mang đom đóm).
function refuelNeed(l) { return Math.ceil((MAX_U - l.fuel) / (TUNING.fuel_per_mote * FUEL_UNIT)); }
function interactTarget() {
  const P = sim.s.player;
  let best = null, bd = Infinity;
  for (const l of sim.s.lanterns) {
    if (l.lit && Math.min(P.carried, refuelNeed(l)) === 0) continue;
    const d = Math.hypot(P.pos[0] - l.pos[0], P.pos[2] - l.pos[2]);
    if (d <= TUNING.interact_radius && (d < bd || (d === bd && l.id < best.id))) { best = l; bd = d; }
  }
  return best;
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
  if (interactTarget()) return;
  const P = sim.s.player;
  const litNear = sim.s.lanterns.find((x) => x.lit && Math.hypot(P.pos[0] - x.pos[0], P.pos[2] - x.pos[2]) <= TUNING.interact_radius);
  if (litNear) { toast(P.carried === 0 ? 'Cần đom đóm để châm dầu' : 'Đèn đã đầy dầu'); return; }
  const { l, d } = nearestUnlit();
  if (!l) return;
  if (d > TUNING.interact_radius) {
    if (d < 6) toast(`Lại gần cột đèn hơn (còn ${(d - TUNING.interact_radius).toFixed(1)} m)`);
  } else if (sim.s.player.carried === 0) {
    toast('Chưa mang đom đóm nào. Hãy đi gom đom đóm trước', true);
  }
}

// ---------- chế độ màn hình
let mode = 'loading';
let introT = 0, resultT = 0;
const SCREENS = ['title', 'intro', 'pause', 'result', 'dawn', 'settings', 'board', 'chapters', 'cardpick'];
let settingsFrom = 'title';
function setMode(m) {
  mode = m;
  const show = { title: 'title', intro: 'intro', paused: 'pause', result: 'result', dawn: 'dawn', settings: 'settings', board: 'board', chapters: 'chapters', cardpick: 'cardpick' }[m];
  for (const id of SCREENS) $(id).classList.toggle('hidden', id !== show);
  $('hud').classList.toggle('hidden', !['play', 'paused', 'intro', 'ending', 'settings'].includes(m) || (m === 'settings' && settingsFrom === 'title'));
  if (!['play', 'intro', 'ending'].includes(m)) { if (document.pointerLockElement) document.exitPointerLock(); keys.clear(); mouseRight = false; }
  if (m === 'play') { canvas.requestPointerLock?.()?.catch?.(() => {}); }
}
function startNight(n) {
  audio.unlock();
  storyRun = null;
  $('introLead').classList.add('hidden'); $('introTip').classList.add('hidden');
  newSim(n, false);
  world.setDayNow(0);
  camYaw = 0; camPitch = 0.5;
  lockedOnce = false;
  introT = 0;
  $('introEyebrow').textContent = `Đêm ${n}`;
  $('introTitle').textContent = NIGHTS[n].name;
  $('introQuote').textContent = QUOTES[n];
  setMode('intro');
}
function startRun(n) { run = { total: 0, nights: [], seed: 0, saved: false }; startNight(n); }
$('btnStart').onclick = () => startRun(1);
document.querySelectorAll('[data-night]').forEach((b) => { b.onclick = () => startRun(+b.dataset.night); });
$('btnResume').onclick = () => setMode('play');
$('btnRestart').onclick = () => (storyRun ? startChapter(storyRun.chapter) : startNight(night));
$('btnAgain').onclick = () => {
  if (storyRun) { startChapter(storyRun.chapter); return; } // Cốt truyện: thua thì chơi lại chương
  if (sim.s.state === 'won' && night < 3) startNight(night + 1);
  else startNight(night);
};
const toMenu = () => { storyRun = null; newSim(1, true); setMode('title'); };

// ---------- Chế độ Cốt truyện: 5 chương mở khóa lần lượt, thẻ năng lực giữ qua các chương
let storyRun = null;
const STORY_DEFAULT = { unlocked: 1, done: [], cards: [], total: 0, scores: {} };
let storyProg = { ...STORY_DEFAULT, ...store.get('story', {}) };
const saveStory = () => store.set('story', storyProg);
function renderChapters() {
  $('prologue').textContent = PROLOGUE;
  $('chapterList').innerHTML = [1, 2, 3, 4, 5].map((n) => {
    const ch = CHAPTERS[n], locked = n > storyProg.unlocked, done = storyProg.done.includes(n);
    const mon = Object.keys(ch.monsters).concat(ch.boss ? ['boss'] : []).map((k) => `<span title="${MONSTERS[k].name}">${MONSTER_ICON[k]}</span>`).join(' ');
    return `<button class="chap${done ? ' done' : ''}" data-ch="${n}" ${locked ? 'disabled' : ''}><b>Chương ${n}</b><span class="isl">${NIGHTS[n].name}</span><span>${ch.title}</span><span class="mon">${locked ? '🔒 Chưa mở' : mon}</span></button>`;
  }).join('');
  $('chapterList').querySelectorAll('[data-ch]').forEach((b) => { b.onclick = () => startChapter(+b.dataset.ch); });
  $('ownedCards').innerHTML = storyProg.cards.length ? 'Thẻ đang có: ' + storyProg.cards.map((id) => `<span>${CARDS[id].icon} ${CARDS[id].name}</span>`).join('') : 'Chưa có thẻ năng lực. Thắng một chương để nhận thẻ.';
}
function startChapter(n) {
  audio.unlock();
  storyRun = { chapter: n };
  newSim(n, false, { cards: storyProg.cards });
  world.setDayNow(0);
  camYaw = 0; camPitch = 0.5; lockedOnce = false; introT = -2.5; // lời dẫn dài hơn: giữ màn giới thiệu lâu hơn
  const tx = CHAPTER_TEXT[n];
  $('introEyebrow').textContent = `Chương ${n} · ${CHAPTERS[n].title}`;
  $('introTitle').textContent = NIGHTS[n].name;
  $('introLead').textContent = tx.lead; $('introLead').classList.remove('hidden');
  $('introQuote').textContent = tx.quote;
  $('introTip').textContent = tx.tip; $('introTip').classList.remove('hidden');
  setMode('intro');
}
function renderCardStrip() {
  const cards = sim?.s.story?.cards ?? [];
  $('cardStrip').classList.toggle('hidden', cards.length === 0);
  const act = sim?.s.story?.mods.active;
  $('cardStrip').innerHTML = cards.map((id) => `<span class="${id === act ? 'act' : ''}" title="${CARDS[id].text}">${CARDS[id].icon} ${CARDS[id].name}</span>`).join('');
  $('cdAbility').classList.toggle('hidden', !act);
  // tên thẻ đầy đủ đã hiện ở dải thẻ; nhãn dưới ô Q giữ ngắn để không đè nhãn bên cạnh
}
function showCardPick(done) {
  const pool = CARD_IDS.filter((id) => !storyProg.cards.includes(id));
  const opts = [];
  while (opts.length < 3 && pool.length) opts.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  $('pickEyebrow').textContent = `Chương ${done} hoàn thành`;
  $('pickKey').textContent = keyName(KEYS.ability);
  $('cardOptions').innerHTML = opts.map((id) => { const c = CARDS[id]; return `<button class="pcard" data-card="${id}"><span class="ic">${c.icon}</span><b>${c.name}</b><span class="kd">${c.kind === 'active' ? 'Chủ động · ' + keyName(KEYS.ability) : 'Thụ động'}</span><small>${c.text}</small></button>`; }).join('');
  $('cardOptions').querySelectorAll('[data-card]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.card;
      // chỉ giữ một thẻ chủ động: thẻ chủ động mới thay thẻ cũ
      if (CARDS[id].kind === 'active') storyProg.cards = storyProg.cards.filter((c) => CARDS[c].kind !== 'active');
      storyProg.cards.push(id);
      saveStory();
      startChapter(done + 1);
    };
  });
  setMode('cardpick');
}
function storyResult() {
  const s = sim.s, won = s.state === 'won', n = storyRun.chapter;
  if (won) {
    if (!storyProg.done.includes(n)) storyProg.done.push(n);
    storyProg.unlocked = Math.max(storyProg.unlocked, Math.min(5, n + 1));
    storyProg.scores[n] = Math.max(storyProg.scores[n] ?? 0, s.score);
    storyProg.total = Object.values(storyProg.scores).reduce((a, b) => a + b, 0);
    saveStory();
    if (n === 5) {
      $('dawnTitle').textContent = 'Năm hòn đảo đã sáng';
      $('dawnText').textContent = ENDING;
      $('dawnScore').textContent = storyProg.total;
      $('dawnGrid').innerHTML = [1, 2, 3, 4, 5].map((k) => `<span>Chương ${k} · ${NIGHTS[k].name}</span><b>${storyProg.scores[k] ?? '—'}</b>`).join('');
      $('saveForm').classList.add('hidden');
      setMode('dawn');
      return;
    }
    showCardPick(n);
    return;
  }
  $('result').querySelector('.panel').classList.add('lost');
  $('resEyebrow').textContent = `Chương ${n} · ${CHAPTERS[n].title}`;
  $('resTitle').textContent = s.player.flames <= 0 ? 'Ngọn lửa đã tắt' : 'Trời sáng mà đèn chưa đủ';
  $('resText').textContent = 'Thẻ năng lực vẫn còn đó. Thử lại chương này nhé, Mây.';
  $('resScore').textContent = s.score;
  $('resGrid').innerHTML = '';
  $('btnAgain').textContent = 'Chơi lại chương';
  $('saveForm').classList.add('hidden');
  setMode('result');
}
$('btnStory').onclick = () => { renderChapters(); setMode('chapters'); };
$('btnChaptersBack').onclick = () => setMode('title');
$('btnStoryReset').onclick = () => { storyProg = { ...STORY_DEFAULT, done: [], cards: [], scores: {} }; saveStory(); renderChapters(); };
$('btnMenu').onclick = $('btnMenu2').onclick = $('btnMenu3').onclick = toMenu;
$('btnDawnAgain').onclick = () => (storyRun ? (renderChapters(), setMode('chapters')) : startRun(1));
$('btnSettings').onclick = () => { settingsFrom = 'title'; setMode('settings'); renderKeys(); };
$('btnPauseSettings').onclick = () => { settingsFrom = 'paused'; setMode('settings'); renderKeys(); };
$('btnSettingsBack').onclick = () => { capture = null; setMode(settingsFrom); };
$('btnBoard').onclick = () => { setMode('board'); renderBoard(); };
$('btnBoardBack').onclick = () => setMode('title');
$('vol').value = store.get('vol', 0.8);
$('vol').oninput = (e) => { audio.setVolume(+e.target.value); store.set('vol', +e.target.value); };
$('sens').value = sens;
$('sens').oninput = (e) => { sens = +e.target.value; store.set('sens', sens); };
// Bảng màu dễ phân biệt (được lưu)
function setColorblind(on) {
  ACCESS.colorblind = on;
  document.body.classList.toggle('cb', on);
  $('cb').checked = on;
  store.set('cb', on);
}
$('cb').onchange = (e) => setColorblind(e.target.checked);
setColorblind(!!store.get('cb', false));
// Giảm chuyển động: tắt rung camera và chớp màn hình
let reduceMotion = !!store.get('reduceMotion', false);
$('reduceMotion').checked = reduceMotion;
$('reduceMotion').onchange = (e) => { reduceMotion = e.target.checked; store.set('reduceMotion', reduceMotion); };
// Chữ lớn ×1.25
function setLarge(on) { document.body.classList.toggle('large', on); $('largeText').checked = on; store.set('largeText', on); }
$('largeText').onchange = (e) => setLarge(e.target.checked);
setLarge(!!store.get('largeText', false));

// ---------- đổi phím
function renderKeys() {
  const dup = duplicates(KEYS);
  const dupActs = new Set(dup.flatMap(([, list]) => list));
  $('keys').innerHTML = ACTIONS.map(([a, label]) => `<span>${label}</span><button type="button" class="keybtn${dupActs.has(a) ? ' dup' : ''}${capture === a ? ' wait' : ''}" data-act="${a}">${capture === a ? 'Nhấn phím…' : keyName(KEYS[a])}</button>`).join('');
  $('keys').querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => { capture = b.dataset.act; renderKeys(); }; });
  const label = (a) => ACTIONS.find(([x]) => x === a)[1];
  $('keysMsg').textContent = dup.length ? '⚠ Trùng phím: ' + dup.map(([c, list]) => `${keyName(c)} đang dùng cho ${list.map(label).join(' và ')}`).join('; ') : '';
  $('keysMsg').classList.toggle('bad', dup.length > 0);
  renderControlHints();
}
function finishCapture(code) {
  const a = capture;
  capture = null;
  if (code !== 'Escape' || a === 'pause') { KEYS = { ...KEYS, [a]: code }; store.set('keys', KEYS); }
  renderKeys();
}
$('btnKeysReset').onclick = () => { KEYS = { ...DEFAULT_KEYS }; store.set('keys', KEYS); capture = null; renderKeys(); };
function renderControlHints() {
  const K = (a) => `<kbd>${keyName(KEYS[a])}</kbd>`;
  $('controlsList').innerHTML = [
    `${K('up')}${K('left')}${K('down')}${K('right')} di chuyển`, '<kbd>Chuột</kbd> xoay camera',
    `${K('jump')} nhảy`, `${K('dash')} lướt`, `${K('interact')} nạp đèn / châm dầu`,
    `${K('pulse')} / <kbd>Chuột phải</kbd> tỏa sáng`, `${K('pause')} tạm dừng`, '<kbd>M</kbd> tắt/bật tiếng',
  ].map((x) => `<div>${x}</div>`).join('');
  $('promptKey').textContent = keyName(KEYS.interact);
  const short = (c) => keyName(c).replace(/ (trái|phải)$/, '');
  $('cdDashKey').textContent = short(KEYS.dash);
  $('cdPulseKey').textContent = short(KEYS.pulse);
}
renderControlHints();

// ---------- bảng xếp hạng
async function renderBoard() {
  $('boardList').innerHTML = '<li class="muted">Đang tải…</li>';
  const { entries, disk } = await loadBoard();
  $('boardList').innerHTML = entries.length
    ? entries.map((e, i) => `<li><b>${i + 1}</b><span class="nm"></span><span class="nw">${e.nights_won}/3 Đêm</span><span class="sc">${e.score}</span></li>`).join('')
    : '<li class="muted">Chưa có ai. Hãy là người đầu tiên!</li>';
  [...$('boardList').querySelectorAll('.nm')].forEach((el, i) => { el.textContent = entries[i].name; });
  $('boardNote').textContent = disk ? 'Lưu trên đĩa (.data/leaderboard.json)' : 'Bản tĩnh: lưu trong trình duyệt này';
}
function showSaveForm(panelId) {
  const form = $('saveForm');
  form.classList.toggle('hidden', run.saved);
  $('saveMsg').textContent = '';
  $('btnSave').disabled = false;
  const panel = $(panelId).querySelector('.panel');
  panel.insertBefore(form, panel.querySelector('.btn'));
  $('playerName').value = store.get('lastName', '');
}
$('saveForm').onsubmit = async (e) => {
  e.preventDefault();
  const name = $('playerName').value.trim();
  if (!validName(name)) { $('saveMsg').textContent = 'Tên 3–12 ký tự: chữ, số hoặc dấu gạch dưới'; $('saveMsg').className = 'save-msg bad'; return; }
  const entry = { name, score: run.total, nights_won: run.nights.length, achieved_at: isoWithOffset(new Date()), seed: run.seed || 0 };
  try {
    const { entries } = await saveScore(entry);
    const rank = entries.findIndex((x) => x.name === entry.name.normalize('NFC') && x.achieved_at === entry.achieved_at);
    run.saved = true;
    store.set('lastName', name);
    $('saveMsg').className = 'save-msg';
    $('saveMsg').textContent = rank >= 0 ? `Đã lưu: hạng ${rank + 1} trong top 10` : 'Đã lưu (chưa lọt top 10)';
    $('btnSave').disabled = true;
  } catch (err) {
    $('saveMsg').className = 'save-msg bad';
    $('saveMsg').textContent = 'Không lưu được: ' + err.message;
  }
};

// ---------- HUD
const flamesEl = $('flames'), motesEl = $('motes');
for (let i = 0; i < TUNING.flames; i++) flamesEl.appendChild(Object.assign(document.createElement('div'), { className: 'flame' }));
for (let i = 0; i < TUNING.capacity_max; i++) motesEl.appendChild(Object.assign(document.createElement('div'), { className: 'mote' }));
let toastTimer = 0;
// Phụ đề / chỉ báo hình ảnh cho các tín hiệu âm thanh quan trọng
const CAP_ICON = { shade: '◆', wind: '🍃', time: '⏳', fuel: '🏮', hit: '✦' };
function caption(text, kind) {
  if (mode !== 'play') return;
  const el = document.createElement('div');
  el.className = 'sub sub-' + kind;
  el.innerHTML = `<i>${CAP_ICON[kind] ?? '•'}</i>`;
  el.appendChild(document.createTextNode(text));
  $('subs').appendChild(el);
  while ($('subs').children.length > 4) $('subs').firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 3500);
}
let spawnPointers = [];
const ptrPool = [];
// vị trí mũi tên ở mép màn hình cho điểm thế giới (x,y,z); null nếu điểm đang trong màn hình
function edgeArrow(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(camera);
  const behind = v.z > 1;
  if (!behind && Math.abs(v.x) <= 0.92 && Math.abs(v.y) <= 0.88) return null;
  let ax = v.x, ay = v.y;
  if (behind) { ax = -ax; ay = -ay; }
  const a = Math.atan2(ay, ax), m = 0.86;
  const k = Math.min(m / Math.abs(Math.cos(a) || 1e-6), m / Math.abs(Math.sin(a) || 1e-6));
  return { x: (Math.cos(a) * k * 0.5 + 0.5) * window.innerWidth, y: (-Math.sin(a) * k * 0.5 + 0.5) * window.innerHeight, a };
}
function updateSpawnPointers(dt) {
  spawnPointers = spawnPointers.filter((p) => (p.t -= dt) > 0 && sim.s.shades.some((x) => x.id === p.id));
  let n = 0;
  for (const p of spawnPointers) {
    const sh = sim.s.shades.find((x) => x.id === p.id);
    const e = edgeArrow(sh.pos[0], sh.pos[1], sh.pos[2]);
    if (!e) continue;
    let el = ptrPool[n];
    if (!el) { el = document.createElement('div'); el.className = 'ptr'; el.innerHTML = '<div>➤</div>'; $('ptrs').appendChild(el); ptrPool.push(el); }
    el.style.display = ''; el.style.left = e.x + 'px'; el.style.top = e.y + 'px';
    el.firstChild.style.transform = `rotate(${-e.a}rad)`;
    el.style.opacity = Math.min(1, p.t);
    n++;
  }
  for (let i = n; i < ptrPool.length; i++) ptrPool[i].style.display = 'none';
}
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
  if (mode === 'play' && sec === 10 && sec !== lastSec) caption('10 giây cuối tới bình minh', 'time');
  $('timer').classList.toggle('final', sec <= 10);
  lastSec = sec;
  const lit = s.lanterns.filter((l) => l.lit).length, need = litNeeded(s.lanterns.length);
  $('lanterns').textContent = `${lit}/${s.lanterns.length}`;
  $('lanternsNeed').textContent = `cần ${need} lúc bình minh`;
  $('lanternsNeed').classList.toggle('danger', lit < need && sec <= 60);
  $('score').textContent = run.total + s.score;
  const cap = Math.min(TUNING.capacity_max, TUNING.carry_capacity + C.capacity_per_light * P.lights);
  [...motesEl.children].forEach((m, i) => { m.classList.toggle('on', i < P.carried); m.classList.toggle('hidden', i >= cap); });
  $('motesLabel').textContent = `Đom đóm ${P.carried}/${cap}`;
  setCd($('cdDash'), P.charm > 0 ? 0 : P.dashCd / C.dash_cd_ticks, true);
  setCd($('cdPulse'), P.pulseCd / C.pulse_cd_ticks, P.carried >= TUNING.pulse_cost);
  const st = s.story;
  if (st?.mods.active) setCd($('cdAbility'), st.abilityCd / CARDS[st.mods.active].cd, true);
  const boss = s.shades.find((x) => x.kind === 'boss');
  $('bossBar').classList.toggle('hidden', !boss);
  if (boss) $('bossHp').style.width = `${(100 * boss.hp) / MONSTERS.boss.hp}%`;
  const charm = $('charm');
  charm.classList.toggle('hidden', P.charm <= 0);
  if (P.charm > 0) $('charmT').textContent = `${Math.ceil(P.charm / TPS)}s`;
  // nhắc nạp đèn / châm dầu
  let near = interactTarget();
  if (!near) {
    let nd = Infinity;
    for (const l of s.lanterns) {
      if (l.lit) continue;
      const d = Math.hypot(P.pos[0] - l.pos[0], P.pos[2] - l.pos[2]);
      if (d <= TUNING.interact_radius && d < nd) { near = l; nd = d; }
    }
  }
  $('prompt').classList.toggle('hidden', !near);
  if (near) {
    if (near.lit) {
      $('promptVerb').textContent = 'Châm dầu';
      $('promptN').textContent = `(${Math.floor(near.fuel / FUEL_UNIT)}/${TUNING.fuel_max}, dùng ${Math.min(P.carried, refuelNeed(near))})`;
    } else {
      const cost = near.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
      $('promptVerb').textContent = near.everLit ? 'Thắp lại' : 'Nạp ánh sáng';
      $('promptN').textContent = P.carried > 0 ? `(${near.deposited}/${cost})` : `(${near.deposited}/${cost}): cần đom đóm`;
    }
  }
  // cảnh báo đèn sắp cạn dầu (< 30)
  for (const l of s.lanterns) {
    if (l.lit && l.fuel < LOW_U && !lowWarned.has(l.id) && mode === 'play') { lowWarned.add(l.id); toast(`Đèn ${l.id} sắp cạn dầu, mất vùng an toàn!`, true); caption(`Đèn ${l.id} dưới 30 dầu`, 'fuel'); }
    if (!l.lit || l.fuel >= LOW_U) lowWarned.delete(l.id);
  }
  // mũi tên chỉ tới đèn chưa sáng gần nhất khi ngoài màn hình
  const { l: target } = nearestUnlit();
  const arrow = $('arrow');
  if (target && mode === 'play') {
    const v = new THREE.Vector3(target.pos[0], target.pos[1] + 3, target.pos[2]).project(camera);
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
let stats = { motes: 0, lit: 0, relit: 0, stuns: 0 };
let shake = 0, lastLaunch = 0, windWarned = false, windWas = false;
let lowWarned = new Set(), drainWarned = new Set();
function handleEvents(events) {
  const P = sim.s.player;
  for (const e of events) {
    switch (e.name) {
      case 'mote_picked': audio.pickup(); fx.burst([P.pos[0], P.pos[1] + 1, P.pos[2]], 0xffe58a, 8, 2); break;
      case 'deposit': {
        stats.motes += e.data.amount; audio.deposit();
        const l = sim.s.lanterns.find((x) => x.id === e.data.lantern_id);
        fx.burst([l.pos[0], l.pos[1] + 2.5, l.pos[2]], 0xffd27a, 14, 3);
        break;
      }
      case 'lantern_lit': {
        if (e.data.relight) stats.relit++; else stats.lit++;
        audio.lit();
        if (night === 3) audio.bell();
        const l = sim.s.lanterns.find((x) => x.id === e.data.lantern_id);
        fx.burst([l.pos[0], l.pos[1] + 3.2, l.pos[2]], 0xffb347, 60, 6);
        const lit = sim.s.lanterns.filter((x) => x.lit).length, need = litNeeded(sim.s.lanterns.length);
        toast(e.data.relight ? `Đèn ${l.id} sáng lại!` : lit >= need ? `${lit} đèn đang sáng, đủ để chờ bình minh` : `Một ngọn đèn đã sáng, cần ${need - lit} nữa`);
        break;
      }
      case 'refuel': {
        stats.motes += e.data.amount; audio.deposit();
        const l = sim.s.lanterns.find((x) => x.id === e.data.lantern_id);
        fx.burst([l.pos[0], l.pos[1] + 3.2, l.pos[2]], 0xffd27a, 20, 3);
        toast(`Châm dầu đèn ${l.id}: ${Math.floor(e.data.fuel)}/${TUNING.fuel_max}`);
        break;
      }
      case 'lantern_out': {
        const l = sim.s.lanterns.find((x) => x.id === e.data.lantern_id);
        audio.lose();
        fx.burst([l.pos[0], l.pos[1] + 3.2, l.pos[2]], 0x5b5f6e, 30, 2);
        toast(`Đèn ${l.id} đã tắt! Thắp lại chỉ cần ${TUNING.relight_cost} đom đóm`, true);
        break;
      }
      case 'fuel_drain':
        if (!drainWarned.has(e.data.shade_id)) { drainWarned.add(e.data.shade_id); toast(`Bóng Mực đang hút dầu đèn ${e.data.lantern_id}! Tỏa Sáng để đuổi`, true); }
        break;
      case 'pulse': stats.stuns += e.data.stunned_ids.length; fx.pulse(P.pos); audio.pulse(); break;
      case 'player_hit': audio.hit(); if (!reduceMotion) { shake = 1; flash(); } caption('Mây bị chạm!', 'hit'); if (e.data.by === 'fall') toast('Mây rơi xuống biển mây…', true); break;
      case 'shade_spawned': { audio.spawn(); caption(`${MONSTERS[e.data.kind ?? 'ink'].name} xuất hiện`, 'shade'); const sh = sim.s.shades.find((x) => x.id === e.data.id); if (sh) spawnPointers.push({ id: sh.id, t: 5 }); break; }
      case 'dash': audio.dash(); break;
      case 'armor_break': { const sh = sim.s.shades.find((x) => x.id === e.data.id); audio.hit(); if (sh) fx.burst([sh.pos[0], sh.pos[1] + 1, sh.pos[2]], 0x8a84a0, 30, 3); toast('Giáp Mực Khổng Lồ đã vỡ, Tỏa Sáng lần nữa!'); break; }
      case 'phantom_blink': { const sh = sim.s.shades.find((x) => x.id === e.data.id); if (sh) fx.burst([sh.pos[0], sh.pos[1] + 0.5, sh.pos[2]], 0x7a3cff, 26, 2); caption('Mực Ma dịch chuyển!', 'shade'); break; }
      case 'boss_hit': audio.bell(); if (!reduceMotion) shake = 0.6; toast(`Mẹ Mực trúng đòn, còn ${e.data.hp}/${MONSTERS.boss.hp} máu`); break;
      case 'boss_defeated': { const b = sim.s.shades.find((x) => x.id === e.data.id) ?? { pos: [0, 1, 0] }; fx.burst([b.pos[0], b.pos[1] + 2, b.pos[2]], 0xffd27a, 120, 8); audio.win(); toast('Mẹ Mực đã tan vào ánh sáng!'); break; }
      case 'ability': { const c = CARDS[e.data.card]; audio.charm(); fx.pulse(P.pos); toast(`${c.icon} ${c.name}`); break; }
      case 'charm_picked': audio.charm(); fx.burst([P.pos[0], P.pos[1] + 1.2, P.pos[2]], 0xff6a5a, 24, 3); toast('Bùa Gió: chạy nhanh hơn, lướt không cần hồi chiêu'); break;
      case 'drifter_steal': audio.steal(); toast(`Gió Lạc cướp mất ${e.data.amount} đom đóm! Tỏa Sáng để đòi lại`, true); break;
      case 'drifter_drop': fx.burst(sim.s.drifters.find((d) => d.id === e.data.drifter_id)?.pos ?? P.pos, 0xffe58a, 20, 3); toast('Gió Lạc đánh rơi đom đóm, nhặt lại nhanh!'); break;
      case 'game_over':
        setMode('ending');
        resultT = e.data.result === 'won' ? 3.2 : 1.6;
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
  if (storyRun) { storyResult(); return; }
  const s = sim.s, won = s.state === 'won';
  if (won) { run.nights.push({ night, score: s.score }); run.total += s.score; }
  if (won && night === 3) { showDawn(); return; }
  $('result').querySelector('.panel').classList.toggle('lost', !won);
  $('resEyebrow').textContent = won ? 'Bình minh trên đảo' : 'Đêm vẫn còn dài';
  const litNow = s.lanterns.filter((l) => l.lit).length, need = litNeeded(s.lanterns.length);
  $('resTitle').textContent = won ? `${NIGHTS[night].name} đón bình minh!` : (s.player.flames <= 0 ? 'Ngọn lửa đã tắt' : `Trời sáng mà chỉ còn ${litNow}/${need} đèn`);
  $('resText').textContent = won ? `${litNow} ngọn đèn còn sáng khi mặt trời lên. Đêm ${night + 1} đang chờ.` : 'Lũ Bóng Mực vẫn còn lẩn trong sương. Thử lại Đêm này nhé, Mây.';
  $('resScore').textContent = s.score;
  const base = stats.motes * TUNING.score.per_mote + stats.lit * TUNING.score.per_lantern + stats.relit * TUNING.score.per_relight;
  const rows = [
    ['Đom đóm nạp / châm dầu', `${stats.motes} × ${TUNING.score.per_mote}`],
    ['Đèn thắp lần đầu', `${stats.lit} × ${TUNING.score.per_lantern}`],
    ['Đèn thắp lại', `${stats.relit} × ${TUNING.score.per_relight}`],
    [won ? 'Xua Bóng Mực & thưởng bình minh' : 'Xua Bóng Mực', `+${s.score - base}`],
  ];
  rows.push(['Tổng hành trình (các Đêm đã thắng)', `${run.total}`]);
  $('resGrid').innerHTML = rows.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
  $('btnAgain').textContent = won ? `Sang Đêm ${night + 1}` : 'Chơi lại Đêm';
  setMode('result');
  if (!won) showSaveForm('result'); else $('saveForm').classList.add('hidden');
}
function showDawn() {
  $('dawnScore').textContent = run.total;
  $('dawnGrid').innerHTML = run.nights.map((r) => `<span>Đêm ${r.night} · ${NIGHTS[r.night].name}</span><b>${r.score}</b>`).join('');
  setMode('dawn');
  showSaveForm('dawn');
}

// ---------- vòng lặp
const clock = new THREE.Clock();
let acc = 0, t = 0;
let prevPos = [0, 0, 0];
const camPos = new THREE.Vector3(0, 12, -14), camLook = new THREE.Vector3(), focus = new THREE.Vector3();
let wasGrounded = true;
let fpsAcc = 0, fpsN = 0, fps = 0;

function frame(ts = performance.now()) {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  t += dt;
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  const s = sim.s;

  if (mode === 'intro') {
    introT += dt;
    if (introT > 3.6) setMode('play');
  }
  if (mode === 'play' || mode === 'bench') {
    acc += dt;
    while (acc >= 1 / TPS) {
      prevPos = [...s.player.pos];
      wasGrounded = s.player.grounded;
      sim.step(mode === 'bench' ? {} : readInput());
      if (wasGrounded && !s.player.grounded && s.player.vel[1] > 5 && !s.player.launch) audio.jump();
      if (s.fx.launches !== lastLaunch) { lastLaunch = s.fx.launches; audio.bounce(); fx.burst([s.player.pos[0], s.player.pos[1] + 0.3, s.player.pos[2]], 0xffd27a, 20, 4); }
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

  // ngày / đêm: menu xoay vòng ngày ↔ đêm; chơi là đêm; thắng thì bình minh lên
  let dayTarget = 0;
  if (mode === 'title' || mode === 'loading') dayTarget = 0.5 - 0.5 * Math.cos(t * 0.09);
  else if (mode === 'dawn' || ((mode === 'ending' || mode === 'result') && s.state === 'won')) dayTarget = 1;
  if (mode === 'title' || mode === 'loading') world.setDayNow(dayTarget);
  focus.set(ip[0], ip[1], ip[2]);
  world.update(t, progress, dayTarget, focus);
  const day = world.day;
  bloom.strength = 0.7 * (1 - 0.6 * day);
  renderer.toneMappingExposure = 1.05 - 0.12 * day;

  player.root.visible = mode !== 'title';
  player.update(dt, t, P, ip);
  lanternViews.forEach((v, i) => v.update(dt, t, s.lanterns[i], camera));
  charmViews.forEach((v, i) => v.update(dt, t, s.charms[i] ?? { available: false }));
  const pv = new THREE.Vector3(ip[0], ip[1], ip[2]);
  const alive = new Set();
  for (const sh of s.shades) {
    alive.add(sh.id);
    let v = shadeViews.get(sh.id);
    if (!v) { v = makeShade(scene, sh.kind ?? 'ink'); shadeViews.set(sh.id, v); }
    v.update(dt, t, sh, pv);
  }
  for (const [id, v] of shadeViews) if (!alive.has(id)) { v.dispose(); shadeViews.delete(id); }
  flushShadeSmoke();
  const dAlive = new Set();
  for (const d of s.drifters) {
    dAlive.add(d.id);
    let v = drifterViews.get(d.id);
    if (!v) { v = makeDrifter(scene); drifterViews.set(d.id, v); }
    v.update(dt, t, d);
  }
  for (const [id, v] of drifterViews) if (!dAlive.has(id)) { v.dispose(); drifterViews.delete(id); }
  motesView.update(t, s.motes);
  fx.update(dt);

  // gió mạnh: lá bay báo trước 2 s, rồi gió thổi 5 s
  const w = s.wind;
  const warn = w.enabled && !w.active && w.next - s.sim <= C.wind_warn_ticks && w.next - s.sim > 0;
  if (warn && !windWarned && mode === 'play') { windWarned = true; toast('Lá bắt đầu bay… gió mạnh sắp nổi!', true); caption('Gió sắp thổi', 'wind'); audio.wind(); }
  if (w.active && !windWas) windWarned = false;
  windWas = w.active;
  const windDir = w.active ? w.dir : (w.nextDir ?? 0);
  windFx.update(dt, t, pv, windDir, w.active ? 1 : warn ? 0.45 : 0);

  // camera
  if (mode === 'bench') {
    const [cx, cy, cz] = benchCamera(bench.started ? (ts - bench.started) / 1000 : 0);
    camera.position.set(cx, cy, cz);
    camera.lookAt(0, 0, 0);
  } else if (mode === 'title' || mode === 'loading') {
    const a = t * 0.045;
    const cx = world.uniforms.uCenter.value.x;
    camPos.set(cx + Math.cos(a) * 62, 18 + Math.sin(t * 0.2) * 3, Math.sin(a) * 62);
    camLook.set(cx, 3, 0);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  } else {
    const fwd = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
    const target = new THREE.Vector3(ip[0], Math.max(ip[1], -2) + 1.5, ip[2]);
    const introK = mode === 'intro' ? Math.max(0, 1 - introT / 3.2) : 0;
    const dawnK = mode === 'dawn' || (s.state === 'won' && mode !== 'play') ? 1 : 0;
    const dist = camDist + introK * 22 + dawnK * 10;
    const pitch = camPitch + introK * 0.5 + dawnK * 0.15;
    if (dawnK) camYaw += dt * 0.08;
    const desired = target.clone().addScaledVector(fwd, -dist * Math.cos(pitch));
    desired.y += dist * Math.sin(pitch);
    // camera không chui vào vách tầng / tháp chuông: dò từ nhân vật ra sau, gặp khối đặc thì dừng
    const map = NIGHTS[night];
    const dir = desired.clone().sub(target), full = dir.length();
    dir.normalize();
    let free = full;
    for (let d = 0.6; d <= full; d += 0.3) {
      const px = target.x + dir.x * d, py = target.y + dir.y * d, pz = target.z + dir.z * d;
      const g = map.ground(px, pz);
      if (g !== null && g > py - 0.4) { free = Math.max(1.2, d - 0.5); break; }
    }
    desired.copy(target).addScaledVector(dir, free);
    const gy = groundAt(map, desired.x, desired.z);
    desired.y = Math.max(desired.y, (gy ?? -6) + 0.8);
    camPos.lerp(desired, Math.min(1, dt * (mode === 'intro' ? 3 : 10)));
    camLook.lerp(target, Math.min(1, dt * 12));
    camera.position.copy(camPos);
    shake = Math.max(0, shake - dt * 2.5);
    if (shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake * 0.5, (Math.random() - 0.5) * shake * 0.5, 0));
    camera.lookAt(camLook);
  }
  if (!['title', 'loading', 'bench'].includes(mode)) { updateHud(dt); updateSpawnPointers(dt); }
  composer.render();
  if (mode === 'bench') benchTick(ts);
}

// ---------- benchmark (Ticket-04): ?bench=1&seed=42&duration=30
// Không input, Đêm 1, 200 Bóng Mực, 100 đom đóm, L1–L3 sáng; tắt phần trang trí sáng tạo; 3 s khởi động rồi đo.
const bench = { started: 0, warm: BENCH.warmup_s * 1000, dur: (+params.get('duration') || 30) * 1000, last: 0, dts: [], first: 0, done: false };
function startBench() {
  const seed = +params.get('seed') || 42;
  night = 1;
  buildNightViews(1);
  world.setCreative(false);
  sim = createSim({ seed, night: 1, scenario: benchScenario(seed), bench: true });
  sim.drainEvents();
  prevPos = [...sim.s.player.pos];
  world.setDayNow(0);
  $('loading')?.remove();
  for (const id of SCREENS) $(id).classList.add('hidden');
  $('hud').classList.add('hidden');
  mode = 'bench';
}
function benchTick(ts) {
  if (bench.done) return;
  if (!bench.started) { bench.started = ts; bench.first = performance.timeOrigin + ts; bench.last = ts; return; }
  const el = ts - bench.started;
  if (el > bench.warm) {
    bench.dts.push(ts - bench.last);
    const heap = performance.memory?.usedJSHeapSize;
    if (heap) bench.heap = Math.max(bench.heap ?? 0, heap);
  }
  bench.last = ts;
  if (el >= bench.warm + bench.dur) {
    bench.done = true;
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    window.__benchResult = {
      dts: bench.dts, first_frame_epoch_ms: bench.first,
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      size: [renderer.domElement.width, renderer.domElement.height], dpr: renderer.getPixelRatio(),
      shades: sim.s.shades.length, motes: sim.s.motes.length,
      js_heap_peak_mb: bench.heap ? Math.round(bench.heap / 1048576) : null,
    };
    if (params.get('report') === '1') fetch('/api/bench', { method: 'POST', body: JSON.stringify(window.__benchResult) }).catch(() => {});
  }
}

if (BENCH_MODE) {
  startBench();
  requestAnimationFrame(frame);
} else {
  newSim(1, true);
  setMode('loading');
  requestAnimationFrame(frame);
  setTimeout(() => {
    $('loading').style.opacity = '0';
    setTimeout(() => $('loading').remove(), 800);
    setMode('title');
  }, 600);
}

// cho phép kiểm tra nhanh trong console (đo FPS, nhảy Đêm)
window.__ddl = { get sim() { return sim; }, get mode() { return mode; }, get fps() { return fps; }, get info() { return { ...renderer.info.render, programs: renderer.info.programs?.length, geometries: renderer.info.memory.geometries }; }, setMode, startNight, startChapter, world };
