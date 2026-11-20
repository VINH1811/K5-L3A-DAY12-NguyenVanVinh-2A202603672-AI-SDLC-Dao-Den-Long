# Phase 2 · Ticket-02 "Ba hòn đảo": spec, giả định, tiêu chí nghiệm thu

Contract v1.1. Mọi số liệu lấy đúng bảng chuẩn của Ticket-02; nguồn duy nhất trong code là `src/sim/config.js`.
Bằng chứng tự động: `npm test` chạy `tests/headless.test.mjs` (hồi quy Phase 1) và `tests/phase2.test.mjs` (tính năng mới), tất cả qua CLI `node tools/headless.mjs`.

## Thay đổi so với Phase 1 và test cũ bị ảnh hưởng

| Thay đổi | Test cũ | Xử lý |
|---|---|---|
| `contract_version` 1.0 → 1.1, thêm khóa `dash_*`, `night2/3_duration_s` | "contract khớp với tuning" | Sửa: kiểm tra "1.1" và tập khóa khớp hoàn toàn |
| Sự kiện mới `night_start` ở tick 0 | 2 test so sánh toàn bộ danh sách sự kiện | Sửa: bộ đọc tách `night_start` ra (`allEvents` vẫn giữ để test riêng) |
| `player_hit` do rơi có thêm `lost` | "rơi khỏi đảo" | Sửa: thêm `lost: 4` vào kỳ vọng |
| Lướt đi đủ 12 tick ở 14 m/s (bản Phase 1 chỉ đi 11 tick) | không có test cũ | Thêm test mới; đây là lỗi thật, phát hiện nhờ test |

Không có test nào bị tắt.

## Giả định (chỗ ticket chưa nói rõ)

- Đêm 3: điểm (0,0,0) nằm trong tháp chuông nên Mây xuất phát và hồi sinh tại **(0, 0, −20)** (tầng 0, phía nam).
- Vách tầng: đi lên được bậc cao tối đa 0.35 m (đủ cho dốc 3 m / 6 m); cao hơn là vách. Đang đứng thì bám theo dốc đi xuống tối đa 0.35 m mỗi tick; bước khỏi mép tầng thì rơi tự do.
- Bóng Mực trượt trên mặt đất (tâm cao hơn đất 1 m), không leo vách, không ra khỏi đảo; lùi bị chặn bởi vách/tháp thì dừng đẩy. Lang thang tới một điểm sinh đom đóm ngẫu nhiên theo seed.
- Gió Lạc bay lơ lửng (không bị vách hay vùng an toàn chặn), tâm cao hơn đất 1.2 m, chạm tính theo XZ ≤ 1.2 m. Sinh ở một điểm sinh Bóng Mực ngẫu nhiên ("điểm sương"). Cướp được cả khi đang `idle` nếu chạm trúng (Mây đang mang > 0). Thả đom đóm tại đúng vị trí của nó, loại `dropped`, sống 480 tick.
- Tỏa Sáng trúng Gió Lạc đang `idle`: không có tác dụng. Không cộng điểm cho Gió Lạc.
- Gió mạnh: cơn thứ k bắt đầu ở sim_tick 1800·k, kéo dài 300 tick; hướng chốt lúc báo trước (sim_tick 1800·k − 120). Gió đẩy cả khi đang bay từ bục. Ngoài Đêm 3 tắt, trừ khi scenario bật `wind_enabled`.
- Bục nhảy kích hoạt khi Mây **đứng** trên bục (XZ ≤ 1 m, cùng độ cao). Vận tốc ngang giữ đến khi chạm đất; nếu va vách thì mất vận tốc ngang. Lướt trong lúc bay dùng 14 m/s rồi trở lại vận tốc bay.
- Snapshot: `player.invuln` là boolean (đang bất tử hay không); thời gian còn lại xem qua scenario `invuln_ticks`. `player_hit` do rơi giữ `dropped` = số đom đóm mất (tương thích v1.0) và thêm `lost` cùng giá trị.
- `night_start` được ghi ngay sau snapshot tick 0, với `tick: 0`.
- Tạm dừng: nút khác bấm trong lúc dừng không được "nhớ" sang lúc tiếp tục.

## Tiêu chí nghiệm thu (Phần 3) → bằng chứng

| Mục | Tiêu chí | Test (`tests/phase2.test.mjs`) |
|---|---|---|
| 3 Đêm, contract v1.1 | `--night 1/2/3` chạy; snapshot có `night`, `wind`, player mở rộng, `motes[kind,ttl_s]`, `drifters`, `charms`; `night_start` tick 0 | "v1.1: snapshot có night…" |
| Đêm 2 cầu tre | Đi từ A sang B qua cầu không rơi; bước ra mép cầu thì rơi | "đi qua cầu tre", "bước ra mép cầu" |
| Bục nhảy Đêm 2 | Bắn lên vy 14, đáp đảo B sau ~1.4 s (tick 80–90), phím không ghi đè | "bục nhảy (20,0,18)…", "phím di chuyển không ghi đè" |
| Đêm 3 tầng | Vách không đi lên; dốc lên Y = 3; bước khỏi mép rơi không mất máu; bục lên Y = 6; tháp là vật cản | 5 test "Đêm 3: …" |
| Lướt | 14 m/s × 0.2 s, hồi 1.5 s, sự kiện `dash`; trên không giữ độ cao | "Lướt: …", "Lướt trên không…" |
| Bùa Gió | `charm_picked {C1, 600}`, 7.2 m/s, hồi lại 2700 tick; lướt không hồi chiêu, phải bấm lại | 2 test "Bùa Gió: …" |
| Gió Lạc | Đuổi khi mang ≥ 5; cướp 3; bỏ chạy 240 tick rồi biến mất; không mất Ngọn Lửa; Tỏa Sáng: đang đuổi → bỏ chạy, đang chạy có đồ → `drifter_drop`; sinh tick 1200 id D1 | 5 test "Gió Lạc…" |
| Tạm dừng | `paused`/`resumed`; tick tăng, sim_tick và thời gian đứng; snapshot `paused` | "Tạm dừng…" |
| Gió mạnh | Bật ở tick 1800, đẩy 2 m/s, tắt sau 5 s; tắt được bằng scenario | "Gió mạnh Đêm 3…" |
| Lịch sinh / tốc độ | Bóng Mực Đêm 2 mỗi 7 s, Đêm 3 mỗi 6 s và 4.5 m/s; tên trạng thái chuẩn | "Lịch sinh Bóng Mực…", "Bóng Mực Đêm 3…" |
| Scenario v1.1 | `shades[].state`, `state_ticks_left`; trạng thái lạ → mã 2 | "scenario shades[].state…" |
| Tất định | Đêm 2, 3 cùng seed → byte giống hệt | "tất định trên Đêm 2 và 3" |
| Hiệu năng headless | Đêm 3 đủ 21 600 tick < 30 s | "Đêm 3 đầy đủ…" (máy dev: ~0.2 s; lưu ý lần chạy này có thể dừng sớm khi Mây thua) |
| Chuỗi 3 Đêm, HUD, pause, cài đặt, âm thanh | Menu → giới thiệu Đêm → chơi → kết quả → Đêm kế; thắng Đêm 3 → màn Bình Minh với tổng điểm | Kiểm tra tay trong trình duyệt (đã chạy: Đêm 1 thắng → "Sang Đêm 2", tổng 948; thắng Đêm 3 → Bình Minh) |
| ≥ 30 FPS ở 1280×720 | | Đo trong trình duyệt bằng `__ddl.fps`: ~70 FPS (giới hạn vsync) trên cả 3 Đêm |
