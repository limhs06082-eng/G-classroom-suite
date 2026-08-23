/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// define과 external 양쪽에서 같은 값을 써야 하므로 한 번만 읽는다.
const VITE_TARGET = process.env.VITE_TARGET ?? 'web';

export default defineConfig({
  // Vercel 배포 기준. 원본 dashboard의 GitHub Pages base 로직은 이식하지 않는다.
  base: '/',
  define: {
    /*
     * 빌드 대상을 글자로 박아 넣는다. import.meta.env.VITE_TARGET은
     * VITE_ 접두사 덕에 자동으로 들어가지만, 값이 없을 때 undefined가
     * 되어 타입이 흔들린다. 여기서 못 박아 둔다.
     */
    'import.meta.env.VITE_TARGET': JSON.stringify(VITE_TARGET),
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
    rollupOptions: {
      /*
       * 웹 빌드에서는 @tauri-apps 패키지를 번들 밖으로 뺀다.
       *
       * isDesktop() 뒤의 동적 import(예: openBoard.ts)는 여러 라우트별
       * lazy 청크가 함께 쓰므로, 그 코드 자체가 별도 공유 청크로 떨어져
       * 나간다. isDesktop은 메인 청크에 있어 그 청크는 경계 너머로
       * import해야 하는데, 경계를 넘으면 Rollup이 값을 상수로 접지
       * 못해 if(!isDesktop()) 분기가 소거되지 않고 런타임 검사로 남는다.
       * 그러면 뒤따르는 @tauri-apps/* 동적 import가 죽은 코드로 지워지지
       * 않고 진짜 청크로 나와 웹 번들에 실린다.
       *
       * external로 못 박으면 이 상수 접기 성공 여부와 무관하게 웹
       * 번들에서 통째로 빠진다. 데스크톱 빌드에서는 그대로 번들에
       * 넣어야 하므로 그때는 비운다.
       */
      external: VITE_TARGET === 'desktop'
        ? []
        : (source) =>
            /^@tauri-apps\//.test(source) ||
            /[\\/]storage[\\/](TauriFileStore|FileBackedStorage)\.ts$/.test(source),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
