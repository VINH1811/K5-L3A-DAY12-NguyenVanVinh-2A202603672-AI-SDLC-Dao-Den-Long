#!/usr/bin/env node
// Chạy toàn bộ kiểm chứng tự động và lưu bằng chứng khớp với commit hiện tại.
//   node tools/proof.mjs [--out docs/proof/latest]
// Ghi ra thư mục --out:
//   test-report.tap    kết quả `node --test` (TAP)
//   headless-n{1,2,3}.end.json   dòng end của một Đêm đầy đủ mỗi bản đồ (seed 1, không input)
//   soak.json          soak 10 Đêm theo soak_cmd của contract
//   summary.md         tóm tắt: commit, thời điểm, số test đạt/hỏng, ngưỡng soak
// Mã thoát 0 khi mọi thứ đạt; 1 nếu có test hỏng hoặc soak vượt ngưỡng.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const outDir = path.resolve(ROOT, argv[argv.indexOf('--out') + 1] && argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'docs/proof/latest');
fs.mkdirSync(outDir, { recursive: true });

const sh = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
const git = (...a) => sh('git', a).stdout.trim();
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));

// 1. test
const tests = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.test.mjs')).map((f) => path.join('tests', f));
const t = sh(process.execPath, ['--test', '--test-reporter=tap', ...tests]);
fs.writeFileSync(path.join(outDir, 'test-report.tap'), t.stdout);
const num = (k) => +((t.stdout.match(new RegExp(`^# ${k} (\\d+)`, 'm')) ?? [])[1] ?? NaN);
const pass = num('pass'), fail = num('fail');
const failed = [...t.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);

// 2. headless một Đêm đầy đủ mỗi bản đồ
const ends = [];
for (const n of [1, 2, 3]) {
  const tmp = path.join(outDir, `headless-n${n}.jsonl`);
  const r = sh(process.execPath, ['tools/headless.mjs', '--seed', '1', '--night', String(n), '--ticks', '21600', '--out', tmp]);
  const end = r.status === 0 ? fs.readFileSync(tmp, 'utf8').trim().split('\n').at(-1) : `{"error":${JSON.stringify(r.stderr.trim())}}`;
  fs.writeFileSync(path.join(outDir, `headless-n${n}.end.json`), end + '\n');
  fs.rmSync(tmp, { force: true }); // file đầy đủ rất lớn; giữ dòng end để đối chiếu
  ends.push([n, r.status, end]);
}

// 3. soak theo đúng soak_cmd của contract
const soakArgs = contract.soak_cmd.split(' ').slice(1);
const soakOut = path.join(outDir, 'soak.json');
const s = sh(process.execPath, [...soakArgs, '--seed', '7', '--nights', '10', '--out', soakOut]);
const soak = s.status === 0 ? JSON.parse(fs.readFileSync(soakOut, 'utf8')) : null;
const ratio = soak ? soak.mem_end_mb / soak.mem_start_mb : NaN;
const soakOk = !!soak && soak.crashes === 0 && ratio <= 1.2;

const ok = t.status === 0 && fail === 0 && ends.every(([, st]) => st === 0) && soakOk;
const summary = `# Bằng chứng tự động

- Commit: \`${git('rev-parse', '--short', 'HEAD')}\`${git('status', '--porcelain') ? ' (có thay đổi chưa commit)' : ''}
- Thời điểm: ${new Date().toISOString()}
- Node: ${process.version} · ${process.platform}/${process.arch}
- Contract: v${contract.contract_version}

| Kiểm chứng | Kết quả |
|---|---|
| \`npm test\` | ${pass} đạt, ${fail} hỏng${failed.length ? ': ' + failed.join('; ') : ''} |
${ends.map(([n, st, end]) => `| headless Đêm ${n} (seed 1, tối đa 21 600 tick, dừng khi hết Đêm) | ${st === 0 ? 'mã 0' : 'mã ' + st} · \`${end}\` |`).join('\n')}
| soak 10 Đêm (\`${contract.soak_cmd}\`) | ${soak ? `crashes ${soak.crashes}, RSS ${soak.mem_start_mb} → ${soak.mem_end_mb} MB (${ratio.toFixed(3)}×, ngưỡng 1.2)` : 'lỗi: ' + s.stderr.trim()} |

**Tổng: ${ok ? 'ĐẠT' : 'CHƯA ĐẠT'}**
`;
fs.writeFileSync(path.join(outDir, 'summary.md'), summary);
process.stdout.write(summary);
process.exit(ok ? 0 : 1);
