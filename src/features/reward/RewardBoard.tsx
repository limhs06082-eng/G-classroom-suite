import { useState } from 'react';

import { Button, cx, EmptyState } from '../../shared/ui';
import { groupColorStyle } from '../seating/groupColors';
import { useReward } from './useReward';

type BoardView = 'group' | 'student' | 'goal';

/**
 * 전자칠판용 점수판.
 *
 * 학생들이 보는 화면이다. 개인 순위를 늘 띄워 두면 부담이 되므로
 * 모둠판을 기본으로 두고 개인·목표는 교사가 선택해서 띄운다.
 */
export function RewardBoard() {
  const reward = useReward();
  const [view, setView] = useState<BoardView>('group');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="lg"
          variant={view === 'group' ? 'primary' : 'secondary'}
          aria-pressed={view === 'group'}
          onClick={() => setView('group')}
        >
          모둠 점수
        </Button>
        <Button
          size="lg"
          variant={view === 'student' ? 'primary' : 'secondary'}
          aria-pressed={view === 'student'}
          onClick={() => setView('student')}
        >
          개인 점수
        </Button>
        <Button
          size="lg"
          variant={view === 'goal' ? 'primary' : 'secondary'}
          aria-pressed={view === 'goal'}
          onClick={() => setView('goal')}
        >
          공동 목표
        </Button>

        <span className="ml-auto text-board-sm font-bold text-slate-900">
          우리 반 {reward.totals.classTotal}점
        </span>
      </div>

      {view === 'group' ? (
        reward.groups.length === 0 ? (
          <EmptyState
            title="아직 모둠 점수가 없습니다"
            // 학생이 보는 화면이다. 교사용 조작 안내를 크게 띄우지 않는다.
            description="모둠을 만들면 점수판이 여기에 나타납니다."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...reward.groups]
              .sort(
                (a, b) =>
                  (reward.totals.groups.get(b.id) ?? 0) - (reward.totals.groups.get(a.id) ?? 0),
              )
              .map((group) => {
                const style = groupColorStyle(group.color);
                return (
                  <li
                    key={group.id}
                    className={cx('flex items-center gap-3 rounded-card border-4 p-4', style.card)}
                  >
                    <span className={cx('size-5 shrink-0 rounded-full', style.dot)} aria-hidden />
                    <span className={cx('min-w-0 flex-1 truncate text-board-sm font-bold', style.text)}>
                      {group.name}
                    </span>
                    <span className="shrink-0 text-board-base font-black text-slate-900">
                      {reward.totals.groups.get(group.id) ?? 0}
                    </span>
                  </li>
                );
              })}
          </ul>
        )
      ) : null}

      {view === 'student' ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {reward.roster.map((student) => (
            <li
              key={student.id}
              className="flex items-center gap-2 rounded-card border-2 border-slate-200 bg-surface p-3"
            >
              <span className="font-mono text-board-sm text-slate-400">{student.number}</span>
              <span className="min-w-0 flex-1 truncate text-board-sm text-slate-900">
                {student.name}
              </span>
              <span className="shrink-0 text-board-sm font-bold text-slate-900">
                {reward.totals.students.get(student.id) ?? 0}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {view === 'goal' ? (
        reward.goals.length === 0 ? (
          <EmptyState
            title="아직 공동 목표가 없습니다"
            description="목표가 생기면 진행률이 여기에 표시됩니다."
          />
        ) : (
          <ul className="flex flex-col gap-5">
            {reward.goals.map(({ goal, current, ratio, isAchieved }) => (
              <li key={goal.id}>
                <p className="flex flex-wrap items-baseline gap-2 text-board-sm font-bold text-slate-900">
                  {goal.title}
                  <span className="text-slate-500">
                    {current} / {goal.targetPoints}점
                  </span>
                  {isAchieved ? <span className="text-success-700">달성!</span> : null}
                </p>
                <div className="mt-2 h-10 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className={cx('block h-full', isAchieved ? 'bg-success-500' : 'bg-reward-500')}
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
