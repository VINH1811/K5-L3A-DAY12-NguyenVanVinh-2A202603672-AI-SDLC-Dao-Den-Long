# Changelog

## [phase-3] Contract v1.2: "Đèn cạn dầu"

### Thay đổi phá vỡ tương thích (breaking)
- `contract_version` "1.1" → "1.2".
- Thời lượng Đêm 1/2/3: 300/330/360 s → **240/270/300 s**.
- **Bỏ thắng sớm.** Không còn `game_over.reason = "all_lit"`. Thắng chỉ xét ở bình minh: còn sống và số đèn đang sáng ≥ ceil(0.6 × tổng) → `won/dawn_survived`; dưới ngưỡng → `lost/dawn`.
- **Công thức điểm mới:** +5 mỗi đom đóm (thắp, thắp lại, châm dầu), +100 thắp lần đầu, +40 thắp lại, +5 trúng Tỏa Sáng (+15 nếu Bóng Mực đang hút), bình minh khi thắng: mỗi đèn sáng +50 + floor(fuel), mỗi Ngọn Lửa +50. Bỏ thưởng thời gian. `tuning.score.per_mote` 10 → 5, `per_second_left` 2 → 0.
- **Đèn đã sáng nhận đom đóm để châm dầu** (trước đây không nhận). Khi tương tác chỉ xét đèn nhận được.
- **Vùng an toàn chỉ có khi đèn còn ≥ 30 dầu**; Bóng Mực vào được đèn yếu.
- Sức chứa không còn cố định 10: `10 + 2 × successful_lights`, tối đa 20.

### Thêm
- Dầu đèn (`fuel`, tối đa 100, hao 1/s), `lantern_out`, thắp lại 5 đom đóm, `relit_count`, `ever_lit`.
- Trạng thái Bóng Mực `drain` (hút 5 dầu/s), sự kiện `fuel_drain` mỗi 60 tick.
- Sự kiện `refuel`; `lantern_lit` thêm `relight`.
- Snapshot: đèn có `fuel`, `ever_lit`, `relit_count`; `player.capacity`.
- Scenario: đèn có `lit`, `fuel`, `ever_lit`; `player.successful_lights`; `shades[].target_lantern_id`.
- Tuning: `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`.
- Giao diện:
  - Thanh dầu trên đèn; đèn và thanh nhấp nháy 1 Hz khi dầu < 30.
  - Đèn tắt bị xẹp 20% và giấy có vết rách.
  - Dòng nhắc "Châm dầu / Thắp lại", HUD "cần k đèn lúc bình minh" và "đang mang / sức chứa".
  - Cài đặt "Bảng màu dễ phân biệt" (được lưu): Bóng Mực #00B3FF, cảnh báo trắng kèm ⚠.

### Sửa
- Bóng Mực bị đẩy khỏi vùng an toàn không còn hút dầu trong lúc bị đẩy.
- Bóng Mực dừng đúng trên mép 6 m (trước đây sai số số thực có thể kích hoạt đẩy lại mãi).

## [phase-2] Contract v1.1: "Ba hòn đảo"

### Thay đổi phá vỡ tương thích (breaking)
- `contract_version` "1.0" → "1.1".
- Sự kiện mới `night_start` ở tick 0.
- `player_hit` do rơi thêm trường `lost`.
- Tên trạng thái Bóng Mực cố định: `spawning, wander, chase, recoil, stunned`.

### Thêm
- Đêm 2 Đảo Cau (hai đảo, cầu tre, bục nhảy) và Đêm 3 Đảo Chuông (3 tầng, dốc, tháp chuông, gió mạnh); `--night 1|2|3`.
- Lướt, Gió Lạc, Bùa Gió, tạm dừng (`pause`), chuỗi 3 Đêm và màn Bình Minh.
- Snapshot: `night`, `wind`, player mở rộng, `motes[kind, ttl_s]`, `drifters`, `charms`.
- Đảo lơ lửng trên mây, trụ đá cao, chu kỳ ngày/đêm, đổ bóng.

### Sửa
- Lướt đi đủ 12 tick ở 14 m/s (trước đây 11 tick).

## [phase-1] Contract v1.0: Đêm 1 "Đảo Bến"
- Game 3D chơi được Đêm 1 từ đầu tới thắng/thua, HUD, âm thanh tự tổng hợp.
- Lõi mô phỏng tất định 60 tick/s, CLI headless theo Test Contract v1.0, 19 scenario test.
