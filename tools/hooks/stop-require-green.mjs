#!/usr/bin/env node
// Hook "Stop" cho agent (khai báo trong .claude/settings.json).
// Khi agent định kết thúc lượt làm việc: nếu mã nguồn/test/contract có thay đổi chưa commit
// hoặc commit mới so với lần xanh gần nhất, chạy `node --test`. Test đỏ → mã thoát 2 và in lỗi ra stderr,
// agent bị chặn kết thúc và nhận danh sách test hỏng để sửa tiếp.
// Để tránh vòng lặp vô hạn: lần chặn thứ hai liên tiếp (stop_hook_active) vẫn báo lỗi nhưng cho dừng,
// để người dùng quyết định.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { /* không có stdin */ }

const sh = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
// Có gì liên quan tới hành vi game thay đổi không? (bỏ qua tài liệu, ảnh, out/)
const WATCH = /^(src\/|tests\/|tools\/|game\.contract\.json|package(-lock)?\.json|index\.html|vite\.config\.js)/;
const dirty = sh('git', ['status', '--porcelain']).stdout.split('\n').map((l) => l.slice(3).trim().replace(/^"|"$/g, '')).filter((f) => WATCH.test(f));
const head = sh('git', ['rev-parse', 'HEAD']).stdout.trim();
const stamp = path.join(ROOT, 'out', '.last-green');
const lastGreen = fs.existsSync(stamp) ? fs.readFileSync(stamp, 'utf8').trim() : '';
if (dirty.length === 0 && lastGreen === head) process.exit(0); // không có gì mới cần kiểm

const tests = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.test.mjs')).map((f) => path.join('tests', f));
const r = sh(process.execPath, ['--test', '--test-reporter=tap', ...tests]);
const failed = [...r.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);

if (r.status === 0 && failed.length === 0) {
  if (dirty.length === 0) { fs.mkdirSync(path.dirname(stamp), { recursive: true }); fs.writeFileSync(stamp, head); }
  process.exit(0);
}

const msg = [
  `npm test ĐỎ: ${failed.length} test hỏng. Chưa được kết thúc — sửa code (không sửa test cho "đạt", không tắt test) rồi chạy lại npm test.`,
  ...failed.slice(0, 15).map((f) => `  ✗ ${f}`),
  dirty.length ? `File thay đổi: ${dirty.slice(0, 10).join(', ')}` : '',
].filter(Boolean).join('\n');

if (input.stop_hook_active) {
  // đã chặn một lần rồi mà vẫn đỏ: báo cho người dùng, không chặn tiếp để tránh lặp vô hạn
  process.stderr.write(msg + '\n(Đã chặn một lần; cho dừng để người dùng quyết định.)\n');
  process.exit(0);
}
process.stderr.write(msg + '\n');
process.exit(2);
