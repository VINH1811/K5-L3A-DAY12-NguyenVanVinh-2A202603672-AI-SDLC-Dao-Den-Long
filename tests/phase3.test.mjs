// Scenario headless cho Ticket-03 "Đèn cạn dầu" (Contract v1.2). Chạy qua đúng CLI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { run, ROOT } from './run.mjs';

const quiet = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], drifters: [] };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const L = (snap, id) => snap.lanterns.find((l) => l.id === id);
const dXZ = (p, q) => Math.hypot(p[0] - q[0], p[2] - q[2]);

test('contract v1.2: có các khóa mới và thời lượng 240/270/300', () => {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
  const want = { fuel_max: 100, fuel_decay_per_s: 1.0, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6, drain_per_s: 5, low_fuel_threshold: 30, capacity_max: 20, night1_duration_s: 240, night2_duration_s: 270, night3_duration_s: 300 };
  for (const [k, v] of Object.entries(want)) assert.equal(c.tuning[k], v, k);
  for (const [n, s] of [[1, 240], [2, 270], [3, 300]]) assert.equal(run({ night: n, ticks: 0 }).snaps[0].time_left_s, s);
});

test('snapshot: đèn có fuel (1 chữ số), ever_lit, relit_count; player có capacity', () => {
  const r = run({ scenario: { ...quiet, lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true, fuel: 42.25 }] }, ticks: 0 });
  const s0 = r.snaps[0];
  assert.deepEqual(L(s0, 'L1'), { id: 'L1', pos: [0, 0, 25], lit: true, deposited: 10, fuel: 100, ever_lit: true, relit_count: 0 });
  assert.equal(L(s0, 'L2').fuel, 42.3);
  assert.equal(L(s0, 'L3').fuel, 0);
  assert.equal(L(s0, 'L3').ever_lit, false);
  assert.equal(s0.player.capacity, 10);
});

test('dầu hao 1/giây khi đèn sáng', () => {
  const r = run({ scenario: { ...quiet, lanterns: [{ id: 'L1', lit: true }] }, ticks: 600, every: 600 });
  assert.equal(L(r.snaps.at(-1), 'L1').fuel, 90);
});

test('hết dầu: lantern_out, đèn tắt, deposited = 0, vẫn nhớ ever_lit', () => {
  const r = run({ scenario: { ...quiet, lanterns: [{ id: 'L1', lit: true, fuel: 1 }] }, ticks: 70, every: 70 });
  const ev = r.events.find((e) => e.name === 'lantern_out');
  assert.deepEqual([ev.tick, ev.data], [60, { lantern_id: 'L1' }]);
  assert.deepEqual(L(r.snaps.at(-1), 'L1'), { id: 'L1', pos: [0, 0, 25], lit: false, deposited: 0, fuel: 0, ever_lit: true, relit_count: 0 });
});

test('thắp lần đầu: lantern_lit relight=false, +5/đom đóm +100, fuel 100', () => {
  const r = run({ scenario: { ...quiet, player: { pos: [0, 0, 24], carried: 10 } }, ticks: 2, every: 1, inputs: { frames: [{ tick: 0, interact: true }] } });
  const lit = r.events.find((e) => e.name === 'lantern_lit');
  assert.deepEqual([lit.tick, lit.data], [1, { lantern_id: 'L1', relight: false }]);
  assert.equal(r.snaps.find((s) => s.tick === 1).score, 10 * 5 + 100);
  assert.equal(L(r.snaps.find((s) => s.tick === 1), 'L1').fuel, 100);
});

