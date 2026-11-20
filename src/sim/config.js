// Số liệu gameplay. Mọi giá trị trong TUNING phải khớp với game.contract.json (test so khớp hai nơi).
// Theo số chuẩn của Ticket-02 (Contract v1.1).

export const TPS = 60; // tick mỗi giây, cố định

export const TUNING = {
  player_speed: 6.0,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1.0,
  interact_radius: 2.0,
  pulse_cost: 3,
  pulse_radius: 5.0,
  night1_duration_s: 300,
  night2_duration_s: 330,
  night3_duration_s: 360,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2.0,
  pulse_push_m: 4.0,
  pulse_cooldown_s: 3.0,
  safe_radius: 6.0,
  shade_speed: 4.0,
  shade_hit_radius: 1.0,
  fall_enabled: true,
  dash_speed: 14.0,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

// Hằng số phụ (không có trong contract nhưng ghi rõ trong docs/notes).
export const C = {
  accel_time_s: 0.1, // đạt tốc độ tối đa / dừng trong 0.1 s
  jump_vel: 7.0,
  gravity: -20.0,
  step_up: 0.35, // bậc cao nhất đi lên được (dốc), cao hơn là vách
  snap_down: 0.35, // đang đứng đất thì bám xuống dốc tối đa chừng này mỗi tick
  land_tol: 1.0,
  pickup_dy: 1.5,
  fall_y: -10,
  respawn_wait_ticks: 60,
  invuln_ticks: Math.round(TUNING.invuln_s * TPS), // 90
  pulse_center_dy: 0.8,
  pulse_cd_ticks: Math.round(TUNING.pulse_cooldown_s * TPS), // 180
  stun_ticks: Math.round(TUNING.pulse_stun_s * TPS), // 120
  push_ticks: 15,
  dash_ticks: Math.round(TUNING.dash_duration_s * TPS), // 12
  dash_cd_ticks: Math.round(TUNING.dash_cooldown_s * TPS), // 90
  shade_y: 1.0, // tâm Bóng Mực cao hơn mặt đất 1 m
  shade_detect: 12,
  shade_lose: 18,
  shade_wander_speed: 2.0,
  shade_hit_dy: 1.5,
  shade_spawning_ticks: 30,
  recoil_ticks: 60,
  recoil_m: 2.0,
  safe_push_ticks: 30,
  shade_spawn_first: 300,
  shade_spawn_min_dist: 15,
  mote_initial: 20,
  mote_cap: 30,
  mote_spawn_every: 240,
  drop_ttl_ticks: 480,
  drop_r_min: 1.5,
  drop_r_max: 2.5,
  // Gió Lạc
  drifter_speed: 7.0,
  drifter_idle_speed: 2.0,
  drifter_max: 2,
  drifter_every: 1200,
  drifter_detect: 15,
  drifter_min_carried: 5,
  drifter_hit_r: 1.2,
  drifter_steal: 3,
  drifter_flee_ticks: 240,
  drifter_drop_flee_ticks: 120,
  drifter_y: 1.2,
  // Bùa Gió
  charm_ticks: 600,
  charm_respawn_ticks: 2700,
  charm_speed: 7.2,
  // Gió mạnh (Đêm 3)
  wind_every: 1800,
  wind_ticks: 300,
  wind_warn_ticks: 120,
  wind_speed: 2.0,
  // bục nhảy
  pad_radius: 1.0,
};

const deg = (d) => (d * Math.PI) / 180;
const ring = (n, r, startDeg, stepDeg, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = deg(startDeg + i * stepDeg);
    return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
  });
const hyp = Math.hypot;

// ---------- Đêm 1 — Đảo Bến: đảo tròn bán kính 40 m
const N1 = {
  night: 1,
  name: 'Đảo Bến',
  duration_s: TUNING.night1_duration_s,
  start: [0, 0, 0],
  lanterns: [
    { id: 'L1', pos: [0, 0, 25] },
    { id: 'L2', pos: [23.8, 0, 7.7] },
    { id: 'L3', pos: [14.7, 0, -20.2] },
    { id: 'L4', pos: [-14.7, 0, -20.2] },
    { id: 'L5', pos: [-23.8, 0, 7.7] },
  ],
  moteSpots: [...ring(8, 12, 0, 45), ...ring(16, 33, 0, 22.5)],
  shadeSpots: ring(12, 37, 15, 30),
  shadeEvery: 480,
  shadeMax: 6,
  shadeSpeed: 4.0,
  pads: [],
  charms: [],
  drifters: false,
  wind: false,
  islands: [{ c: [0, 0], r: 40 }],
  ground(x, z) {
    return hyp(x, z) <= 40 ? 0 : null;
  },
};

