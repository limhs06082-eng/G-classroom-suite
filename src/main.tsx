import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from './app/router';
import { ToastProvider } from './shared/ui';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('#root 요소를 찾을 수 없습니다. index.html을 확인하세요.');
}

createRoot(rootElement).render(
  <StrictMode>
    {/* 전자칠판 라우트는 AppShell 밖에 있으므로 알림은 라우터 바깥에서 감싼다 */}
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
);
