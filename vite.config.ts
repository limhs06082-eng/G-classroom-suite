/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Vercel 배포 기준. 원본 dashboard의 GitHub Pages base 로직은 이식하지 않는다.
  base: '/',
  plugins: [react(), tailwindcss()],
  server: {
    // 포트가 이미 쓰이는 환경이 흔하다. PORT가 있으면 그것을 따른다.
    port: Number(process.env.PORT ?? 3000),
  },
  build: {
    // 기능별 lazy 청크가 늘어나므로 경고 임계값을 현실적으로 잡는다.
    chunkSizeWarningLimit: 700,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
