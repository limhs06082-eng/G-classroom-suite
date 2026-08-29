import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { useToday } from '../../shared/state/useToday';
import { EmptyState } from '../../shared/ui';
import { assignmentsDueSoon, itemsFor } from './noticeCore';

/**
 * 전자칠판용 알림장.
 *
 * 종례 때 띄워 두고 학생이 받아 적는 화면이라 board 스케일을 쓴다.
 * 조작 요소는 두지 않는다 — 고치는 것은 교사 창의 알림장 화면이다.
 */
export function NoticeBoard() {
  const { data } = useSuite();
  const activeClass = useActiveClass();
  const today = useToday();
  const classId = activeClass?.id ?? '';

  const items = itemsFor(data.notices, classId, today);
  const dueSoon = assignmentsDueSoon(data.assignments, classId, today);

  if (items.length === 0 && dueSoon.length === 0) {
    return (
      <EmptyState
        title="오늘 알림장이 비어 있습니다"
        description="알림장 화면에서 적으면 여기 바로 나타납니다."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {items.length > 0 ? (
        <ol className="flex flex-col gap-4">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-baseline gap-4">
              <span data-numeric className="shrink-0 text-board-md font-bold text-notice-500">
                {index + 1}.
              </span>
              <span className="min-w-0 text-board-md font-semibold text-slate-900">{item.text}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {dueSoon.length > 0 ? (
        <section>
          <h2 className="mb-3 text-board-sm font-bold text-slate-500">잊지 마세요 — 과제</h2>
          <ul className="flex flex-col gap-2">
            {dueSoon.map((assignment) => (
              <li key={assignment.id} className="flex items-baseline gap-3 text-board-sm text-slate-900">
                <span className="shrink-0 font-bold text-danger-500">
                  {assignment.dueDate === today ? '오늘까지' : '내일까지'}
                </span>
                <span className="min-w-0">{assignment.title}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
