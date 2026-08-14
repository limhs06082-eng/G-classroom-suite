import { ClipboardCheck } from 'lucide-react';

import type { SubmissionStatus } from '../../shared/domain/types';
import { Card, cx, EmptyState } from '../../shared/ui';
import { statusFromIndex, SUBMISSION_LABELS, SUBMISSION_SHORT } from './assignmentCore';
import { useAssignment } from './useAssignment';

const CELL_TONE: Record<SubmissionStatus, string> = {
  unsubmitted: 'bg-white text-slate-300',
  submitted: 'bg-success-50 text-success-700',
  supplement: 'bg-warning-50 text-warning-700',
  completed: 'bg-brand-50 text-brand-700',
};

/**
 * 학생 × 과제 격자.
 *
 * 과제별 탭은 과제를 하나씩만 보여 준다. 누가 여러 개 밀렸는지는 그렇게 볼 수 없다.
 *
 * 칸에는 한 글자만 넣는다(미·제·보·완). 과제 20개를 한 화면에 넣으려면
 * '미제출' 세 글자가 들어갈 자리가 없다. 색만으로 구분하지 않는다 —
 * 색각 이상인 교사가 제출과 보완을 못 가린다.
 */
export function AssignmentMatrix() {
  const assignment = useAssignment();

  if (assignment.assignments.length === 0 || assignment.roster.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="표로 볼 것이 아직 없습니다"
        description="명단과 과제가 있어야 학생과 과제를 한 화면에서 볼 수 있습니다."
      />
    );
  }

  return (
    <Card title="학생 × 과제" icon={ClipboardCheck} accentClass="text-assignment-500">
      <p className="mb-3 text-sm text-slate-500">
        칸을 누르면 미제출 → 제출 → 보완 → 완료 순으로 바뀝니다.
      </p>

      {/* 가로 스크롤은 표 안에서만 일어난다. 페이지 전체가 옆으로 밀리면 안 된다. */}
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <caption className="sr-only">학생별 과제 제출 현황 표</caption>

          <thead>
            <tr>
              {/* 이름 열이 밀려 나가면 지금 누르는 칸이 누구 것인지 알 수 없다. */}
              <th
                scope="col"
                className="sticky left-0 z-10 border-b border-slate-200 bg-white px-3 py-2 text-left font-medium text-slate-500"
              >
                학생
              </th>

              {assignment.progress.map(({ assignment: item, counts, total }) => (
                <th
                  key={item.id}
                  scope="col"
                  className="min-w-20 border-b border-slate-200 px-2 py-2 text-center font-medium text-slate-700"
                >
                  <span className="block max-w-24 truncate">{item.title}</span>
                  <span className="block text-xs font-normal text-slate-400" data-numeric>
                    {total - counts.unsubmitted}/{total}
                  </span>
                </th>
              ))}

              <th
                scope="col"
                className="border-b border-slate-200 px-3 py-2 text-center font-medium text-slate-500"
              >
                합계
              </th>
            </tr>
          </thead>

          <tbody>
            {assignment.studentProgress.map(({ student, counts, total }) => (
              <tr key={student.id} className="border-b border-slate-100">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-normal whitespace-nowrap"
                >
                  <span className="font-mono text-xs text-slate-400" data-numeric>
                    {student.number}
                  </span>{' '}
                  <span className="text-slate-800">{student.name}</span>
                </th>

                {assignment.assignments.map((item) => {
                  const status = statusFromIndex(assignment.statusIndex, item.id, student.id);

                  return (
                    <td key={item.id} className="p-0.5 text-center">
                      <button
                        type="button"
                        onClick={() => assignment.cycleStatus(item.id, student.id)}
                        aria-label={`${student.name}, ${item.title}, ${SUBMISSION_LABELS[status]}`}
                        className={cx(
                          'h-8 w-full rounded-control border border-slate-200 font-medium transition-colors duration-[120ms] hover:border-slate-400',
                          CELL_TONE[status],
                        )}
                      >
                        {SUBMISSION_SHORT[status]}
                      </button>
                    </td>
                  );
                })}

                <td className="px-3 py-1.5 text-center text-slate-500" data-numeric>
                  {counts.submitted + counts.completed}/{total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
