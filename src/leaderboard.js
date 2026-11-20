// Bảng xếp hạng cục bộ (Ticket-04): logic thuần, dùng chung cho trình duyệt, server và CLI xuất.
export const MAX_ENTRIES = 10;
// 3–12 ký tự: chữ (kể cả tiếng Việt có dấu), số, gạch dưới.
export const NAME_RE = /^[\p{L}\p{M}\p{N}_]{3,12}$/u;

export const normalizeName = (n) => String(n ?? '').normalize('NFC').trim();
export const validName = (n) => NAME_RE.test(normalizeName(n)) && [...normalizeName(n)].length <= 12;

// ISO 8601 có múi giờ của máy, ví dụ 2026-11-20T21:05:09+07:00
export function isoWithOffset(d = new Date()) {
  const p = (n) => String(Math.trunc(Math.abs(n))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sign}${p(off / 60)}:${p(off % 60)}`;
}

export function validEntry(e) {
  return e && typeof e === 'object' && validName(e.name) && Number.isInteger(e.score) && e.score >= 0
    && Number.isInteger(e.nights_won) && e.nights_won >= 0 && e.nights_won <= 3
    && typeof e.achieved_at === 'string' && !Number.isNaN(Date.parse(e.achieved_at)) && Number.isInteger(e.seed);
}

// Điểm giảm dần; bằng điểm thì ai đạt trước đứng trên. Giữ top 10.
export function sortEntries(entries) {
  return [...entries].sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at)).slice(0, MAX_ENTRIES);
}

export function addEntry(entries, e) {
  if (!validEntry(e)) throw new Error('mục bảng xếp hạng không hợp lệ');
  const clean = { name: normalizeName(e.name), score: e.score, nights_won: e.nights_won, achieved_at: e.achieved_at, seed: e.seed };
  return sortEntries([...(entries ?? []).filter(validEntry), clean]);
}

// Lọt top 10 không?
export function qualifies(entries, score) {
  const s = sortEntries(entries ?? []);
  return s.length < MAX_ENTRIES || score > s[s.length - 1].score;
}
