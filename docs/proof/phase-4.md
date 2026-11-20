# Bằng chứng Phase 4 · Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

Máy đo của tác giả (chỉ để tham khảo; giảng viên đo trên máy chấm chung):
Windows 11 Pro (10.0.26200), Intel Core i9-12900H, 16 GB RAM, NVIDIA GeForce RTX 3060 Laptop (Direct3D11 qua ANGLE), Chrome, Node 22.16.

## 1. Benchmark: [bench.json](bench.json)

```bash
npm run build
node tools/bench.mjs --seed 42 --duration 30 --out bench.json
```

| Chỉ số | Ngưỡng | Kết quả |
|---|---|---|
| avg_fps | ≥ 60 | **168.0** |
| p1_low_fps | ≥ 30 | **114.5** |
| frame_ms_p95 | | 7.0 |
| frames | | 5 039 |
| load_ms | ≤ 10 000 | **1 269** |
| peak_mem_mb | | `null` (bản web, xem dưới) |

Cảnh đo theo đúng ticket:
- Canvas 1280×720 trong cửa sổ không toàn màn hình. Vsync tắt bằng cờ Chrome `--disable-gpu-vsync --disable-frame-rate-limit`.
- Đêm 1, đủ ánh sáng, đổ bóng và bloom như lúc chơi thật.
- 200 Bóng Mực ở trạng thái `wander`, rải đều theo seed 42; 100 đom đóm; L1–L3 sáng với 100 dầu ([src/sim/bench.js](../../src/sim/bench.js)).
- Chế độ `bench` của sim tắt: sinh thêm thực thể, sát thương, nhặt, hao dầu, kết thúc Đêm. Bóng Mực vẫn đi theo luật wander.
- Không có input; Mây đứng ở (0,0,0).
- Camera bay tròn r = 30 m, Y = 15, bắt đầu ở (30,15,0), 15 s một vòng.
- Đo 3 s khởi động trước, rồi đo đúng 30 s.
- Phần trang trí sáng tạo thêm (đảo bay, đèn trời) được tắt trong cảnh bench.

Cách tính chỉ số đúng định nghĩa của ticket ([tools/bench.mjs](../../tools/bench.mjs), hàm `metrics`):
- `avg_fps` = 1000·N/Σdt.
- `p1_low_fps` = 1000 / trung bình của k = ceil(1% N) khung chậm nhất.
- `frame_ms_p95` = phân vị 95 của dt.
- `load_ms` tính từ lúc tiến trình Node khởi động tới khung hình đầu tiên của cảnh bench.

`peak_mem_mb = null`: đây là bản web. RSS của các tiến trình Chrome không đo được từ trang. File có thêm `js_heap_peak_mb` (heap JS của trang, theo `performance.memory`) để tham khảo.

**Tối ưu đã làm để đạt ngưỡng (có số đo trước/sau):**
- Bản đầu mỗi Bóng Mực tốn khoảng 16 draw call và khoảng 11 geometry riêng (2 272 geometry cho 200 con).
- Lần thử 3 s với bản đầu: avg 67.3, p1_low 30.1, sát ngưỡng.
- Sau khi dùng chung geometry, gộp thân với 6 xúc tu và 2 mắt, và gom khói của mọi Bóng Mực vào một hệ hạt (xúc tu lay bằng vertex shader): avg 165–168, p1_low 109–115.

## 2. Soak test: [soak.json](soak.json)

```bash
node --expose-gc --single-threaded --max-semi-space-size=1 tools/soak.mjs --seed 7 --nights 10 --out soak.json
```

| Chỉ số | Ngưỡng | Kết quả |
|---|---|---|
| crashes | = 0 | **0** |
| mem_end_mb / mem_start_mb | ≤ 1.2 | 47.5 / 44.5 = **1.07** |
| duration_s | | 1.3 |

- 10 Đêm xoay vòng 1→2→3. Đêm thứ i dùng seed 7 + i. Input ngẫu nhiên theo seed: đổi hướng mỗi 30 tick; mỗi tick 5% nhảy, 3% lướt, 2% Tỏa Sáng, 10% tương tác.
- Cả 10 Đêm đều thua: input ngẫu nhiên không giữ được đủ đèn tới bình minh. Mục đích của soak là ổn định, không phải thắng.
- **Vì sao có cờ V8:** khi chạy mặc định, RSS dao động 46–58 MB giữa các Đêm. Một số lần ra 1.21× dù không rò rỉ.
- [soak-heap-probe.txt](soak-heap-probe.txt) (tạo bằng `node --expose-gc tools/memprobe.mjs`) cho thấy `heapUsed` đứng yên khoảng 4.5 MB qua 12 Đêm. Phần dao động là do V8 nới hoặc thu vùng young generation và các luồng nền.
- `--single-threaded --max-semi-space-size=1` loại phần nhiễu đó, nên RSS phản ánh rò rỉ thật. Năm lần chạy liên tiếp đều ra 44.4–44.5 → 47.3–47.5 MB.

## 3. Bảng xếp hạng

- Lưu ra đĩa ở `.data/leaderboard.json` khi chạy bằng `npm start` / `node tools/start.mjs` (API `/api/leaderboard`). Ghi nguyên tử, nên vẫn còn sau khi tắt và mở lại game.
- Mở bản tĩnh không có server thì lưu trong localStorage.
- Xuất: `node tools/start.mjs --export-leaderboard out.json`, cho ra `{"entries": [...]}` đúng thứ tự.
- Test tự động (`tests/phase4.test.mjs`): thứ tự điểm giảm dần, bằng điểm thì ai đạt trước đứng trên, top 10, tên 3–12 ký tự (nhận tiếng Việt có dấu), ISO 8601 có múi giờ, lệnh xuất đọc đúng file trên đĩa.
- Kiểm tra tay trong trình duyệt: thua Đêm 1 → nhập "Mây_01" → "Đã lưu: hạng 1 trong top 10". File `.data/leaderboard.json` có đúng mục đó, lệnh xuất ra đúng mục đó. (File thử đã xóa sau khi kiểm tra.)

## 4. Dễ tiếp cận (kiểm tra tay trong trình duyệt)

| Yêu cầu | Kết quả |
|---|---|
| Đổi phím cho 9 hành động, được lưu | Đổi "Đi tới" sang I: lưu vào `ddl.keys`, gợi ý điều khiển ở menu cập nhật "I A S D" |
| Phát hiện trùng phím | Gán "Nhảy" = E: hiện "⚠ Trùng phím: E đang dùng cho Nhảy và Nạp / châm dầu", hai ô viền đỏ |
| Khôi phục mặc định | Nút "Khôi phục mặc định" xóa cảnh báo, trả về WASD/Space/Shift/E/F/Esc |
| Phụ đề / chỉ báo hình ảnh | Bóng Mực xuất hiện: phụ đề "◆ Bóng Mực xuất hiện" và mũi tên tím ở mép màn hình chỉ tới con ở ngoài màn hình. Gió sắp thổi: "🍃 Gió sắp thổi" + lá bay. 10 s cuối: "⏳ …" và đồng hồ phóng to nhấp nháy. Đèn < 30 dầu: "🏮 Đèn Lx dưới 30 dầu" + đèn và thanh dầu nhấp nháy 1 Hz |
| Giảm chuyển động | Tắt rung camera và chớp màn hình khi bị chạm |
| Cỡ chữ ≥ 18 px ở 1280×720; chữ lớn ×1.25 | Mọi `font-size` dưới 18 px trong CSS đã nâng lên 18 px. Tùy chọn "Chữ lớn" phóng HUD và các màn hình ×1.25 |
