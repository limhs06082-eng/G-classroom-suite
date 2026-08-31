import { Check } from 'lucide-react';

import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { cx, EmptyState } from '../../shared/ui';
import { statusOf } from '../attendance/attendanceCore';
import { useDuty } from './useDuty';

/**
 * 전자칠판용 오늘의 당번.
 *
 * 교실 뒷자리에서도 자기 이름을 찾을 수 있어야 하므로 board 스케일을 쓴다.
 * 아침에 띄워 두는 화면이라 조작 요소는 두지 않는다.
 */
export function DutyBoard() {
  const duty = useDuty();
  const { data } = useSuite();
  const activeClass = useActiveClass();
  const classId = activeClass?.id ?? '';

  if (duty.todayDuties.length === 0) {
    return (
      <EmptyState
        title="오늘은 당번이 없습니다"
        description="역할·당번 화면에서 이번 주 배정을 누르면 여기에 표시됩니다."
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {duty.todayDuties.map(({ role, students, replaced, isDone }) => (
        <li
          key={role.id}
          className={cx(
            'rounded-card border-4 p-4',
            isDone ? 'border-success-500 bg-success-50' : 'border-slate-300 bg-surface',
          )}
        >
          <h2 className="flex items-center gap-2 text-board-sm font-bold text-slate-900">
            {isDone ? <Check className="size-8 shrink-0 text-success-500" aria-label="완료" /> : null}
            {role.name}
          </h2>

          <ul className="mt-3 flex flex-col gap-1">
            {students.length === 0 ? (
              <li className="text-board-sm text-slate-400">배정 없음</li>
            ) : (
              students.map((student) => {
                const swap = replaced.find((r) => r.substitute.id === student.id);
                /*
                 * 오늘 없는 학생은 흐리게 긋는다. 대체를 아직 안 정한 날,
                 * 결석한 이름이 멀쩡히 걸려 있으면 다른 학생이 대신 하려다
                 * 혼선이 생긴다. 대체가 정해지면 이미 대체자로 바뀌어 나온다.
                 */
                const away = (() => {
                  const status = statusOf(data.attendanceRecords, classId, duty.today, student.id);
                  return status === 'absent' || status === 'fieldTrip';
                })();
                return (
                  <li
                    key={student.id}
                    className={cx('text-board-sm', away ? 'text-slate-300 line-through' : 'text-slate-900')}
                  >
                    <span className="truncate">{student.name}</span>
                    {swap ? (
                      <span className="ml-2 text-slate-400">({swap.original.name} 대신)</span>
                    ) : null}
                    {away ? <span className="ml-2 text-slate-400 no-underline">결석</span> : null}
                  </li>
                );
              })
            )}
          </ul>
        </li>
      ))}
    </ul>
  );
}
