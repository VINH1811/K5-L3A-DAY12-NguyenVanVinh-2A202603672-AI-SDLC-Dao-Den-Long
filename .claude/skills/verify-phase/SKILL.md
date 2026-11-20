---
name: verify-phase
description: Kiểm chứng một thay đổi hoặc một phase của Đảo Đèn Lồng và lưu bằng chứng khớp commit. Dùng trước khi báo "xong", trước khi gắn tag phase-N, hoặc khi người dùng hỏi "đã đúng yêu cầu chưa".
---

# Kiểm chứng và lưu bằng chứng

"Agent bảo chạy rồi" không phải bằng chứng. Mỗi lần kết thúc một việc hoặc một phase, làm theo thứ tự sau.

## 1. Đối chiếu yêu cầu → test
- Mở ticket của phase và file `docs/notes/phase-N-spec.md`. Mỗi yêu cầu chính phải có một dòng trong bảng "tiêu chí nghiệm thu → bằng chứng".
- Yêu cầu mới chưa có test: viết scenario trong `tests/phaseN.test.mjs`, chạy qua CLI bằng `run()` của `tests/run.mjs`, không gọi hàm sim trực tiếp.
- Test cũ bị luật mới làm sai: sửa hoặc bỏ **kèm lý do** trong spec của phase đó. Không tắt test, không sửa kỳ vọng cho "đạt" khi chưa hiểu vì sao sai.

## 2. Chạy kiểm chứng tự động và lưu
```bash
node tools/proof.mjs --out docs/proof/latest
```
Script chạy `npm test`, headless một Đêm đầy đủ cho mỗi bản đồ, soak 10 Đêm theo `soak_cmd`. Nó ghi `summary.md`, `test-report.tap`, `soak.json` và dòng `end` của từng Đêm, kèm commit hiện tại. Mã thoát khác 0 là chưa đạt.

Để bằng chứng khớp commit: commit code trước, rồi chạy `proof.mjs`, rồi commit thư mục bằng chứng.

## 3. Phần chỉ kiểm được trong trình duyệt
- Chạy game bằng cấu hình `game` trong `.claude/launch.json` (`node tools/start.mjs --no-open`, cổng 5173).
- `window.__ddl` có `sim`, `mode`, `fps`, `info`, `startNight(n)`, `setMode(m)`. Dùng chúng để nhảy Đêm, đọc trạng thái, đo FPS. Chỉ *đọc* `sim.s` để kiểm. Khi cần dựng tình huống thì ghi rõ trong bằng chứng rằng trạng thái được đặt tay.
- Ghi lại thao tác và kết quả quan sát được (con số, chuỗi HUD, ảnh) vào bảng của spec.

## 4. Hiệu năng (khi đụng tới phần vẽ)
```bash
npm run build && node tools/bench.mjs --seed 42 --duration 30 --out bench.json
```
Ngưỡng: avg_fps ≥ 60, p1_low_fps ≥ 30, load_ms ≤ 10000. Lưu kết quả kèm cấu hình máy vào `docs/proof/`.

## 5. Trước khi kết thúc
Hook `Stop` (`tools/hooks/stop-require-green.mjs`) tự chạy `npm test` khi có thay đổi trong `src/`, `tests/`, `tools/`, contract hoặc package. Test đỏ thì agent không được kết thúc. Nếu bị chặn: đọc tên test hỏng, sửa nguyên nhân, chạy lại. Không né hook.
