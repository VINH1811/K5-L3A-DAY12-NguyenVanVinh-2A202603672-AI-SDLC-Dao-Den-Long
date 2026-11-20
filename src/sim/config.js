// Số liệu gameplay. Mọi giá trị ở đây phải khớp với game.contract.json (tests/contract.test.mjs kiểm tra).
// Dùng số chuẩn của Ticket-02 ngay từ Phase 1 để không phải đổi cảm giác điều khiển về sau.

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

// Hằng số phụ (không có trong contract v1.0 nhưng ghi rõ trong README).
export const C = {
  accel: TUNING.player_speed / 0.1, // đạt tốc độ tối đa trong 0.1 s
  jump_vel: 7.0,
  gravity: -20.0,
  pickup_dy: 1.5,
  island_radius: 40,
  fall_y: -10,
  respawn_wait_ticks: 60,
  invuln_ticks: Math.round(TUNING.invuln_s * TPS), // 90
  pulse_center_dy: 0.8,
  pulse_cd_ticks: Math.round(TUNING.pulse_cooldown_s * TPS), // 180
  stun_ticks: Math.round(TUNING.pulse_stun_s * TPS), // 120
  push_ticks: 15,
  dash_ticks: Math.round(TUNING.dash_duration_s * TPS), // 12
  dash_cd_ticks: Math.round(TUNING.dash_cooldown_s * TPS), // 90
  shade_y: 1.0,
  shade_detect: 12,
  shade_lose: 18,
  shade_wander_speed: 2.0,
  shade_hit_dy: 1.5,
  shade_spawning_ticks: 30,
  recoil_ticks: 60,
  recoil_m: 2.0,
  safe_push_ticks: 30,
  shade_spawn_first: 300,
  shade_spawn_every: 480,
  shade_max: 6,
  shade_spawn_r: 37,
  shade_spawn_min_dist: 15,
  mote_initial: 20,
  mote_cap: 30,
  mote_spawn_every: 240,
  drop_ttl_ticks: 480,
  drop_r_min: 1.5,
  drop_r_max: 2.5,
};

// Bản đồ chuẩn Đêm 1 — Đảo Bến.
export const NIGHT1 = {
  name: 'Đảo Bến',
  lanterns: [
    { id: 'L1', pos: [0, 0, 25] },
    { id: 'L2', pos: [23.8, 0, 7.7] },
    { id: 'L3', pos: [14.7, 0, -20.2] },
    { id: 'L4', pos: [-14.7, 0, -20.2] },
    { id: 'L5', pos: [-23.8, 0, 7.7] },
  ],
  moteSpots: (() => {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i * 45 * Math.PI) / 180;
      pts.push([12 * Math.cos(a), 0, 12 * Math.sin(a)]);
    }
    for (let i = 0; i < 16; i++) {
      const a = (i * 22.5 * Math.PI) / 180;
      pts.push([33 * Math.cos(a), 0, 33 * Math.sin(a)]);
    }
    return pts;
  })(),
  shadeSpots: (() => {
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = ((15 + i * 30) * Math.PI) / 180;
      pts.push([C.shade_spawn_r * Math.cos(a), C.shade_y, C.shade_spawn_r * Math.sin(a)]);
    }
    return pts;
  })(),
};
