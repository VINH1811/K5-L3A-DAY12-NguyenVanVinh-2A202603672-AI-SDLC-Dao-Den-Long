// Scenario headless chạy qua đúng CLI mà giảng viên dùng. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TUNING } from '../src/sim/config.js';

import { run, ROOT } from "./run.mjs";

const quiet = { random_motes: false, random_shades: false };

test('contract khớp với tuning trong code', () => {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
  // v1.2 (Ticket-03): thêm khóa dầu đèn / win_ratio / capacity_max, thời lượng Đêm 240/270/300
  assert.equal(c.contract_version, '1.2');
  assert.deepEqual(Object.keys(c.tuning).sort(), Object.keys(TUNING).sort());
  for (const [k, v] of Object.entries(c.tuning)) assert.deepEqual(v, TUNING[k], `tuning.${k}`);
});

test('snapshot tick 0, end là dòng cuối, đứng yên 600 tick', () => {
  const r = run({ scenario: { ...quiet, motes: [], shades: [] }, ticks: 600 });
  assert.equal(r.code, 0);
  assert.equal(r.snaps[0].tick, 0);
  assert.deepEqual(r.snaps[0].player.pos, [0, 0, 0]);
  assert.equal(r.snaps.length, 61);
  assert.deepEqual(r.end, { type: 'end', ticks: 600, state: 'playing', score: 0 });
  assert.equal(r.snaps.at(-1).time_left_s, 230); // Ticket-03: Đêm 1 dài 240 s
});

test('tất định: cùng seed → output giống hệt', () => {
  const inputs = { frames: [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 30 }, { tick: 200, jump: true }, { tick: 201, jump: false }] };
  const a = run({ seed: 99, ticks: 3000, inputs });
  const b = run({ seed: 99, ticks: 3000, inputs });
  assert.equal(a.raw, b.raw);
});

test('đi thẳng +Z 1 giây ≈ 6 m (tăng tốc 0.1 s)', () => {
  const r = run({ scenario: { ...quiet, motes: [], shades: [] }, ticks: 60, inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  const z = r.snaps.at(-1).player.pos[2];
  assert.ok(z > 5.6 && z < 6.0, `z=${z}`);
});

test('cam_yaw_deg 90: move [0,1] đi theo +X', () => {
  const r = run({ scenario: { ...quiet, motes: [], shades: [] }, ticks: 30, inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] } });
  const [x, , z] = r.snaps.at(-1).player.pos;
  assert.ok(x > 2 && Math.abs(z) < 1e-6, `x=${x} z=${z}`);
});

