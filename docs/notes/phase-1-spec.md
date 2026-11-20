# Phase 1 · PRD-0 "Đảo Đèn Lồng": spec, giả định, tiêu chí nghiệm thu

Contract v1.0. Bàn giao ở tag `phase-1`. Bảng dưới ghi tiêu chí *tại thời điểm Phase 1*. Cột cuối cho biết mục nào về sau bị thay hoặc mở rộng (chi tiết trong [phase-2-spec.md](phase-2-spec.md), [phase-3-spec.md](phase-3-spec.md), [CHANGELOG.md](../../CHANGELOG.md)).

## Cách tiếp cận

- **Tách lõi khỏi hiển thị.** `src/sim/` là mô phỏng thuần, tất định, 60 tick/s: không DOM, không Three.js, không `Math.random`/`Date`, ngẫu nhiên chỉ qua `makeRng(seed)`. `src/game/` chỉ đọc trạng thái để vẽ. Cùng một lõi chạy trong trình duyệt và trong `tools/headless.mjs`.
- **Kiểm chứng trước khi viết.** Mỗi điều khoản bắt buộc của Test Contract v1.0 có ít nhất một scenario chạy qua *đúng* CLI mà giảng viên dùng (`tests/run.mjs` gọi `node tools/headless.mjs …`), không gọi hàm sim trực tiếp.
- **Số liệu.** PRD-0 để mở các con số. Mình chọn ngay bộ số chuẩn phổ biến (6 m/s, nhảy 7 m/s, trọng lực −20, sức chứa 10, chi phí đèn 10…) và khai báo trong `game.contract.json`. Test so khớp contract với `src/sim/config.js`. Ticket-02 sau đó công bố đúng bộ số này, nên Phase 2 không phải đổi cảm giác điều khiển.

## Giả định (chỗ PRD-0 còn mơ hồ)

| Chỗ mơ hồ | Giả định đã chọn |
|---|---|
| Hình dạng Đêm 1 | Đảo tròn tâm (0,0,0), bán kính 40 m; ngoài 40 m là biển mây (rơi). 5 đèn L1–L5 trên vòng r ≈ 25 m |
| Điểm sinh | 24 điểm sinh đom đóm (8 điểm r = 12, 16 điểm r = 33), 20 con lúc đầu, trần 30, thêm 1 con mỗi 240 tick. 12 điểm sinh Bóng Mực r = 37, cách Mây ≥ 15 m |
| Lịch Bóng Mực | 2 con ở tick 300, sau đó 1 con mỗi 480 tick, tối đa 6 |
| Trạng thái Bóng Mực | `spawning` 30 tick (không gây sát thương) → `wander` 2 m/s → `chase` khi Mây ≤ 12 m (4 m/s), bỏ đuổi khi > 18 m → `recoil` 60 tick / 2 m sau khi chạm → `stunned` khi trúng Tỏa Sáng. Bóng do scenario đặt bắt đầu ở `wander` |
| Chạm | Khoảng cách XZ ≤ 1.0 m và chênh cao ≤ 1.5 m; tâm Bóng Mực cao hơn đất 1 m. Tối đa 1 lần mất Ngọn Lửa mỗi tick |
| Bị chạm | −1 Ngọn Lửa, rơi floor(mang/2) đom đóm ra vành 1.5–2.5 m (sống 480 tick, nhặt lại được từ tick sau), bất tử 90 tick |
| Rơi khỏi đảo | Y < −10: −1 Ngọn Lửa, mất hết đom đóm, chờ 60 tick rồi hồi sinh ở gốc, bất tử 90 tick |
| Tỏa Sáng | 3 đom đóm, hồi chiêu 3 s; tâm = chân Mây + 0.8 m; Bóng Mực trong 5 m (3D) choáng 120 tick, bị đẩy 4 m trong 15 tick; +5 mỗi con |
| Vùng an toàn | Đèn sáng tạo vùng 6 m; Bóng Mực bị chặn ở mép; bóng đang ở trong khi đèn vừa thắp bị đẩy ra trong 30 tick, không gây sát thương lúc đó |
| Thắng / thua | Thắng khi thắp đủ 5 đèn; thua khi hết 3 Ngọn Lửa hoặc hết 300 s. Hết Ngọn Lửa xét trước |
| Điểm | +10 mỗi đom đóm nạp, +100 mỗi đèn, +5 mỗi Bóng Mực trúng Tỏa Sáng; khi thắng: +2 × giây còn lại (làm tròn xuống) + 50 × Ngọn Lửa còn lại |
| Lướt | Có từ Phase 1: 14 m/s × 0.2 s, hồi 1.5 s, phát sự kiện `dash` |
| Scenario | Đèn đặt `lit: true` coi như đã nạp đủ (`deposited = 10`); dựng scenario không phát sự kiện, không cộng điểm |
| Snapshot | Có thêm mảng `motes` (id, pos), là khuyến nghị của v1.0 |

## Tiêu chí nghiệm thu → bằng chứng (`tests/headless.test.mjs`)

