// Scenario headless cho Ticket-02 (Contract v1.1): 3 Đêm, bục nhảy, tầng, gió, Gió Lạc, Bùa Gió, lướt, tạm dừng.
// Mỗi luật mới có ít nhất một scenario, chạy qua đúng CLI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from './run.mjs';

const quiet = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], drifters: [] };
const near = (a, b, eps = 0.05) => Math.abs(a - b) <= eps;
const dist2 = (p, c) => Math.hypot(p[0] - c[0], p[2] - c[1]);

test('v1.1: snapshot có night, wind, player mở rộng, motes/drifters/charms; night_start ở tick 0', () => {
  for (const [night, nl] of [[1, 5], [2, 6], [3, 7]]) {
    const r = run({ night, ticks: 1 });
    assert.equal(r.code, 0);
    const s0 = r.snaps[0];
    assert.equal(s0.night, night);
    assert.equal(s0.lanterns.length, nl);
    assert.deepEqual(Object.keys(s0.wind).sort(), ['active', 'dir_deg']);
    for (const k of ['pos', 'vel', 'grounded', 'flames', 'carried', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) assert.ok(k in s0.player, k);
    assert.ok(Array.isArray(s0.drifters) && Array.isArray(s0.charms));
    assert.ok(s0.motes.every((m) => m.kind === 'random' && m.ttl_s === null));
    const ns = r.allEvents.find((e) => e.name === 'night_start');
    assert.deepEqual([ns.tick, ns.data], [0, { night }]);
  }
});

test('Đêm 2: đi qua cầu tre từ đảo A sang đảo B không rơi', () => {
  const r = run({ night: 2, scenario: { ...quiet, player: { pos: [20, 0, 0] } }, ticks: 300, inputs: { frames: [{ tick: 0, move: [-1, 0], cam_yaw_deg: 180 }, { tick: 300, move: [0, 0] }] } });
  // cam_yaw 180: move x=-1 → hướng +X
  const p = r.snaps.at(-1).player.pos;
  assert.ok(p[0] > 45 && p[1] === 0, `pos=${p}`);
  assert.equal(r.events.filter((e) => e.name === 'player_hit').length, 0);
});

test('Đêm 2: bước ra mép cầu (không lan can) thì rơi', () => {
  const r = run({ night: 2, scenario: { ...quiet, player: { pos: [35, 0, 0] } }, ticks: 200, inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  const h = r.events.find((e) => e.name === 'player_hit');
  assert.equal(h.data.by, 'fall');
});

test('Đêm 2: bục nhảy (20,0,18) bắn sang đảo B, đáp sau ~1.4 s', () => {
  const r = run({ night: 2, scenario: { ...quiet, player: { pos: [20, 0, 18] } }, ticks: 120, every: 1 });
  const s1 = r.snaps.find((s) => s.tick === 1);
  assert.ok(s1.player.vel[1] > 13 && !s1.player.grounded, JSON.stringify(s1.player));
  const land = r.snaps.find((s) => s.tick > 5 && s.player.grounded);
  assert.ok(land, 'phải chạm đất');
  assert.ok(land.tick >= 80 && land.tick <= 90, `đáp ở tick ${land.tick}`);
  assert.ok(dist2(land.player.pos, [70, 0]) <= 28, `pos=${land.player.pos}`);
  assert.equal(r.events.filter((e) => e.name === 'player_hit').length, 0);
});

test('Đêm 2: đang bay từ bục thì phím di chuyển không ghi đè vận tốc', () => {
  const a = run({ night: 2, scenario: { ...quiet, player: { pos: [20, 0, 18] } }, ticks: 40 });
  const b = run({ night: 2, scenario: { ...quiet, player: { pos: [20, 0, 18] } }, ticks: 40, inputs: { frames: [{ tick: 2, move: [1, 0] }] } });
  assert.deepEqual(a.snaps.at(-1).player.pos, b.snaps.at(-1).player.pos);
});

test('Đêm 3: vách tầng 1 không đi lên được', () => {
  const r = run({ night: 3, scenario: { ...quiet, player: { pos: [0, 0, 27] } }, ticks: 120, inputs: { frames: [{ tick: 0, move: [0, -1] }] } });
  const p = r.snaps.at(-1).player.pos;
  assert.ok(p[2] >= 24 && p[1] === 0, `pos=${p}`);
});

test('Đêm 3: theo dốc 30° lên tầng 1 (Y = 3)', () => {
  const a = (30 * Math.PI) / 180;
  const r = run({ night: 3, scenario: { ...quiet, player: { pos: [31 * Math.cos(a), 0, 31 * Math.sin(a)] } }, ticks: 100, inputs: { frames: [{ tick: 0, move: [-Math.cos(a), -Math.sin(a)] }, { tick: 90, move: [0, 0] }] } });
  const p = r.snaps.at(-1).player;
  assert.equal(p.pos[1], 3);
  assert.equal(p.grounded, true);
});

test('Đêm 3: bước ra mép tầng 1 thì rơi xuống tầng 0, không mất Ngọn Lửa', () => {
  const r = run({ night: 3, scenario: { ...quiet, player: { pos: [0, 3, 22] } }, ticks: 90, inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  const p = r.snaps.at(-1).player;
  assert.equal(p.pos[1], 0);
  assert.equal(p.flames, 3);
});

test('Đêm 3: bục (0,3,13) đưa lên tầng 2 (Y = 6)', () => {
  const r = run({ night: 3, scenario: { ...quiet, player: { pos: [0, 3, 13] } }, ticks: 90 });
  const p = r.snaps.at(-1).player;
  assert.equal(p.pos[1], 6, `pos=${p.pos}`);
  assert.ok(Math.hypot(p.pos[0], p.pos[2]) <= 8);
});

test('Đêm 3: tháp chuông là vật cản', () => {
  const r = run({ night: 3, scenario: { ...quiet, player: { pos: [0, 6, -6] } }, ticks: 120, inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  const p = r.snaps.at(-1).player.pos;
  assert.ok(Math.hypot(p[0], p[2]) >= 2, `pos=${p}`);
});

test('Lướt: 14 m/s trong 0.2 s, hồi chiêu 1.5 s, sự kiện dash', () => {
  const r = run({ scenario: quiet, ticks: 60, every: 1, inputs: { frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 30, dash: true }, { tick: 31, dash: false }] } });
  assert.deepEqual(r.events.filter((e) => e.name === 'dash').map((e) => e.tick), [1]);
  const s12 = r.snaps.find((s) => s.tick === 12);
  assert.ok(near(s12.player.pos[2], 14 * 0.2, 0.01), `z=${s12.player.pos[2]}`); // hướng mặt +Z
  assert.ok(near(r.snaps.find((s) => s.tick === 1).player.dash_cd_s, 1.5, 0.001));
});

test('Lướt trên không giữ nguyên độ cao', () => {
  const r = run({ scenario: quiet, ticks: 40, every: 1, inputs: { frames: [{ tick: 0, jump: true }, { tick: 10, dash: true }] } });
  const ys = r.snaps.filter((s) => s.tick >= 12 && s.tick <= 22).map((s) => s.player.pos[1]);
  assert.ok(ys.every((y) => y === ys[0]) && ys[0] > 0, `ys=${ys}`);
});

test('Bùa Gió: nhặt → charm_picked, 7.2 m/s, bùa hồi lại sau 2700 tick', () => {
  const r = run({ night: 2, scenario: { ...quiet, player: { pos: [33, 0, 0] } }, ticks: 80, inputs: { frames: [{ tick: 0, move: [-1, 0], cam_yaw_deg: 180 }] } });
  const ev = r.events.find((e) => e.name === 'charm_picked');
  assert.deepEqual(ev.data, { charm_id: 'C1', charm_ticks: 600 });
  const last = r.snaps.at(-1);
  assert.ok(near(last.player.vel[0], 7.2, 0.001), `vel=${last.player.vel}`);
  assert.equal(last.charms[0].available, false);
  const picked = ev.tick; // còn 2700 − (80 − picked) tick
  assert.ok(near(last.charms[0].respawn_s, (2700 - (80 - picked)) / 60, 0.001), `respawn_s=${last.charms[0].respawn_s}`);
});

test('Bùa Gió: lướt không hồi chiêu nhưng phải bấm lại; bấm khi đang lướt bị bỏ qua', () => {
  const frames = [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 20, dash: true }, { tick: 21, dash: false }];
  const r = run({ scenario: { ...quiet, player: { charm_ticks: 600 } }, ticks: 30, inputs: { frames } });
  assert.deepEqual(r.events.filter((e) => e.name === 'dash').map((e) => e.tick), [1, 21]);
});

test('Gió Lạc: đuổi khi mang ≥ 5, cướp 3 đom đóm rồi bỏ chạy và biến mất sau 240 tick', () => {
  const r = run({ night: 2, scenario: { ...quiet, player: { carried: 6 }, drifters: [{ id: 'D1', pos: [6, 1.2, 0] }] }, ticks: 300 });
  const st = r.events.find((e) => e.name === 'drifter_steal');
  assert.deepEqual(st.data, { drifter_id: 'D1', amount: 3, carried: 3 });
  const after = r.snaps.find((s) => s.tick >= st.tick + 10);
  assert.equal(after.drifters[0].state, 'flee');
  assert.equal(after.drifters[0].stolen, 3);
  assert.equal(r.snaps.at(-1).drifters.length, 0);
  assert.equal(r.events.filter((e) => e.name === 'player_hit').length, 0); // không mất Ngọn Lửa
});

test('Gió Lạc: mang < 5 thì không đuổi', () => {
  const r = run({ night: 2, scenario: { ...quiet, player: { carried: 4 }, drifters: [{ id: 'D1', pos: [10, 1.2, 0] }] }, ticks: 30 });
  assert.equal(r.snaps.at(-1).drifters[0].state, 'idle');
});

test('Tỏa Sáng trúng Gió Lạc đang bỏ chạy có đồ → thả lại đom đóm (drifter_drop)', () => {
  const r = run({ night: 2, scenario: { ...quiet, player: { carried: 3 }, drifters: [{ id: 'D1', pos: [2, 1.2, 0], state: 'flee', stolen: 3 }] }, ticks: 200, inputs: { frames: [{ tick: 0, pulse: true }] } });
  const d = r.events.find((e) => e.name === 'drifter_drop');
  assert.deepEqual([d.tick, d.data], [1, { drifter_id: 'D1', amount: 3 }]);
  const s = r.snaps.find((x) => x.tick === 10);
  assert.equal(s.motes.filter((m) => m.kind === 'dropped').length, 3);
  assert.ok(r.snaps.find((x) => x.tick === 130).drifters.length === 0, 'biến mất sau 120 tick');
});

test('Tỏa Sáng trúng Gió Lạc đang đuổi → bỏ chạy, không cướp', () => {
  const r = run({ night: 2, scenario: { ...quiet, player: { carried: 9 }, drifters: [{ id: 'D1', pos: [4, 1.2, 0], state: 'chase' }] }, ticks: 60, inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(r.events.filter((e) => e.name === 'drifter_steal').length, 0);
  assert.equal(r.snaps.at(-1).drifters[0].state, 'flee');
  assert.equal(r.snaps.at(-1).player.carried, 6);
});

test('Gió Lạc sinh ở tick 1200 trên Đêm 2, id D1', () => {
  const r = run({ night: 2, scenario: { random_shades: false }, ticks: 1199, every: 1199 });
  assert.equal(r.snaps.at(-1).drifters.length, 0);
  const r2 = run({ night: 2, scenario: { random_shades: false }, ticks: 1200, every: 1200 });
  assert.deepEqual(r2.snaps.at(-1).drifters.map((d) => d.id), ['D1']);
});

test('Tạm dừng: tick tăng, sim_tick / thời gian đứng yên, snapshot paused', () => {
  const frames = [{ tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 50, pause: true }, { tick: 51, pause: false }];
  const r = run({ scenario: quiet, ticks: 100, inputs: { frames } });
  assert.deepEqual(r.events.map((e) => [e.tick, e.name]), [[11, 'paused'], [51, 'resumed']]);
  const s30 = r.snaps.find((s) => s.tick === 30);
  assert.equal(s30.state, 'paused');
  assert.equal(s30.sim_tick, 10);
  const last = r.snaps.at(-1);
  assert.equal(last.sim_tick, 100 - 40);
  assert.equal(last.time_left_s, 300 - 60 / 60);
});

test('Gió mạnh Đêm 3: 30 s một lần, 5 s, đẩy 2 m/s', () => {
  const r = run({ night: 3, scenario: { ...quiet, wind_enabled: true }, ticks: 2160, every: 60 });
  const s1800 = r.snaps.find((s) => s.tick === 1800), s1860 = r.snaps.find((s) => s.tick === 1860), s2160 = r.snaps.at(-1);
  assert.equal(r.snaps.find((s) => s.tick === 1740).wind.active, false);
  assert.equal(s1800.wind.active, true);
  const moved = Math.hypot(s1860.player.pos[0] - s1800.player.pos[0], s1860.player.pos[2] - s1800.player.pos[2]);
  assert.ok(near(moved, 2, 0.05), `moved=${moved}`);
  assert.equal(s2160.wind.active, false);
  const off = run({ night: 3, scenario: quiet, ticks: 1900, every: 1900 });
  assert.deepEqual(off.snaps.at(-1).player.pos, [0, 0, -20]);
});

test('Lịch sinh Bóng Mực: Đêm 2 mỗi 7 s, Đêm 3 mỗi 6 s', () => {
  const r2 = run({ night: 2, ticks: 721 });
  assert.deepEqual(r2.events.filter((e) => e.name === 'shade_spawned').map((e) => e.tick), [300, 300, 720]);
  const r3 = run({ night: 3, ticks: 661 });
  assert.deepEqual(r3.events.filter((e) => e.name === 'shade_spawned').map((e) => e.tick), [300, 300, 660]);
});

test('Bóng Mực Đêm 3 đuổi 4.5 m/s, tên trạng thái chuẩn', () => {
  const r = run({ night: 3, scenario: { ...quiet, shades: [{ id: 'S1', pos: [10, 1, -20], state: 'chase' }] }, ticks: 60, every: 60 });
  const sh = r.snaps.at(-1).shades[0];
  assert.equal(sh.state, 'chase');
  assert.ok(near(sh.pos[0], 10 - 4.5, 0.01), `x=${sh.pos[0]}`);
});

test('scenario shades[].state + state_ticks_left', () => {
  const r = run({ scenario: { ...quiet, shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'stunned', state_ticks_left: 30 }] }, ticks: 29, every: 29 });
  assert.equal(r.snaps.at(-1).shades[0].state, 'stunned');
  assert.equal(r.events.filter((e) => e.name === 'player_hit').length, 0);
  assert.equal(run({ scenario: { shades: [{ pos: [1, 1, 1], state: 'dancing' }] } }).code, 2);
});

test('Đêm 3 đầy đủ 21 600 tick chạy dưới 30 s', () => {
  const t = Date.now();
  const r = run({ night: 3, ticks: 21600, inputs: { frames: [{ tick: 0, move: [1, 0.3] }, { tick: 400, move: [-0.4, 1] }] } });
  assert.equal(r.code, 0);
  assert.ok(Date.now() - t < 30000);
});

test('tất định trên Đêm 2 và 3 (cùng seed → byte giống hệt, kể cả id D*, S*)', () => {
  for (const night of [2, 3]) {
    const inputs = { frames: [{ tick: 0, move: [0.4, 1], cam_yaw_deg: 20 }, { tick: 300, dash: true }, { tick: 301, dash: false }, { tick: 900, move: [-1, -0.2] }] };
    const a = run({ night, seed: 5, ticks: 4000, inputs });
    const b = run({ night, seed: 5, ticks: 4000, inputs });
    assert.equal(a.raw, b.raw);
  }
});
