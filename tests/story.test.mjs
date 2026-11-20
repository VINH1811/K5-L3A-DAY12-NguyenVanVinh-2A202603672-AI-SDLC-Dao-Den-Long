// Chế độ Cốt truyện (ngoài Test Contract): chạy qua CLI với --story. Chế độ chuẩn không đổi — xem test đầu tiên.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from './run.mjs';
import { CARD_IDS, CHAPTERS } from '../src/sim/story.js';

const quiet = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], drifters: [] };
const dXZ = (p, q) => Math.hypot(p[0] - q[0], p[2] - q[2]);
const S = (cards = []) => ({ cards });

test('không có --story: Đêm 4, 5 bị từ chối (mã 2), snapshot không có trường kind', () => {
  assert.equal(run({ night: 4, ticks: 1 }).code, 2);
  assert.equal(run({ night: 5, ticks: 1 }).code, 2);
  const r = run({ scenario: { ...quiet, shades: [{ id: 'S1', pos: [10, 1, 0], kind: 'giant' }] }, ticks: 0 });
  assert.deepEqual(Object.keys(r.snaps[0].shades[0]).sort(), ['id', 'pos', 'state']);
});

test('--story: 5 chương đều chạy được, đúng số đèn, có trùm ở chương 5', () => {
  for (const [n, nl] of [[1, 5], [2, 6], [3, 7], [4, 6], [5, 5]]) {
    const r = run({ night: n, story: S(), ticks: 600 });
    assert.equal(r.code, 0, `Đêm ${n}: ${r.stderr}`);
    assert.equal(r.snaps[0].lanterns.length, nl);
  }
  const boss = run({ night: 5, story: S(), ticks: 0 }).snaps[0].shades.find((x) => x.kind === 'boss');
  assert.deepEqual([boss.id, boss.hp], ['B1', 6]);
});

