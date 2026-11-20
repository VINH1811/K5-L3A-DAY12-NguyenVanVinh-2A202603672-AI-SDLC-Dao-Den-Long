// Phím điều khiển có thể đổi (Ticket-04): mặc định, tên hiển thị, phát hiện trùng phím.
export const ACTIONS = [
  ['up', 'Đi tới'], ['down', 'Đi lùi'], ['left', 'Sang trái'], ['right', 'Sang phải'],
  ['jump', 'Nhảy'], ['dash', 'Lướt'], ['interact', 'Nạp / châm dầu'], ['pulse', 'Tỏa Sáng'], ['ability', 'Năng lực thẻ (Cốt truyện)'], ['pause', 'Tạm dừng'],
];
export const DEFAULT_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', ability: 'KeyQ', pause: 'Escape' };
// Phím phụ cố định (chỉ dùng khi không bị gán cho hành động khác)
export const ALT_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', dash: 'ShiftRight', pause: 'KeyP' };

const NAMES = { Space: 'Space', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải', AltLeft: 'Alt trái', AltRight: 'Alt phải', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: '⌫', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', CapsLock: 'Caps' };
export function keyName(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return 'Num ' + code.slice(6);
  return code;
}

export function loadKeys(stored) {
  const k = { ...DEFAULT_KEYS };
  if (stored && typeof stored === 'object') for (const [a] of ACTIONS) if (typeof stored[a] === 'string' && stored[a]) k[a] = stored[a];
  return k;
}

// Danh sách cặp trùng: [[mã phím, [hành động…]], …]
export function duplicates(keys) {
  const by = new Map();
  for (const [a] of ACTIONS) { const c = keys[a]; if (!by.has(c)) by.set(c, []); by.get(c).push(a); }
  return [...by].filter(([, list]) => list.length > 1);
}

// Phím nào đang kích hoạt hành động a (phím chính, hoặc phím phụ nếu phím phụ không bị gán chỗ khác)
export function codesFor(keys, a) {
  const out = [keys[a]];
  const alt = ALT_KEYS[a];
  if (alt && !Object.values(keys).includes(alt)) out.push(alt);
  return out;
}
