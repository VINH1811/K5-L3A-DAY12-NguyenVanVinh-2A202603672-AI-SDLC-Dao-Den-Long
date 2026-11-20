// Lõi mô phỏng Đảo Đèn Lồng — thuần logic, không phụ thuộc DOM/WebGL.
// Chạy giống hệt nhau trong trình duyệt (bản có giao diện) và Node (headless).
import { TPS, TUNING, C, NIGHT1 } from './config.js';
import { makeRng } from './rng.js';

export class ScenarioError extends Error {}

const r3 = (v) => Math.round(v * 1000) / 1000 + 0; // +0 bỏ -0
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);

export function createSim({ seed = 1, night = 1, scenario = null } = {}) {
  if (night !== 1) throw new ScenarioError(`night ${night} chưa được hỗ trợ (Phase 1 chỉ có Đêm 1)`);
  const rng = makeRng(seed);
  const map = NIGHT1;

  const s = {
    tick: 0,
    state: 'playing',
    result: null,
    timeLeft: TUNING.night1_duration_s * TPS, // đơn vị tick
    score: 0,
    nextMote: 1,
    nextShade: 1,
    randomMotes: true,
    randomShades: true,
    events: [],
    player: {
      pos: [0, 0, 0], vel: [0, 0, 0], grounded: true, facing: [0, 1],
      flames: TUNING.flames, carried: 0, invuln: 0, pulseCd: 0, dashCd: 0,
      dashTicks: 0, dashDir: [0, 1], respawn: 0, dead: false,
    },
    lanterns: map.lanterns.map((l) => ({ id: l.id, pos: [...l.pos], lit: false, deposited: 0 })),
    motes: [],
    shades: [],
    prev: { jump: false, interact: false, pulse: false, dash: false },
    // dữ liệu chỉ dùng để hiển thị (không ảnh hưởng logic)
    fx: { pulses: [], hits: 0, lits: [] },
  };

  // ---- dựng màn mặc định
  const spots = map.moteSpots.map((p, i) => i);
  for (let i = spots.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  const addMote = (pos, kind = 'random', ttl = null) => {
    const m = { id: `M${s.nextMote++}`, pos: [pos[0], 0, pos[2]], kind, ttl, born: s.tick };
    s.motes.push(m);
    return m;
  };
  const addShade = (pos, state = 'spawning', id = null) => {
    const sh = {
      id: id ?? `S${s.nextShade++}`, pos: [pos[0], C.shade_y, pos[2]], state,
      stateTicks: state === 'spawning' ? C.shade_spawning_ticks : 0,
      stun: 0, push: [0, 0], pushTicks: 0, recoil: [0, 0], recoilTicks: 0,
      safeTicks: 0, safeVec: [0, 0], wanderTarget: null, wanderTicks: 0,
    };
    s.shades.push(sh);
    return sh;
  };
  for (let i = 0; i < C.mote_initial; i++) addMote(map.moteSpots[spots[i]]);

  if (scenario) applyScenario(scenario);

  // ---- scenario
  function applyScenario(sc) {
    if (typeof sc !== 'object' || sc === null || Array.isArray(sc)) throw new ScenarioError('scenario phải là object');
    const p = sc.player;
    if (p !== undefined) {
      if (typeof p !== 'object' || p === null) throw new ScenarioError('player sai định dạng');
      if (p.pos !== undefined) { if (!isVec3(p.pos)) throw new ScenarioError('player.pos sai'); s.player.pos = [...p.pos]; }
      if (p.carried !== undefined) { if (!Number.isInteger(p.carried) || p.carried < 0) throw new ScenarioError('player.carried sai'); s.player.carried = p.carried; }
      if (p.flames !== undefined) { if (!Number.isInteger(p.flames) || p.flames < 0) throw new ScenarioError('player.flames sai'); s.player.flames = p.flames; }
      s.player.grounded = s.player.pos[1] <= 0 && distXZ(s.player.pos, [0, 0, 0]) <= C.island_radius;
    }
    if (sc.random_motes !== undefined) { if (typeof sc.random_motes !== 'boolean') throw new ScenarioError('random_motes sai'); s.randomMotes = sc.random_motes; }
    if (sc.random_shades !== undefined) { if (typeof sc.random_shades !== 'boolean') throw new ScenarioError('random_shades sai'); s.randomShades = sc.random_shades; }
    if (s.randomMotes === false && sc.motes === undefined) { s.motes = []; }
    if (sc.motes !== undefined) {
      if (!Array.isArray(sc.motes)) throw new ScenarioError('motes phải là mảng');
      s.motes = []; s.nextMote = 1;
      for (const m of sc.motes) {
        const pos = Array.isArray(m) ? m : m && m.pos;
        if (!isVec3(pos)) throw new ScenarioError('mote sai định dạng');
        const mm = addMote(pos);
        if (!Array.isArray(m) && typeof m.id === 'string') mm.id = m.id;
      }
    }
    if (sc.shades !== undefined) {
      if (!Array.isArray(sc.shades)) throw new ScenarioError('shades phải là mảng');
      s.shades = [];
      for (const sh of sc.shades) {
        if (!sh || !isVec3(sh.pos)) throw new ScenarioError('shade sai định dạng');
        if (sh.id !== undefined && typeof sh.id !== 'string') throw new ScenarioError('shade.id sai');
        const made = addShade([sh.pos[0], 0, sh.pos[2]], 'wander', sh.id ?? null);
        made.pos[1] = sh.pos[1];
      }
      // id tự sinh tiếp theo không trùng id có sẵn
      for (const sh of s.shades) { const n = /^S(\d+)$/.exec(sh.id); if (n) s.nextShade = Math.max(s.nextShade, +n[1] + 1); }
    }
    if (sc.lanterns !== undefined) {
      if (!Array.isArray(sc.lanterns)) throw new ScenarioError('lanterns phải là mảng');
      for (const l of sc.lanterns) {
        const target = l && s.lanterns.find((x) => x.id === l.id);
        if (!target) throw new ScenarioError(`lantern id không tồn tại: ${l && l.id}`);
        if (l.pos !== undefined) { if (!isVec3(l.pos)) throw new ScenarioError('lantern.pos sai'); target.pos = [...l.pos]; }
        if (l.deposited !== undefined) { if (!Number.isInteger(l.deposited) || l.deposited < 0) throw new ScenarioError('lantern.deposited sai'); target.deposited = l.deposited; }
        if (l.lit !== undefined) { if (typeof l.lit !== 'boolean') throw new ScenarioError('lantern.lit sai'); target.lit = l.lit; if (l.lit && l.deposited === undefined) target.deposited = TUNING.lantern_cost; }
      }
    }
    if (sc.time_left_s !== undefined) {
      if (!isNum(sc.time_left_s) || sc.time_left_s < 0) throw new ScenarioError('time_left_s sai');
      s.timeLeft = Math.round(sc.time_left_s * TPS);
    }
  }

  const emit = (name, data) => s.events.push({ type: 'event', tick: s.tick, name, data });

  // ---- một bước mô phỏng
  function step(input = {}) {
    if (s.state !== 'playing') return;
    s.tick += 1; // sự kiện của bước k ghi tick = k+1
    const P = s.player;
    const inp = {
      move: input.move ?? [0, 0], cam_yaw_deg: input.cam_yaw_deg ?? 0,
      jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse, dash: !!input.dash,
    };
    const edge = (k) => inp[k] && !s.prev[k];
    const jumpE = edge('jump'), interactE = edge('interact'), pulseE = edge('pulse'), dashE = edge('dash');
    s.prev = { jump: inp.jump, interact: inp.interact, pulse: inp.pulse, dash: inp.dash };

    // 2. bộ đếm
    s.timeLeft = Math.max(0, s.timeLeft - 1);
    if (P.pulseCd > 0) P.pulseCd--;
    if (P.dashCd > 0) P.dashCd--;
    if (P.invuln > 0) P.invuln--;
    for (const m of s.motes) if (m.ttl !== null) m.ttl--;
    s.motes = s.motes.filter((m) => m.ttl === null || m.ttl > 0);
    for (const sh of s.shades) {
      if (sh.state === 'spawning' && sh.stateTicks > 0) sh.stateTicks--;
      if (sh.stun > 0) sh.stun--;
    }

    // 3. di chuyển Mây
    movePlayer(inp, jumpE, dashE);

    const active = !P.dead && P.respawn === 0;
    // 4. nhặt đom đóm
    if (active) {
      for (const m of [...s.motes].sort(byId)) {
        if (P.carried >= TUNING.carry_capacity) break;
        if (m.born >= s.tick) continue; // đom đóm rơi chỉ nhặt được từ tick sau
        if (distXZ(P.pos, m.pos) <= TUNING.pickup_radius && Math.abs(P.pos[1] - m.pos[1]) <= C.pickup_dy) {
          s.motes.splice(s.motes.indexOf(m), 1);
          P.carried++;
          emit('mote_picked', { carried: P.carried });
        }
      }
    }

    // 5. tương tác với đèn
    if (active && interactE) {
      let best = null, bd = Infinity;
      for (const l of s.lanterns) {
        if (l.lit) continue;
        const d = distXZ(P.pos, l.pos);
        if (d <= TUNING.interact_radius && (d < bd || (d === bd && l.id < best.id))) { best = l; bd = d; }
      }
      if (best && P.carried > 0) {
        const amount = Math.min(P.carried, TUNING.lantern_cost - best.deposited);
        if (amount > 0) {
          P.carried -= amount; best.deposited += amount;
          s.score += amount * TUNING.score.per_mote;
          emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= TUNING.lantern_cost) {
            best.lit = true;
            s.score += TUNING.score.per_lantern;
            emit('lantern_lit', { lantern_id: best.id });
            s.fx.lits.push({ id: best.id, tick: s.tick });
          }
        }
      }
    }

    // 6. vùng an toàn: bóng nằm trong vùng đèn sáng bị đẩy ra mép trong tối đa 30 tick
    for (const l of s.lanterns) {
      if (!l.lit) continue;
      for (const sh of s.shades) {
        if (sh.safeTicks > 0) continue;
        const d = distXZ(sh.pos, l.pos);
        if (d < TUNING.safe_radius) {
          let dx = sh.pos[0] - l.pos[0], dz = sh.pos[2] - l.pos[2];
          if (d === 0) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
          const need = TUNING.safe_radius - d;
          sh.safeTicks = C.safe_push_ticks;
          sh.safeVec = [(dx * need) / C.safe_push_ticks, (dz * need) / C.safe_push_ticks];
        }
      }
    }

    // 7. Tỏa Sáng
    if (active && pulseE && P.pulseCd === 0 && P.carried >= TUNING.pulse_cost) {
      P.carried -= TUNING.pulse_cost;
      P.pulseCd = C.pulse_cd_ticks;
      const c = [P.pos[0], P.pos[1] + C.pulse_center_dy, P.pos[2]];
      const ids = [];
      for (const sh of [...s.shades].sort(byId)) {
        const d3 = Math.hypot(sh.pos[0] - c[0], sh.pos[1] - c[1], sh.pos[2] - c[2]);
        if (d3 > TUNING.pulse_radius) continue;
        let dx = sh.pos[0] - c[0], dz = sh.pos[2] - c[2];
        const dh = Math.hypot(dx, dz);
        if (dh === 0) { dx = 1; dz = 0; } else { dx /= dh; dz /= dh; }
        sh.state = 'stunned'; sh.stun = C.stun_ticks;
        sh.push = [(dx * TUNING.pulse_push_m) / C.push_ticks, (dz * TUNING.pulse_push_m) / C.push_ticks];
        sh.pushTicks = C.push_ticks;
        sh.recoilTicks = 0;
        ids.push(sh.id);
        s.score += TUNING.score.per_stun;
      }
      emit('pulse', { stunned_ids: ids });
      s.fx.pulses.push({ tick: s.tick, pos: [...P.pos] });
    }

    // 8. di chuyển Bóng Mực
    for (const sh of [...s.shades].sort(byId)) moveShade(sh, active);

    // 9. chạm: tối đa một lần mất Ngọn Lửa mỗi tick
    if (active && P.invuln === 0) {
      for (const sh of [...s.shades].sort(byId)) {
        if ((sh.state !== 'wander' && sh.state !== 'chase') || sh.safeTicks > 0) continue;
        if (distXZ(P.pos, sh.pos) <= TUNING.shade_hit_radius && Math.abs(P.pos[1] - sh.pos[1]) <= C.shade_hit_dy) {
          P.flames = Math.max(0, P.flames - 1);
          const dropped = Math.floor(P.carried * TUNING.hit_drop_ratio);
          P.carried -= dropped;
          for (let i = 0; i < dropped; i++) {
            const a = rng.range(0, Math.PI * 2), r = rng.range(C.drop_r_min, C.drop_r_max);
            addMote([P.pos[0] + r * Math.cos(a), 0, P.pos[2] + r * Math.sin(a)], 'dropped', C.drop_ttl_ticks);
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
    if (s.randomMotes && s.tick % C.mote_spawn_every === 0 && s.motes.length < C.mote_cap) {
      const empty = map.moteSpots.filter((p) => !s.motes.some((m) => distXZ(m.pos, p) < 0.5));
      if (empty.length) addMote(empty[rng.int(empty.length)]);
    }
    if (s.randomShades && s.tick >= C.shade_spawn_first && (s.tick - C.shade_spawn_first) % C.shade_spawn_every === 0) {
      const n = s.tick === C.shade_spawn_first ? 2 : 1;
      for (let i = 0; i < n && s.shades.length < C.shade_max; i++) {
        const valid = map.shadeSpots.filter((p) => distXZ(p, P.pos) >= C.shade_spawn_min_dist && !s.shades.some((sh) => distXZ(sh.pos, p) < 2));
        if (!valid.length) break;
        const sh = addShade(valid[rng.int(valid.length)]);
        emit('shade_spawned', { id: sh.id });
      }
    }

    // 11. thắng / thua
    if (P.flames <= 0) end('lost', 'no_flames');
    else if (s.lanterns.every((l) => l.lit)) {
      s.score += Math.floor(s.timeLeft / TPS) * TUNING.score.per_second_left + P.flames * TUNING.score.per_flame_left;
      end('won', 'all_lit');
    } else if (s.timeLeft <= 0) end('lost', 'dawn');
  }

  function end(result, reason) {
    s.state = result;
    emit('game_over', { result, reason });
  }

  function movePlayer(inp, jumpE, dashE) {
    const P = s.player;
    if (P.dead) return;
    if (P.respawn > 0) {
      P.respawn--;
      if (P.respawn === 0) {
        P.pos = [0, 0, 0]; P.vel = [0, 0, 0]; P.grounded = true; P.invuln = C.invuln_ticks; P.dashTicks = 0;
      }
      return;
    }
    // hướng di chuyển theo camera
    let [mx, mz] = inp.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = (inp.cam_yaw_deg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const wlen = Math.hypot(wx, wz);
    if (wlen > 1e-9) P.facing = [wx / wlen, wz / wlen];

    if (dashE && P.dashCd === 0 && P.dashTicks === 0) {
      P.dashTicks = C.dash_ticks; P.dashCd = C.dash_cd_ticks;
      P.dashDir = wlen > 1e-9 ? [wx / wlen, wz / wlen] : [...P.facing];
      emit('dash', {});
    }
    const dt = 1 / TPS;
    if (P.dashTicks > 0) {
      P.dashTicks--;
      P.vel = [P.dashDir[0] * TUNING.dash_speed, 0, P.dashDir[1] * TUNING.dash_speed];
      if (P.dashTicks === 0) P.vel = [P.dashDir[0] * TUNING.player_speed, 0, P.dashDir[1] * TUNING.player_speed];
    } else {
      const tx = wx * TUNING.player_speed, tz = wz * TUNING.player_speed;
      const dx = tx - P.vel[0], dz = tz - P.vel[2];
      const dl = Math.hypot(dx, dz), maxd = C.accel * dt;
      if (dl <= maxd) { P.vel[0] = tx; P.vel[2] = tz; } else { P.vel[0] += (dx / dl) * maxd; P.vel[2] += (dz / dl) * maxd; }
      if (jumpE && P.grounded) { P.vel[1] = C.jump_vel; P.grounded = false; }
      P.vel[1] += C.gravity * dt;
    }
    P.pos[0] += P.vel[0] * dt; P.pos[1] += P.vel[1] * dt; P.pos[2] += P.vel[2] * dt;
    const onIsland = Math.hypot(P.pos[0], P.pos[2]) <= C.island_radius;
    if (onIsland && P.pos[1] <= 0 && P.vel[1] <= 0 && P.pos[1] > -0.5) {
      P.pos[1] = 0; P.vel[1] = 0; P.grounded = true;
    } else {
      P.grounded = false;
    }
    if (TUNING.fall_enabled && P.pos[1] < C.fall_y) {
      const lost = P.carried;
      P.carried = 0; P.flames = Math.max(0, P.flames - 1); P.dashTicks = 0;
      emit('player_hit', { by: 'fall', flames: P.flames, dropped: lost });
      s.fx.hits++;
      if (P.flames > 0) P.respawn = C.respawn_wait_ticks; else P.dead = true;
    }
  }

  function moveShade(sh, playerActive) {
    const P = s.player;
    const dt = 1 / TPS;
    if (sh.safeTicks > 0) {
      sh.pos[0] += sh.safeVec[0]; sh.pos[2] += sh.safeVec[1]; sh.safeTicks--;
      return;
    }
    switch (sh.state) {
      case 'spawning':
        if (sh.stateTicks === 0) sh.state = 'wander';
        return;
      case 'stunned':
        if (sh.pushTicks > 0) { sh.pos[0] += sh.push[0]; sh.pos[2] += sh.push[1]; sh.pushTicks--; }
        if (sh.stun === 0) sh.state = 'wander';
        break;
      case 'recoil':
        sh.pos[0] += sh.recoil[0]; sh.pos[2] += sh.recoil[1];
        if (--sh.recoilTicks <= 0) sh.state = 'wander';
        break;
      case 'wander': {
        if (playerActive && distXZ(sh.pos, P.pos) <= C.shade_detect) { sh.state = 'chase'; moveToward(sh, P.pos, TUNING.shade_speed * dt); break; }
        if (!sh.wanderTarget || sh.wanderTicks <= 0 || distXZ(sh.pos, sh.wanderTarget) < 0.5) {
          const a = rng.range(0, Math.PI * 2), r = 34 * Math.sqrt(rng.next());
          sh.wanderTarget = [r * Math.cos(a), 0, r * Math.sin(a)];
          sh.wanderTicks = 240;
        }
        sh.wanderTicks--;
        moveToward(sh, sh.wanderTarget, C.shade_wander_speed * dt);
        break;
      }
      case 'chase':
        if (!playerActive || distXZ(sh.pos, P.pos) > C.shade_lose) { sh.state = 'wander'; sh.wanderTarget = null; break; }
        moveToward(sh, P.pos, TUNING.shade_speed * dt);
        break;
    }
    // chặn ở mép vùng an toàn và trong đảo
    for (const l of s.lanterns) {
      if (!l.lit) continue;
      const d = distXZ(sh.pos, l.pos);
      if (d < TUNING.safe_radius && d > 0) {
        sh.pos[0] = l.pos[0] + ((sh.pos[0] - l.pos[0]) / d) * TUNING.safe_radius;
        sh.pos[2] = l.pos[2] + ((sh.pos[2] - l.pos[2]) / d) * TUNING.safe_radius;
      }
    }
    const rr = Math.hypot(sh.pos[0], sh.pos[2]);
    if (rr > C.island_radius) { sh.pos[0] *= C.island_radius / rr; sh.pos[2] *= C.island_radius / rr; }
  }

  function moveToward(sh, target, maxStep) {
    const dx = target[0] - sh.pos[0], dz = target[2] - sh.pos[2];
    const d = Math.hypot(dx, dz);
    if (d <= maxStep) { sh.pos[0] = target[0]; sh.pos[2] = target[2]; } else { sh.pos[0] += (dx / d) * maxStep; sh.pos[2] += (dz / d) * maxStep; }
  }

  function snapshot() {
    const P = s.player;
    return {
      type: 'snapshot', tick: s.tick, sim_tick: s.tick, state: s.state,
      time_left_s: r3(s.timeLeft / TPS), score: s.score,
      player: { pos: P.pos.map(r3), flames: P.flames, carried: P.carried },
      lanterns: s.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(r3), lit: l.lit, deposited: l.deposited })),
      shades: [...s.shades].sort(byId).map((sh) => ({ id: sh.id, pos: sh.pos.map(r3), state: sh.state })),
      motes_active: s.motes.length,
      motes: [...s.motes].sort(byId).map((m) => ({ id: m.id, pos: m.pos.map(r3) })),
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
