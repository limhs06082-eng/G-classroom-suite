import { ClipboardCheck, Plus } from 'lucide-react';

import type { SubmissionStatus } from '../../shared/domain/types';
import { Button, Card, cx, EmptyState, useToast } from '../../shared/ui';
import { statusFromIndex, SUBMISSION_LABELS, SUBMISSION_SHORT } from './assignmentCore';
import { useAssignment } from './useAssignment';

const CELL_TONE: Record<SubmissionStatus, string> = {
  unsubmitted: 'bg-surface text-slate-300',
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
export function AssignmentMatrix({ onAddAssignment }: { onAddAssignment?: () => void }) {
  const assignment = useAssignment();
  const toast = useToast();

  /**
   * 열(과제) 또는 행(학생) 일괄 제출. 스냅숏을 기억해 두었다가 실행 취소는
   * setMany 한 번으로 되돌린다 — 보완·완료였던 칸도 그대로 돌아온다.
   */
  const bulkSubmit = (cells: Array<{ assignmentId: string; studentId: string }>, label: string): void => {
    const snapshot = cells.map((cell) => ({
      ...cell,
      status: statusFromIndex(assignment.statusIndex, cell.assignmentId, cell.studentId),
    }));
    assignment.setMany(cells.map((cell) => ({ ...cell, status: 'submitted' as const })));
    toast.info(`${label} 전부 제출로 바꿨습니다.`, {
      actionLabel: '실행 취소',
      onAction: () => assignment.setMany(snapshot),
    });
  };

  if (assignment.assignments.length === 0 || assignment.roster.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="표로 볼 것이 아직 없습니다"
        description="명단과 과제가 있어야 학생과 과제를 한 화면에서 볼 수 있습니다."
        // 표 보기로 먼저 들어온 교사가 막다른 길을 만나면 안 된다.
        action={
          onAddAssignment !== undefined && assignment.roster.length > 0 ? (
            <Button variant="primary" icon={Plus} onClick={onAddAssignment}>
              과제 추가
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <Card title="학생 × 과제" icon={ClipboardCheck} accentClass="text-assignment-500">
      <p className="mb-3 text-sm text-slate-500">
        칸을 누르면 미제출 → 제출 → 보완 → 완료 순으로 바뀝니다. 과제 이름이나 학생 이름을 누르면
        그 줄 전부가 제출이 됩니다(실행 취소 가능).
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
                className="sticky left-0 z-10 border-b border-slate-200 bg-surface px-3 py-2 text-left font-medium text-slate-500"
              >
                학생
              </th>

              {assignment.progress.map(({ assignment: item, counts, total }) => (
                <th
                  key={item.id}
                  scope="col"
                  className="min-w-20 border-b border-slate-200 px-2 py-2 text-center font-medium text-slate-700"
                >
                  {/* 머리글을 누르면 그 과제 전원 제출. 밀린 과제를 찾은 자리에서 바로 정리한다. */}
                  <button
                    type="button"
                    onClick={() =>
                      bulkSubmit(
                        assignment.roster.map((student) => ({ assignmentId: item.id, studentId: student.id })),
                        item.title,
                      )
                    }
                    title={`${item.title} 전원 제출로`}
                    className="block max-w-24 truncate rounded px-1 hover:bg-slate-100 hover:text-brand-700"
                  >
                    {item.title}
                  </button>
                  <span className="block text-xs font-normal text-slate-400" data-numeric>
                    {total - counts.unsubmitted}/{total}
                    {/* 마감한 열을 빼지 않는다. 마감한 과제의 미제출자를 확인하는
                        것이 표 보기의 쓸모 중 하나다. */}
                    {item.status === 'closed' ? (
                      <span className="ml-1 text-slate-400">· 마감</span>
                    ) : null}
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
                  className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left font-normal whitespace-nowrap"
                >
                  {/* 이름을 누르면 그 학생의 진행 중 과제 전부 제출. */}
                  <button
                    type="button"
                    onClick={() =>
                      bulkSubmit(
                        assignment.assignments.map((item) => ({ assignmentId: item.id, studentId: student.id })),
                        `${student.name} 학생`,
                      )
                    }
                    title={`${student.name} 전부 제출로`}
                    className="rounded px-1 hover:bg-slate-100"
                  >
                    <span className="font-mono text-xs text-slate-400" data-numeric>
                      {student.number}
                    </span>{' '}
                    <span className="text-slate-800">{student.name}</span>
                  </button>
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
