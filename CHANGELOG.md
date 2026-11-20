# Changelog

## [phase-4] v1.0.0, Contract v1.3: "Bình minh"

### Thay đổi phá vỡ tương thích (breaking)
- `contract_version` "1.2" → "1.3".
- `run_cmd` đổi từ `npm start` sang `node tools/start.mjs`, để `--export-leaderboard` đi thẳng vào script, không bị npm nuốt.
- `build_cmd` = `npm ci && npm run build`.
- Esc/P vẫn là tạm dừng mặc định, nhưng mọi phím giờ đổi được; phím mũi tên chỉ là phím phụ khi không bị gán cho hành động khác.

### Thêm
- `bench_cmd` (`node tools/bench.mjs --seed 42 --duration 30 --out bench.json`): cảnh benchmark chuẩn 1280×720, tắt vsync, xuất avg_fps / p1_low_fps / frame_ms_p95 / frames / load_ms.
- `soak_cmd` (`node --expose-gc --max-opt=1 --single-threaded --max-semi-space-size=1 tools/soak.mjs …`): 10 Đêm liên tiếp, input ngẫu nhiên theo seed, đo RSS.
- Chế độ `bench` trong sim (mặc định tắt; headless theo contract không đổi).
- Bảng xếp hạng cục bộ:
  - top 10, lưu ra đĩa `.data/leaderboard.json` (bản tĩnh thì dùng localStorage);
  - nhập tên ở màn Bình Minh và khi thua;
  - màn Bảng xếp hạng ở menu;
  - `node tools/start.mjs --export-leaderboard out.json`.
- Dễ tiếp cận:
  - đổi phím 9 hành động, có phát hiện trùng phím và nút khôi phục mặc định;
  - phụ đề / chỉ báo hình ảnh: Bóng Mực xuất hiện kèm mũi tên mép màn hình, gió sắp thổi, 10 s cuối, đèn < 30 dầu;
  - giảm chuyển động;
  - chữ tối thiểu 18 px, tùy chọn chữ lớn ×1.25.
- Màn Cài đặt riêng, mở từ menu và từ màn tạm dừng.
- CI GitHub Actions (Ubuntu + macOS): test, build, soak, headless.
- LICENSE (MIT), CREDITS.md.

### Sửa sau khi gắn tag lần đầu
- Soak: thêm cờ `--max-opt=1` vào `soak_cmd`. CI trên Ubuntu/macOS cho thấy RSS phình 1.2–1.6× do vùng nhớ của trình biên dịch tối ưu V8, dù heap đứng yên. Có cờ này thì ra 1.03–1.04×. CI kiểm tra ngưỡng 1.2.

### Hiệu năng
- Bóng Mực dùng chung geometry (thân + xúc tu gộp, mắt gộp) và một hệ hạt khói chung. Cảnh 200 con trên máy dev: avg 67 → 168 FPS, p1_low 30 → 114.

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
