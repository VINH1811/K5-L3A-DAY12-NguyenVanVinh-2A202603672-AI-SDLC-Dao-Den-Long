# Nhật ký dùng AI

## Công cụ và cách chia việc
- **Công cụ:** Claude Code (ứng dụng desktop), một agent. Trợ giảng AI trên lab board dùng để đọc yêu cầu từng phase.
Tôi và agent cùng thiết kế game; agent viết code theo thiết kế và chỉ đạo của tôi.

- **Cùng thiết kế:**
  - Tôi đặt hướng: game 3D chơi được, nhiều đảo hơn, có đêm và ngày, đảo lơ lửng trong mây cao vút, phong cách đẹp và sinh động.
  - Agent đề xuất cách thể hiện cụ thể: hình dạng ba đảo theo bản đồ chuẩn, cây cau, tháp chuông, bầu trời, ánh sáng.
  - Tôi xem trong game, chọn phương án (ví dụ: làm đúng bản đồ Ticket-02 và chỉ trang trí ở phần hiển thị), yêu cầu chỉnh khi chưa ưng.
- **Agent viết:** code, test, tài liệu; chạy test, headless, bench, soak; kiểm tra trong trình duyệt.
- **Tôi chỉ đạo và kiểm chứng:**
  - đưa nguyên văn PRD-0 và các ticket vào lời nhắc;
  - chơi thử và báo lỗi (ví dụ: bấm E không thắp đèn);
  - quyết định phạm vi từng phase;
  - duyệt từng lần commit, tag, push, Release, dời tag;
  - hỏi lại "đã đúng yêu cầu chưa" sau mỗi phase để agent đối chiếu với LAB, SUBMISSION, RUBRIC.

## Lời nhắc chính
| Phase | Lời nhắc / quyết định của tôi |
|---|---|
| 1 | Dán PRD-0 + Test Contract; chọn "game 3D chơi được"; báo lỗi "bấm E mà không thắp" |
| 2 | "Làm nhiều đảo hơn, có ban đêm và ban ngày, đảo trong mây cao vút"; chọn làm đúng bản đồ Ticket-02 + trang trí chỉ ở phần hiển thị; commit + tag `phase-1` trước khi sửa |
| 3 | "Làm Phase 3" (Ticket-03 thay luật cốt lõi) |
| 4 | "Làm tiếp phase 4"; push + Release; dời tag sau khi CI phát hiện lỗi soak |
| Rà soát | "Bản này đã hết các yêu cầu và đúng yêu cầu của repo chưa", "còn gì nữa không": agent lập danh sách thiếu theo SUBMISSION/RUBRIC |

## Token / chi phí ước tính
Số liệu thật, cộng từ log phiên Claude Code trên máy (`~/.claude/projects/<dự án>/*.jsonl`). Mỗi lượt trả lời có trường `usage`; mỗi lượt chỉ tính một lần. Model: Claude Opus. Ranh giới phase là thời điểm tôi gửi yêu cầu của phase đó.

| Giai đoạn | Lượt | Output | Input mới | Cache ghi | Cache đọc | Tổng | Ghi chú |
|---|---:|---:|---:|---:|---:|---:|---|
| Phase 1 | 83 | 116 K | <1 K | 0.26 M | 14.1 M | **14.5 M** | Đọc repo + PRD, lõi sim, game, 19 test; nhiều ảnh chụp để chỉnh hình |
| Phase 2 | 68 | 139 K | <1 K | 0.24 M | 18.0 M | **18.4 M** | Viết lại sim cho 3 Đêm, dựng 3 đảo + đảo bay |
| Phase 3 | 33 | 67 K | <1 K | 0.10 M | 13.4 M | **13.6 M** | Chủ yếu sửa sim + test |
| Phase 4 | 53 | 91 K | <1 K | 0.13 M | 27.6 M | **27.8 M** | Bench, soak, bảng xếp hạng, dễ tiếp cận |
| Phát hành + hoàn thiện | 87 | 70 K | <1 K | 0.10 M | 54.8 M | **55.0 M** | Push, Release, sửa soak sau CI, hook/skill, spec Phase 1, nhật ký, video |
| **Tổng** | **324** | **483 K** | **<1 K** | **0.82 M** | **127.9 M** | **129.2 M** | |

