// Chạy CLI headless thật (đúng lệnh giảng viên dùng) và đọc JSONL.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const ROOT = path.resolve(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-'));
let n = 0;

export function run({ seed = 1, night = 1, ticks = 600, scenario, inputs, story, every = 10, raw = {} } = {}) {
  const id = n++;
  const out = path.join(tmp, `o${id}.jsonl`);
  const args = ['tools/headless.mjs', '--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every)];
  if (scenario !== undefined) { const f = path.join(tmp, `s${id}.json`); fs.writeFileSync(f, typeof scenario === 'string' ? scenario : JSON.stringify(scenario)); args.push('--scenario', f); }
  if (inputs !== undefined) { const f = path.join(tmp, `i${id}.json`); fs.writeFileSync(f, typeof inputs === 'string' ? inputs : JSON.stringify(inputs)); args.push('--inputs', f); }
  if (story !== undefined) { const f = path.join(tmp, `t${id}.json`); fs.writeFileSync(f, typeof story === 'string' ? story : JSON.stringify(story)); args.push('--story', f); }
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  const lines = r.status === 0 ? fs.readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  return { code: r.status, stderr: r.stderr, lines, events: lines.filter((l) => l.type === 'event' && l.name !== 'night_start'), allEvents: lines.filter((l) => l.type === 'event'), snaps: lines.filter((l) => l.type === 'snapshot'), end: lines.at(-1), raw: r.status === 0 ? fs.readFileSync(out, 'utf8') : '' };
}
