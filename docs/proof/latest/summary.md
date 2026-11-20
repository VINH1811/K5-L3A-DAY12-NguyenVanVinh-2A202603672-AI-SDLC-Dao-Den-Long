# Bằng chứng tự động

- Commit: `60c63d9` (có thay đổi chưa commit)
- Thời điểm: 2026-11-20T15:19:53.179Z
- Node: v22.16.0 · win32/x64
- Contract: v1.3

| Kiểm chứng | Kết quả |
|---|---|
| `npm test` | 80 đạt, 0 hỏng |
| headless Đêm 1 (seed 1, tối đa 21 600 tick, dừng khi hết Đêm) | mã 0 · `{"type":"end","ticks":14400,"state":"lost","score":0}` |
| headless Đêm 2 (seed 1, tối đa 21 600 tick, dừng khi hết Đêm) | mã 0 · `{"type":"end","ticks":16200,"state":"lost","score":0}` |
| headless Đêm 3 (seed 1, tối đa 21 600 tick, dừng khi hết Đêm) | mã 0 · `{"type":"end","ticks":18000,"state":"lost","score":0}` |
| soak 10 Đêm (`node --expose-gc --max-opt=1 --single-threaded --max-semi-space-size=1 tools/soak.mjs`) | crashes 0, RSS 44.5 → 46 MB (1.034×, ngưỡng 1.2) |

**Tổng: ĐẠT**