Cách đọc số:
- Hơn 98% là *cache đọc*: mỗi lượt model đọc lại ngữ cảnh đã lưu trong bộ nhớ đệm. Loại token này rẻ hơn nhiều so với input mới.
- Phần thật sự sinh ra (output) là khoảng 0.48 M token.
- Ngữ cảnh càng dài thì mỗi lượt càng đắt. Vì vậy giai đoạn cuối tốn nhiều nhất dù làm ít việc nhất.

**Cách đã tiết kiệm**
- Ngữ cảnh được cache nên phần lớn token là cache đọc (rẻ), không phải input mới.
- Kiểm chứng bằng test chạy qua CLI (rẻ) thay cho ảnh chụp mỗi khi có thể.
- Sửa bằng patch nhỏ thay vì viết lại cả file.
- Dùng `grep` để đọc đúng đoạn cần.

**Chỗ đã tốn hơn cần thiết**
- Chụp nhiều ảnh màn hình để chỉnh đồ họa ở Phase 1–2.
- Làm đồ họa vượt yêu cầu; rubric không cộng điểm phần này.
- Giữ một phiên quá dài. Từ Phase 4 trở đi mỗi lượt đọc lại ngữ cảnh rất lớn, nên giai đoạn phát hành chiếm khoảng 43% tổng token. Lần sau nên mở phiên mới cho mỗi phase, chỉ mang theo AGENTS.md và spec.

## Những lần AI sai và cách phát hiện
| # | Lỗi | Phát hiện bằng | Sửa / chỉnh harness |
|---|---|---|---|
| 1 | Bấm E nhanh không thắp đèn: lần nhấn rơi giữa hai tick sim | Tôi chơi thử | Giữ lần nhấn tới tick kế; thêm thông báo khi chưa mang đom đóm hoặc đứng xa |
| 2 | Lướt chỉ đi 11 tick thay vì 12 (0.2 s) | Test mới của Phase 2 | Sửa sim |
| 3 | Đảo Cau trơ trụi, không có cây | Ảnh chụp: hàm khoảng cách tới mép dùng `min` thay vì `max` cho 2 đảo | Sửa; thêm quy ước "bản đồ chỉ ở `NIGHTS`" vào AGENTS.md |
| 4 | Camera chui vào tháp chuông | Ảnh chụp | Dò va chạm camera theo `ground()` |
| 5 | Bóng Mực bị đẩy khỏi vùng an toàn vẫn hút dầu; sai số 5.9998 m làm bị đẩy lại mãi | Test Phase 3 | Sửa sim; ghi vào ADR-001 |
| 6 | Agent viết sai kỳ vọng trong test (đặt Mây cách đèn 2.4 m > 2 m; tính dầu 70 thay vì 69.9) | Chạy test và đọc lại luật | Sửa kỳ vọng kèm giải thích trong test, không sửa code cho "đạt" |
| 7 | Soak chỉ đo trên Windows (1.07×) rồi báo đạt; trên Ubuntu/macOS thật ra 1.24–1.58× | CI GitHub Actions | Thử nghiệm cờ V8 trên CI, chọn `--max-opt=1` (1.03–1.04×); CI kiểm ngưỡng; dời tag `phase-4` |
| 8 | Cảnh bench 200 Bóng Mực chỉ đạt p1_low 30 FPS | Bench thật | Dùng chung geometry, gộp draw call → p1_low 114 |
| 9 | Script bằng chứng tự ghi "có thay đổi chưa commit" | Đọc lại `summary.md` | Kiểm trạng thái git trước khi ghi |
| 10 | Trường `team` trong contract do agent đoán | Rà soát cuối | Tôi kiểm tra lại |

**Harness thêm dần**
- AGENTS.md (cập nhật mỗi phase).
- `launch.json` để agent chạy game.
- CI trên Ubuntu + macOS (sau lỗi #7).
- Hook `Stop` chặn kết thúc khi test đỏ.
- Skill `verify-phase`.
- `tools/proof.mjs` lưu bằng chứng.
