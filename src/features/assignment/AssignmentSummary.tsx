import { PendingNote } from '../home/SummaryCard';
import { useAssignment } from './useAssignment';

/** 홈의 '마감 임박 과제' 카드 본문. */
export function AssignmentSummary() {
  const assignment = useAssignment();

  if (assignment.upcoming.length === 0) {
    return <PendingNote>과제를 등록하면 마감이 가까운 순으로 여기 표시됩니다.</PendingNote>;
  }

  const overdue = assignment.upcoming.filter((entry) => entry.isOverdue).length;

  return (
    <div>
      <p className="flex items-baseline gap-1">
        <span data-numeric className="text-2xl font-bold text-slate-900">{assignment.upcoming.length}</span>
        <span className="text-sm text-slate-500">개 진행 중</span>
        {overdue > 0 ? <span className="text-sm text-danger-700">· 지연 {overdue}</span> : null}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {assignment.upcoming.slice(0, 3).map(({ assignment: item, counts, total, daysLeft }) => (
          <li key={item.id} className="truncate text-sm text-slate-500">
            {item.title} — {total - counts.unsubmitted}/{total}
            {daysLeft === null ? '' : daysLeft < 0 ? ' · 지연' : daysLeft === 0 ? ' · 오늘' : ` · D-${daysLeft}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
