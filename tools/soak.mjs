#!/usr/bin/env node
// Soak test (Ticket-04): chạy headless N Đêm liên tiếp trong cùng một tiến trình.
// node --expose-gc --max-opt=1 --single-threaded --max-semi-space-size=1 tools/soak.mjs --seed 7 --nights 10 --out soak.json
// Cờ V8: --max-opt=1 (không dùng trình biên dịch tối ưu Maglev/TurboFan, vùng nhớ biên dịch của chúng làm RSS
// phình 1.2–1.6× trên Linux/macOS dù heap đứng yên), --single-threaded, --max-semi-space-size=1: RSS phản ánh rò rỉ thật
// (heapUsed đứng yên ~4.5 MB qua 12 Đêm; xem docs/proof/phase-4.md).
// Đêm thứ i (i = 1..N) là Đêm ((i − 1) mod 3) + 1, dùng seed (seed + i). Input ngẫu nhiên theo seed:
// mỗi 30 tick chọn lại hướng; mỗi tick 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác.
import fs from 'node:fs';
import { createSim } from '../src/sim/sim.js';
import { makeRng } from '../src/sim/rng.js';
import { NIGHTS, TPS } from '../src/sim/config.js';

function fail(msg) { process.stderr.write(`soak: ${msg}\n`); process.exit(1); }
function parse(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) fail(`tham số sai gần ${argv[i]}`);
    a[argv[i].slice(2)] = argv[i + 1];
  }
  const int = (k, d) => { if (a[k] === undefined) return d; if (!/^-?\d+$/.test(a[k])) fail(`--${k} phải là số nguyên`); return +a[k]; };
  if (!a.out) fail('thiếu --out');
  return { seed: int('seed', 7), nights: int('nights', 10), out: a.out };
}

const gc = () => { if (global.gc) { global.gc(); global.gc(); } };
const rssMb = () => Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;

function playNight(sim, seed) {
  const rng = makeRng(seed ^ 0x5bd1e995);
  const limit = NIGHTS[sim.s.night].duration_s * TPS;
  let move = [0, 0];
  for (let k = 0; k < limit && sim.s.state === 'playing'; k++) {
    if (k % 30 === 0) { const a = rng.range(0, Math.PI * 2); move = [Math.cos(a), Math.sin(a)]; }
    sim.step({
      move, cam_yaw_deg: 0,
      jump: rng.next() < 0.05, dash: rng.next() < 0.03, pulse: rng.next() < 0.02, interact: rng.next() < 0.10,
    });
    sim.drainEvents();
  }
  return sim.s.state === 'playing' ? 'timeout' : sim.s.state;
}

const args = parse(process.argv.slice(2));
const t0 = performance.now();
const results = [];
let crashes = 0, memStart = null;
for (let i = 1; i <= args.nights; i++) {
  const night = ((i - 1) % 3) + 1, seed = args.seed + i;
  let sim = null;
  try {
    sim = createSim({ seed, night });
    if (memStart === null) { gc(); memStart = rssMb(); } // RSS sau khi tải xong Đêm đầu tiên
    results.push(playNight(sim, seed));
  } catch (e) {
    crashes++;
    results.push('crash');
    process.stderr.write(`soak: Đêm ${i} (night ${night}, seed ${seed}) lỗi: ${e.stack}\n`);
  }
  sim = null; // reset Đêm
}
gc();
const memEnd = rssMb(); // RSS sau khi reset xong Đêm cuối
const out = {
  nights: args.nights, crashes, results,
  mem_start_mb: memStart, mem_end_mb: memEnd,
  duration_s: Math.round((performance.now() - t0) / 100) / 10,
  gc_exposed: !!global.gc,
};
fs.writeFileSync(args.out, JSON.stringify(out, null, 2) + '\n');
process.stdout.write(`soak: ${JSON.stringify(out)}\n`);
process.exit(0);