test('bản đồ mới: Đêm 4 có hồ băng ở giữa (rơi), Đêm 5 có nhánh đá nối bệ', () => {
  const lake = run({ night: 4, story: S(), scenario: { ...quiet, player: { pos: [0, 0, -14] } }, ticks: 120, inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.equal(lake.events.find((e) => e.name === 'player_hit')?.data.by, 'fall');
  const arm = run({ night: 5, story: S(), scenario: { ...quiet, shades: [], player: { pos: [0, 0, -30] } }, ticks: 150, inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.equal(arm.events.filter((e) => e.name === 'player_hit').length, 0, 'đi theo nhánh nam vào giữa không rơi');
  assert.ok(arm.snaps.at(-1).player.pos[2] > -16);
});

test('quái sinh theo tổ hợp của chương (chương 2 có Dơi Mực), sự kiện kèm kind', () => {
  const r = run({ night: 2, seed: 3, story: S(), ticks: 5000 });
  const kinds = new Set(r.events.filter((e) => e.name === 'shade_spawned').map((e) => e.data.kind));
  for (const k of kinds) assert.ok(k in CHAPTERS[2].monsters, k);
  assert.ok(kinds.has('bat'), [...kinds].join(','));
});

test('Dơi Mực đuổi nhanh hơn Bóng Mực (6 m/s)', () => {
  const r = run({ night: 1, story: S(), scenario: { ...quiet, shades: [{ id: 'S1', pos: [12, 1, 0], kind: 'bat', state: 'chase' }] }, ticks: 30, every: 30 });
  const x = r.snaps.at(-1).shades[0].pos[0];
  assert.ok(Math.abs(12 - x - 3) < 0.05, `x=${x}`);
});

// Mây bất tử trong test này: không để cú chạm của quái làm rơi đom đóm (khi đó lần Tỏa Sáng thứ hai thiếu 3 đom đóm)
test('Mực Khổng Lồ: lần Tỏa Sáng đầu chỉ vỡ giáp, lần hai mới choáng', () => {
  const frames = [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 190, pulse: true }, { tick: 191, pulse: false }];
  const r = run({ night: 1, story: S(), scenario: { ...quiet, player: { carried: 10, invuln_ticks: 1000 }, shades: [{ id: 'S1', pos: [3, 1, 0], kind: 'giant' }] }, ticks: 200, every: 1, inputs: { frames } });
  assert.equal(r.events.filter((e) => e.name === 'armor_break').length, 1);
  const s2 = r.snaps.find((s) => s.tick === 2).shades[0];
  assert.notEqual(s2.state, 'stunned');
  assert.equal(s2.armor, 0);
  assert.equal(r.snaps.at(-1).shades[0].state, 'stunned');
});

test('Mực Ma dịch chuyển tới cách Mây 4 m khi đuổi', () => {
  const r = run({ night: 1, story: S(), scenario: { ...quiet, shades: [{ id: 'S1', pos: [19, 1, 0], kind: 'phantom', state: 'chase' }] }, ticks: 200, every: 1 });
  const ev = r.events.find((e) => e.name === 'phantom_blink');
  assert.ok(ev, 'phải có phantom_blink');
  const after = r.snaps.find((s) => s.tick === ev.tick).shades[0];
  assert.ok(Math.abs(dXZ(after.pos, [0, 0, 0]) - 4) < 0.01, `d=${dXZ(after.pos, [0, 0, 0])}`);
});

test('Trùm: mỗi lần Tỏa Sáng −1 máu; hết máu → boss_defeated và thắng chương', () => {
  const frames = [];
  for (let k = 0; k < 6; k++) frames.push({ tick: k * 190, pulse: true }, { tick: k * 190 + 1, pulse: false });
  const r = run({ night: 5, story: S(), scenario: { ...quiet, player: { pos: [0, 0, -6], carried: 20, flames: 3, invuln_ticks: 2000 }, shades: [{ id: 'B1', pos: [0, 1.2, -1], kind: 'boss' }] }, ticks: 1200, inputs: { frames } });
  const hits = r.events.filter((e) => e.name === 'boss_hit').map((e) => e.data.hp);
  assert.deepEqual(hits, [5, 4, 3, 2, 1, 0]);
  assert.ok(r.events.some((e) => e.name === 'boss_defeated'));
  assert.deepEqual(r.events.at(-1).data, { result: 'won', reason: 'boss_defeated' });
});

test('Trùm gọi thêm Bóng Mực mỗi 10 s', () => {
  const r = run({ night: 5, story: S(), scenario: { ...quiet, player: { pos: [0, 0, -34] }, shades: [{ id: 'B1', pos: [0, 1.2, 0], kind: 'boss' }] }, ticks: 610 });
  const called = r.events.filter((e) => e.name === 'shade_spawned' && e.data.by === 'B1');
  assert.equal(called.length, 2);
  assert.equal(called[0].tick, 600);
});

test('thẻ thụ động: Nam Châm (2.5 m), Hào Quang Rộng (8 m), Ngọn Lửa Thứ Tư, Túi Lụa', () => {
  const mag = run({ night: 1, story: S(['magnet']), scenario: { ...quiet, motes: [[2.2, 0, 0]] }, ticks: 2 });
  assert.equal(mag.events.filter((e) => e.name === 'mote_picked').length, 1);
  const wide = run({ night: 1, story: S(['wide']), scenario: { ...quiet, player: { carried: 3 }, shades: [{ id: 'S1', pos: [7, 1, 0] }] }, ticks: 2, inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.deepEqual(wide.events.find((e) => e.name === 'pulse').data.stunned_ids, ['S1']);
  const heart = run({ night: 1, story: S(['heart', 'bag']), scenario: quiet, ticks: 0 }).snaps[0].player;
  assert.deepEqual([heart.flames, heart.capacity], [4, 14]);
});

test('thẻ Dầu Trầm: đèn hao một nửa', () => {
  const r = run({ night: 1, story: S(['oil']), scenario: { ...quiet, lanterns: [{ id: 'L1', lit: true }] }, ticks: 600, every: 600 });
  assert.equal(r.snaps.at(-1).lanterns[0].fuel, 95);
});

test('thẻ chủ động (Q): Khiên chặn sát thương, Sương Đóng Băng choáng quái, có hồi chiêu', () => {
  const sh = run({ night: 1, story: S(['shield']), scenario: { ...quiet, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }, ticks: 60, inputs: { frames: [{ tick: 0, ability: true }] } });
  assert.equal(sh.events.find((e) => e.name === 'ability').data.card, 'shield');
  assert.equal(sh.events.filter((e) => e.name === 'player_hit').length, 0);
  const fz = run({ night: 1, story: S(['freeze']), scenario: { ...quiet, shades: [{ id: 'S1', pos: [10, 1, 0] }, { id: 'S2', pos: [-30, 1, 0] }] }, ticks: 5, every: 5,
    inputs: { frames: [{ tick: 0, ability: true }, { tick: 1, ability: false }, { tick: 2, ability: true }] } });
  assert.deepEqual(fz.snaps.at(-1).shades.map((x) => x.state), ['stunned', 'wander']);
  assert.equal(fz.events.filter((e) => e.name === 'ability').length, 1, 'đang hồi chiêu thì bấm lại không có tác dụng');
});

test('thẻ chủ động: Bước Mây dịch chuyển 8 m về phía trước, Đèn Thần châm 40 dầu', () => {
  const b = run({ night: 1, story: S(['blink']), scenario: quiet, ticks: 1, every: 1, inputs: { frames: [{ tick: 0, ability: true }] } });
  assert.equal(b.snaps.at(-1).player.pos[2], 8);
  const L = run({ night: 1, story: S(['beacon']), scenario: { ...quiet, lanterns: [{ id: 'L1', lit: true, fuel: 30 }] }, ticks: 1, every: 1, inputs: { frames: [{ tick: 0, ability: true }] } });
  assert.equal(L.snaps.at(-1).lanterns[0].fuel, 70);
});

test('story sai định dạng hoặc thẻ lạ → mã 2', () => {
  assert.equal(run({ story: '{bad' }).code, 2);
  assert.equal(run({ story: { cards: ['laser'] } }).code, 2);
  assert.equal(run({ story: S(), scenario: { shades: [{ pos: [1, 1, 1], kind: 'dragon' }] } }).code, 2);
  assert.ok(CARD_IDS.length >= 10);
});

test('chế độ Cốt truyện vẫn tất định', () => {
  const inputs = { frames: [{ tick: 0, move: [0.4, 1] }, { tick: 300, ability: true }, { tick: 301, ability: false }] };
  for (const night of [3, 4, 5]) {
    const a = run({ night, seed: 9, story: S(['freeze', 'magnet']), ticks: 4000, inputs });
    const b = run({ night, seed: 9, story: S(['freeze', 'magnet']), ticks: 4000, inputs });
    assert.equal(a.raw, b.raw);
  }
});

test('Mực Khổng Lồ: giáp hồi lại sau 480 tick (8 s) kể từ khi vỡ', () => {
  const r = run({ night: 1, story: S(), scenario: { ...quiet, player: { carried: 3, invuln_ticks: 2000 }, shades: [{ id: 'S1', pos: [3, 1, 0], kind: 'giant' }] }, ticks: 482, every: 1, inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(r.snaps.find((s) => s.tick === 480).shades[0].armor, 0);
  assert.equal(r.snaps.find((s) => s.tick === 481).shades[0].armor, 1);
});
