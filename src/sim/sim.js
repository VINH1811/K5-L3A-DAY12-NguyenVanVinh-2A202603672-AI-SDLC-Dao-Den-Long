// Lõi mô phỏng Đảo Đèn Lồng: thuần logic, không phụ thuộc DOM/WebGL.
// Chạy giống hệt nhau trong trình duyệt (bản có giao diện) và Node (headless).
import { TPS, TUNING, C, NIGHTS, FUEL_UNIT } from './config.js';
import { makeRng } from './rng.js';

export class ScenarioError extends Error {}

const r3 = (v) => Math.round(v * 1000) / 1000 + 0; // +0 bỏ -0
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isTicks = (v) => Number.isInteger(v) && v >= 0;
const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
// Dầu lưu bằng đơn vị nguyên (FUEL_UNIT = 60 đơn vị cho 1 fuel) để không sai số.
const FMAX = TUNING.fuel_max * FUEL_UNIT;
const FLOW = TUNING.low_fuel_threshold * FUEL_UNIT;
const FUEL_PER_MOTE = TUNING.fuel_per_mote * FUEL_UNIT;
const DECAY = Math.round((TUNING.fuel_decay_per_s * FUEL_UNIT) / TPS); // 1 đơn vị / tick
const DRAIN = Math.round((TUNING.drain_per_s * FUEL_UNIT) / TPS); // 5 đơn vị / tick
const f1 = (u) => Math.round((u / FUEL_UNIT) * 10) / 10 + 0; // xuất 1 chữ số thập phân
const DRIFTER_STATES = ['idle', 'chase', 'flee'];

