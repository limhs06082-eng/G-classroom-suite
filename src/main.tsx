import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from './app/router';
import { resolveAdapter } from './shared/storage/firebaseApp';
import { isDesktop } from './shared/platform/target';
import { LocalStorageAdapter } from './shared/storage/LocalStorageAdapter';
import type { StorageAdapter } from './shared/storage/StorageAdapter';
import { WriteErrorToast } from './shared/storage/WriteErrorToast';
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
 *
 * 바로 아래 if (!isDesktop())는 FileBackedStorage·TauriFileStore를 불러오는
 * import()의 guard다. lazy()/import() 자체를 가르는 분기라 target.ts의
 * 규칙대로면 isDesktop()이 아니라 import.meta.env.VITE_TARGET 리터럴
 * 비교를 써야 하는 자리인데, 여기서는 예외로 isDesktop()을 쓴다. 안전한
 * 이유는 main.tsx가 진입 청크 자신이고 target.ts를 다른 청크를 거치지
 * 않고 곧장 정적으로 불러오기 때문이다 — 청크 경계가 없으니 Rollup이
 * 값을 상수로 못 접을 상황 자체가 생기지 않는다. 이 전제를 짐작으로
 * 남겨 두지 않고, check:bundle desktop이 설치형 산출물에 __TAURI_INTERNALS__가
 * 실제로 실렸는지 매번 확인한다.
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
   * 창끼리 알린다. 교사 창에서 자리를 바꾸면 전자칠판 창이 따라와야
   * 하는데, Tauri 창 둘은 각자 다른 webview라 브라우저의 storage
   * 이벤트가 없다. Tauri의 창 간 이벤트로 그 자리를 채운다.
   */
  const [{ emit, listen }, { getCurrentWebviewWindow }] = await Promise.all([
    import('@tauri-apps/api/event'),
    import('@tauri-apps/api/webviewWindow'),
  ]);

  const me = getCurrentWebviewWindow().label;

  window.addEventListener('gboard-local-write', (event) => {
    const fileName = (event as CustomEvent<string>).detail;
    void emit('gboard://file-changed', { from: me, fileName });
  });

  void listen<{ from: string; fileName: string }>('gboard://file-changed', (event) => {
    // 내가 보낸 것이 돌아온 것이면 버린다. 안 그러면 끝없이 돈다.
    if (event.payload.from === me) return;
    void storage.acceptExternalChange(event.payload.fileName);
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

    try {
      // 화면 쪽 대기분을 저장소 메모리로 먼저 밀어 넣는다. 이 핸들러는 동기라 곧 끝난다.
      window.dispatchEvent(new Event('beforeunload'));
      await storage.flush();
    } finally {
      /*
       * 무슨 일이 있어도 창은 닫는다. preventDefault로 닫기를 이미 가로챘으므로,
       * 여기서 못 빠져나가면 앱이 안 닫히는 상태로 남는다. 그러면 선생님은
       * 강제 종료를 하게 되고, 이 과업이 막으려던 바로 그 자료 손실이 난다.
       *
       * destroy()가 거부되면 이 await가 finally 안에서 던진다 — try/finally는
       * flush()가 던지는 것만 막아 줄 뿐 destroy() 자신이 던지는 것은 못
       * 막는다. 여기서 잡지 않으면 처리되지 않은 프라미스 거부로 조용히
       * 사라지고, 선생님은 종료 버튼이 죽은 것으로만 본다 — 앱을 끌
       * 유일한 수단이 실패했는데 아무도 모르는 셈이니 반드시 알려야 한다.
       * destroy가 안 되면 다른 수단으로 억지로 닫지 않는다: 권한만 제대로
       * 주면 되는 문제를 여기서 우회로로 덮으면, 다음에 빠진 권한도 똑같이
       * 조용히 숨어 버린다. 알리고 멈춘다.
       */
      try {
        await currentWindow.destroy();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        window.dispatchEvent(
          new CustomEvent('gboard-write-error', {
            detail: { message: `창을 닫지 못했습니다: ${message}` },
          }),
        );
      }
    }
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
        {/*
          FileBackedStorage의 쓰기 실패를 토스트로 띄운다. 웹에서는
          gboard-write-error가 한 번도 안 던져지므로 그냥 아무 일도 안
          한다 — 그래서 target 분기 없이 무조건 마운트한다.
        */}
        <WriteErrorToast />
        <SuiteDataProvider adapter={adapter}>
          <RouterProvider router={router} />
        </SuiteDataProvider>
      </ToastProvider>
    </StrictMode>,
  );
});