test('thắp lại đèn đã từng sáng: chỉ cần 5 đom đóm, +40, relit_count 1', () => {
  const r = run({ scenario: { ...quiet, player: { pos: [0, 0, 24], carried: 8 }, lanterns: [{ id: 'L1', ever_lit: true }] }, ticks: 2, every: 1, inputs: { frames: [{ tick: 0, interact: true }] } });
  const dep = r.events.find((e) => e.name === 'deposit');
  assert.deepEqual(dep.data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  assert.deepEqual(r.events.find((e) => e.name === 'lantern_lit').data, { lantern_id: 'L1', relight: true });
  const s1 = r.snaps.find((s) => s.tick === 1);
  assert.equal(s1.score, 5 * 5 + 40);
  assert.equal(s1.player.carried, 3);
  assert.equal(L(s1, 'L1').relit_count, 1);
});

test('châm dầu: used = min(mang, ceil((100 − fuel)/10)), refuel event, +5/đom đóm', () => {
  const r = run({ scenario: { ...quiet, player: { pos: [0, 0, 24], carried: 10 }, lanterns: [{ id: 'L1', lit: true, fuel: 55 }] }, ticks: 2, every: 1, inputs: { frames: [{ tick: 0, interact: true }] } });
  const ev = r.events.find((e) => e.name === 'refuel');
  // bước 1: hao trước (55 → 54.983), cần ceil(45.017/10) = 5, dầu lên tối đa 100
  assert.deepEqual([ev.tick, ev.data], [1, { lantern_id: 'L1', amount: 5, fuel: 100 }]);
  const s1 = r.snaps.find((s) => s.tick === 1);
  assert.equal(s1.player.carried, 5);
  assert.equal(s1.score, 25);
});

test('châm dầu khi mang ít hơn mức cần', () => {
  const r = run({ scenario: { ...quiet, player: { pos: [0, 0, 24], carried: 2 }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }] }, ticks: 1, every: 1, inputs: { frames: [{ tick: 0, interact: true }] } });
  // 20 − 1/60 + 2 × 10 = 39.983 → 40.0
  assert.deepEqual(r.events.find((e) => e.name === 'refuel').data, { lantern_id: 'L1', amount: 2, fuel: 40 });
});

