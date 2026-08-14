import { PendingNote } from '../home/SummaryCard';
import { useDuty } from './useDuty';

/**
 * 홈의 '오늘의 당번' 카드 본문.
 *
 * 아침에 홈만 열어도 오늘 누가 무엇을 맡는지 보여야 한다.
 */
export function DutySummary() {
  const duty = useDuty();

  if (!duty.hasRoles) {
    return <PendingNote>역할을 만들고 배정하면 오늘 당번이 여기 표시됩니다.</PendingNote>;
  }

  if (duty.currentRound === null) {
    return <PendingNote>아직 배정하지 않았습니다. 역할·당번에서 이번 주 배정을 눌러 주세요.</PendingNote>;
  }

  if (duty.todayDuties.length === 0) {
    return <PendingNote>오늘은 당번이 없습니다.</PendingNote>;
  }

  const doneCount = duty.todayDuties.filter((entry) => entry.isDone).length;

  return (
    <div>
      <p className="flex items-baseline gap-1">
        <span data-numeric className="text-2xl font-bold text-slate-900">{duty.todayDuties.length}</span>
        <span className="text-sm text-slate-500">개 역할</span>
        {doneCount > 0 ? (
          <span className="text-sm text-success-700">· {doneCount}개 완료</span>
        ) : null}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {duty.todayDuties.slice(0, 3).map(({ role, students }) => (
          <li key={role.id} className="truncate text-sm text-slate-500">
            {role.name} — {students.map((student) => student.name).join(', ') || '배정 없음'}
          </li>
        ))}
        {duty.todayDuties.length > 3 ? (
          <li className="text-sm text-slate-400">외 {duty.todayDuties.length - 3}개</li>
        ) : null}
      </ul>
    </div>
  );
}
