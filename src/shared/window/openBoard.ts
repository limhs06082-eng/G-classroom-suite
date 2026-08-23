import { isDesktop } from '../platform/target';

/**
 * 전자칠판 화면을 연다.
 *
 * 웹에서는 새 탭이고, 설치형에서는 새 앱 창이다.
 *
 * 이 함수가 필요한 이유는 데스크톱에서 `<a target="_blank">`가 **앱 창이
 * 아니라 기본 브라우저를 열기** 때문이다. 그렇게 열린 크롬은 앱 자료
 * 폴더의 파일을 볼 수 없어 빈 전자칠판이 뜬다.
 *
 * 두 번째 모니터가 있으면 그쪽에 띄운다. 교실 화면이 보통 그쪽이다.
 */
export function openBoard(path: string): void {
  if (!isDesktop()) {
    window.open(path, '_blank', 'noopener');
    return;
  }

  void openDesktopWindow(path);
}

async function openDesktopWindow(path: string): Promise<void> {
  const [{ WebviewWindow }, { availableMonitors, primaryMonitor }] = await Promise.all([
    import('@tauri-apps/api/webviewWindow'),
    import('@tauri-apps/api/window'),
  ]);

  const label = 'board';

  // 이미 떠 있으면 새로 만들지 않고 그 창을 앞으로 가져온다.
  const existing = await WebviewWindow.getByLabel(label);
  if (existing !== null) {
    await existing.setFocus();
    return;
  }

  const board = new WebviewWindow(label, {
    url: path,
    title: 'G-board 전자칠판',
    fullscreen: true,
  });

  await board.once('tauri://created', async () => {
    const monitors = await availableMonitors();
    const primary = await primaryMonitor();
    const second = monitors.find((m) => m.name !== primary?.name);
    if (second === undefined) return;

    // 두 번째 모니터의 왼쪽 위로 옮긴 뒤 전체 화면으로 만든다.
    const { LogicalPosition } = await import('@tauri-apps/api/dpi');
    await board.setFullscreen(false);
    await board.setPosition(new LogicalPosition(second.position.x, second.position.y));
    await board.setFullscreen(true);
  });
}
