#!/usr/bin/env node
// Lệnh chạy game (run_cmd).
//   node tools/start.mjs                                  mở game (Vite, http://localhost:5173)
//   node tools/start.mjs --export-leaderboard out.json    xuất bảng xếp hạng {"entries": [...]} rồi thoát
import fs from 'node:fs';
import { readEntries } from './leaderboard-store.mjs';

const argv = process.argv.slice(2);
const i = argv.indexOf('--export-leaderboard');
if (i >= 0) {
  const out = argv[i + 1];
  if (!out) { process.stderr.write('start: thiếu tên file sau --export-leaderboard\n'); process.exit(1); }
  fs.writeFileSync(out, JSON.stringify({ entries: readEntries() }, null, 2) + '\n');
  process.exit(0);
}

const { createServer } = await import('vite');
const server = await createServer({ server: { open: !argv.includes('--no-open'), port: 5173 } });
await server.listen();
server.printUrls();
