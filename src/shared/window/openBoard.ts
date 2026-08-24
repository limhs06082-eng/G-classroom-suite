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
 *
 * ## 웹에서의 작은 퇴행
 *
 * 이 함수를 쓰려면 호출부가 `<a target="_blank">`가 아니라 `onClick`
 * 이어야 한다. 그래서 이번 통합에서 여섯 곳(자리·모둠, 역할·당번,
 * 활동·보상, 과제 제출, 수업, 형성평가)의 [전자칠판] 진입점이 전부
 * `<Link target="_blank">`에서 `<Button onClick={() => openBoard(...)}>`로
 * 바뀌었다. 설치형에는 필요했지만, **웹**에서는 그 버튼에 href가 없어져
 * Ctrl+클릭·가운데 클릭(새 탭)·"새 창에서 열기"·링크 복사가 전부 안
 * 된다 — 브라우저가 그런 동작을 걸 앵커 자체가 없기 때문이다. 의도적으로
 * 받아들인 트레이드오프이지 빠뜨린 버그가 아니다.
 */
export function openBoard(path: string): void {
  if (!isDesktop()) {
    window.open(path, '_blank', 'noopener');
    return;
  }

  /*
   * catch 없이 void만 쓰면 거부(reject)가 처리되지 않은 프라미스 거부로
   * 조용히 사라진다. 실제로 이렇게 됐다 — create-webview-window 권한이
   * 빠져 있어 이 호출이 거부됐는데, 화면에는 아무 표시도 안 나서 "전자칠판
   * 단추가 고장 났다"로만 보였다. 실패를 삼키면 진짜 실패가 이유 없이
   * 고장난 것처럼 보이는 버튼이 된다 — 첫 실행에서 실제로 벌어진 일이
   * 바로 이거다. gboard-write-error 이벤트는 WriteErrorToast.tsx가 이미
   * 듣고 있으니 그대로 재사용한다. detail을 객체({message})로 보내는
   * 이유는 WriteErrorToast.tsx 참고 — 문자열로 보내면 그쪽에 있는 저장
   * 실패 전용 고정 문구("백업 파일을 내려받으세요")가 엉뚱하게 붙는다.
   */
  openDesktopWindow(path).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    window.dispatchEvent(
      new CustomEvent('gboard-write-error', {
        detail: { message: `전자칠판 창을 열지 못했습니다: ${message}` },
      }),
    );
  });
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