test('nhặt đom đóm trong bán kính 1.0 m', () => {
  const r = run({ scenario: { ...quiet, motes: [[0, 0, 3]], shades: [] }, ticks: 60, inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  const ev = r.events.find((e) => e.name === 'mote_picked');
  assert.deepEqual(ev.data, { carried: 1 });
  assert.equal(r.snaps.at(-1).motes_active, 0);
});

test('nạp 10 đom đóm thắp đèn: deposit + lantern_lit + điểm', () => {
  const r = run({
    scenario: { ...quiet, motes: [], shades: [], player: { pos: [0, 0, 23.5], carried: 10 } },
    ticks: 5, inputs: { frames: [{ tick: 1, interact: true }, { tick: 2, interact: false }] },
  });
  assert.deepEqual(r.events.map((e) => [e.tick, e.name]), [[2, 'deposit'], [2, 'lantern_lit']]);
  assert.deepEqual(r.events[0].data, { lantern_id: 'L1', amount: 10, deposited: 10 });
  assert.equal(r.end.score, 10 * TUNING.score.per_mote + TUNING.score.per_lantern);
});

test('nạp từng phần: đèn nhớ tiến độ', () => {
  const r = run({
    scenario: { ...quiet, motes: [], shades: [], player: { pos: [0, 0, 24], carried: 4 }, lanterns: [{ id: 'L1', deposited: 3 }] },
    ticks: 5, inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.deepEqual(r.events[0].data, { lantern_id: 'L1', amount: 4, deposited: 7 });
  assert.equal(r.snaps.at(-1).lanterns[0].lit, false);
});

// [THAY THẾ bởi Ticket-03] Test "thắp hết 5 đèn → won/all_lit" cũ bị bỏ: luật thắng sớm và lý do all_lit
// không còn. Thay bằng test dưới (thắp đủ không kết thúc Đêm) và các test bình minh trong tests/phase3.test.mjs.
test('thắp hết 5 đèn không còn kết thúc Đêm (Ticket-03)', () => {
  const r = run({
    scenario: { ...quiet, motes: [], shades: [], player: { pos: [0, 0, 24], carried: 10 },
      lanterns: ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true })), time_left_s: 100 },
    ticks: 10, inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(r.events.filter((e) => e.name === 'game_over').length, 0);
  assert.equal(r.end.state, 'playing');
  assert.equal(r.snaps.at(-1).lanterns.filter((l) => l.lit).length, 5);
});

test('Tỏa Sáng: trừ 3 đom đóm, choáng Bóng Mực trong 5 m, cộng điểm', () => {
  const r = run({
    scenario: { ...quiet, motes: [], player: { carried: 5 }, shades: [{ id: 'S1', pos: [3, 1, 0] }, { id: 'S2', pos: [20, 1, 0] }] },
    ticks: 30, inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  const p = r.events.find((e) => e.name === 'pulse');
  assert.equal(p.tick, 1);
  assert.deepEqual(p.data, { stunned_ids: ['S1'] });
  const last = r.snaps.at(-1);
  assert.equal(last.player.carried, 2);
  assert.equal(last.shades[0].state, 'stunned');
  assert.ok(Math.abs(last.shades[0].pos[0] - 7) < 0.01, `bị đẩy 4 m: ${last.shades[0].pos[0]}`);
  assert.equal(r.end.score, TUNING.score.per_stun);
});

test('Tỏa Sáng không đủ đom đóm thì không kích hoạt', () => {
  const r = run({ scenario: { ...quiet, motes: [], player: { carried: 2 }, shades: [{ pos: [3, 1, 0] }] }, ticks: 5, inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(r.events.filter((e) => e.name === 'pulse').length, 0);
});

test('bị Bóng Mực chạm: −1 Ngọn Lửa, rơi một nửa đom đóm, bất tử', () => {
  const r = run({ scenario: { ...quiet, motes: [], player: { carried: 7 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }, ticks: 80 });
  const hits = r.events.filter((e) => e.name === 'player_hit');
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 2, dropped: 3 });
  assert.equal(r.snaps.find((s) => s.tick === 10).motes_active, 3);
});

test('hết Ngọn Lửa → lost/no_flames', () => {
  const r = run({ scenario: { ...quiet, motes: [], player: { flames: 1 }, shades: [{ pos: [0.5, 1, 0] }] }, ticks: 50 });
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(r.end.state, 'lost');
});

test('hết giờ → lost/dawn', () => {
  const r = run({ scenario: { ...quiet, motes: [], shades: [], time_left_s: 1 }, ticks: 600 });
  assert.equal(r.end.ticks, 60);
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'dawn' });
});

test('Bóng Mực không vào vùng an toàn quanh đèn sáng', () => {
  const r = run({
    scenario: { ...quiet, motes: [], player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [0, 1, 35] }] },
    ticks: 600,
  });
  for (const s of r.snaps) for (const sh of s.shades) {
    const d = Math.hypot(sh.pos[0] - 0, sh.pos[2] - 25);
    assert.ok(d >= 6 - 1e-3, `tick ${s.tick} d=${d}`);
  }
  assert.equal(r.events.filter((e) => e.name === 'player_hit').length, 0);
});

test('rơi khỏi đảo: player_hit by fall, hồi sinh ở gốc', () => {
  const r = run({ scenario: { ...quiet, motes: [], shades: [], player: { pos: [39, 0, 0], carried: 4 } }, ticks: 200, inputs: { frames: [{ tick: 0, move: [1, 0] }, { tick: 20, move: [0, 0] }] } });
  const h = r.events.find((e) => e.name === 'player_hit');
  assert.deepEqual(h.data, { by: 'fall', flames: 2, dropped: 4, lost: 4 });
  assert.deepEqual(r.snaps.at(-1).player.pos, [0, 0, 0]);
});

test('lịch sinh Bóng Mực: 2 con ở tick 300, id S1 S2', () => {
  const r = run({ ticks: 301 });
  assert.deepEqual(r.events.filter((e) => e.name === 'shade_spawned').map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2']]);
});

test('file inputs / scenario sai định dạng → mã thoát 2', () => {
  assert.equal(run({ inputs: '{bad json' }).code, 2);
  assert.equal(run({ inputs: { frames: [{ tick: 5 }, { tick: 5 }] } }).code, 2);
  assert.equal(run({ scenario: { lanterns: [{ id: 'L9' }] } }).code, 2);
  assert.equal(run({ scenario: { motes: 'x' } }).code, 2);
});

test('đủ một Đêm chạy nhanh (< 5 s)', () => {
  const t = Date.now();
  const r = run({ ticks: 18000, inputs: { frames: [{ tick: 0, move: [1, 0.2] }, { tick: 100, move: [-0.5, -1] }] } });
  assert.equal(r.code, 0);
  assert.ok(Date.now() - t < 5000);
});
