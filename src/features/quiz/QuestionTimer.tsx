import { Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button, cx } from '../../shared/ui';
import { formatDuration, useTimer } from '../../shared/useTimer';

/**
 * 문항 제한 시간.
 *
 * `QuizQuestion.timeLimitSec`는 모델·팩토리·저장에 다 있었는데 세는 화면만
 * 없었다. `legacyImport`가 원본의 `timeLimit`을 옮겨 오므로 원본에는 있던 것이다.
 *
 * **문제를 띄우자마자 세지 않는다.** 교사가 문제를 읽어 줄 시간이 필요하다.
 * 자동으로 시작하면 다 읽기도 전에 시간이 간다.
 *
 * 남은 시간을 저장하지 않는다. useTimer가 끝날 시각을 기억하고 현재 시각과의
 * 차이를 계산하므로 탭이 뒤로 가도 정확하다. QuizRun에 넣으면 0.2초마다 저장이
 * 일어나고 그것이 다른 창에도 퍼진다.
 */
export function QuestionTimer({
  questionId,
  timeLimitSec,
  revealed,
}: {
  questionId: string;
  timeLimitSec: number;
  revealed: boolean;
}) {
  const timer = useTimer();

  const { reset, pause, start, resume, state } = timer;
  const stateRef = useRef(state);
  stateRef.current = state;

  // 문제가 바뀌면 처음 상태로 되돌린다.
  useEffect(() => {
    reset();
  }, [questionId, reset]);

  // 답을 보여 준 뒤에도 세면 학생이 헷갈린다.
  useEffect(() => {
    if (revealed && stateRef.current === 'running') pause();
  }, [revealed, pause]);

  if (timeLimitSec <= 0) return null;

  const totalMs = timeLimitSec * 1000;
  const isIdle = state === 'idle';
  const isFinished = state === 'finished';
  const shown = isIdle ? totalMs : timer.remainingMs;

  // 남은 시간이 1/4 아래로 내려가면 색으로 알린다. 소리는 내지 않는다.
  const isUrgent = !isIdle && !isFinished && timer.remainingMs <= totalMs / 4;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className={cx(
          'rounded-control px-4 py-1.5 font-mono text-board-base font-bold tabular-nums',
          isFinished
            ? 'bg-danger-100 text-danger-700'
            : isUrgent
              ? 'bg-warning-100 text-warning-700'
              : 'bg-slate-100 text-slate-700',
        )}
        aria-label={isFinished ? '시간 종료' : `남은 시간 ${formatDuration(shown)}`}
      >
        {isFinished ? '시간 종료' : formatDuration(shown)}
      </span>

      {isFinished ? (
        <Button size="lg" variant="secondary" icon={RotateCcw} onClick={reset}>
          다시
        </Button>
      ) : state === 'running' ? (
        <Button size="lg" variant="secondary" icon={Pause} onClick={pause}>
          잠깐
        </Button>
      ) : (
        <Button
          size="lg"
          variant="primary"
          icon={Play}
          disabled={revealed}
          onClick={() => (state === 'paused' ? resume() : start(totalMs))}
        >
          {state === 'paused' ? '이어서' : '시간 재기'}
        </Button>
      )}
    </div>
  );
}
