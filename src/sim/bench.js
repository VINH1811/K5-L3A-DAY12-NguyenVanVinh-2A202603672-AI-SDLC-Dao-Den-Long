// Cảnh benchmark chuẩn của Ticket-04 (giống nhau cho mọi lần đo).
// Đêm 1, 200 Bóng Mực "wander" rải đều trên đảo, 100 đom đóm, L1–L3 sáng 100 dầu, Mây đứng ở (0,0,0).
import { makeRng } from './rng.js';
import { NIGHTS, C } from './config.js';

export const BENCH = { shades: 200, motes: 100, camera_radius: 30, camera_y: 15, lap_s: 15, warmup_s: 3, width: 1280, height: 720 };

export function benchScenario(seed = 42) {
  const rng = makeRng(seed);
  const R = NIGHTS[1].islands[0].r - 2; // trong đảo, chừa mép
  // rải đều theo diện tích: r = R·sqrt(u)
  const point = () => { const a = rng.range(0, Math.PI * 2), r = R * Math.sqrt(rng.next()); return [r * Math.cos(a), 0, r * Math.sin(a)]; };
  const shades = Array.from({ length: BENCH.shades }, (_, i) => { const p = point(); return { id: `S${i + 1}`, pos: [p[0], C.shade_y, p[2]], state: 'wander' }; });
  const motes = Array.from({ length: BENCH.motes }, () => point());
  return {
    player: { pos: [0, 0, 0] },
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    shades, motes, drifters: [],
    lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: 100 })),
  };
}

// Camera bench: tròn bán kính 30 m quanh (0,0,0), cao 15 m, bắt đầu ở góc 0° = (30,15,0),
// ngược chiều kim đồng hồ nhìn từ trên (góc tăng từ +X sang +Z như bản đồ chuẩn), 15 s một vòng.
export function benchCamera(tSeconds) {
  const a = (tSeconds / BENCH.lap_s) * Math.PI * 2;
  return [BENCH.camera_radius * Math.cos(a), BENCH.camera_y, BENCH.camera_radius * Math.sin(a)];
}
