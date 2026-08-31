import { Check, Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

import { playChime } from '../../shared/fx/sound';
import { formatDuration, useTimer } from '../../shared/useTimer';
import { Button, cx, EmptyState } from '../../shared/ui';
import { MODE_LABELS, PHASE_LABELS } from './lessonCore';
import { useLesson } from './useLesson';

/**
 * 전자칠판용 수업 진행 화면.
 *
 * 학생이 보는 화면이다. 지금 무엇을 하는지, 얼마나 남았는지, 다음이 무엇인지
 * 이 셋만 크게 보이면 된다.
 */
export function LessonBoard() {
  const lesson = useLesson();
  // 단계 시간이 다 되면 종을 울린다. 칠판을 보고 있는 것은 학생들이고,
  // 활동을 접는 신호는 눈보다 귀가 빠르다. 툴바 스피커 단추로 꺼진다.
  const timer = useTimer(playChime);
  const current = lesson.progress?.current ?? null;

  /*
   * 단계가 바뀌면 그 단계에 배정한 시간으로 타이머를 다시 맞춘다.
   * 교사가 매번 손으로 맞추면 수업 흐름이 끊긴다.
   */
  const currentId = current?.id ?? null;
  const currentMinutes = current?.minutes ?? 0;

  useEffect(() => {
    if (currentId === null) return;
    if (currentMinutes > 0) timer.start(currentMinutes * 60 * 1000);
    else timer.reset();
    // 단계가 바뀔 때만 다시 맞춘다. timer는 매 렌더 새로 만들어지므로 의존성에서 뺀다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, currentMinutes]);

  if (lesson.running === null || lesson.progress === null || current === null) {
    return (
      <EmptyState
        title="진행 중인 수업이 없습니다"
        description="수업 진행 화면에서 수업 시작을 누르면 여기에 표시됩니다."
      />
    );
  }

  const { progress } = lesson;
  const isDone = lesson.doneStageIds.includes(current.id);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="ink rounded-control bg-slate-900 px-4 py-1.5 text-board-sm font-bold text-white">
          {PHASE_LABELS[current.phase]}
        </span>
        <span className="text-board-sm text-slate-500">
          {progress.index + 1} / {progress.total}
        </span>
        <span className="text-board-sm text-slate-500">{MODE_LABELS[current.mode]} 활동</span>

        {timer.state === 'idle' ? null : (
          <span
            className={cx(
              'ml-auto font-mono text-board-xl font-black tabular-nums',
              timer.state === 'finished' ? 'text-danger-500' : 'text-slate-900',
            )}
            aria-live="polite"
          >
            {formatDuration(timer.remainingMs)}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <h2 className="text-board-2xl font-black text-slate-900">{current.title}</h2>
        {current.guide === '' ? null : (
          <p className="mt-4 text-board-base text-slate-600">{current.guide}</p>
        )}
      </div>

      {progress.next === null ? null : (
        <p className="text-board-sm text-slate-400">다음: {progress.next.title}</p>
      )}

      {/* 진행률은 완료 체크 기준이다. 학생에게 얼마나 남았는지 보여 준다. */}
      <div className="h-6 overflow-hidden rounded-full bg-slate-100">
        <span
          className="block h-full bg-lesson-500 transition-all"
          style={{ width: `${Math.round(progress.ratio * 100)}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={lesson.goPrev} disabled={progress.index === 0}>
          이전
        </Button>
        <Button size="lg" variant="primary" onClick={lesson.goNext} disabled={progress.isLast}>
          다음 단계
        </Button>
        <Button
          size="lg"
          variant={isDone ? 'primary' : 'secondary'}
          icon={Check}
          onClick={() => lesson.toggleDone(current.id)}
        >
          {isDone ? '완료함' : '완료 표시'}
        </Button>

        {timer.state === 'running' ? (
          <Button size="lg" icon={Pause} onClick={timer.pause}>
            일시정지
          </Button>
        ) : timer.state === 'paused' ? (
          <Button size="lg" icon={Play} onClick={timer.resume}>
            계속
          </Button>
        ) : null}

        {current.minutes > 0 ? (
          <>
            <Button size="lg" onClick={() => timer.addTime(60 * 1000)}>
              +1분
            </Button>
            <Button
              size="lg"
              icon={RotateCcw}
              variant="ghost"
              onClick={() => timer.start(current.minutes * 60 * 1000)}
            >
              시간 다시
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
