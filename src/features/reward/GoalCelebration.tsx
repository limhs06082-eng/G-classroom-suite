import { PartyPopper } from 'lucide-react';
import { useEffect, useRef } from 'react';

import type { ScoreGoal } from '../../shared/domain/types';
import { Button } from '../../shared/ui';

/**
 * 공동 목표 달성 축하.
 *
 * 토스트가 아니라 전체 화면이다. **학생들에게 보여 주는 화면**이라
 * 4초 뒤에 사라지면 안 된다. 교사가 닫을 때까지 남는다.
 *
 * 글자는 전자칠판 크기(board)를 쓴다. 교사 화면에 띄우지만 교실 뒤에서도
 * 읽혀야 한다. 교사가 노트북을 돌려 보여 주거나 화면을 미러링한다.
 */
export function GoalCelebration({
  goals,
  targetLabel,
  onClose,
}: {
  goals: readonly ScoreGoal[];
  targetLabel: (goal: ScoreGoal) => string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (goals.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="공동 목표 달성"
      className="animate-rise-in fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-white/95 p-8 backdrop-blur-sm"
    >
      <PartyPopper className="size-20 text-reward-500" aria-hidden />

      <h2 className="text-center text-board-lg font-bold text-slate-900">
        {goals.length === 1 ? '목표를 이뤘습니다' : `목표 ${goals.length}개를 이뤘습니다`}
      </h2>

      <ul className="flex max-w-4xl flex-col gap-4">
        {goals.map((goal) => (
          <li
            key={goal.id}
            className="rounded-card border-4 border-reward-200 bg-reward-50 px-8 py-5 text-center"
          >
            <p className="text-board-base font-bold text-slate-900">{goal.title}</p>
            <p className="mt-1 text-board-sm text-slate-600">
              {targetLabel(goal)} · {goal.targetPoints}점
            </p>
            {goal.reward === '' ? null : (
              <p className="mt-3 text-board-sm font-semibold text-reward-700">{goal.reward}</p>
            )}
          </li>
        ))}
      </ul>

      <Button ref={closeRef} size="lg" variant="primary" onClick={onClose}>
        닫기
      </Button>
    </div>
  );
}
