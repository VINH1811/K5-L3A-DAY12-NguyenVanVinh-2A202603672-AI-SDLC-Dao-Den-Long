# AGENTS.md — Đảo Đèn Lồng

## Lệnh
- Cài: `npm ci` · Chạy game: `npm start` · Build tĩnh: `npm run build`
- Test (bắt buộc xanh trước khi kết thúc việc): `npm test`
- Headless: `node tools/headless.mjs --seed 1 --night 1 --ticks 600 --out out/x.jsonl`

## Kiến trúc
- `src/sim/` là lõi logic thuần, tất định. Không import DOM, Three.js, `Math.random`, `Date`. Ngẫu nhiên chỉ qua `makeRng(seed)`.
- `src/game/` chỉ đọc trạng thái sim để vẽ/phát âm thanh. Không được sửa `sim.s` trong gameplay.
- Phần sáng tạo thêm chỉ đặt ở `src/game/`; nếu buộc phải có trong sim thì phải tắt được khi headless.

## Quy ước
- Số liệu tuning chỉ sửa ở `src/sim/config.js`, rồi cập nhật `game.contract.json` (test so khớp hai nơi).
- Thứ tự xử lý trong một tick theo Ticket-02 (comment đánh số trong `step()`); sự kiện của bước k ghi `tick = k+1`.
- Mỗi luật mới cần ít nhất một scenario trong `tests/headless.test.mjs`, chạy qua CLI chứ không gọi hàm trực tiếp.
- Không sửa tay file output để test đạt; không viết test luôn đạt.
