import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from './app/router';
import { resolveAdapter } from './shared/storage/firebaseApp';
import { isDesktop } from './shared/platform/target';
import { LocalStorageAdapter } from './shared/storage/LocalStorageAdapter';
import type { StorageAdapter } from './shared/storage/StorageAdapter';
import { SuiteDataProvider } from './shared/roster/SuiteDataProvider';
import { ToastProvider } from './shared/ui';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('#root 요소를 찾을 수 없습니다. index.html을 확인하세요.');
}

/**
 * 저장소를 정한 뒤에 그린다.
 *
 * 설치형은 파일에, 웹은 브라우저에 담는다. 웹에서 Firebase 설정이
 * 비어 있으면 resolveAdapter가 기다리지 않고 곧바로 돌려주므로,
 * 설정을 안 넣은 교사에게는 아무 지연이 없다.
 *
 * 최상위 await를 쓰지 않는다. 타입 검사와 테스트는 통과하지만 빌드 목표가
 * es2020이라 esbuild가 거부한다. then으로 받아야 빌드까지 지나간다.
 */
async function chooseAdapter(): Promise<StorageAdapter> {
  if (!isDesktop()) {
    return resolveAdapter((message) => console.warn(message));
  }

  const [{ FileBackedStorage }, { TauriFileStore }] = await Promise.all([
    import('./shared/storage/FileBackedStorage'),
    import('./shared/storage/TauriFileStore'),
  ]);

  const storage = await FileBackedStorage.open(new TauriFileStore(), {
    onWriteError: (message) => console.warn(message),
  });

  /*
   * 창을 닫을 때 예약된 쓰기를 반드시 흘려보낸다.
   *
   * beforeunload로는 안 된다. 두 가지가 걸린다. 첫째, SuiteDataProvider가
   * 이미 beforeunload를 듣고 있는데 그쪽이 나중에 등록되어 나중에 돈다 —
   * 내가 먼저 비우고 나면 그 뒤에 들어온 저장은 타이머만 걸린 채 프로세스가
   * 죽는다. 둘째, beforeunload는 비동기를 기다려 주지 않는다.
   *
   * Tauri의 닫기 요청은 둘 다 푼다. 닫기를 잠시 막고, 화면 쪽이 들고 있던
   * 대기분을 beforeunload로 밀어 넣은 뒤, 파일에 닿는 것까지 기다렸다가 닫는다.
   */
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const currentWindow = getCurrentWindow();

  await currentWindow.onCloseRequested(async (event) => {
    event.preventDefault();

    // 화면 쪽 대기분을 저장소 메모리로 먼저 밀어 넣는다. 이 핸들러는 동기라 곧 끝난다.
    window.dispatchEvent(new Event('beforeunload'));

    await storage.flush();
    await currentWindow.destroy();
  });

  return new LocalStorageAdapter(storage);
}

void chooseAdapter().then((adapter) => {
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
