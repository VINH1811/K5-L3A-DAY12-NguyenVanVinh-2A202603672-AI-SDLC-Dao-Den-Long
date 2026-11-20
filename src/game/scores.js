// Bảng xếp hạng phía trình duyệt: ưu tiên lưu ra đĩa qua /api/leaderboard (khi chạy bằng npm start / preview);
// nếu mở bản tĩnh không có server thì lưu trong localStorage của trình duyệt.
import { addEntry, sortEntries, validEntry } from '../leaderboard.js';

const LS = 'ddl.leaderboard';
const lsRead = () => { try { return sortEntries((JSON.parse(localStorage.getItem(LS)) ?? []).filter(validEntry)); } catch { return []; } };
const lsWrite = (e) => { try { localStorage.setItem(LS, JSON.stringify(e)); } catch { /* bỏ qua */ } };

export async function loadBoard() {
  try {
    const r = await fetch('/api/leaderboard', { cache: 'no-store' });
    if (r.ok) return { entries: (await r.json()).entries, disk: true };
  } catch { /* không có server */ }
  return { entries: lsRead(), disk: false };
}

export async function saveScore(entry) {
  try {
    const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
    if (r.ok) return { entries: (await r.json()).entries, disk: true };
    if (r.status === 400) throw new Error((await r.json()).error);
  } catch (e) {
    if (e.message && !/fetch|network|Failed/i.test(e.message)) throw e;
  }
  const entries = addEntry(lsRead(), entry);
  lsWrite(entries);
  return { entries, disk: false };
}
