# ADR-001: Mô hình trạng thái đèn có dầu và luật thắng ở bình minh

- Trạng thái: Chấp nhận (Phase 3, Ticket-03 "Đèn cạn dầu", Contract v1.2)
- Thay thế: luật Phase 1–2 "đèn đã sáng không nhận thêm đom đóm", "Bóng Mực không bao giờ vào vùng an toàn", "thắng ngay khi tất cả đèn sáng", công thức điểm cũ.

## Bối cảnh

Trước Phase 3, đèn chỉ có hai trạng thái: tắt (đang gom `deposited` tới 10) và sáng (vĩnh viễn). Thắp đủ đèn là thắng ngay, nên người giỏi xong Đêm trong 2 phút. Ticket-03 đổi mục tiêu thành "giữ đảo sáng tới bình minh": đèn có thể tắt lại, Bóng Mực có thể hút dầu.

## Quyết định

**1. Đèn là máy trạng thái có bộ nhớ.**

| Trường | Ý nghĩa |
|---|---|
| `lit` | đang sáng |
| `fuel` | dầu, lưu bằng số nguyên 1/60 (`FUEL_UNIT = 60`): 100 dầu = 6000 đơn vị |
| `deposited` | tiến độ thắp; về 0 khi tắt |
| `everLit` | đã từng sáng; quyết định giá thắp lại (5 thay vì 10) |
| `relit` | số lần thắp lại |

Chuyển trạng thái:

```
TẮT(chưa từng sáng) --nạp đủ 10--> SÁNG(fuel 100)
SÁNG --fuel ≤ 0 (bước 2b)--> TẮT(everLit, deposited 0)  [lantern_out]
TẮT(everLit) --nạp đủ 5--> SÁNG(fuel 100, relit+1)      [lantern_lit relight=true]
SÁNG --E (châm dầu)--> SÁNG(fuel + 10×used)              [refuel]
```

Vùng an toàn là thuộc tính *suy ra*, không phải trạng thái lưu: `safe = lit && fuel ≥ 30`. Nhờ vậy không có chỗ nào phải "nhớ bật/tắt vùng an toàn".

**2. Dầu dùng số nguyên.** Hao 1 đơn vị mỗi tick (1/s), mỗi Bóng Mực đang hút trừ thêm 5 đơn vị mỗi tick (5/s). So sánh ngưỡng 30 là so sánh nguyên `fuel < 1800`, nên "đúng 30 vẫn còn vùng an toàn" không bị sai số. Chỉ làm tròn 1 chữ số khi xuất snapshot/sự kiện.

**3. Thêm trạng thái Bóng Mực `drain`.** Bóng `wander` chọn mục tiêu mỗi tick: đèn sáng yếu (< 30) gần nhất (bằng nhau thì id nhỏ), nếu không có thì đèn tắt gần nhất, nếu không có nữa thì lang thang như cũ. Tới ≤ 2 m đèn yếu thì sang `drain` và đứng yên. Việc trừ dầu nằm ở bước 2 của tick *sau*, đúng thứ tự Ticket-03. `drain` thoát sang `chase` (Mây ≤ 6 m), `stunned` (Tỏa Sáng), hoặc `wander` (đèn tắt, dầu ≥ 30, hoặc xa > 2 m). Bóng đang `drain` không gây sát thương.

**4. Châm dầu ≥ 30 đẩy Bóng Mực ra.** Bước 6 (vùng an toàn) áp dụng cho mọi đèn `safe`. Khi bóng bị đẩy, nếu nó đang `drain` thì chuyển ngay sang `wander`, để không hút tiếp trong 30 tick bị đẩy (lỗi này test phát hiện). Tick cuối của cú đẩy đặt bóng đúng lên mép 6 m, để sai số số thực không kích hoạt đẩy lại.

**5. Luật thắng chỉ xét ở bình minh.** Bước 11:
- hết Ngọn Lửa → `lost/no_flames`, xét trước tiên kể cả ở tick bình minh;
- hết giờ, số đèn đang sáng ≥ ceil(0.6 × tổng) → `won/dawn_survived`, cộng điểm bình minh;
- hết giờ mà đèn sáng dưới ngưỡng → `lost/dawn`.

`all_lit` bị bỏ.

**6. Sức chứa suy ra từ `player.lights`** (số lần thắp thành công trong Đêm, kể cả thắp lại; đèn đặt bằng scenario không tính): `min(20, 10 + 2 × lights)`.

## Hệ quả

- Snapshot thêm `fuel`, `ever_lit`, `relit_count`, `player.capacity`. Sự kiện mới `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` thêm `relight`.
- Test Phase 1 "thắp hết 5 đèn → won/all_lit" bị **bỏ có lý do** và thay bằng "thắp hết 5 đèn không còn kết thúc Đêm". Các test thời gian còn lại được cập nhật theo thời lượng mới 240/270/300 s. Không test nào bị tắt âm thầm (chi tiết ở [phase-3-spec.md](phase-3-spec.md)).
- Phần hiển thị (`src/game/`) đọc `fuel` để vẽ thanh dầu, nhấp nháy 1 Hz khi < 30, tắt vòng an toàn; đèn tắt bị xẹp 20% và có vết rách. Không có logic nào bị chép sang phần hiển thị ngoài việc chọn đèn cho dòng nhắc "E".

## Phương án đã cân nhắc

- *Lưu dầu bằng số thực, so sánh có epsilon.* Bỏ vì ngưỡng "đúng 30" và chuỗi châm/hút dễ lệch giữa các lần chạy.
- *Thêm cờ `safe` riêng cho đèn.* Bỏ vì dễ lệch với `fuel`; suy ra từ `fuel` thì luôn đúng.
- *Bóng `drain` vẫn gây sát thương khi chạm.* Ticket ghi "đứng yên và hút"; Mây vào trong 6 m thì nó đã chuyển `chase` (khi đó chạm mới gây sát thương), nên giữ đơn giản.
