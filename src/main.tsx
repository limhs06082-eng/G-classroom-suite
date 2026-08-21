import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from './app/router';
import { resolveAdapter } from './shared/storage/firebaseApp';
import { SuiteDataProvider } from './shared/roster/SuiteDataProvider';
import { ToastProvider } from './shared/ui';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('#root 요소를 찾을 수 없습니다. index.html을 확인하세요.');
}

/*
 * 저장소를 정한 뒤에 그린다.
 *
 * Firebase 설정이 비어 있으면 resolveAdapter는 기다리지 않고 곧바로 이 기기
 * 저장소를 돌려주므로, 설정을 안 넣은 교사에게는 아무 지연이 없다.
 *
 * 최상위 await를 쓰지 않는다. 타입 검사와 테스트는 통과하지만 빌드 목표가
 * es2020이라 esbuild가 거부한다. then으로 받아야 빌드까지 지나간다.
 */
void resolveAdapter((message) => console.warn(message)).then((adapter) => {
  createRoot(rootElement).render(
    <StrictMode>
      {/*
        전자칠판 라우트는 AppShell 밖에 있으므로 알림·데이터를 라우터 바깥에서 감싼다.
        Toast가 바깥이어야 SuiteDataProvider가 복구 내역을 알릴 수 있다.
      */}
      <ToastProvider>
        <SuiteDataProvider adapter={adapter}>
          <RouterProvider router={router} />
        </SuiteDataProvider>
      </ToastProvider>
    </StrictMode>,
  );
});