// ---------- Đêm 2 — Đảo Cau: hai đảo r = 28 m nối bằng cầu tre
const padToward = (from, to, h, vy) => {
  const dx = to[0] - from[0], dz = to[2] - from[2], d = hyp(dx, dz);
  return { pos: from, vel: [(dx / d) * h, vy, (dz / d) * h] };
};
const N2 = {
  night: 2,
  name: 'Đảo Cau',
  duration_s: TUNING.night2_duration_s,
  start: [0, 0, 0],
  lanterns: [
    { id: 'L1', pos: [0, 0, 20] },
    { id: 'L2', pos: [17, 0, -10] },
    { id: 'L3', pos: [-17, 0, -10] },
    { id: 'L4', pos: [70, 0, 20] },
    { id: 'L5', pos: [87, 0, -10] },
    { id: 'L6', pos: [53, 0, -10] },
  ],
  moteSpots: [
    ...ring(4, 10, 0, 90), ...ring(8, 22, 0, 45),
    ...ring(4, 10, 0, 90, 0, 70), ...ring(8, 22, 0, 45, 0, 70),
  ],
  shadeSpots: [...ring(8, 26, 22.5, 45), ...ring(8, 26, 22.5, 45, 0, 70)],
  shadeEvery: 420,
  shadeMax: 8,
  shadeSpeed: 4.0,
  pads: [
    padToward([20, 0, 18], [70, 0, 0], 24, 14),
    padToward([50, 0, -18], [0, 0, 0], 24, 14),
  ],
  charms: [{ id: 'C1', pos: [35, 0, 0] }],
  drifters: true,
  wind: false,
  islands: [{ c: [0, 0], r: 28 }, { c: [70, 0], r: 28 }],
  bridge: { x0: 26, x1: 44, z0: -2, z1: 2 },
  ground(x, z) {
    if (hyp(x, z) <= 28 || hyp(x - 70, z) <= 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0;
    return null;
  },
};

// ---------- Đêm 3 — Đảo Chuông: đảo r = 45 m, 3 tầng, 2 dốc, tháp chuông
const RAMPS = [30, 150].map((a) => ({ angle: a, dir: [Math.cos(deg(a)), Math.sin(deg(a))], r0: 30, r1: 24, width: 3, h: 3 }));
const N3 = {
  night: 3,
  name: 'Đảo Chuông',
  duration_s: TUNING.night3_duration_s,
  // (0,0,0) nằm trong tháp chuông nên Đêm 3 xuất phát ở tầng 0 phía nam (giả định, ghi trong docs).
  start: [0, 0, -20],
  lanterns: [
    { id: 'L1', pos: [0, 6, 6] },
    { id: 'L2', pos: [18, 3, 10] },
    { id: 'L3', pos: [-18, 3, 10] },
    { id: 'L4', pos: [35, 0, -10] },
    { id: 'L5', pos: [-35, 0, -10] },
    { id: 'L6', pos: [20, 0, -35] },
    { id: 'L7', pos: [-20, 0, -35] },
  ],
  moteSpots: [...ring(18, 34, 0, 20, 0), ...ring(8, 18, 20, 20, 3), ...ring(4, 5, 45, 90, 6)],
  shadeSpots: ring(16, 43, 0, 22.5),
  shadeEvery: 360,
  shadeMax: 10,
  shadeSpeed: 4.5,
  pads: [{ pos: [0, 3, 13], vel: [0, 12, -8] }],
  charms: [{ id: 'C1', pos: [30, 0, 25] }, { id: 'C2', pos: [-30, 0, 25] }],
  drifters: true,
  wind: true,
  islands: [{ c: [0, 0], r: 45 }],
  tiers: { t1: { r0: 12, r1: 24, y: 3 }, t2: { r: 8, y: 6 }, tower: { r: 2, h: 8 } },
  ramps: RAMPS,
  ground(x, z) {
    const r = hyp(x, z);
    if (r > 45) return null;
    if (r <= 2) return 14; // tháp chuông: khối đặc cao 8 m trên tầng 2
    if (r <= 8) return 6;
    if (r >= 12 && r <= 24 && z > 0) return 3;
    for (const rp of RAMPS) {
      const along = x * rp.dir[0] + z * rp.dir[1];
      const perp = Math.abs(-x * rp.dir[1] + z * rp.dir[0]);
      if (perp <= rp.width / 2 && along >= rp.r1 && along <= rp.r0) return (rp.h * (rp.r0 - along)) / (rp.r0 - rp.r1);
    }
    return 0;
  },
};

export const NIGHTS = { 1: N1, 2: N2, 3: N3 };
export const NIGHT1 = N1;
