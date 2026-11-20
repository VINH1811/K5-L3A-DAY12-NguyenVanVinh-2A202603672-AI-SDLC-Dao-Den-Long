# Chế độ Cốt truyện (nhánh `story-mode`, sau v1.0.0)

Phần mở rộng sáng tạo, làm sau khi đã nộp bài: `main`, các tag `phase-*` và Release v1.0.0 không đổi. Chế độ này **không thuộc Test Contract**:
- chỉ bật khi `createSim({ story })` được truyền vào (CLI: `--story story.json`);
- không có `--story` thì headless cho output **giống từng byte** bản `main`. Đã so 9 lần chạy (3 Đêm × 3 seed, có input) trước khi commit;
- 80 test chuẩn vẫn xanh, kèm 16 test riêng trong `tests/story.test.mjs`.

## Cách chơi
Menu → **Chế độ Cốt truyện**. Năm chương mở khóa lần lượt; thắng chương này mới mở chương sau. Tiến độ và thẻ được lưu trong trình duyệt. Thua thì chơi lại chương đó, thẻ vẫn giữ.

| Chương | Đảo · vùng khí hậu | Quái | Điều kiện thắng |
|---|---|---|---|
| 1 · Bến đèn tắt | Đảo Bến · đồng cỏ, bến thuyền | Bóng Mực | Giữ ≥ 3/5 đèn tới bình minh |
| 2 · Rặng cau trong gió | Đảo Cau · nhiệt đới, cát, cây cau | + Dơi Mực | ≥ 4/6 |
| 3 · Tiếng chuông đá | Đảo Chuông · núi thu, lá phong đỏ | + Mực Khổng Lồ | ≥ 5/7 |
| 4 · Mặt hồ đóng băng | **Đảo Băng** (mới) · tuyết, hồ băng thủng ở giữa, bão tuyết | + Mực Ma | ≥ 4/6 |
| 5 · Trái tim của mực | **Đảo Mực** (mới) · đất tím, cây chết, pha lê mực, 4 nhánh đá | Mẹ Mực (trùm) + quân | Hạ trùm, hoặc ≥ 3/5 đèn tới bình minh |

## Quái
| Quái | Đặc điểm |
|---|---|
| Bóng Mực | Như luật chuẩn |
| Dơi Mực | Nhỏ, có cánh vỗ; đuổi 6 m/s, phát hiện 16 m |
| Mực Khổng Lồ | To, có gai giáp; chậm 2.6 m/s, chạm xa 1.6 m. Lần Tỏa Sáng đầu chỉ vỡ giáp (gai rụng), lần hai mới choáng; giáp liền lại sau 8 s |
| Mực Ma | Trong mờ, chập chờn; khi đuổi, cứ 3 s dịch chuyển tới cách Mây 4 m |
| Mẹ Mực (trùm) | To gấp 3, vương miện gai, 6 mắt; 6 máu, mỗi lần Tỏa Sáng trúng (tầm +2.5 m) mất 1 máu; cứ 10 s gọi 2 Bóng Mực. Hạ trùm: +500 điểm, mọi quái choáng 3 s |

## Thẻ năng lực
Thắng chương 1–4 thì chọn 1 trong 3 thẻ chưa có. Thẻ thụ động cộng dồn. Chỉ trang bị 1 thẻ chủ động: chọn thẻ chủ động mới thì thẻ cũ bị thay.

| Thẻ | Loại | Tác dụng |
|---|---|---|
| Nam Châm Đom Đóm | Thụ động | Nhặt trong 2.5 m |
| Hào Quang Rộng | Thụ động | Tỏa Sáng 8 m |
| Dầu Trầm | Thụ động | Đèn hao dầu một nửa |
| Chân Gió | Thụ động | Chạy +15%, lướt hồi nửa thời gian |
| Ngọn Lửa Thứ Tư | Thụ động | 4 Ngọn Lửa mỗi chương |
| Túi Lụa | Thụ động | Mang thêm 4 đom đóm |
| Khiên Ánh Sáng | Chủ động (Q) | Bất tử 3 s · hồi 25 s |
| Sương Đóng Băng | Chủ động (Q) | Choáng mọi quái trong 15 m 4 s · hồi 30 s |
| Đèn Thần | Chủ động (Q) | +40 dầu cho đèn sáng gần nhất · hồi 40 s |
| Bước Mây | Chủ động (Q) | Dịch chuyển 8 m về phía trước · hồi 10 s |

Phím Q đổi được trong Cài đặt.

## Kiểm chứng
- `npm test`: 96/96 (80 chuẩn + 16 cốt truyện, chạy qua CLI với `--story`).
- Headless chuẩn so với `main`: giống từng byte ở 9/9 lần chạy.
- Trình duyệt:
  - bản đồ chương khóa/mở đúng;
  - thắng chương 1 hiện màn chọn thẻ, chọn Sương Đóng Băng thì sang chương 2 với lời dẫn và mẹo;
  - bấm Q làm choáng cả Dơi Mực lẫn Bóng Mực, dải thẻ và ô hồi chiêu Q hiện trên HUD;
  - chương 5 có thanh máu trùm, chạy 165 FPS.
- Bench chuẩn sau khi đổi phần vẽ quái: 167 FPS trung bình, 1% low 111.

## Giới hạn đã biết
- Chưa chơi trọn cả 5 chương bằng tay. Thắng chương và trận trùm đã kiểm bằng test headless và bằng cách dựng trạng thái trong trình duyệt.
- Độ khó (số máu trùm, tốc độ quái, hồi chiêu thẻ) mới là số đặt lần đầu, chưa chỉnh sau khi chơi thử.
