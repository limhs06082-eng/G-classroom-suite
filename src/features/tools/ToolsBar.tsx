import { Bell, EyeOff, Maximize2, Pause, Play, RotateCcw, Timer as TimerIcon, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button, cx, Modal } from '../../shared/ui';
import { formatDuration, useTimer } from './useTimer';

/**
 * 수업 도구 툴바.
 *
 * 원본 dashboard의 타이머·스톱워치·화면커튼·집중화면·빠른알림을 옮겼다.
 * 홈 전용이 아니라 전역이다. 어느 화면에서 수업하든 손이 닿아야 한다.
 */

const PRESET_MINUTES = [1, 3, 5, 10, 15];

export function ToolsBar() {
  const [open, setOpen] = useState<null | 'timer' | 'curtain' | 'notice'>(null);

  return (
    <>
      <div className="no-print sticky bottom-0 z-20 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2">
          <Button size="sm" icon={TimerIcon} onClick={() => setOpen('timer')}>
            타이머
          </Button>
          <Button size="sm" icon={EyeOff} onClick={() => setOpen('curtain')}>
            화면 가리기
          </Button>
          <Button size="sm" icon={Bell} onClick={() => setOpen('notice')}>
            알림 띄우기
          </Button>
          <span className="ml-auto hidden text-xs text-slate-400 sm:inline">
            수업 중 쓰는 도구입니다
          </span>
        </div>
      </div>

      <TimerModal open={open === 'timer'} onClose={() => setOpen(null)} />
      {open === 'curtain' ? <ScreenCurtain onClose={() => setOpen(null)} /> : null}
      <NoticeModal open={open === 'notice'} onClose={() => setOpen(null)} />
    </>
  );
}

function TimerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [finished, setFinished] = useState(false);
  const timer = useTimer(() => setFinished(true));
  const [custom, setCustom] = useState('7');

  useEffect(() => {
    if (open) setFinished(false);
  }, [open]);

  const running = timer.state === 'running';

  return (
    <Modal open={open} onClose={onClose} title="타이머" size="sm">
      <div className="flex flex-col items-center gap-4">
        <p
          className={cx(
            'font-mono text-5xl font-black tabular-nums',
            finished ? 'text-danger-500' : 'text-slate-900',
          )}
          aria-live="polite"
        >
          {formatDuration(timer.remainingMs)}
        </p>

        {finished ? <p className="text-sm font-medium text-danger-700">시간이 다 되었습니다</p> : null}

        {timer.state === 'idle' ? (
          <>
            <div className="flex flex-wrap justify-center gap-2">
              {PRESET_MINUTES.map((minutes) => (
                <Button key={minutes} onClick={() => timer.start(minutes * 60 * 1000)}>
                  {minutes}분
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={120}
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                aria-label="직접 입력 분"
                className="h-10 w-20 rounded-control border border-slate-300 px-3 text-center"
              />
              <span className="text-sm text-slate-600">분</span>
              <Button
                variant="primary"
                onClick={() => {
                  const minutes = Number.parseInt(custom, 10);
                  if (Number.isFinite(minutes) && minutes > 0) timer.start(minutes * 60 * 1000);
                }}
              >
                시작
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => timer.addTime(60 * 1000)}>+1분</Button>
            <Button onClick={() => timer.addTime(-60 * 1000)}>-1분</Button>
            {running ? (
              <Button icon={Pause} onClick={timer.pause}>
                일시정지
              </Button>
            ) : timer.state === 'paused' ? (
              <Button icon={Play} variant="primary" onClick={timer.resume}>
                계속
              </Button>
            ) : null}
            <Button icon={RotateCcw} variant="ghost" onClick={timer.reset}>
              초기화
            </Button>
          </div>
        )}

        {/*
          문장이 가운데서 끊기지 않게 각각 한 덩어리로 둔다.
          좁은 화면에서는 span이 각자 줄바꿈되어 두 줄이 된다.
        */}
        <p className="text-center text-sm text-slate-500">
          <span className="block">다른 화면으로 옮겨도 시간이 정확합니다.</span>
          <span className="block">끝날 시각을 기준으로 셉니다.</span>
        </p>
      </div>
    </Modal>
  );
}

/**
 * 화면 가리기.
 *
 * 학생이 화면을 보지 않아야 할 때 전자칠판을 덮는다.
 * Esc나 버튼으로만 걷힌다.
 */
function ScreenCurtain({ onClose }: { onClose: () => void }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', handleKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-label="화면 가리기"
      className="no-print fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-slate-900"
    >
      <p className="text-board-lg font-black text-white">잠시 화면을 가립니다</p>
      <Button size="lg" icon={X} onClick={onClose}>
        화면 다시 보기
      </Button>
      <p className="text-sm text-slate-400">Esc 키를 눌러도 걷힙니다</p>
    </div>,
    document.body,
  );
}

/** 전자칠판에 큰 글씨로 한 줄 띄운다. 준비물·조용히 등 즉석 안내용. */
function NoticeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [showing, setShowing] = useState(false);

  return (
    <>
      <Modal
        open={open && !showing}
        onClose={onClose}
        title="알림 띄우기"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button
              variant="primary"
              icon={Maximize2}
              disabled={text.trim() === ''}
              onClick={() => setShowing(true)}
            >
              크게 띄우기
            </Button>
          </>
        }
      >
        <label className="block text-sm">
          <span className="text-slate-700">보여 줄 문구</span>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="교과서 42쪽을 펴세요"
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>
      </Modal>

      {showing
        ? createPortal(
            <div
              role="dialog"
              aria-label="알림"
              className="no-print fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-white p-8"
            >
              <p className="text-center text-board-xl font-black text-slate-900">{text}</p>
              <Button
                size="lg"
                icon={X}
                onClick={() => {
                  setShowing(false);
                  onClose();
                }}
              >
                닫기
              </Button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
