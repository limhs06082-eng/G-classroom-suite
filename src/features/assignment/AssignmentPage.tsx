import { Archive, ClipboardCheck, Monitor, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { Assignment, SubmissionStatus } from '../../shared/domain/types';
import { useActiveClass } from '../../shared/roster/SuiteDataProvider';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  cx,
  EmptyState,
  Modal,
  Tabs,
  useToast,
} from '../../shared/ui';
import { openBoard } from '../../shared/window/openBoard';
import { AssignmentMatrix } from './AssignmentMatrix';
import { SUBMISSION_LABELS } from './assignmentCore';
import { StudentAssignments } from './StudentAssignments';
import { useAssignment } from './useAssignment';

const STATUS_TONE: Record<SubmissionStatus, string> = {
  unsubmitted: 'border-slate-200 bg-surface text-slate-500',
  submitted: 'border-success-200 bg-success-50 text-success-700',
  supplement: 'border-warning-200 bg-warning-50 text-warning-700',
  completed: 'border-brand-200 bg-brand-50 text-brand-700',
};

/**
 * 과제 제출 현황.
 *
 * 원본의 핵심은 "한 번 눌러 상태를 바꾸는 속도"였다. 그것을 지켰다.
 * 같은 자리를 계속 누르면 미제출 → 제출 → 보완 → 완료로 돈다.
 *
 * 탭 셋은 같은 자료를 다르게 보는 것이지 다른 기능이 아니다.
 * 어느 탭에서 상태를 바꿔도 나머지 둘에 즉시 반영된다.
 */
type AssignmentTab = 'byTask' | 'matrix' | 'byStudent';

