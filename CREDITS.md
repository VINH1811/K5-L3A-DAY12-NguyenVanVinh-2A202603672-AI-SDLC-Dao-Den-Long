# Credits

## Nhân vật và bối cảnh
- Đảo Đèn Lồng, Mây, Ông Đăng, Bóng Mực, Gió Lạc, Bùa Gió: tài liệu gốc của lab AI SDLC Day 12 (PRD-0, Ticket-02…04).

## Mã nguồn bên thứ ba
| Thành phần | Giấy phép | Dùng cho |
|---|---|---|
| [three.js](https://threejs.org) r170 (kèm addons EffectComposer, UnrealBloomPass, OutputPass, BufferGeometryUtils) | MIT | Đồ họa 3D |
| [Vite](https://vitejs.dev) 5 | MIT | Dev server, build tĩnh, preview |

## Phông chữ (tải từ Google Fonts khi chạy)
| Phông | Giấy phép |
|---|---|
| Be Vietnam Pro | SIL Open Font License 1.1 |
| Cormorant Garamond | SIL Open Font License 1.1 |

## Hình ảnh, mô hình, âm thanh
- **Không dùng asset ngoài.** Mọi mô hình 3D (Mây, đèn lồng, Bóng Mực, cây cau, tháp chuông, đảo, đảo bay…) được dựng bằng code từ hình khối cơ bản của three.js trong `src/game/`.
- Họa tiết (mây, đá, lá bùa, quầng sáng) vẽ bằng Canvas 2D lúc chạy. Bầu trời, biển mây, thác nước dùng shader GLSL viết trong repo.
- Mọi âm thanh và nhạc nền được tổng hợp lúc chạy bằng WebAudio (`src/game/audio.js`), không có file âm thanh.
- Ảnh chụp màn hình trong `docs/screenshots/` chụp từ chính game.
