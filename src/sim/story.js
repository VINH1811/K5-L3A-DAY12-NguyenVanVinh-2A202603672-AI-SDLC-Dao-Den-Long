// Chế độ Cốt truyện: 5 chương, nhiều loại quái, thẻ năng lực.
// KHÔNG thuộc Test Contract: chỉ bật khi createSim({ story }) được truyền vào. Headless chuẩn (Đêm 1–3, không --story)
// cho output giống hệt trước đây.

// Mỗi chương gắn với một bản đồ trong NIGHTS (config.js) và một tổ hợp quái (trọng số khi sinh).
export const CHAPTERS = {
  1: { title: 'Bến đèn tắt', monsters: { ink: 1 } },
  2: { title: 'Rặng cau trong gió', monsters: { ink: 3, bat: 2 } },
  3: { title: 'Tiếng chuông đá', monsters: { ink: 3, bat: 1, giant: 2 } },
  4: { title: 'Mặt hồ đóng băng', monsters: { ink: 2, giant: 1, phantom: 2 } },
  5: { title: 'Trái tim của mực', monsters: { ink: 2, bat: 1, phantom: 1 }, boss: true },
};

// Thông số từng loại quái. ink = Bóng Mực gốc (dùng đúng số chuẩn của Ticket-02).
export const MONSTERS = {
  ink: { name: 'Bóng Mực' },
  bat: { name: 'Dơi Mực', speed: 6.0, wander: 3.5, detect: 16, lose: 22, hitR: 0.8, y: 1.3 },
  giant: { name: 'Mực Khổng Lồ', speed: 2.6, wander: 1.4, detect: 10, lose: 16, hitR: 1.6, y: 1.2, armor: 1, armorRegen: 480 },
  phantom: { name: 'Mực Ma', speed: 3.4, wander: 2.0, detect: 14, lose: 20, hitR: 1.0, y: 1.0, blinkEvery: 180, blinkDist: 4 },
  boss: { name: 'Mẹ Mực', speed: 1.6, wander: 1.0, detect: 40, lose: 60, hitR: 2.2, y: 1.2, hp: 6, summonEvery: 600, summonN: 2, hitStun: 45, pulseReach: 2.5 },
};

// Thẻ năng lực: thụ động (luôn có tác dụng) hoặc chủ động (phím Q, có hồi chiêu). Chỉ trang bị 1 thẻ chủ động.
export const CARDS = {
  magnet: { name: 'Nam Châm Đom Đóm', kind: 'passive', text: 'Nhặt đom đóm trong bán kính 2.5 m', icon: '✧' },
  wide: { name: 'Hào Quang Rộng', kind: 'passive', text: 'Tỏa Sáng phủ 8 m thay vì 5 m', icon: '◎' },
  oil: { name: 'Dầu Trầm', kind: 'passive', text: 'Đèn hao dầu chậm một nửa', icon: '🏮' },
  swift: { name: 'Chân Gió', kind: 'passive', text: 'Chạy nhanh hơn 15%, lướt hồi chiêu nửa thời gian', icon: '➶' },
  heart: { name: 'Ngọn Lửa Thứ Tư', kind: 'passive', text: 'Bắt đầu mỗi chương với 4 Ngọn Lửa', icon: '♥' },
  bag: { name: 'Túi Lụa', kind: 'passive', text: 'Mang thêm 4 đom đóm', icon: '◈' },
  shield: { name: 'Khiên Ánh Sáng', kind: 'active', text: 'Q: bất tử 3 giây (hồi 25 s)', icon: '⛨', cd: 1500 },
  freeze: { name: 'Sương Đóng Băng', kind: 'active', text: 'Q: choáng mọi quái trong 15 m 4 giây (hồi 30 s)', icon: '❄', cd: 1800 },
  beacon: { name: 'Đèn Thần', kind: 'active', text: 'Q: châm 40 dầu cho đèn sáng gần nhất (hồi 40 s)', icon: '✺', cd: 2400 },
  blink: { name: 'Bước Mây', kind: 'active', text: 'Q: dịch chuyển 8 m về phía trước (hồi 10 s)', icon: '⤳', cd: 600 },
};
export const CARD_IDS = Object.keys(CARDS);

// Gộp các thẻ thành bộ chỉ số dùng trong sim.
export function cardMods(cards = []) {
  const has = (id) => cards.includes(id);
  const active = [...cards].reverse().find((id) => CARDS[id]?.kind === 'active') ?? null;
  return {
    pickupR: has('magnet') ? 2.5 : null,
    pulseR: has('wide') ? 8 : null,
    decayEvery: has('oil') ? 2 : 1, // hao 1 đơn vị mỗi N tick
    speedMul: has('swift') ? 1.15 : 1,
    dashCdMul: has('swift') ? 0.5 : 1,
    flames: has('heart') ? 4 : null,
    capBonus: has('bag') ? 4 : 0,
    active,
  };
}

export function validStory(st) {
  return st && typeof st === 'object' && Array.isArray(st.cards ?? []) && (st.cards ?? []).every((c) => CARD_IDS.includes(c));
}