export default function AssignmentPage() {
  const activeClass = useActiveClass();
  const assignment = useAssignment();
  const toast = useToast();

  const [tab, setTab] = useState<AssignmentTab>('byTask');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Assignment | null>(null);

  if (activeClass === null) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          title="학급을 먼저 만들어 주세요"
          description="학급과 명단이 있어야 제출 현황을 관리할 수 있습니다."
          action={
            <Link
              to="/setup"
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              처음 설정 시작하기
            </Link>
          }
        />
      </Card>
    );
  }

  if (assignment.roster.length === 0) {
    return (
      <Card title="과제 제출 현황" icon={ClipboardCheck} accentClass="text-assignment-500">
        <EmptyState
          icon={Users}
          title="학생 명단이 비어 있습니다"
          description="명단을 등록하면 제출 현황을 바로 체크할 수 있습니다."
          action={
            <Link
              to="/roster"
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              명단 등록하기
            </Link>
          }
        />
      </Card>
    );
  }

  const selected =
    assignment.progress.find((entry) => entry.assignment.id === selectedId) ??
    assignment.progress[0] ??
    null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">과제 제출 현황</h1>
        <Badge tone="neutral">과제 {assignment.assignments.length}개</Badge>

        <div className="ml-auto flex gap-2">
          <Button icon={Plus} variant="primary" onClick={() => setAddOpen(true)}>
            과제 추가
          </Button>
          <Button variant="secondary" icon={Monitor} onClick={() => openBoard('/board/assignment')}>
            전자칠판
          </Button>
        </div>
      </div>

      <Tabs
        items={[
          { id: 'byTask', label: '과제별', count: assignment.assignments.length },
          { id: 'matrix', label: '표 보기' },
          { id: 'byStudent', label: '학생별', count: assignment.roster.length },
        ]}
        activeId={tab}
        onChange={(id) =>
          setTab(id === 'matrix' ? 'matrix' : id === 'byStudent' ? 'byStudent' : 'byTask')
        }
      >
      {tab === 'matrix' ? (
        <AssignmentMatrix />
      ) : tab === 'byStudent' ? (
        <StudentAssignments />
      ) : (
        <div className="flex flex-col gap-4">
        {assignment.assignments.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title={
              assignment.archived.length > 0
                ? '진행 중인 과제가 없습니다'
                : '아직 등록한 과제가 없습니다'
            }
            description={
              assignment.archived.length > 0
                ? '보관한 과제는 아래에서 되돌릴 수 있습니다.'
                : '과제를 만들면 학생별 제출 상태를 한 번의 클릭으로 체크할 수 있습니다.'
            }
            action={
              <Button variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>
                과제 추가
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <ul aria-label="과제 목록" className="flex flex-wrap gap-2">
            {assignment.progress.map(({ assignment: item, counts, total, isOverdue, daysLeft }) => {
              const active = selected?.assignment.id === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedId(item.id)}
                    className={cx(
                      'flex items-center gap-2 rounded-control border px-3 py-2 text-sm',
                      active
                        ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                        : 'border-slate-200 bg-surface text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {item.title}
                    <span className="font-mono text-xs text-slate-400">
                      {total - counts.unsubmitted}/{total}
                    </span>
                    {item.status === 'closed' ? <Badge tone="neutral">마감</Badge> : null}
                    {isOverdue ? <Badge tone="danger">지연</Badge> : null}
                    {daysLeft !== null && daysLeft >= 0 && daysLeft <= 2 && !isOverdue ? (
                      <Badge tone="warning">{daysLeft === 0 ? '오늘' : `D-${daysLeft}`}</Badge>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {selected === null ? null : (
            <Card
              title={selected.assignment.title}
              icon={ClipboardCheck}
              accentClass="text-assignment-500"
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-500">
                    {selected.assignment.dueDate === ''
                      ? '기한 없음'
                      : `기한 ${selected.assignment.dueDate}`}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      assignment.setAll(selected.assignment.id, 'submitted');
                      toast.info('전원을 제출로 바꿨습니다.', {
                        actionLabel: '실행 취소',
                        onAction: () => assignment.setAll(selected.assignment.id, 'unsubmitted'),
                      });
                    }}
                  >
                    전원 제출
                  </Button>

                  {/*
                   * 진행 중에서 바로 보관은 두지 않는다. 진행 중인 과제를 한 번에
                   * 숨기는 것은 실수하기 쉽다. 마감을 거쳐야 보관할 수 있다.
                   */}
                  {selected.assignment.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        assignment.setAssignmentStatus(selected.assignment.id, 'closed');
                        toast.info(`${selected.assignment.title} 과제를 마감했습니다.`, {
                          actionLabel: '실행 취소',
                          onAction: () =>
                            assignment.setAssignmentStatus(selected.assignment.id, 'active'),
                        });
                      }}
                    >
                      마감하기
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          assignment.setAssignmentStatus(selected.assignment.id, 'active');
                          toast.info(`${selected.assignment.title} 과제를 다시 열었습니다.`);
                        }}
                      >
                        다시 열기
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Archive}
                        onClick={() => {
                          assignment.setAssignmentStatus(selected.assignment.id, 'archived');
                          setSelectedId(null);
                          toast.info(`${selected.assignment.title} 과제를 보관했습니다.`, {
                            actionLabel: '실행 취소',
                            onAction: () =>
                              assignment.setAssignmentStatus(selected.assignment.id, 'closed'),
                          });
                        }}
                      >
                        보관하기
                      </Button>
                    </>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    iconOnly
                    aria-label={`${selected.assignment.title} 삭제`}
                    onClick={() => setDeleting(selected.assignment)}
                  />
                </div>
              }
            >
              {/* 교사가 적어 넣은 안내다. 안 보여 주면 적은 것이 사라졌다고 생각한다. */}
              {selected.assignment.description === '' ? null : (
                <p className="mb-3 rounded-control bg-slate-50 px-3 py-2 text-sm whitespace-pre-wrap text-slate-600">
                  {selected.assignment.description}
                </p>
              )}

              <div className="mb-3 flex flex-wrap gap-2">
                {(Object.keys(SUBMISSION_LABELS) as SubmissionStatus[]).map((status) => (
                  <Badge
                    key={status}
                    tone={
                      status === 'unsubmitted'
                        ? 'neutral'
                        : status === 'submitted'
                          ? 'success'
                          : status === 'supplement'
                            ? 'warning'
                            : 'brand'
                    }
                  >
                    {SUBMISSION_LABELS[status]} {selected.counts[status]}
                  </Badge>
                ))}
              </div>

              <p className="mb-3 text-sm text-slate-500">
                학생을 누르면 미제출 → 제출 → 보완 → 완료 순으로 바뀝니다.
              </p>

              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {assignment.roster.map((student) => {
                  const status = assignment.statusFor(selected.assignment.id, student.id);

                  return (
                    <li key={student.id}>
                      <button
                        type="button"
                        onClick={() => {
                          const next = assignment.cycleStatus(selected.assignment.id, student.id);
                          if (next === 'supplement') {
                            toast.info(`${student.name} 보완으로 표시했습니다.`);
                          }
                        }}
                        aria-label={`${student.name} ${SUBMISSION_LABELS[status]}`}
                        className={cx(
                          'flex w-full items-center gap-1.5 rounded-card border p-2.5 text-left transition-colors',
                          STATUS_TONE[status],
                        )}
                      >
                        <span className="font-mono text-xs opacity-60">{student.number}</span>
                        <span className="min-w-0 flex-1 truncate text-sm">{student.name}</span>
                        <span className="shrink-0 text-xs font-medium">
                          {SUBMISSION_LABELS[status]}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}

        {/* 보관한 과제가 없으면 이 줄 자체가 안 나온다. */}
        {assignment.archived.length > 0 ? (
          <div className="rounded-card border border-slate-200 bg-surface">
            <button
              type="button"
              onClick={() => setArchiveOpen((value) => !value)}
              aria-expanded={archiveOpen}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-600 hover:bg-slate-50"
            >
              <Archive className="size-4 shrink-0 text-slate-400" aria-hidden />
              보관한 과제 {assignment.archived.length}개
              <span className="ml-auto text-brand-600">{archiveOpen ? '접기' : '보기'}</span>
            </button>

            {archiveOpen ? (
              <ul className="flex flex-col gap-2 border-t border-slate-100 p-3">
                {assignment.archived.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 rounded-control border border-slate-200 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                      {item.title}
                    </span>
                    <span className="text-xs text-slate-400">
                      {item.dueDate === '' ? '기한 없음' : `기한 ${item.dueDate}`}
                    </span>
                    {/* 보관함에서는 되돌리기만 한다. 체크나 삭제는 되돌린 뒤에. */}
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={RotateCcw}
                      onClick={() => {
                        assignment.setAssignmentStatus(item.id, 'closed');
                        toast.success(`${item.title} 과제를 되돌렸습니다. 마감 상태입니다.`);
                      }}
                    >
                      되돌리기
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        </div>
      )}
      </Tabs>

      {/* 모달과 확인창은 Tabs 밖에 둔다. 탭을 바꿔도 열려 있던 창이 사라지면 안 된다. */}
      <AddAssignmentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(input) => {
          assignment.addAssignment(input);
          setAddOpen(false);
          toast.success(`${input.title} 과제를 만들었습니다.`);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`${deleting?.title ?? ''} 과제를 지울까요?`}
        description="이 과제의 제출 기록도 함께 사라집니다. 지우기 직전 상태는 자동으로 백업됩니다."
        destructive
        confirmLabel="과제 삭제"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting === null) return;
          void (async () => {
            await assignment.deleteAssignment(deleting.id);
            toast.warning(`${deleting.title} 과제를 지웠습니다.`);
            setDeleting(null);
            setSelectedId(null);
          })();
        }}
      />
    </div>
  );
}

function AddAssignmentModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (input: { title: string; description: string; dueDate: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="과제 추가"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            disabled={title.trim() === ''}
            onClick={() => {
              onAdd({ title: title.trim(), description: description.trim(), dueDate });
              setTitle('');
              setDescription('');
              setDueDate('');
            }}
          >
            추가
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="block text-sm">
          <span className="text-slate-700">과제 이름</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="독서 감상문"
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-700">제출 기한 (선택)</span>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-700">안내 (선택)</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="공책에 한 쪽 이상 작성"
            className="mt-1 w-full rounded-control border border-slate-300 p-2"
          />
        </label>
      </div>
    </Modal>
  );
}
