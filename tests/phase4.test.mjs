// Kiểm tra Ticket-04 (Contract v1.3): contract, soak test, bảng xếp hạng (lệnh xuất), cảnh benchmark.
// Benchmark cần mở trình duyệt có GPU nên không chạy trong npm test; kết quả đo lưu ở docs/proof/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { run, ROOT } from './run.mjs';
import { benchScenario, benchCamera, BENCH } from '../src/sim/bench.js';
import { createSim } from '../src/sim/sim.js';
import { addEntry, sortEntries, validName, isoWithOffset, qualifies } from '../src/leaderboard.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl4-'));
const node = (args, env = {}) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } });

test('contract v1.3: có bench_cmd, soak_cmd; giữ headless_cmd và tuning v1.2', () => {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
  assert.equal(c.contract_version, '1.3');
  for (const k of ['build_cmd', 'run_cmd', 'headless_cmd', 'bench_cmd', 'soak_cmd']) assert.equal(typeof c[k], 'string', k);
  assert.equal(c.tuning.fuel_max, 100);
  assert.ok(fs.existsSync(path.join(ROOT, c.bench_cmd.split(' ').at(-1))));
});

test('soak: chạy N Đêm xoay vòng, đúng định dạng, không crash, bộ nhớ ≤ 1.2×', () => {
  const out = path.join(tmp, 'soak.json');
  const r = node(['--expose-gc', '--max-opt=1', '--single-threaded', '--max-semi-space-size=1', 'tools/soak.mjs', '--seed', '7', '--nights', '4', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(s.nights, 4);
  assert.equal(s.crashes, 0);
  assert.equal(s.results.length, 4);
  for (const x of s.results) assert.ok(['won', 'lost', 'timeout'].includes(x), x);
  assert.ok(s.mem_start_mb > 0 && s.mem_end_mb > 0);
  assert.ok(s.mem_end_mb <= 1.2 * s.mem_start_mb, `${s.mem_end_mb} > 1.2 × ${s.mem_start_mb}`);
  assert.equal(typeof s.duration_s, 'number');
});

test('soak tất định: cùng seed → cùng kết quả các Đêm', () => {
  const a = path.join(tmp, 'sa.json'), b = path.join(tmp, 'sb.json');
  node(['tools/soak.mjs', '--seed', '3', '--nights', '3', '--out', a]);
  node(['tools/soak.mjs', '--seed', '3', '--nights', '3', '--out', b]);
  assert.deepEqual(JSON.parse(fs.readFileSync(a)).results, JSON.parse(fs.readFileSync(b)).results);
});

test('bảng xếp hạng: điểm giảm dần, bằng điểm ai đạt trước đứng trên, giữ top 10', () => {
  let e = [];
  const t = (m) => `2026-11-20T10:${String(m).padStart(2, '0')}:00+07:00`;
  for (let i = 0; i < 12; i++) e = addEntry(e, { name: `P_${i}`, score: 100 * (i % 6), nights_won: i % 4, achieved_at: t(i), seed: i });
  assert.equal(e.length, 10);
  assert.deepEqual(e.map((x) => x.score), [500, 500, 400, 400, 300, 300, 200, 200, 100, 100]);
  assert.deepEqual(e.slice(0, 2).map((x) => x.name), ['P_5', 'P_11']); // bằng 500: P_5 đạt trước
  assert.equal(qualifies(e, 100), false);
  assert.equal(qualifies(e, 101), true);
});

test('tên hợp lệ: 3–12 ký tự chữ/số/_; nhận tiếng Việt có dấu', () => {
  for (const ok of ['May', 'Mây_01', 'Nguyễn_Vinh', 'abc', 'A23456789012']) assert.ok(validName(ok), ok);
  for (const bad of ['ab', 'A234567890123', 'có cách', 'x-y', '', 'a!b']) assert.ok(!validName(bad), bad);
});

test('achieved_at là ISO 8601 có múi giờ', () => {
  assert.match(isoWithOffset(new Date()), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
});

test('lệnh xuất: <run_cmd> --export-leaderboard out.json đọc file trên đĩa, đúng thứ tự', () => {
  const store = path.join(tmp, 'lb.json');
  const entries = [
    { name: 'Cuoi', score: 50, nights_won: 0, achieved_at: '2026-11-20T09:00:00+07:00', seed: 1 },
    { name: 'Dau', score: 900, nights_won: 3, achieved_at: '2026-11-20T09:05:00+07:00', seed: 2 },
    { name: 'Giua_som', score: 300, nights_won: 1, achieved_at: '2026-11-20T08:00:00+07:00', seed: 3 },
    { name: 'Giua_muon', score: 300, nights_won: 2, achieved_at: '2026-11-20T08:30:00+07:00', seed: 4 },
  ];
  fs.writeFileSync(store, JSON.stringify({ entries }));
  const out = path.join(tmp, 'export.json');
  const r = node(['tools/start.mjs', '--export-leaderboard', out], { DDL_LEADERBOARD: store });
  assert.equal(r.status, 0, r.stderr);
  const doc = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(doc.entries.map((x) => x.name), ['Dau', 'Giua_som', 'Giua_muon', 'Cuoi']);
  assert.deepEqual(Object.keys(doc.entries[0]).sort(), ['achieved_at', 'name', 'nights_won', 'score', 'seed']);
  // không có file → danh sách rỗng
  const r2 = node(['tools/start.mjs', '--export-leaderboard', out], { DDL_LEADERBOARD: path.join(tmp, 'none.json') });
  assert.equal(r2.status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), { entries: [] });
});

test('cảnh benchmark: 200 Bóng Mực wander + 100 đom đóm trong đảo, L1–L3 sáng 100 dầu (nạp qua CLI)', () => {
  const sc = benchScenario(42);
  assert.equal(sc.shades.length, BENCH.shades);
  assert.equal(sc.motes.length, BENCH.motes);
  assert.deepEqual(benchScenario(42), sc, 'tất định theo seed');
  const r = run({ scenario: sc, ticks: 0 });
  assert.equal(r.code, 0);
  const s0 = r.snaps[0];
  assert.equal(s0.shades.length, 200);
  assert.ok(s0.shades.every((x) => x.state === 'wander' && Math.hypot(x.pos[0], x.pos[2]) <= 40));
  assert.equal(s0.motes_active, 100);
  assert.deepEqual(s0.lanterns.filter((l) => l.lit).map((l) => [l.id, l.fuel]), [['L1', 100], ['L2', 100], ['L3', 100]]);
});

test('chế độ bench của sim: không sinh thêm, không sát thương, không nhặt, không hao dầu, không kết thúc', () => {
  const sim = createSim({ seed: 42, night: 1, scenario: { ...benchScenario(42), time_left_s: 1 }, bench: true });
  for (let i = 0; i < 1200; i++) sim.step({});
  const ev = sim.drainEvents().map((e) => e.name);
  assert.deepEqual([...new Set(ev)].filter((n) => n !== 'night_start'), []);
  assert.equal(sim.s.state, 'playing');
  assert.equal(sim.s.shades.length, 200);
  assert.equal(sim.s.motes.length, 100);
  assert.equal(sim.s.player.flames, 3);
  assert.equal(sim.s.lanterns[0].fuel, 100 * 60);
  // Bóng Mực vẫn di chuyển theo luật wander
  assert.notDeepEqual(sim.s.shades[0].pos, benchScenario(42).shades[0].pos);
});

test('camera bench: tròn r = 30, cao 15, bắt đầu (30,15,0), 15 s một vòng, ngược chiều kim đồng hồ nhìn từ trên', () => {
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(benchCamera(0), [30, 15, 0]));
  assert.ok(near(benchCamera(15), [30, 15, 0]));
  assert.ok(near(benchCamera(3.75), [0, 15, 30])); // góc 90°: cùng quy ước góc của bản đồ chuẩn
});
