#!/usr/bin/env node
// Benchmark (Ticket-04, Contract v1.3):
//   node tools/bench.mjs --seed 42 --duration 30 --out bench.json
// Mở bản build tĩnh (dist/, tự build nếu thiếu) trong Chrome/Edge/Chromium có sẵn trên máy, cửa sổ 1280×720
// không toàn màn hình, tắt vsync bằng cờ --disable-gpu-vsync --disable-frame-rate-limit.
// Trang chạy cảnh bench chuẩn (src/sim/bench.js), 3 s khởi động rồi đo đúng --duration giây và gửi
// thời gian từng khung về đây; script tính avg_fps, p1_low_fps, frame_ms_p95 và ghi file JSON.
// Đặt CHROME_PATH nếu trình duyệt nằm ở chỗ khác.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROCESS_START = Date.now() - process.uptime() * 1000; // mốc tính load_ms
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = (m) => { process.stderr.write(`bench: ${m}\n`); process.exit(1); };

function parse(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) fail(`tham số sai gần ${argv[i]}`);
    a[argv[i].slice(2)] = argv[i + 1];
  }
  const int = (k, d) => { if (a[k] === undefined) return d; if (!/^\d+$/.test(a[k])) fail(`--${k} phải là số nguyên dương`); return +a[k]; };
  return { seed: int('seed', 42), duration: int('duration', 30), out: a.out ?? 'bench.json' };
}

function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const c = [];
  if (process.platform === 'win32') {
    for (const base of [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)) {
      c.push(path.join(base, 'Google/Chrome/Application/chrome.exe'), path.join(base, 'Chromium/Application/chrome.exe'), path.join(base, 'Microsoft/Edge/Application/msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    c.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  } else {
    for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      const r = spawnSync('which', [n], { encoding: 'utf8' });
      if (r.status === 0) c.push(r.stdout.trim());
    }
  }
  return c.find((p) => p && fs.existsSync(p)) ?? null;
}

function metrics(dts) {
  const N = dts.length;
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * N));
  const worst = sorted.slice(-k);
  const p95 = sorted[Math.min(N - 1, Math.ceil(0.95 * N) - 1)];
  const r1 = (v) => Math.round(v * 10) / 10;
  return { avg_fps: r1((1000 * N) / sum), p1_low_fps: r1(1000 / (worst.reduce((a, b) => a + b, 0) / k)), frame_ms_p95: r1(p95), frames: N };
}

function osName() {
  return `${os.type()} ${os.release()} (${os.arch()}), ${os.cpus()[0]?.model ?? 'CPU?'} ×${os.cpus().length}, RAM ${Math.round(os.totalmem() / 1073741824)} GB`;
}

const args = parse(process.argv.slice(2));
const browser = findBrowser();
if (!browser) fail('không tìm thấy Chrome/Edge/Chromium; đặt biến môi trường CHROME_PATH');

if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
  process.stderr.write('bench: chưa có dist/, đang build…\n');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) fail('build thất bại');
}

// server tĩnh + nhận kết quả
let resolveResult;
const result = new Promise((r) => { resolveResult = r; });
const benchPlugin = {
  name: 'ddl-bench',
  configurePreviewServer(server) {
    server.middlewares.use('/api/bench', (req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => { res.end('ok'); try { resolveResult(JSON.parse(body)); } catch (e) { fail('kết quả bench hỏng: ' + e.message); } });
    });
  },
};
const { preview } = await import('vite');
const server = await preview({ root: ROOT, plugins: [benchPlugin], preview: { port: 0, open: false }, logLevel: 'error' });
const port = server.httpServer.address().port;
const url = `http://localhost:${port}/?bench=1&seed=${args.seed}&duration=${args.duration}&report=1`;
if (process.env.DDL_BENCH_DEBUG) process.stderr.write(`bench: ${browser}
${url}
`);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
const child = spawn(browser, [
  `--app=${url}`, '--window-size=1280,760', '--window-position=40,40', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-gpu-vsync', '--disable-frame-rate-limit', '--force-device-scale-factor=1',
], { stdio: 'ignore' });
child.on('error', (e) => fail('không mở được trình duyệt: ' + e.message));

const timeout = setTimeout(() => { child.kill(); fail('quá thời gian chờ kết quả'); }, (args.duration + 90) * 1000);
const r = await result;
clearTimeout(timeout);
child.kill();
await server.close();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* trình duyệt có thể còn giữ file */ }

const out = {
  contract_version: '1.3',
  ...metrics(r.dts),
  load_ms: Math.round(r.first_frame_epoch_ms - PROCESS_START),
  peak_mem_mb: null,
  vsync_off: true,
  renderer: `Three.js r170 WebGL2 trong ${path.basename(browser)} (${r.gpu}); canvas ${r.size.join('×')} @${r.dpr}x`,
  os: osName(),
  // ngoài contract, để đối chiếu:
  peak_mem_note: 'Bản web: RSS của tiến trình trình duyệt không đo được từ trang; js_heap_peak_mb là heap JS của trang (Chrome).',
  js_heap_peak_mb: r.js_heap_peak_mb ?? null,
  scene: { shades: r.shades, motes: r.motes, seed: args.seed, duration_s: args.duration },
};
fs.writeFileSync(args.out, JSON.stringify(out, null, 2) + '\n');
process.stdout.write(`bench: ${JSON.stringify(out)}\n`);
process.exit(0);
