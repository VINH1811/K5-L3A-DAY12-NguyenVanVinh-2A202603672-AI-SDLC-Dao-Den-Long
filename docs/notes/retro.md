# Đánh giá từng phase và retro

## Đánh giá từng phase
| Phase | Đạt | Chưa đạt / ghi chú | Hỏng phase trước? |
|---|---|---|---|
| 1 · PRD-0, v1.0 | Đêm 1 chơi được tới thắng/thua; headless đúng contract; 19 test qua CLI; tất định | Lỗi bấm E nhanh do người chơi phát hiện, đã sửa | — |
| 2 · Ticket-02, v1.1 | 3 Đêm đúng bản đồ chuẩn, bục nhảy, tầng, gió, Gió Lạc, Bùa Gió, tạm dừng; 26 test mới; ~70 FPS | Tự giả định điểm xuất phát Đêm 3 (0,0,−20) | 4 test Phase 1 sửa theo v1.1, có ghi lý do |
| 3 · Ticket-03, v1.2 | Dầu đèn, drain, thắng ở bình minh, điểm mới, sức chứa, mù màu; ADR + CHANGELOG; 25 test mới | Test thắng `all_lit` bị **bỏ có lý do** vì luật bị thay | Có chủ đích (luật thay thế) |
| 4 · Ticket-04, v1.3 | Bench 168 FPS / p1_low 114 / load 1.3 s; soak 0 crash, 1.03×; bảng xếp hạng lưu đĩa + lệnh xuất; đổi phím, phụ đề, giảm chuyển động, chữ lớn; Release v1.0.0; CI | `peak_mem_mb = null` (bản web). Bench cần Chrome có sẵn trên máy. Soak ban đầu chỉ đạt trên Windows, phải sửa và dời tag | Không: 80/80 test xanh trên Ubuntu + macOS |

## Retro
**Số liệu:**
- 4 phase, contract v1.0 → v1.3, 3 bản đồ.
- 80 test (19 + 26 + 25 + 10), CI 2 hệ điều hành.
- Bench 168 FPS, soak 1.03×.
- 24 commit nhỏ, 4 tag phase + Release v1.0.0.

**Hiệu quả:**
- Tách lõi sim tất định khỏi phần vẽ ngay từ Phase 1, nên mọi luật mới đều kiểm được bằng headless.
- Dùng sẵn bộ số chuẩn từ đầu, nên Phase 2 không phải đổi cảm giác điều khiển.
- Mọi test chạy qua đúng CLI của giảng viên. Test bắt 2 lỗi thật của AI (#2, #5 trong nhật ký), CI bắt thêm lỗi #7.

**Chưa hiệu quả:**
- Chỉ kiểm chứng trên Windows. Lỗi soak chỉ lộ ra khi CI chạy trên Linux/macOS, sau khi đã gắn tag.
- Không gắn tag đúng mốc giờ từng phase: các tag được tạo trong cùng một buổi.
- Tốn token cho đồ họa vượt yêu cầu.

**Nếu làm lại:**
- Bật CI trên Ubuntu + macOS ngay từ Phase 1.
- Gắn tag và push ngay khi hết giờ mỗi phase.
- Đặt hook "test đỏ thì chưa được dừng" từ đầu, không đợi tới cuối.
- Làm đúng yêu cầu trước, trau chuốt hình ảnh sau và có giới hạn.
