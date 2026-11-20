# Phase 3 · Ticket-03 "Đèn cạn dầu": spec, giả định, tiêu chí nghiệm thu

Contract v1.2. Quyết định thiết kế: [adr-001-lantern-fuel.md](adr-001-lantern-fuel.md). Thay đổi phá vỡ tương thích: [CHANGELOG.md](../../CHANGELOG.md).

## Test cũ bị luật mới làm sai và cách xử lý

| Test cũ | Vì sao sai | Xử lý |
|---|---|---|
| `headless`: "contract khớp với tuning" | phiên bản 1.1 → 1.2 | Sửa: kiểm tra "1.2" |
| `headless`: "snapshot tick 0… đứng yên 600 tick" (time_left 290) | Đêm 1 còn 240 s | Sửa: 230 |
| `headless`: "thắp hết 5 đèn → won/all_lit" | [THAY THẾ] không còn thắng sớm, `all_lit` bị bỏ | **Bỏ**, thay bằng "thắp hết 5 đèn không còn kết thúc Đêm" + các test bình minh trong `phase3.test.mjs` |
| `phase2`: "Tạm dừng…" (time_left 300 − 1) | Đêm 1 còn 240 s | Sửa: 240 − 1 |

Các test điểm cũ (nạp đèn, Tỏa Sáng) đọc hệ số từ `TUNING.score`, nên tự đúng với điểm mới (+5/đom đóm). Test vùng an toàn Phase 1 vẫn đúng: đèn đặt sẵn có 100 dầu, sau 600 tick còn 90 ≥ 30.

## Giả định

- Châm dầu dùng dầu *sau* khi bước 2 đã trừ hao và hút của tick đó (bước 5 sau bước 2). Ví dụ: 55 dầu, bấm E ở tick 0 → bước 1 còn 54.983 → dùng ceil(45.017/10) = 5 đom đóm → 100.
- Vì luôn hao trước khi tương tác, một đèn "đầy" theo nghĩa hiển thị (100) vẫn nhận 1 đom đóm ở tick kế tiếp. Đây là hệ quả trực tiếp của công thức trong ticket.
- `target_lantern_id` trong scenario là đèn ưu tiên của Bóng Mực khi `wander`, nếu đèn đó yếu hoặc tắt; trạng thái `drain` trong scenario bắt buộc phải có nó (thiếu → mã 2).
- Bóng `wander` đi về đèn tắt gần nhất rồi đứng chờ cách chân cột ≤ 1.5 m. Khi mọi đèn đều sáng và ≥ 30 dầu thì lang thang ngẫu nhiên như Phase 2.
- Bóng `drain` không gây sát thương.
- `fuel_drain` ghi ở tick thứ 60, 120… kể từ khi con đó bắt đầu hút; dầu ghi là dầu *sau* khi trừ ở tick đó.
- `lantern.fuel` trong scenario cho đèn chưa sáng bị bỏ qua (đèn tắt luôn có `fuel: 0`); fuel ngoài [0, 100] → mã 2.
- Đèn đặt `lit: true` bằng scenario được coi là `ever_lit: true` (đã từng sáng) nhưng không tính vào `successful_lights`.
- Điểm: khóa mới trong `tuning.score`: `per_relight: 40`, `per_stun_drain: 15`, `per_lit_at_dawn: 50`; `per_second_left` đặt 0 (đã bỏ).

## Tiêu chí nghiệm thu → bằng chứng (`tests/phase3.test.mjs`, chạy qua CLI)

| Mục | Tiêu chí | Test |
|---|---|---|
| Contract v1.2 | Có 8 khóa mới, thời lượng 240/270/300 | "contract v1.2…" |
| Snapshot | `fuel` 1 chữ số, `ever_lit`, `relit_count`, `player.capacity` | "snapshot: đèn có fuel…" |
| Hao dầu | 600 tick → −10 | "dầu hao 1/giây" |
| Hết dầu | `lantern_out` đúng tick, `deposited` 0, nhớ `ever_lit` | "hết dầu…" |
| Thắp lần đầu / thắp lại | relight false/true, 10/5 đom đóm, +100/+40, fuel 100 | 2 test |
| Châm dầu | công thức `used`, sự kiện `refuel`, trần 100, mang thiếu | 2 test |
| Chọn đèn | đèn không nhận được không được chọn, không sự kiện | 2 test |
| Mất vùng an toàn < 30; drain | bóng tới ≤ 2 m, `drain`, hút 6/s tổng, `fuel_drain` mỗi 60 tick | "đèn dưới 30 dầu…" |
| Đúng 30 còn vùng an toàn | bóng không vào trong 6 m | "đúng 30 dầu…" |
| Chuyển trạng thái drain | → chase (≤ 6 m), → wander (đèn tắt), → stunned +15 | 3 test |
| Châm ≥ 30 đẩy bóng | thôi hút ngay, ra mép 6 m trong 30 tick, không sát thương | "châm dầu lên ≥ 30…" |
| Ưu tiên đèn yếu | bỏ qua đèn tắt gần hơn | "Bóng Mực wander ưu tiên đèn yếu…" |
| Luật thắng | `dawn_survived` + điểm bình minh; thua `dawn` khi dưới ngưỡng; ngưỡng 3/5, 4/6, 5/7; `no_flames` ưu tiên ở tick bình minh | 4 test |
| Sức chứa | 10 + 2 × lần thắp, tối đa 20; đèn scenario không tính | 2 test |
| Scenario v1.2 sai → mã 2 | | "scenario v1.2 sai…" |
| Tất định | Đêm 1–3 | "tất định với luật dầu" |
| Thanh dầu, nhấp nháy < 30, mù màu, HUD sức chứa | Kiểm tra tay trong trình duyệt | Đã chạy: châm 4 đom đóm 12 → 52, đèn tắt hiện vết rách và nhắc "Thắp lại (0/5)", Bóng Mực `drain` khi đèn còn 20 dầu, chế độ mù màu đổi viền Bóng Mực sang #00B3FF và cảnh báo trắng có ⚠ |
