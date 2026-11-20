import { defineConfig } from 'vite';
import { leaderboardMiddleware } from './tools/leaderboard-store.mjs';

// Bảng xếp hạng lưu ra đĩa qua /api/leaderboard khi chạy bằng `npm start` (dev) hoặc `npm run preview`.
const leaderboardApi = {
  name: 'ddl-leaderboard',
  configureServer(server) { server.middlewares.use(leaderboardMiddleware); },
  configurePreviewServer(server) { server.middlewares.use(leaderboardMiddleware); },
};

export default defineConfig({
  plugins: [leaderboardApi],
  build: { chunkSizeWarningLimit: 1200 },
});
