import { CircleQuestionMark, Maximize2, Minimize2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from './Button';
import { cx } from './cx';
import { ShortcutsModal } from './ShortcutsModal';
import { useFullscreen } from './useFullscreen';
import { useHelpKey } from './useHelpKey';

interface Props {
  /** 화면 상단에 크게 뜨는 제목. 예: '오늘의 당번' */
  title: string;
  /** 제목 옆 부가 정보. 예: '3학년 2반 · 3월 2일 월요일' */
  subtitle?: string;
  /** 제목 줄 오른쪽 조작부. board 스케일에 맞춰 큰 버튼을 쓴다. */
  actions?: ReactNode;
  /** 닫기 버튼을 눌렀을 때. 없으면 닫기 버튼이 나오지 않는다. */
  onExit?: () => void;
  children: ReactNode;
}

/**
 * 전자칠판 화면 프레임.
 *
 * 원본 3개 앱이 각자 다른 이름으로 같은 것을 만들었다
 * (duty의 SmartboardModal, seating의 StudentPublicViewModal,
 *  dashboard의 FocusScreenModal). 여기서 하나로 합친다.
 *
 * 설계 전제: 교실 뒷자리는 칠판에서 3~8m 떨어져 있다.
 * 그래서 board 타이포 스케일을 쓰고, 색은 고대비로, 장식은 최소로 한다.
 * 조작 버튼은 손가락으로 눌리도록 크게 둔다.
 */
export function BoardScreen({ title, subtitle, actions, onExit, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, isSupported, toggle } = useFullscreen(rootRef);
  const [helpOpen, setHelpOpen] = useState(false);
  const openHelp = useCallback(() => setHelpOpen(true), []);

  /*
   * 칠판 창의 키보드. Esc는 닫기, F는 전체 화면, ?는 단축키 도움 — 교탁
   * 앞에서 리모컨이나 키보드로 다루는 화면이라 마우스로 구석의 작은 단추를
   * 찾게 하지 않는다. 칠판에는 글자 입력칸이 없으므로 타이핑과 부딪힐 일이
   * 없다. 대화상자(도움 등)가 열려 있으면 Esc는 그것을 닫는 것이지 칠판을
   * 닫는 것이 아니다.
   */
  useHelpKey(openHelp);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      if (document.querySelector('[role="dialog"]') !== null) return;
      if (event.key === 'Escape' && onExit !== undefined) onExit();
      if ((event.key === 'f' || event.key === 'F') && isSupported) void toggle();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onExit, isSupported, toggle]);

  return (
    <div ref={rootRef} className="flex h-dvh w-full flex-col bg-surface text-slate-900">
      <header className="flex items-center gap-4 border-b-4 border-slate-900 px-8 py-5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-board-lg font-black tracking-tight">{title}</h1>
          {subtitle === undefined ? null : (
            <p className="mt-1 truncate text-board-sm text-slate-500">{subtitle}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actions}

          <Button
            size="lg"
            variant="secondary"
            icon={CircleQuestionMark}
            iconOnly
            aria-label="키보드 단축키"
            onClick={openHelp}
          />

          {isSupported ? (
            <Button
              size="lg"
              variant="secondary"
              icon={isFullscreen ? Minimize2 : Maximize2}
              iconOnly
              aria-label={isFullscreen ? '전체 화면 끄기' : '전체 화면'}
              onClick={() => void toggle()}
            />
          ) : null}

          {onExit === undefined ? null : (
            <Button size="lg" variant="secondary" icon={X} iconOnly aria-label="닫기" onClick={onExit} />
          )}
        </div>
      </header>

      <main className={cx('min-h-0 flex-1 overflow-auto px-8 py-6', 'text-board-base')}>
        {children}
      </main>

      <ShortcutsModal open={helpOpen} onClose={() => setHelpOpen(false)} scope="board" />
    </div>
  );
}
