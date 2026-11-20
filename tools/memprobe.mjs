// Đo heapUsed/RSS sau mỗi Đêm (bằng chứng soak không rò rỉ): node --expose-gc tools/memprobe.mjs
import { createSim } from '../src/sim/sim.js';
import { makeRng } from '../src/sim/rng.js';
const mb = (v) => (v / 1048576).toFixed(1);
for (let i = 1; i <= 12; i++) {
  let sim = createSim({ seed: 7 + i, night: ((i - 1) % 3) + 1 });
  const rng = makeRng(i);
  for (let k = 0; k < 18000 && sim.s.state === 'playing'; k++) { sim.step({ move: [rng.range(-1, 1), rng.range(-1, 1)], jump: rng.next() < 0.05, interact: rng.next() < 0.1, pulse: rng.next() < 0.02, dash: rng.next() < 0.03 }); sim.drainEvents(); }
  sim = null; global.gc(); global.gc();
  const m = process.memoryUsage();
  console.log(i, 'heapUsed', mb(m.heapUsed), 'heapTotal', mb(m.heapTotal), 'rss', mb(m.rss));
}