test('đèn sáng không nhận được (không mang gì) thì không được chọn, không sự kiện', () => {
  const r = run({ scenario: { ...quiet, player: { pos: [0, 0, 24], carried: 0 }, lanterns: [{ id: 'L1', lit: true, fuel: 50 }] }, ticks: 3, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(r.events.length, 0);
});

test('chọn đèn: bỏ qua đèn không nhận được, lấy đèn nhận được gần nhất', () => {
  // L1 sáng 50 dầu ở (0,0,25), đặt L2 chưa sáng ở (0,0,22.6); Mây ở (0,0,23.5): L2 gần hơn
  const r = run({ scenario: { ...quiet, player: { pos: [0, 0, 23.5], carried: 3 }, lanterns: [{ id: 'L1', lit: true, fuel: 50 }, { id: 'L2', pos: [0, 0, 22.6] }] }, ticks: 1, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(r.events.map((e) => e.name), ['deposit']);
  assert.equal(r.events[0].data.lantern_id, 'L2');
});

test('đèn dưới 30 dầu mất vùng an toàn; Bóng Mực wander tới hút (drain) 5/giây, fuel_drain mỗi 60 tick', () => {
  const r = run({ scenario: { ...quiet, lanterns: [{ id: 'L1', lit: true, fuel: 25 }], shades: [{ id: 'S1', pos: [0, 1, 31] }] }, ticks: 400, every: 10 });
  const first = r.snaps.find((s) => s.shades[0].state === 'drain');
  assert.ok(first, 'phải chuyển drain');
  assert.ok(dXZ(first.shades[0].pos, [0, 0, 25]) <= 2 + 1e-6);
  const drains = r.events.filter((e) => e.name === 'fuel_drain');
  assert.ok(drains.length >= 2);
  assert.deepEqual(Object.keys(drains[0].data).sort(), ['fuel', 'lantern_id', 'shade_id']);
  // giữa hai sự kiện liên tiếp: 60 tick × (1 + 5)/60 = 6 dầu
  assert.ok(near(drains[0].data.fuel - drains[1].data.fuel, 6, 0.05), `${drains[0].data.fuel} → ${drains[1].data.fuel}`);
  assert.equal(drains[1].tick - drains[0].tick, 60);
});

test('đúng 30 dầu vẫn còn vùng an toàn: Bóng Mực không vào', () => {
  const r = run({ scenario: { ...quiet, lanterns: [{ id: 'L1', lit: true, fuel: 30.5 }], shades: [{ id: 'S1', pos: [0, 1, 33], target_lantern_id: 'L1' }] }, ticks: 25, every: 1 });
  for (const s of r.snaps) assert.ok(dXZ(s.shades[0].pos, [0, 0, 25]) >= 6 - 1e-6, `tick ${s.tick}`);
});

test('drain → chase khi Mây vào trong 6 m', () => {
  const r = run({ scenario: { ...quiet, player: { pos: [0, 0, 21] }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [0, 1, 26.5], state: 'drain', target_lantern_id: 'L1' }] }, ticks: 1, every: 1 });
  assert.equal(r.snaps.at(-1).shades[0].state, 'chase');
});

test('drain → wander khi đèn tắt', () => {
  const r = run({ scenario: { ...quiet, lanterns: [{ id: 'L1', lit: true, fuel: 0.05 }], shades: [{ id: 'S1', pos: [0, 1, 26.5], state: 'drain', target_lantern_id: 'L1' }] }, ticks: 3, every: 1 });
  assert.equal(r.events.find((e) => e.name === 'lantern_out').tick, 1);
  assert.equal(r.snaps.find((s) => s.tick === 1).shades[0].state, 'wander');
});

test('Tỏa Sáng trúng Bóng Mực đang drain: stunned, +15', () => {
  const r = run({ scenario: { ...quiet, player: { pos: [0, 0, 22.5], carried: 3 }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [0, 1, 26.5], state: 'drain', target_lantern_id: 'L1' }] }, ticks: 2, every: 1, inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.deepEqual(r.events.find((e) => e.name === 'pulse').data, { stunned_ids: ['S1'] });
  assert.equal(r.snaps.at(-1).shades[0].state, 'stunned');
  assert.equal(r.end.score, 15);
});

test('châm dầu lên ≥ 30 khi có Bóng Mực trong vùng: bị đẩy ra mép 6 m trong ≤ 30 tick, không gây sát thương', () => {
  const r = run({ scenario: { ...quiet, player: { pos: [1.5, 0, 25], carried: 5 }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [-1.5, 1, 25.5], state: 'drain', target_lantern_id: 'L1' }] }, ticks: 31, every: 1, inputs: { frames: [{ tick: 0, interact: true }] } });
  // bước 2 trừ hao 1 + bị hút 5 đơn vị/60 trước khi châm: 20 − 0.1 + 5 × 10 = 69.9
  assert.equal(r.events.find((e) => e.name === 'refuel').data.fuel, 69.9);
  assert.notEqual(r.snaps.find((s) => s.tick === 1).shades[0].state, 'drain', 'thôi hút ngay khi đèn được châm ≥ 30');
  assert.equal(r.events.filter((e) => e.name === 'fuel_drain').length, 0);
  assert.ok(dXZ(r.snaps.find((s) => s.tick === 30).shades[0].pos, [0, 0, 25]) >= 6 - 1e-3);
  assert.ok(dXZ(r.snaps.find((s) => s.tick === 31).shades[0].pos, [0, 0, 25]) >= 6 - 1e-3);
  assert.equal(r.events.filter((e) => e.name === 'player_hit').length, 0);
});

test('Bóng Mực wander ưu tiên đèn yếu hơn đèn tắt gần hơn', () => {
  // S1 ở (8,1,25): L1 yếu cách 8 m; L2 (23.8,0,7.7) tắt cách ~23 m; không có Mây gần
  const r = run({ scenario: { ...quiet, player: { pos: [0, 0, -30] }, lanterns: [{ id: 'L1', lit: true, fuel: 25 }, { id: 'L2', pos: [12, 0, 25] }], shades: [{ id: 'S1', pos: [8, 1, 25] }] }, ticks: 60, every: 60 });
  assert.ok(r.snaps.at(-1).shades[0].pos[0] < 8, 'đi về phía L1 (−X)');
});

test('thắng ở bình minh: còn sống và đèn sáng ≥ ceil(0.6 × tổng): dawn_survived + điểm bình minh', () => {
  const r = run({ scenario: { ...quiet, time_left_s: 1, lanterns: [{ id: 'L1', lit: true, fuel: 50 }, { id: 'L2', lit: true, fuel: 50 }, { id: 'L3', lit: true, fuel: 50 }] }, ticks: 100 });
  assert.equal(r.end.ticks, 60);
  assert.deepEqual(r.events.at(-1).data, { result: 'won', reason: 'dawn_survived' });
  // mỗi đèn: 50 + floor(49) ; 3 Ngọn Lửa × 50
  assert.equal(r.end.score, 3 * (50 + 49) + 3 * 50);
});

