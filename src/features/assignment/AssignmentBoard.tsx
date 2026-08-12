import { cx, EmptyState } from '../../shared/ui';
import { SUBMISSION_LABELS } from './assignmentCore';
import { useAssignment } from './useAssignment';

/**
 * 전자칠판용 제출 현황.
 *
 * 아침에 띄워 두고 학생이 자기 이름을 확인하는 용도다.
 * 이름을 그대로 노출하므로 미제출만 크게 보여 준다.
 */
export function AssignmentBoard() {
  const assignment = useAssignment();

  if (assignment.upcoming.length === 0) {
    return (
      <EmptyState
        title="진행 중인 과제가 없습니다"
        description="과제 제출 화면에서 과제를 만들면 여기에 표시됩니다."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-6">
      {assignment.upcoming.slice(0, 4).map(({ assignment: item, counts, total, isOverdue }) => {
        const notYet = assignment.roster.filter(
          (student) => assignment.statusFor(item.id, student.id) === 'unsubmitted',
        );

        return (
          <li key={item.id}>
            <h2 className="flex flex-wrap items-baseline gap-3 text-board-sm font-bold text-slate-900">
              {item.title}
              <span className={cx('text-board-sm', isOverdue ? 'text-danger-700' : 'text-slate-500')}>
                {total - counts.unsubmitted} / {total}명 제출
              </span>
              {item.dueDate === '' ? null : (
                <span className="text-board-sm text-slate-400">기한 {item.dueDate}</span>
              )}
            </h2>

            {notYet.length === 0 ? (
              <p className="mt-2 text-board-sm text-success-700">모두 냈습니다</p>
            ) : (
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-board-sm text-slate-700">
                <span className="text-slate-400">{SUBMISSION_LABELS.unsubmitted}</span>
                {notYet.map((student) => (
                  <span key={student.id}>{student.name}</span>
                ))}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