| Yêu cầu PRD-0 / Test Contract v1.0 | Tiêu chí kiểm chứng được | Test | Về sau |
|---|---|---|---|
| `game.contract.json` khai báo đúng số đang dùng | Mọi khóa `tuning` bằng đúng giá trị trong `config.js` | "contract khớp với tuning trong code" | Phiên bản 1.1 → 1.2 → 1.3 |
| Mô hình tick, snapshot tick 0, dòng `end` bắt buộc | Snapshot đầu ở tick 0, mỗi 10 tick một snapshot, `end` là dòng cuối, `time_left_s` giảm đúng | "snapshot tick 0, end là dòng cuối…" | Thời lượng Đêm 1: 300 → 240 s (Ticket-03) |
| Tính tất định | Cùng seed + inputs → output giống từng byte | "tất định: cùng seed → output giống hệt" | Mở rộng cho Đêm 2–3 |
| Di chuyển 6 m/s, tăng tốc ≤ 0.1 s | Đi thẳng 1 s được 5.6–6.0 m | "đi thẳng +Z 1 giây ≈ 6 m" | |
| Quy ước `cam_yaw_deg` | θ = 90°: move [0,1] đi theo +X | "cam_yaw_deg 90…" | |
| Nhặt đom đóm trong 1 m | `mote_picked {carried}`, `motes_active` giảm | "nhặt đom đóm trong bán kính 1.0 m" | Sức chứa tăng dần (Ticket-03) |
| Nạp đèn để thắp | `deposit` + `lantern_lit` cùng tick k+1, đúng điểm | "nạp 10 đom đóm thắp đèn…" | Điểm +5/đom đóm, `relight` (Ticket-03) |
| Đèn nhớ tiến độ | Nạp 4 vào đèn đã có 3 → `deposited` 7, chưa sáng | "nạp từng phần: đèn nhớ tiến độ" | |
| Thắng khi thắp hết đèn | `won/all_lit` + thưởng thời gian & Ngọn Lửa | (test gốc ở tag `phase-1`) | **[Thay thế bởi Ticket-03]** test bị bỏ có lý do, thay bằng "thắp hết 5 đèn không còn kết thúc Đêm" |
| Tỏa Sáng xua Bóng Mực | Trừ 3, `pulse {stunned_ids}`, choáng, đẩy đúng 4 m, +5 | "Tỏa Sáng: trừ 3 đom đóm…" | +15 khi Bóng Mực đang hút dầu |
| Không đủ ánh sáng thì không Tỏa Sáng | Mang 2 → không có sự kiện `pulse` | "Tỏa Sáng không đủ đom đóm…" | |
| Bóng Mực chạm thì mất máu | `player_hit {by:"shade", flames, dropped}`, đom đóm rơi ra | "bị Bóng Mực chạm…" | |
| Hết máu thì thua | `lost/no_flames` | "hết Ngọn Lửa → lost/no_flames" | |
| Hết giờ | `lost/dawn` đúng tick 60 khi còn 1 s | "hết giờ → lost/dawn" | Ticket-03: bình minh có thể thắng |
| Bóng Mực sợ đèn | Không Bóng Mực nào vào trong 6 m của đèn sáng suốt 600 tick, không hit | "Bóng Mực không vào vùng an toàn…" | Ticket-03: chỉ đèn ≥ 30 dầu |
| Rơi khỏi đảo | `player_hit {by:"fall"}`, hồi sinh ở gốc | "rơi khỏi đảo…" | v1.1 thêm `lost` |
| Bóng Mực xuất hiện | `shade_spawned` S1, S2 ở tick 300 | "lịch sinh Bóng Mực…" | |
| File sai định dạng → mã 2 | JSON hỏng, tick trùng, id đèn lạ, `motes` không phải mảng | "file inputs / scenario sai định dạng → mã thoát 2" | |
| Chạy nhanh, không cần cửa sổ/GPU | Một Đêm đầy đủ < 5 s | "đủ một Đêm chạy nhanh" | Ticket-02: ≤ 30 s cho 21 600 tick |

Chạy lại: `git checkout phase-1 && npm ci && npm test` cho 19/19 ở thời điểm Phase 1. Trên `main`, cùng file test đã được cập nhật theo các ticket sau, như ghi ở cột cuối.

## Phần chỉ kiểm được bằng tay (trình duyệt)

| Yêu cầu | Đã kiểm |
|---|---|
| Chơi được Đêm 1 từ đầu tới thắng/thua, chơi lại được | Thắng (thắp đủ 5 đèn) → màn kết quả → "Chơi lại"; thua (hết giờ) → "Chơi lại" |
| HUD đủ thông tin | Ngọn Lửa, đồng hồ, đèn k/5, điểm, thanh đom đóm, hồi chiêu, nhắc "E — Nạp ánh sáng (x/10)", mũi tên tới đèn gần nhất |
| Phong cách: đêm ấm, cổ tích; vàng cam là tốt, tím đen là nguy hiểm; Mây đội nón lá có đèn lồng nhỏ | Xem [ảnh chụp](../screenshots/) |
| Lỗi do người dùng báo: bấm E nhanh không thắp | Nguyên nhân: lần nhấn và nhả nằm gọn giữa hai tick nên sim không thấy. Sửa bằng cách giữ lần nhấn tới tick kế tiếp, kèm thông báo khi chưa mang đom đóm hoặc đứng xa quá 2 m. Kiểm lại: nhấn rồi nhả ngay khi mang 10 đom đóm ở cách chân cột 1.5 m → L1 sáng, điểm 200 |
