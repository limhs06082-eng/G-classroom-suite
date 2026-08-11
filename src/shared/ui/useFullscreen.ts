import { useCallback, useEffect, useState, type RefObject } from 'react';

/**
 * 전체 화면 전환.
 *
 * 전자칠판에서는 브라우저 주소창·탭이 보이면 학생 시선을 뺏고 화면도 좁아진다.
 * 다만 전체 화면 요청은 사용자 제스처가 있어야 하고 브라우저·정책에 따라
 * 거부될 수 있으므로, 실패해도 화면은 그대로 동작해야 한다.
 */
export function useFullscreen(targetRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    setIsSupported(typeof document !== 'undefined' && document.fullscreenEnabled === true);

    const handleChange = (): void => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const enter = useCallback(async (): Promise<void> => {
    const target = targetRef.current;
    if (!target || typeof target.requestFullscreen !== 'function') return;
    try {
      await target.requestFullscreen();
    } catch {
      // 거부돼도 화면은 그대로 쓸 수 있다. 조용히 넘어간다.
    }
  }, [targetRef]);

  const exit = useCallback(async (): Promise<void> => {
    if (document.fullscreenElement === null) return;
    try {
      await document.exitFullscreen();
    } catch {
      // 무시
    }
  }, []);

  const toggle = useCallback(async (): Promise<void> => {
    if (document.fullscreenElement === null) {
      await enter();
    } else {
      await exit();
    }
  }, [enter, exit]);

  return { isFullscreen, isSupported, enter, exit, toggle };
}