// bench = true: cảnh benchmark Ticket-04 (tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm).
// Mặc định false; headless theo contract không bao giờ bật.
export function createSim({ seed = 1, night = 1, scenario = null, bench = false } = {}) {
  const map = NIGHTS[night];
  if (!map) throw new ScenarioError(`night ${night} không tồn tại (chỉ có 1, 2, 3)`);
  const rng = makeRng(seed);
  const ground = (x, z) => map.ground(x, z);

  const s = {
    night,
    bench,
    map,
    tick: 0, // số tick đã chạy (kể cả lúc tạm dừng)
    sim: 0, // số bước gameplay đã chạy (sim_tick)
    paused: false,
    state: 'playing',
    timeLeft: map.duration_s * TPS, // đơn vị tick
    score: 0,
    nextMote: 1,
    nextShade: 1,
    nextDrifter: 1,
    randomMotes: true,
    randomShades: true,
    randomDrifters: map.drifters,
    wind: { enabled: map.wind, active: false, dir: 0, ticks: 0, next: C.wind_every, nextDir: null },
    events: [],
    player: {
      pos: [...map.start], vel: [0, 0, 0], grounded: true, facing: [0, 1],
      flames: TUNING.flames, carried: 0, invuln: 0, pulseCd: 0, dashCd: 0, charm: 0,
      dashTicks: 0, dashDir: [0, 1], respawn: 0, dead: false, launch: null, lights: 0,
    },
    lanterns: map.lanterns.map((l) => ({ id: l.id, pos: [...l.pos], lit: false, deposited: 0, fuel: 0, everLit: false, relit: 0 })),
    motes: [],
    shades: [],
    drifters: [],
    charms: map.charms.map((c) => ({ id: c.id, pos: [...c.pos], available: true, respawn: 0 })),
    prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    // dữ liệu chỉ dùng để hiển thị (không ảnh hưởng logic)
    fx: { pulses: [], hits: 0, lits: [], launches: 0 },
  };

  // ---- dựng màn mặc định
  const spots = map.moteSpots.map((p, i) => i);
  for (let i = spots.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  function addMote(pos, kind = 'random', ttl = null) {
    const m = { id: `M${s.nextMote++}`, pos: [pos[0], pos[1], pos[2]], kind, ttl, born: s.sim };
    s.motes.push(m);
    return m;
  }
  function addShade(pos, state = 'spawning', id = null) {
    const sh = {
      id: id ?? `S${s.nextShade++}`, pos: [pos[0], pos[1], pos[2]], state,
      stateTicks: state === 'spawning' ? C.shade_spawning_ticks : 0,
      stun: 0, push: [0, 0], pushTicks: 0, recoil: [0, 0], recoilTicks: 0,
      safeTicks: 0, safeVec: [0, 0], wanderTarget: null, wanderTicks: 0,
      target: null, drainTicks: 0, // đèn đang nhắm tới / số tick đã hút
    };
    s.shades.push(sh);
    return sh;
  }
  function addDrifter(pos, id = null) {
    const d = { id: id ?? `D${s.nextDrifter++}`, pos: [pos[0], pos[1], pos[2]], state: 'idle', stolen: 0, flee: 0, target: null, targetTicks: 0, stole: false };
    s.drifters.push(d);
    return d;
  }
  for (let i = 0; i < Math.min(C.mote_initial, map.moteSpots.length); i++) addMote(map.moteSpots[spots[i]]);

  if (scenario) applyScenario(scenario);
  s.events.push({ type: 'event', tick: 0, name: 'night_start', data: { night } });

  // ---- scenario
  function applyScenario(sc) {
    if (typeof sc !== 'object' || sc === null || Array.isArray(sc)) throw new ScenarioError('scenario phải là object');
    const bool = (k) => { if (sc[k] !== undefined && typeof sc[k] !== 'boolean') throw new ScenarioError(`${k} phải là boolean`); return sc[k]; };
    const p = sc.player;
    if (p !== undefined) {
      if (typeof p !== 'object' || p === null) throw new ScenarioError('player sai định dạng');
      const P = s.player;
      if (p.pos !== undefined) { if (!isVec3(p.pos)) throw new ScenarioError('player.pos sai'); P.pos = [...p.pos]; }
      if (p.carried !== undefined) { if (!isTicks(p.carried)) throw new ScenarioError('player.carried sai'); P.carried = p.carried; }
      if (p.flames !== undefined) { if (!isTicks(p.flames)) throw new ScenarioError('player.flames sai'); P.flames = p.flames; }
      for (const [k, f] of [['invuln_ticks', 'invuln'], ['dash_cd_ticks', 'dashCd'], ['pulse_cd_ticks', 'pulseCd'], ['charm_ticks', 'charm'], ['successful_lights', 'lights']]) {
        if (p[k] !== undefined) { if (!isTicks(p[k])) throw new ScenarioError(`player.${k} sai`); P[f] = p[k]; }
      }
      const g = ground(P.pos[0], P.pos[2]);
      P.grounded = g !== null && Math.abs(P.pos[1] - g) < 1e-6;
    }
    if (bool('random_motes') !== undefined) s.randomMotes = sc.random_motes;
    if (bool('random_shades') !== undefined) s.randomShades = sc.random_shades;
    if (bool('random_drifters') !== undefined) s.randomDrifters = sc.random_drifters;
    if (bool('wind_enabled') !== undefined) s.wind.enabled = sc.wind_enabled;
    if (s.randomMotes === false && sc.motes === undefined) s.motes = [];
    if (sc.motes !== undefined) {
      if (!Array.isArray(sc.motes)) throw new ScenarioError('motes phải là mảng');
      s.motes = []; s.nextMote = 1;
      for (const m of sc.motes) {
        const pos = Array.isArray(m) ? m : m && m.pos;
        if (!isVec3(pos)) throw new ScenarioError('mote sai định dạng');
        const mm = addMote(pos);
        mm.born = -1;
        if (!Array.isArray(m) && typeof m.id === 'string') mm.id = m.id;
      }
    }
    if (sc.shades !== undefined) {
      if (!Array.isArray(sc.shades)) throw new ScenarioError('shades phải là mảng');
      s.shades = [];
      for (const sh of sc.shades) {
        if (!sh || !isVec3(sh.pos)) throw new ScenarioError('shade sai định dạng');
        if (sh.id !== undefined && typeof sh.id !== 'string') throw new ScenarioError('shade.id sai');
        if (sh.state !== undefined && !SHADE_STATES.includes(sh.state)) throw new ScenarioError(`shade.state sai: ${sh.state}`);
        if (sh.state_ticks_left !== undefined && !isTicks(sh.state_ticks_left)) throw new ScenarioError('shade.state_ticks_left sai');
        const st = sh.state ?? 'wander';
        const made = addShade(sh.pos, st, sh.id ?? null);
        const left = sh.state_ticks_left;
        if (st === 'spawning') made.stateTicks = left ?? C.shade_spawning_ticks;
        if (st === 'stunned') made.stun = left ?? C.stun_ticks;
        if (st === 'recoil') { made.recoilTicks = left ?? C.recoil_ticks; }
        if (sh.target_lantern_id !== undefined) {
          if (!s.lanterns.some((l) => l.id === sh.target_lantern_id)) throw new ScenarioError(`shade.target_lantern_id không tồn tại: ${sh.target_lantern_id}`);
          made.target = sh.target_lantern_id;
          made.forced = sh.target_lantern_id; // ưu tiên đèn này khi wander, nếu nó yếu hoặc tắt
        }
        if (st === 'drain' && !made.target) throw new ScenarioError('shade drain cần target_lantern_id');
      }
      for (const sh of s.shades) { const n = /^S(\d+)$/.exec(sh.id); if (n) s.nextShade = Math.max(s.nextShade, +n[1] + 1); }
    }
    if (sc.drifters !== undefined) {
      if (!Array.isArray(sc.drifters)) throw new ScenarioError('drifters phải là mảng');
      s.drifters = [];
      for (const d of sc.drifters) {
        if (!d || !isVec3(d.pos)) throw new ScenarioError('drifter sai định dạng');
        if (d.id !== undefined && typeof d.id !== 'string') throw new ScenarioError('drifter.id sai');
        if (d.state !== undefined && !DRIFTER_STATES.includes(d.state)) throw new ScenarioError(`drifter.state sai: ${d.state}`);
        if (d.stolen !== undefined && !isTicks(d.stolen)) throw new ScenarioError('drifter.stolen sai');
        if (d.state_ticks_left !== undefined && !isTicks(d.state_ticks_left)) throw new ScenarioError('drifter.state_ticks_left sai');
        const made = addDrifter(d.pos, d.id ?? null);
        made.state = d.state ?? 'idle';
        made.stolen = d.stolen ?? 0;
        if (made.state === 'flee') { made.flee = d.state_ticks_left ?? C.drifter_flee_ticks; made.stole = true; }
      }
      for (const d of s.drifters) { const n = /^D(\d+)$/.exec(d.id); if (n) s.nextDrifter = Math.max(s.nextDrifter, +n[1] + 1); }
    }
    if (sc.charms !== undefined) {
      if (!Array.isArray(sc.charms)) throw new ScenarioError('charms phải là mảng');
      s.charms = sc.charms.map((c, i) => {
        if (!c || !isVec3(c.pos)) throw new ScenarioError('charm sai định dạng');
        if (c.available !== undefined && typeof c.available !== 'boolean') throw new ScenarioError('charm.available sai');
        if (c.respawn_ticks !== undefined && !isTicks(c.respawn_ticks)) throw new ScenarioError('charm.respawn_ticks sai');
        const available = c.available ?? true;
        return { id: typeof c.id === 'string' ? c.id : `C${i + 1}`, pos: [...c.pos], available, respawn: available ? 0 : (c.respawn_ticks ?? C.charm_respawn_ticks) };
      });
    }
    if (sc.lanterns !== undefined) {
      if (!Array.isArray(sc.lanterns)) throw new ScenarioError('lanterns phải là mảng');
      for (const l of sc.lanterns) {
        const target = l && s.lanterns.find((x) => x.id === l.id);
        if (!target) throw new ScenarioError(`lantern id không tồn tại: ${l && l.id}`);
        if (l.pos !== undefined) { if (!isVec3(l.pos)) throw new ScenarioError('lantern.pos sai'); target.pos = [...l.pos]; }
        if (l.deposited !== undefined) { if (!isTicks(l.deposited)) throw new ScenarioError('lantern.deposited sai'); target.deposited = l.deposited; }
        if (l.ever_lit !== undefined) { if (typeof l.ever_lit !== 'boolean') throw new ScenarioError('lantern.ever_lit sai'); target.everLit = l.ever_lit; }
        if (l.lit !== undefined) {
          if (typeof l.lit !== 'boolean') throw new ScenarioError('lantern.lit sai');
          target.lit = l.lit;
          if (l.lit) { target.everLit = true; if (l.deposited === undefined) target.deposited = TUNING.lantern_cost; }
        }
        if (l.fuel !== undefined) {
          if (!isNum(l.fuel) || l.fuel < 0 || l.fuel > TUNING.fuel_max) throw new ScenarioError('lantern.fuel sai');
          target.fuel = Math.round(l.fuel * FUEL_UNIT);
        } else if (target.lit) target.fuel = FMAX;
        if (!target.lit) target.fuel = 0;
      }
    }
    if (sc.time_left_s !== undefined) {
      if (!isNum(sc.time_left_s) || sc.time_left_s < 0) throw new ScenarioError('time_left_s sai');
      s.timeLeft = Math.round(sc.time_left_s * TPS);
    }
  }

  const emit = (name, data) => s.events.push({ type: 'event', tick: s.tick, name, data });

  // ---- một bước (Ticket-02, "Thứ tự xử lý trong một tick")
  function step(input = {}) {
    if (s.state !== 'playing') return;
    s.tick += 1; // sự kiện của bước k ghi tick = k+1
    const P = s.player;
    const inp = {
      move: input.move ?? [0, 0], cam_yaw_deg: input.cam_yaw_deg ?? 0,
      jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse, dash: !!input.dash, pause: !!input.pause,
    };
    const edge = (k) => inp[k] && !s.prev[k];
    const jumpE = edge('jump'), interactE = edge('interact'), pulseE = edge('pulse'), dashE = edge('dash'), pauseE = edge('pause');
    s.prev = { jump: inp.jump, interact: inp.interact, pulse: inp.pulse, dash: inp.dash, pause: inp.pause };

    // 1. đọc input: xử lý pause trước
    if (pauseE) {
      s.paused = !s.paused;
      emit(s.paused ? 'paused' : 'resumed', {});
      if (s.paused) return;
    } else if (s.paused) return;
    s.sim += 1;

    // 2. giảm bộ đếm
    s.timeLeft = Math.max(0, s.timeLeft - 1);
    if (P.pulseCd > 0) P.pulseCd--;
    if (P.dashCd > 0) P.dashCd--;
    if (P.invuln > 0) P.invuln--;
    if (P.charm > 0) P.charm--;
    for (const sh of s.shades) {
      if (sh.state === 'spawning' && sh.stateTicks > 0) sh.stateTicks--;
      if (sh.stun > 0) sh.stun--;
    }
    for (const m of s.motes) if (m.ttl !== null) m.ttl--;
    s.motes = s.motes.filter((m) => m.ttl === null || m.ttl > 0);
    for (const c of s.charms) if (!c.available && c.respawn > 0 && --c.respawn === 0) c.available = true;
    updateWind();
    // 2b. dầu: đèn sáng tự hao 1/s, mỗi Bóng Mực đang hút trừ thêm 5/s; hết dầu thì tắt ngay sau bước 2
    for (const l of s.lanterns) {
      if (!l.lit || bench) continue;
      const drainers = s.shades.filter((sh) => sh.state === 'drain' && sh.target === l.id).sort(byId);
      l.fuel = Math.max(0, l.fuel - DECAY - DRAIN * drainers.length);
      for (const sh of drainers) {
        if (++sh.drainTicks % C.drain_event_every === 0) emit('fuel_drain', { lantern_id: l.id, shade_id: sh.id, fuel: f1(l.fuel) });
      }
      if (l.fuel <= 0) {
        l.lit = false; l.fuel = 0; l.deposited = 0;
        emit('lantern_out', { lantern_id: l.id });
      }
    }

    // 3. di chuyển Mây (nhảy, lướt, bục nhảy, gió) rồi kiểm tra rơi
    movePlayer(inp, jumpE, dashE);

    const active = !P.dead && P.respawn === 0;
    // 4. nhặt đom đóm và bùa
    if (active && !bench) {
      for (const m of [...s.motes].sort(byId)) {
        if (P.carried >= capacity()) break;
        if (m.born >= s.sim) continue; // thực thể mới chỉ tương tác được từ tick sau
        if (distXZ(P.pos, m.pos) <= TUNING.pickup_radius && Math.abs(P.pos[1] - m.pos[1]) <= C.pickup_dy) {
          s.motes.splice(s.motes.indexOf(m), 1);
          P.carried++;
          emit('mote_picked', { carried: P.carried });
        }
      }
      for (const c of s.charms) {
        if (!c.available) continue;
        if (distXZ(P.pos, c.pos) <= TUNING.pickup_radius && Math.abs(P.pos[1] - c.pos[1]) <= C.pickup_dy) {
          c.available = false; c.respawn = C.charm_respawn_ticks;
          P.charm = C.charm_ticks;
          emit('charm_picked', { charm_id: c.id, charm_ticks: C.charm_ticks });
        }
      }
    }

    // 5. tương tác với đèn: chỉ xét đèn nhận được (chưa sáng, hoặc sáng mà chưa đầy dầu)
    if (active && interactE) {
      let best = null, bd = Infinity;
      for (const l of s.lanterns) {
        if (l.lit && refuelAmount(l) === 0) continue;
        const d = distXZ(P.pos, l.pos);
        if (d <= TUNING.interact_radius && (d < bd || (d === bd && l.id < best.id))) { best = l; bd = d; }
      }
      if (best && best.lit) {
        // châm dầu
        const used = refuelAmount(best);
        best.fuel = Math.min(FMAX, best.fuel + FUEL_PER_MOTE * used);
        P.carried -= used;
        s.score += used * TUNING.score.per_mote;
        emit('refuel', { lantern_id: best.id, amount: used, fuel: f1(best.fuel) });
      } else if (best && P.carried > 0) {
        const cost = best.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
        const amount = Math.min(P.carried, cost - best.deposited);
        if (amount > 0) {
          P.carried -= amount; best.deposited += amount;
          s.score += amount * TUNING.score.per_mote;
          emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= cost) {
            const relight = best.everLit;
            best.lit = true; best.everLit = true; best.fuel = FMAX;
            if (relight) best.relit++;
            P.lights++;
            s.score += relight ? TUNING.score.per_relight : TUNING.score.per_lantern;
            emit('lantern_lit', { lantern_id: best.id, relight });
            s.fx.lits.push({ id: best.id, tick: s.tick });
          }
        }
      }
    }

    // 6. vùng an toàn (chỉ đèn còn ≥ 30 dầu): bóng nằm trong vùng bị đẩy ra mép trong tối đa 30 tick
    for (const l of s.lanterns) {
      if (!safeLantern(l)) continue;
      for (const sh of s.shades) {
        if (sh.safeTicks > 0) continue;
        const d = distXZ(sh.pos, l.pos);
        if (d < TUNING.safe_radius - 1e-6) {
          let dx = sh.pos[0] - l.pos[0], dz = sh.pos[2] - l.pos[2];
          if (d === 0) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
          const need = TUNING.safe_radius - d;
          sh.safeTicks = C.safe_push_ticks;
          sh.safeVec = [(dx * need) / C.safe_push_ticks, (dz * need) / C.safe_push_ticks];
          sh.safeFrom = l.id;
          // đang hút mà đèn được châm lên ≥ 30: thôi hút ngay (không hút tiếp trong lúc bị đẩy)
          if (sh.state === 'drain') { sh.state = 'wander'; sh.drainTicks = 0; }
        }
      }
    }

    // 7. Tỏa Sáng
    if (active && pulseE && P.pulseCd === 0 && P.carried >= TUNING.pulse_cost) {
      P.carried -= TUNING.pulse_cost;
      P.pulseCd = C.pulse_cd_ticks;
      const c = [P.pos[0], P.pos[1] + C.pulse_center_dy, P.pos[2]];
      const d3 = (e) => Math.hypot(e.pos[0] - c[0], e.pos[1] - c[1], e.pos[2] - c[2]);
      const ids = [];
      for (const sh of [...s.shades].sort(byId)) {
        if (d3(sh) > TUNING.pulse_radius) continue;
        let dx = sh.pos[0] - c[0], dz = sh.pos[2] - c[2];
        const dh = Math.hypot(dx, dz);
        if (dh === 0) { dx = 1; dz = 0; } else { dx /= dh; dz /= dh; }
        const wasDrain = sh.state === 'drain';
        sh.state = 'stunned'; sh.stun = C.stun_ticks;
        sh.push = [(dx * TUNING.pulse_push_m) / C.push_ticks, (dz * TUNING.pulse_push_m) / C.push_ticks];
        sh.pushTicks = C.push_ticks;
        sh.recoilTicks = 0; sh.stateTicks = 0; sh.drainTicks = 0;
        ids.push(sh.id);
        s.score += wasDrain ? TUNING.score.per_stun_drain : TUNING.score.per_stun;
      }
      for (const d of [...s.drifters].sort(byId)) {
        if (d3(d) > TUNING.pulse_radius) continue;
        if (d.state === 'chase') { d.state = 'flee'; d.flee = C.drifter_flee_ticks; d.stole = true; }
        else if (d.state === 'flee' && d.stolen > 0) {
          const amount = d.stolen;
          for (let i = 0; i < amount; i++) addMote([d.pos[0], groundOr(d.pos), d.pos[2]], 'dropped', C.drop_ttl_ticks);
          d.stolen = 0;
          d.flee = Math.min(d.flee, C.drifter_drop_flee_ticks);
          emit('drifter_drop', { drifter_id: d.id, amount });
        }
      }
      emit('pulse', { stunned_ids: ids });
      s.fx.pulses.push({ tick: s.tick, pos: [...P.pos] });
    }

    // 8. di chuyển Bóng Mực và Gió Lạc
    for (const sh of [...s.shades].sort(byId)) moveShade(sh, active);
    for (const d of [...s.drifters].sort(byId)) moveDrifter(d, active);
    s.drifters = s.drifters.filter((d) => !d.removed);

    // 9. chạm: Gió Lạc cướp trước, rồi Bóng Mực gây hit (id tăng dần)
    if (active) {
      for (const d of [...s.drifters].sort(byId)) {
        if (d.stole || (d.state !== 'idle' && d.state !== 'chase') || P.carried === 0) continue;
        if (distXZ(P.pos, d.pos) <= C.drifter_hit_r) {
          const amount = Math.min(C.drifter_steal, P.carried);
          P.carried -= amount;
          d.stolen = amount; d.stole = true; d.state = 'flee'; d.flee = C.drifter_flee_ticks;
          emit('drifter_steal', { drifter_id: d.id, amount, carried: P.carried });
        }
      }
    }
    if (active && P.invuln === 0 && !bench) {
      for (const sh of [...s.shades].sort(byId)) {
        if ((sh.state !== 'wander' && sh.state !== 'chase') || sh.safeTicks > 0) continue;
        if (distXZ(P.pos, sh.pos) <= TUNING.shade_hit_radius && Math.abs(P.pos[1] - sh.pos[1]) <= C.shade_hit_dy) {
          P.flames = Math.max(0, P.flames - 1);
          const dropped = Math.floor(P.carried * TUNING.hit_drop_ratio);
          P.carried -= dropped;
          for (let i = 0; i < dropped; i++) {
            const a = rng.range(0, Math.PI * 2), r = rng.range(C.drop_r_min, C.drop_r_max);
            const x = P.pos[0] + r * Math.cos(a), z = P.pos[2] + r * Math.sin(a);
            const g = ground(x, z);
            addMote([x, g ?? P.pos[1], z], 'dropped', C.drop_ttl_ticks);
          }
          P.invuln = C.invuln_ticks;
          let dx = sh.pos[0] - P.pos[0], dz = sh.pos[2] - P.pos[2];
          const dh = Math.hypot(dx, dz);
          if (dh === 0) { dx = 1; dz = 0; } else { dx /= dh; dz /= dh; }
          sh.state = 'recoil'; sh.recoilTicks = C.recoil_ticks;
          sh.recoil = [(dx * C.recoil_m) / C.recoil_ticks, (dz * C.recoil_m) / C.recoil_ticks];
          emit('player_hit', { by: 'shade', flames: P.flames, dropped });
          s.fx.hits++;
          break;
        }
      }
    }

    // 10. sinh thực thể theo lịch
    if (bench) return; // cảnh bench: không sinh thêm, không kết thúc Đêm
    if (s.randomMotes && s.sim % C.mote_spawn_every === 0 && s.motes.length < C.mote_cap) {
      const empty = map.moteSpots.filter((p) => !s.motes.some((m) => distXZ(m.pos, p) < 0.5));
      if (empty.length) addMote(empty[rng.int(empty.length)]);
    }
    if (s.randomShades && s.sim >= C.shade_spawn_first && (s.sim - C.shade_spawn_first) % map.shadeEvery === 0) {
      const n = s.sim === C.shade_spawn_first ? 2 : 1;
      for (let i = 0; i < n && s.shades.length < map.shadeMax; i++) {
        const valid = map.shadeSpots.filter((p) => distXZ(p, P.pos) >= C.shade_spawn_min_dist && !s.shades.some((sh) => distXZ(sh.pos, p) < 2));
        if (!valid.length) break;
        const sp = valid[rng.int(valid.length)];
        const sh = addShade([sp[0], groundOr(sp) + C.shade_y, sp[2]]);
        emit('shade_spawned', { id: sh.id });
      }
    }
    if (s.randomDrifters && s.sim % C.drifter_every === 0 && s.drifters.length < C.drifter_max) {
      const sp = map.shadeSpots[rng.int(map.shadeSpots.length)];
      addDrifter([sp[0], groundOr(sp) + C.drifter_y, sp[2]]);
    }

    // 11. thắng / thua (Ticket-03): không còn thắng sớm; chỉ xét ở bình minh
    if (P.flames <= 0) end('lost', 'no_flames');
    else if (s.timeLeft <= 0) {
      const lit = s.lanterns.filter((l) => l.lit);
      if (lit.length >= litNeeded()) {
        for (const l of lit) s.score += TUNING.score.per_lit_at_dawn + Math.floor(l.fuel / FUEL_UNIT);
        s.score += P.flames * TUNING.score.per_flame_left;
        end('won', 'dawn_survived');
      } else end('lost', 'dawn');
    }
  }

  const litNeeded = () => Math.ceil(TUNING.win_ratio * s.lanterns.length);
  const capacity = () => Math.min(TUNING.capacity_max, TUNING.carry_capacity + C.capacity_per_light * s.player.lights);
  const safeLantern = (l) => l.lit && l.fuel >= FLOW;
  // số đom đóm dùng khi châm dầu: min(đang mang, ceil((100 − fuel) / 10))
  const refuelAmount = (l) => Math.min(s.player.carried, Math.ceil((FMAX - l.fuel) / FUEL_PER_MOTE));
  const lanternById = (id) => s.lanterns.find((l) => l.id === id);
  // đèn sáng yếu (< 30) gần nhất, bằng nhau thì id nhỏ hơn; không có thì đèn tắt gần nhất
  function pickLantern(sh) {
    const pick = (list) => {
      let best = null, bd = Infinity;
      for (const l of list) { const d = distXZ(sh.pos, l.pos); if (d < bd || (d === bd && l.id < best.id)) { best = l; bd = d; } }
      return best;
    };
    return pick(s.lanterns.filter((l) => l.lit && l.fuel < FLOW)) ?? pick(s.lanterns.filter((l) => !l.lit));
  }

  function end(result, reason) {
    s.state = result;
    emit('game_over', { result, reason });
  }

  const groundOr = (p) => { const g = ground(p[0], p[2]); return g === null ? 0 : g; };

  // Gió mạnh: cứ mỗi 30 s một cơn 5 s; hướng chốt lúc báo trước 2 s.
  function updateWind() {
    const w = s.wind;
    if (!w.enabled) { w.active = false; return; }
    if (s.sim === w.next - C.wind_warn_ticks) w.nextDir = r3(rng.range(0, 360));
    if (s.sim === w.next) {
      w.active = true; w.ticks = C.wind_ticks; w.dir = w.nextDir ?? r3(rng.range(0, 360)); w.nextDir = null; w.next += C.wind_every;
    } else if (w.active && --w.ticks <= 0) w.active = false;
  }

  // Di chuyển theo phương ngang có xét vách: trả về true nếu đi được hết.
  function slide(pos, dx, dz, maxUp) {
    const can = (x, z) => { const g = ground(x, z); return g === null || g <= pos[1] + maxUp; };
    if (can(pos[0] + dx, pos[2] + dz)) { pos[0] += dx; pos[2] += dz; return true; }
    if (dx !== 0 && can(pos[0] + dx, pos[2])) { pos[0] += dx; return false; }
    if (dz !== 0 && can(pos[0], pos[2] + dz)) { pos[2] += dz; return false; }
    return false;
  }

  function movePlayer(inp, jumpE, dashE) {
    const P = s.player;
    if (P.dead) return;
    if (P.respawn > 0) {
      P.respawn--;
      if (P.respawn === 0) {
        P.pos = [...map.start]; P.vel = [0, 0, 0]; P.grounded = true; P.invuln = C.invuln_ticks; P.dashTicks = 0; P.launch = null;
      }
      return;
    }
    const dt = 1 / TPS;
    let [mx, mz] = inp.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = (inp.cam_yaw_deg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const wlen = Math.hypot(wx, wz);
    if (wlen > 1e-9) P.facing = [wx / wlen, wz / wlen];

    const speed = P.charm > 0 ? C.charm_speed : TUNING.player_speed;
    if (dashE && P.dashTicks === 0 && (P.dashCd === 0 || P.charm > 0)) {
      P.dashTicks = C.dash_ticks; P.dashCd = P.charm > 0 ? 0 : C.dash_cd_ticks;
      P.dashDir = wlen > 1e-9 ? [wx / wlen, wz / wlen] : [...P.facing];
      emit('dash', {});
    }
    if (P.dashTicks > 0) {
      // lướt: 14 m/s, giữ nguyên độ cao
      P.dashTicks--;
      P.vel = [P.dashDir[0] * TUNING.dash_speed, 0, P.dashDir[1] * TUNING.dash_speed];
    } else if (P.launch) {
      // đang bay từ bục nhảy: vận tốc ngang giữ nguyên, phím di chuyển không ghi đè
      P.vel[0] = P.launch[0]; P.vel[2] = P.launch[2];
      P.vel[1] += C.gravity * dt;
    } else {
      const tx = wx * speed, tz = wz * speed;
      const dx = tx - P.vel[0], dz = tz - P.vel[2];
      const dl = Math.hypot(dx, dz), maxd = (speed / C.accel_time_s) * dt;
      if (dl <= maxd) { P.vel[0] = tx; P.vel[2] = tz; } else { P.vel[0] += (dx / dl) * maxd; P.vel[2] += (dz / dl) * maxd; }
      if (jumpE && P.grounded) { P.vel[1] = C.jump_vel; P.grounded = false; }
      P.vel[1] += C.gravity * dt;
    }
    // ngang (có vách) rồi dọc
    let hx = P.vel[0] * dt, hz = P.vel[2] * dt;
    if (s.wind.active) {
      const a = (s.wind.dir * Math.PI) / 180;
      hx += Math.cos(a) * C.wind_speed * dt; hz += Math.sin(a) * C.wind_speed * dt;
    }
    if (!slide(P.pos, hx, hz, C.step_up) && P.launch) { P.launch = [0, 0, 0]; }
    P.pos[1] += P.vel[1] * dt;

    if (P.dashTicks === 0 && P.vel[1] === 0 && Math.hypot(P.vel[0], P.vel[2]) > speed + 1e-9) {
      // vừa hết lướt (đã đi đủ 12 tick ở 14 m/s): về tốc độ chạy hoặc vận tốc bay của bục
      if (P.launch) P.vel = [P.launch[0], 0, P.launch[2]];
      else P.vel = [P.dashDir[0] * speed, 0, P.dashDir[1] * speed];
    }
    // chạm đất; đang đứng thì bám theo dốc đi xuống, bước khỏi mép tầng thì rơi
    const g = ground(P.pos[0], P.pos[2]);
    const tol = P.grounded ? C.snap_down : 0;
    if (g !== null && P.vel[1] <= 0 && P.pos[1] <= g + tol + 1e-9 && P.pos[1] >= g - C.land_tol) {
      P.pos[1] = g; P.vel[1] = 0; P.grounded = true; P.launch = null;
    } else {
      P.grounded = false;
    }
    // bục nhảy
    if (P.grounded && P.dashTicks === 0) {
      for (const pad of map.pads) {
        if (distXZ(P.pos, pad.pos) <= C.pad_radius && Math.abs(P.pos[1] - pad.pos[1]) < 0.05) {
          P.launch = [pad.vel[0], 0, pad.vel[2]];
          P.vel = [...pad.vel];
          P.grounded = false;
          s.fx.launches++;
          break;
        }
      }
    }
    if (TUNING.fall_enabled && P.pos[1] < C.fall_y) {
      const lost = P.carried;
      P.carried = 0; P.flames = Math.max(0, P.flames - 1); P.dashTicks = 0; P.launch = null;
      emit('player_hit', { by: 'fall', flames: P.flames, dropped: lost, lost });
      s.fx.hits++;
      if (P.flames > 0) P.respawn = C.respawn_wait_ticks; else P.dead = true;
    }
  }

  // Bóng Mực trượt trên mặt đất (tâm cao hơn đất 1 m), không leo vách, không ra khỏi đảo.
  function shadeStep(sh, dx, dz) {
    const tryMove = (x, z) => {
      const g = ground(x, z);
      const gy = sh.pos[1] - C.shade_y;
      if (g === null || g > gy + C.step_up) return false;
      sh.pos[0] = x; sh.pos[2] = z; sh.pos[1] = g + C.shade_y;
      return true;
    };
    if (tryMove(sh.pos[0] + dx, sh.pos[2] + dz)) return true;
    if (dx !== 0 && tryMove(sh.pos[0] + dx, sh.pos[2])) return false;
    if (dz !== 0) tryMove(sh.pos[0], sh.pos[2] + dz);
    return false;
  }

  function moveShade(sh, playerActive) {
    const P = s.player;
    const dt = 1 / TPS;
    const spd = map.shadeSpeed;
    if (sh.safeTicks > 0) {
      shadeStep(sh, sh.safeVec[0], sh.safeVec[1]); sh.safeTicks--;
      if (sh.safeTicks === 0) {
        // tick cuối: đặt đúng lên mép để sai số số thực không làm vùng an toàn đẩy lại
        const l = lanternById(sh.safeFrom);
        const d = l ? distXZ(sh.pos, l.pos) : 0;
        if (l && d > 0 && d < TUNING.safe_radius) {
          const k = TUNING.safe_radius / d;
          const nx = l.pos[0] + (sh.pos[0] - l.pos[0]) * k, nz = l.pos[2] + (sh.pos[2] - l.pos[2]) * k;
          const g = ground(nx, nz);
          if (g !== null) { sh.pos[0] = nx; sh.pos[2] = nz; sh.pos[1] = g + C.shade_y; }
        }
      }
      return;
    }
    switch (sh.state) {
      case 'spawning':
        if (sh.stateTicks === 0) sh.state = 'wander';
        return;
      case 'stunned':
        if (sh.pushTicks > 0) { if (!shadeStep(sh, sh.push[0], sh.push[1])) sh.pushTicks = 0; else sh.pushTicks--; }
        if (sh.stun === 0) sh.state = 'wander';
        break;
      case 'recoil':
        shadeStep(sh, sh.recoil[0], sh.recoil[1]);
        if (--sh.recoilTicks <= 0) sh.state = 'wander';
        break;
      case 'wander': {
        if (playerActive && distXZ(sh.pos, P.pos) <= C.shade_detect) { sh.state = 'chase'; toward(sh, P.pos, spd * dt); break; }
        // Ticket-03: tìm đèn yếu (< 30) gần nhất; không có thì về đèn tắt gần nhất; không có nữa thì lang thang
        const forced = sh.forced ? lanternById(sh.forced) : null;
        const L = forced && (!forced.lit || forced.fuel < FLOW) ? forced : pickLantern(sh);
        if (L) {
          sh.target = L.id;
          const d = distXZ(sh.pos, L.pos);
          if (L.lit && L.fuel < FLOW && d <= C.drain_reach) { sh.state = 'drain'; sh.drainTicks = 0; break; }
          if (L.lit || d > 1.5) toward(sh, L.pos, C.shade_wander_speed * dt);
          break;
        }
        sh.target = null;
        if (!sh.wanderTarget || sh.wanderTicks <= 0 || distXZ(sh.pos, sh.wanderTarget) < 0.5) {
          sh.wanderTarget = map.moteSpots[rng.int(map.moteSpots.length)];
          sh.wanderTicks = 240;
        }
        sh.wanderTicks--;
        toward(sh, sh.wanderTarget, C.shade_wander_speed * dt);
        break;
      }
      case 'drain': {
        // đứng yên hút dầu (việc trừ dầu làm ở bước 2 của tick sau)
        const L = lanternById(sh.target);
        if (playerActive && distXZ(sh.pos, P.pos) <= C.drain_break) { sh.state = 'chase'; sh.drainTicks = 0; }
        else if (!L || !L.lit || L.fuel >= FLOW || distXZ(sh.pos, L.pos) > C.drain_reach) { sh.state = 'wander'; sh.drainTicks = 0; }
        break;
      }
      case 'chase':
        if (!playerActive || distXZ(sh.pos, P.pos) > C.shade_lose) { sh.state = 'wander'; sh.wanderTarget = null; break; }
        toward(sh, P.pos, spd * dt);
        break;
    }
    // chặn ở mép vùng an toàn (đèn < 30 dầu không còn vùng an toàn)
    for (const l of s.lanterns) {
      if (!safeLantern(l)) continue;
      const d = distXZ(sh.pos, l.pos);
      if (d < TUNING.safe_radius && d > 0) {
        const k = TUNING.safe_radius / d;
        const nx = l.pos[0] + (sh.pos[0] - l.pos[0]) * k, nz = l.pos[2] + (sh.pos[2] - l.pos[2]) * k;
        const g = ground(nx, nz);
        if (g !== null) { sh.pos[0] = nx; sh.pos[2] = nz; sh.pos[1] = g + C.shade_y; }
      }
    }
  }

  function toward(e, target, maxStep) {
    const dx = target[0] - e.pos[0], dz = target[2] - e.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < 1e-9) return;
    const st = Math.min(d, maxStep);
    shadeStep(e, (dx / d) * st, (dz / d) * st);
  }

  // Gió Lạc bay lơ lửng, không bị vách hay vùng an toàn chặn, nhưng không rời khỏi vùng đảo.
  function moveDrifter(d, playerActive) {
    const P = s.player;
    const dt = 1 / TPS;
    const fly = (vx, vz) => {
      const x = d.pos[0] + vx, z = d.pos[2] + vz;
      const g = ground(x, z);
      d.pos[0] = x; d.pos[2] = z;
      if (g !== null) d.pos[1] = g + C.drifter_y;
    };
    if (d.state === 'flee') {
      let dx = d.pos[0] - P.pos[0], dz = d.pos[2] - P.pos[2];
      const dl = Math.hypot(dx, dz);
      if (dl < 1e-9) { dx = 1; dz = 0; } else { dx /= dl; dz /= dl; }
      fly(dx * C.drifter_speed * dt, dz * C.drifter_speed * dt);
      if (--d.flee <= 0) d.removed = true;
      return;
    }
    const want = playerActive && P.carried >= C.drifter_min_carried && distXZ(d.pos, P.pos) <= C.drifter_detect;
    d.state = want ? 'chase' : 'idle';
    let target, sp;
    if (want) { target = P.pos; sp = C.drifter_speed; }
    else {
      if (!d.target || d.targetTicks <= 0 || distXZ(d.pos, d.target) < 0.5) { d.target = map.moteSpots[rng.int(map.moteSpots.length)]; d.targetTicks = 300; }
      d.targetTicks--;
      target = d.target; sp = C.drifter_idle_speed;
    }
    const dx = target[0] - d.pos[0], dz = target[2] - d.pos[2], dl = Math.hypot(dx, dz);
    if (dl > 1e-9) { const st = Math.min(dl, sp * dt); fly((dx / dl) * st, (dz / dl) * st); }
  }

  function snapshot() {
    const P = s.player;
    return {
      type: 'snapshot', tick: s.tick, sim_tick: s.sim, night: s.night,
      state: s.paused && s.state === 'playing' ? 'paused' : s.state,
      time_left_s: r3(s.timeLeft / TPS), score: s.score,
      wind: { active: s.wind.active, dir_deg: s.wind.dir },
      player: {
        pos: P.pos.map(r3), vel: P.vel.map(r3), grounded: P.grounded,
        flames: P.flames, carried: P.carried, capacity: capacity(), invuln: P.invuln > 0,
        dash_cd_s: r3(P.dashCd / TPS), pulse_cd_s: r3(P.pulseCd / TPS), charm_s: r3(P.charm / TPS),
      },
      lanterns: s.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(r3), lit: l.lit, deposited: l.deposited, fuel: l.lit ? f1(l.fuel) : 0, ever_lit: l.everLit, relit_count: l.relit })),
      shades: [...s.shades].sort(byId).map((sh) => ({ id: sh.id, pos: sh.pos.map(r3), state: sh.state })),
      motes_active: s.motes.length,
      motes: [...s.motes].sort(byId).map((m) => ({ id: m.id, pos: m.pos.map(r3), kind: m.kind, ttl_s: m.ttl === null ? null : r3(m.ttl / TPS) })),
      drifters: [...s.drifters].sort(byId).map((d) => ({ id: d.id, pos: d.pos.map(r3), state: d.state, stolen: d.stolen })),
      charms: s.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: r3(c.respawn / TPS) })),
    };
  }

  const drainEvents = () => { const e = s.events; s.events = []; return e; };

  return { s, step, snapshot, drainEvents };
}

function byId(a, b) {
  const na = +a.id.slice(1), nb = +b.id.slice(1);
  if (a.id[0] === b.id[0] && Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
