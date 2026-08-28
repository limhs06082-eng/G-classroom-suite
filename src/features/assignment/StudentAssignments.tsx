import { ClipboardCheck, Users } from 'lucide-react';
import { useState } from 'react';

import type { SubmissionStatus } from '../../shared/domain/types';
import { Badge, Card, cx, EmptyState } from '../../shared/ui';
import { SUBMISSION_LABELS } from './assignmentCore';
import { useAssignment } from './useAssignment';

const STATUS_TONE: Record<SubmissionStatus, string> = {
  unsubmitted: 'border-slate-200 bg-surface text-slate-500',
  submitted: 'border-success-200 bg-success-50 text-success-700',
  supplement: 'border-warning-200 bg-warning-50 text-warning-700',
  completed: 'border-brand-200 bg-brand-50 text-brand-700',
};

const BADGE_TONE: Record<SubmissionStatus, 'neutral' | 'success' | 'warning' | 'brand'> = {
  unsubmitted: 'neutral',
  submitted: 'success',
  supplement: 'warning',
  completed: 'brand',
};

/**
 * 학생 하나의 과제 전부.
 *
 * 상담이나 가정 연락 때 "이 학생이 뭘 안 냈나"를 한 번에 본다.
 *
 * 보완 사유(Submission.note)가 여기 산다. 과제별 격자에도 표 보기 칸에도
 * 한 학생만 골라 적을 자리가 없다. 학생 하나를 펼쳐 보는 이 화면이 제자리다.
 */
export function StudentAssignments() {
  const assignment = useAssignment();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (assignment.roster.length === 0 || assignment.assignments.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="학생별로 볼 것이 아직 없습니다"
        description="명단과 과제가 있어야 학생 한 명의 제출 이력을 볼 수 있습니다."
      />
    );
  }

  const selected =
    assignment.studentProgress.find((entry) => entry.student.id === selectedId) ??
    assignment.studentProgress[0] ??
    null;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-2">
        {assignment.studentProgress.map(({ student, counts, total, overdueCount }) => {
          const active = selected?.student.id === student.id;
          const done = counts.submitted + counts.completed;

          return (
            <li key={student.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedId(student.id)}
                className={cx(
                  'flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-sm',
                  active
                    ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                    : 'border-slate-200 bg-surface text-slate-700 hover:bg-slate-50',
                )}
              >
                <span className="font-mono text-xs text-slate-400" data-numeric>
                  {student.number}
                </span>
                {student.name}
                <span className="text-xs text-slate-400" data-numeric>
                  {done}/{total}
                </span>
                {overdueCount > 0 ? <Badge tone="danger">지연 {overdueCount}</Badge> : null}
              </button>
            </li>
          );
        })}
      </ul>

      {selected === null ? null : (
        <Card
          title={`${selected.student.number}번 ${selected.student.name}`}
          icon={Users}
          accentClass="text-assignment-500"
          action={
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SUBMISSION_LABELS) as SubmissionStatus[]).map((status) => (
                <Badge key={status} tone={BADGE_TONE[status]}>
                  {SUBMISSION_LABELS[status]} {selected.counts[status]}
                </Badge>
              ))}
            </div>
          }
        >
          <p className="mb-3 text-sm text-slate-500">
            상태 단추를 누르면 미제출 → 제출 → 보완 → 완료 순으로 바뀝니다. 보완 사유는 이
            학생에게만 남습니다.
          </p>

          <ul className="flex flex-col gap-2">
            {assignment.assignments.map((item) => {
              const status = assignment.statusFor(item.id, selected.student.id);
              const note =
                assignment.submissions.find(
                  (entry) =>
                    entry.assignmentId === item.id && entry.studentId === selected.student.id,
                )?.note ?? '';

              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-2 rounded-control border border-slate-200 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                    {item.title}
                  </span>
                  <span className="text-xs text-slate-400">
                    {item.dueDate === '' ? '기한 없음' : `기한 ${item.dueDate}`}
                  </span>

                  <button
                    type="button"
                    onClick={() => assignment.cycleStatus(item.id, selected.student.id)}
                    aria-label={`${item.title} ${SUBMISSION_LABELS[status]}`}
                    className={cx(
                      'h-8 w-16 shrink-0 rounded-control border text-sm font-medium transition-colors duration-[120ms]',
                      STATUS_TONE[status],
                    )}
                  >
                    {SUBMISSION_LABELS[status]}
                  </button>

                  <input
                    type="text"
                    value={note}
                    onChange={(event) =>
                      assignment.setNote(item.id, selected.student.id, event.target.value)
                    }
                    aria-label={`${item.title} 보완 사유`}
                    placeholder="보완 사유 (선택)"
                    className="h-8 w-full rounded-control border border-slate-300 px-2 text-sm sm:w-56"
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
