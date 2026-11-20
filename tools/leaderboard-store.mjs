// Lưu bảng xếp hạng ra đĩa (file JSON). Mặc định .data/leaderboard.json ở thư mục game;
// đổi bằng biến môi trường DDL_LEADERBOARD (dùng cho test).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addEntry, sortEntries, validEntry } from '../src/leaderboard.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const storePath = () => process.env.DDL_LEADERBOARD || path.join(ROOT, '.data', 'leaderboard.json');

export function readEntries() {
  try {
    const doc = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    return sortEntries((doc.entries ?? []).filter(validEntry));
  } catch {
    return [];
  }
}

export function saveEntry(entry) {
  const entries = addEntry(readEntries(), entry);
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ entries }, null, 2) + '\n');
  fs.renameSync(tmp, file); // ghi nguyên tử, tắt game giữa chừng không hỏng file
  return entries;
}

// Middleware cho Vite (dev và preview): GET/POST /api/leaderboard
export function leaderboardMiddleware(req, res, next) {
  if (!req.url || !req.url.startsWith('/api/leaderboard')) return next();
  const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET') return send(200, { entries: readEntries() });
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      try { send(200, { entries: saveEntry(JSON.parse(body)) }); } catch (e) { send(400, { error: e.message }); }
    });
    return;
  }
  send(405, { error: 'method' });
}
