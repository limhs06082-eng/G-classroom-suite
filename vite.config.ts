/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Vercel 배포 기준. 원본 dashboard의 GitHub Pages base 로직은 이식하지 않는다.
  base: '/',
  define: {
    /*
     * 빌드 대상을 글자로 박아 넣는다. import.meta.env.VITE_TARGET은
     * VITE_ 접두사 덕에 자동으로 들어가지만, 값이 없을 때 undefined가
     * 되어 타입이 흔들린다. 여기서 못 박아 둔다.
     */
    'import.meta.env.VITE_TARGET': JSON.stringify(process.env.VITE_TARGET ?? 'web'),
  },
  plugins: [react(), tailwindcss()],
  server: {
    // 포트가 이미 쓰이는 환경이 흔하다. PORT가 있으면 그것을 따른다.
    // Tauri가 devUrl로 이 포트를 본다. 자동으로 옮겨 다니면 흰 화면이 뜬다.
    port: Number(process.env.PORT ?? 3000),
    strictPort: true,
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
