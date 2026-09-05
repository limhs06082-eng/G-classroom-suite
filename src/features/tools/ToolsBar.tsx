import { Bell, Dices, EyeOff, Hand, Maximize2, Pause, Play, RotateCcw, Timer as TimerIcon, Volume2, VolumeX, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { isMuted, setMuted, subscribeMuted } from '../../shared/fx/sound';
import { Button, cx, Modal } from '../../shared/ui';
import { PickerModal } from './PickerModal';
import { useTools, useToolsTimer } from './ToolsContext';

/*
 * 투표 창은 따로 실어 온다. 툴바는 첫 청크에 들어가는데, 큰 화면 하나가
 * 더 붙으면 웹 첫 청크가 한도(400KB)를 넘는다. lazy라도 늘 마운트해 두면
 * 집계는 남는다 — 처음 그릴 때 한 번 받아 오고 그 뒤로는 같은 컴포넌트다.
 */
const VoteModal = lazy(() => import('./VoteModal').then((m) => ({ default: m.VoteModal })));
import { formatDuration } from './useTimer';

/**
 * 수업 도구 툴바.
 *
 * 원본 dashboard의 타이머·스톱워치·화면커튼·집중화면·빠른알림을 옮겼다.
 * 홈 전용이 아니라 전역이다. 어느 화면에서 수업하든 손이 닿아야 한다.
 *
 * 여는 상태는 여기 없다. `ToolsContext`가 들고 있다 — 홈의 '지금' 카드처럼
 * 툴바 밖에 있는 자리도 같은 도구를 열어야 하기 때문이다. 툴바는 그 상태를
 * 읽어 그리는 쪽이 되었고, 제 단추도 남들과 똑같이 `open()`을 부른다.
 */

const PRESET_MINUTES = [1, 3, 5, 10, 15];

export function ToolsBar() {
  const { openTool, open, close } = useTools();
  const timer = useToolsTimer();

  /*
   * 단추가 남은 시간을 짊어진다. 모달을 닫고 순회 지도를 나가도, 화면
   * 어딘가에는 타이머가 살아 있다는 표시가 남아야 한다. 끝난 뒤에는
   * 사라지지 않는 토스트(ToolsContext)가 함께 알린다.
   */
  const timerLabel =
    timer.state === 'running' || timer.state === 'paused'
      ? `타이머 ${formatDuration(timer.remainingMs)}`
      : timer.state === 'finished'
        ? '타이머 끝!'
        : '타이머';

  return (
    <>
      <div className="no-print sticky bottom-0 z-20 border-t border-slate-200 bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2">
          <Button
            size="sm"
            icon={TimerIcon}
            variant={timer.state === 'finished' ? 'primary' : 'secondary'}
            onClick={() => open('timer')}
          >
            <span data-numeric>{timerLabel}</span>
          </Button>
          <Button size="sm" icon={EyeOff} onClick={() => open('curtain')}>
            화면 가리기
          </Button>
          <Button size="sm" icon={Bell} onClick={() => open('notice')}>
            알림 띄우기
          </Button>
          <Button size="sm" icon={Dices} onClick={() => open('picker')}>
            뽑기
          </Button>
          <Button size="sm" icon={Hand} onClick={() => open('vote')}>
            거수 투표
          </Button>
          <span className="ml-auto hidden text-xs text-slate-400 sm:inline">
            수업 중 쓰는 도구입니다
          </span>
          <MuteToggle />
        </div>
      </div>

      <TimerModal open={openTool === 'timer'} onClose={close} />
      {openTool === 'curtain' ? <ScreenCurtain onClose={close} /> : null}
      <NoticeModal open={openTool === 'notice'} onClose={close} />
      {/*
        뽑기는 열렸을 때만 마운트한다. 명단(useSuite)을 읽는 모달이라,
        늘 마운트해 두면 SuiteDataProvider 없이 툴바만 그리는 자리가 깨진다.
      */}
      {openTool === 'picker' ? <PickerModal onClose={close} /> : null}
      {/* 투표는 늘 마운트 — 명단을 안 읽고, 집계가 닫았다 열어도 남아야 한다. */}
      <Suspense fallback={null}>
        <VoteModal open={openTool === 'vote'} onClose={close} />
      </Suspense>
    </>
  );
}

/**
 * 효과음 끄기. 소리는 기기의 취향이라(테마처럼) 여기 한 단추로 전부 꺼진다.
 *
 * 뽑기·점수·타이머마다 따로 묻지 않는다 — 조용히 해야 하는 시간(시험,
 * 옆 반 배려)은 소리 전부가 조용해야 하는 시간이다.
 */
function MuteToggle() {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, isMuted);

  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-pressed={muted}
      aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
      title={muted ? '효과음 켜기' : '효과음 끄기'}
      className={cx(
        'rounded-control p-1.5 transition-colors',
        muted ? 'text-slate-300 hover:text-slate-500' : 'text-slate-500 hover:text-slate-700',
      )}
    >
      {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
    </button>
  );
}

function TimerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  /*
   * 타이머는 ToolsContext에 산다. 모달 안에 두면 닫는 순간 화면에서
   * 사라져서, 끝나도 알 길이 시계뿐이었다. 여기는 그리기만 한다.
   * '끝났다'는 별도 state가 아니라 timer.state가 직접 말한다 — 전에는
   * 모달을 다시 열 때 지역 finished를 지워 버려, 끝난 건지 리셋된 건지
   * 구별할 수 없는 0:00만 남았다.
   */
  const timer = useToolsTimer();
  const [custom, setCustom] = useState('7');

  const finished = timer.state === 'finished';
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

        {/* 끝난 뒤에는 곧바로 다음 타이머를 걸 수 있어야 한다. */}
        {timer.state === 'idle' || finished ? (
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
      className="ink no-print fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-slate-900"
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

  const dismiss = (): void => {
    setShowing(false);
    onClose();
  };

  /*
   * 전체 화면일 때 Esc로 닫는다. 화면 가리개는 되는데 이것만 안 되면,
   * 교실 앞에서 리모컨·키보드로 못 닫고 마우스를 찾아야 한다.
   */
  useEffect(() => {
    if (!showing) return;
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
    // dismiss는 렌더마다 새로 만들어지지만 하는 일이 같아 무해하다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing]);

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
            onKeyDown={(event) => {
              // 치고 바로 Enter — 급한 안내에 마우스를 찾게 하지 않는다.
              // 한글 조합을 마치는 Enter(IME)는 거른다. 마지막 글자가 잘린다.
              if (event.key === 'Enter' && !event.nativeEvent.isComposing && text.trim() !== '') {
                setShowing(true);
              }
            }}
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
              className="no-print fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-surface p-8"
            >
              <p className="text-center text-board-xl font-black text-slate-900">{text}</p>
              <Button size="lg" icon={X} onClick={dismiss}>
                닫기
              </Button>
              <p className="text-sm text-slate-400">Esc 키를 눌러도 닫힙니다</p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