test('thua ở bình minh nếu đèn sáng dưới ngưỡng (Đêm 1 cần 3/5)', () => {
  const r = run({ scenario: { ...quiet, time_left_s: 1, lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }] }, ticks: 100 });
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'dawn' });
  assert.equal(r.end.score, 0);
});

test('ngưỡng thắng Đêm 2 là 4/6, Đêm 3 là 5/7', () => {
  const lit = (ids) => ids.map((id) => ({ id, lit: true }));
  assert.equal(run({ night: 2, scenario: { ...quiet, time_left_s: 0.5, lanterns: lit(['L1', 'L2', 'L3']) }, ticks: 60 }).end.state, 'lost');
  assert.equal(run({ night: 2, scenario: { ...quiet, time_left_s: 0.5, lanterns: lit(['L1', 'L2', 'L3', 'L4']) }, ticks: 60 }).end.state, 'won');
  assert.equal(run({ night: 3, scenario: { ...quiet, time_left_s: 0.5, lanterns: lit(['L1', 'L2', 'L3', 'L4']) }, ticks: 60 }).end.state, 'lost');
  assert.equal(run({ night: 3, scenario: { ...quiet, time_left_s: 0.5, lanterns: lit(['L1', 'L2', 'L3', 'L4', 'L5']) }, ticks: 60 }).end.state, 'won');
});

test('hết Ngọn Lửa ở đúng tick bình minh vẫn thua no_flames', () => {
  const r = run({ scenario: { ...quiet, time_left_s: 1 / 60, player: { flames: 1 }, lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true })), shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }, ticks: 5 });
  assert.equal(r.end.ticks, 1);
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
});

test('sức chứa = 10 + 2 × lần thắp thành công, tối đa 20', () => {
  assert.equal(run({ scenario: { ...quiet, player: { successful_lights: 4 } }, ticks: 0 }).snaps[0].player.capacity, 18);
  assert.equal(run({ scenario: { ...quiet, player: { successful_lights: 9 } }, ticks: 0 }).snaps[0].player.capacity, 20);
  // thắp L1 rồi nhặt được tới 12
  const motes = Array.from({ length: 14 }, (_, i) => [0, 0, 23 - i * 0.5]);
  const r = run({ scenario: { ...quiet, motes, player: { pos: [0, 0, 24], carried: 10 } }, ticks: 120, every: 120, inputs: { frames: [{ tick: 0, interact: true }, { tick: 2, move: [0, -1] }] } });
  const last = r.snaps.at(-1);
  assert.equal(last.player.capacity, 12);
  assert.equal(last.player.carried, 12);
});

test('đèn đặt sẵn bằng scenario không tính vào successful_lights', () => {
  const r = run({ scenario: { ...quiet, lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }] }, ticks: 0 });
  assert.equal(r.snaps[0].player.capacity, 10);
});

test('scenario v1.2 sai → mã 2', () => {
  assert.equal(run({ scenario: { shades: [{ pos: [1, 1, 1], target_lantern_id: 'L9' }] } }).code, 2);
  assert.equal(run({ scenario: { shades: [{ pos: [1, 1, 1], state: 'drain' }] } }).code, 2);
  assert.equal(run({ scenario: { lanterns: [{ id: 'L1', lit: true, fuel: 150 }] } }).code, 2);
  assert.equal(run({ scenario: { lanterns: [{ id: 'L1', ever_lit: 'yes' }] } }).code, 2);
});

test('tất định với luật dầu (Đêm 1–3)', () => {
  for (const night of [1, 2, 3]) {
    const inputs = { frames: [{ tick: 0, move: [0.4, 1] }, { tick: 200, interact: true }, { tick: 201, interact: false }, { tick: 600, move: [-1, -0.3] }] };
    const a = run({ night, seed: 11, ticks: 6000, inputs });
    const b = run({ night, seed: 11, ticks: 6000, inputs });
    assert.equal(a.raw, b.raw);
  }
});
