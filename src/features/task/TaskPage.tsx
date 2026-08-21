import { Check, ListChecks, Plus, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { createTask } from '../../shared/domain/factories';
import { createId } from '../../shared/ids';
import { TASK_AREAS, type TaskArea, type TaskItem, type TaskPriority } from '../../shared/domain/types';
import { useSuite } from '../../shared/roster/SuiteDataProvider';
import { Badge, Button, Card, ConfirmDialog, cx, EmptyState, Modal, useToast } from '../../shared/ui';
import {
  compareTasks,
  daysUntil,
  FILTER_LABELS,
  isOverdue,
  matchesFilter,
  PRIORITY_LABELS,
  stepProgress,
  summarizeTasks,
  type TaskFilter,
} from './taskCore';

const FILTERS: TaskFilter[] = ['today', 'week', 'overdue', 'open', 'done', 'all'];

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * 회의·업무 체크리스트.
 *
 * 교사 혼자 보는 화면이라 전자칠판이 없다.
 * 오늘 할 일이 맨 위에 오는 것이 이 화면의 전부다.
 */
export default function TaskPage() {
  const { data, update, guard } = useSuite();
  const toast = useToast();

  const today = todayString();
  const [filter, setFilter] = useState<TaskFilter>('open');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<TaskItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const summary = useMemo(() => summarizeTasks(data.tasks, today), [data.tasks, today]);

  const visible = useMemo(
    () => data.tasks.filter((task) => matchesFilter(task, filter, today)).sort(compareTasks),
    [data.tasks, filter, today],
  );

  const patchTask = useCallback(
    (taskId: string, recipe: (task: TaskItem) => TaskItem): void => {
      const now = new Date().toISOString();
      update((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId ? { ...recipe(task), updatedAt: now } : task,
        ),
      }));
    },
    [update],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">업무 체크</h1>
        {summary.overdue > 0 ? <Badge tone="danger">기한 초과 {summary.overdue}</Badge> : null}
        {summary.today > 0 ? <Badge tone="warning">오늘 {summary.today}</Badge> : null}

        <Button icon={Plus} variant="primary" className="ml-auto" onClick={() => setAddOpen(true)}>
          업무 추가
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((id) => (
          <Button
            key={id}
            size="sm"
            variant={filter === id ? 'primary' : 'ghost'}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {FILTER_LABELS[id]}
            {id === 'overdue' && summary.overdue > 0 ? ` ${summary.overdue}` : ''}
            {id === 'open' && summary.open > 0 ? ` ${summary.open}` : ''}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={ListChecks}
            title={data.tasks.length === 0 ? '아직 등록한 업무가 없습니다' : '이 조건에 맞는 업무가 없습니다'}
            description={
              data.tasks.length === 0
                ? '평가 계획 제출, 체험학습 신청처럼 마감이 있는 일을 넣어 두면 놓치지 않습니다.'
                : '다른 조건을 눌러 보세요.'
            }
            action={
              data.tasks.length === 0 ? (
                <Button variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>
                  업무 추가
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((task) => {
            const overdue = isOverdue(task, today);
            const days = task.dueDate === '' ? null : daysUntil(today, task.dueDate);
            const steps = stepProgress(task);
            const expanded = expandedId === task.id;

            return (
              <li
                key={task.id}
                className={cx(
                  'rounded-card border p-3',
                  task.done
                    ? 'border-slate-200 bg-slate-50'
                    : overdue
                      ? 'border-danger-200 bg-danger-50'
                      : 'border-slate-200 bg-white',
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      patchTask(task.id, (item) => ({ ...item, done: !item.done }));
                      if (!task.done) {
                        toast.success(`${task.title} 완료로 표시했습니다.`, {
                          actionLabel: '실행 취소',
                          onAction: () => patchTask(task.id, (item) => ({ ...item, done: false })),
                        });
                      }
                    }}
                    aria-pressed={task.done}
                    aria-label={`${task.title} ${task.done ? '완료 해제' : '완료 표시'}`}
                    className={cx(
                      'inline-flex size-5 shrink-0 items-center justify-center rounded border',
                      task.done ? 'border-success-500 bg-success-500 text-white' : 'border-slate-300',
                    )}
                  >
                    {task.done ? <Check className="size-3.5" aria-hidden /> : null}
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : task.id)}
                    className={cx(
                      'min-w-0 flex-1 truncate text-left text-sm font-medium',
                      task.done ? 'text-slate-400 line-through' : 'text-slate-900',
                    )}
                  >
                    {task.title}
                  </button>

                  <Badge tone="neutral">{task.area}</Badge>
                  {task.priority === 'high' ? <Badge tone="danger">중요</Badge> : null}
                  {steps.total > 0 ? (
                    <Badge tone={steps.done === steps.total ? 'success' : 'neutral'}>
                      {steps.done}/{steps.total}
                    </Badge>
                  ) : null}

                  {task.dueDate === '' ? null : (
                    <span
                      className={cx(
                        'shrink-0 text-sm',
                        overdue ? 'font-medium text-danger-700' : 'text-slate-500',
                      )}
                    >
                      {task.dueDate}
                      {days === null ? '' : days < 0 ? ` (${-days}일 지남)` : days === 0 ? ' (오늘)' : ` (D-${days})`}
                    </span>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    iconOnly
                    aria-label={`${task.title} 삭제`}
                    onClick={() => setDeleting(task)}
                  />
                </div>

                {expanded ? (
                  <TaskDetail task={task} onPatch={(recipe) => patchTask(task.id, recipe)} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <AddTaskModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(input) => {
          update((current) => ({ ...current, tasks: [...current.tasks, createTask(input)] }));
          setAddOpen(false);
          toast.success(`${input.title} 업무를 추가했습니다.`);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`${deleting?.title ?? ''} 업무를 지울까요?`}
        description="세부 단계와 메모가 함께 사라집니다. 지우기 직전 상태는 자동으로 백업됩니다."
        destructive
        confirmLabel="삭제"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting === null) return;
          void (async () => {
            await guard('업무 삭제 직전');
            update((current) => ({
              ...current,
              tasks: current.tasks.filter((task) => task.id !== deleting.id),
            }));
            toast.warning(`${deleting.title} 업무를 지웠습니다.`);
            setDeleting(null);
          })();
        }}
      />
    </div>
  );
}

function TaskDetail({
  task,
  onPatch,
}: {
  task: TaskItem;
  onPatch: (recipe: (task: TaskItem) => TaskItem) => void;
}) {
  const [stepText, setStepText] = useState('');

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3">
      <ul className="flex flex-col gap-1">
        {task.steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() =>
                onPatch((item) => ({
                  ...item,
                  steps: item.steps.map((s) => (s.id === step.id ? { ...s, done: !s.done } : s)),
                }))
              }
              aria-pressed={step.done}
              aria-label={`${step.text} ${step.done ? '완료 해제' : '완료'}`}
              className={cx(
                'inline-flex size-4 shrink-0 items-center justify-center rounded border',
                step.done ? 'border-success-500 bg-success-500 text-white' : 'border-slate-300',
              )}
            >
              {step.done ? <Check className="size-3" aria-hidden /> : null}
            </button>
            <span className={cx('min-w-0 flex-1', step.done && 'text-slate-400 line-through')}>
              {step.text}
            </span>
            <Button
              size="sm"
              variant="ghost"
              icon={Trash2}
              iconOnly
              aria-label={`${step.text} 단계 삭제`}
              onClick={() =>
                onPatch((item) => ({ ...item, steps: item.steps.filter((s) => s.id !== step.id) }))
              }
            />
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <input
          value={stepText}
          onChange={(event) => setStepText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || stepText.trim() === '') return;
            onPatch((item) => ({
              ...item,
              steps: [...item.steps, { id: createId(), text: stepText.trim(), done: false }],
            }));
            setStepText('');
          }}
          placeholder="세부 단계 추가 후 Enter"
          aria-label={`${task.title} 세부 단계 추가`}
          className="h-9 min-w-0 flex-1 rounded-control border border-slate-300 px-2 text-sm"
        />
      </div>

      <label className="block text-sm">
        <span className="text-slate-700">메모 · 회의 안건</span>
        <textarea
          defaultValue={task.memo}
          onBlur={(event) => onPatch((item) => ({ ...item, memo: event.target.value }))}
          rows={2}
          aria-label={`${task.title} 메모`}
          className="mt-1 w-full rounded-control border border-slate-300 p-2 text-sm"
        />
      </label>
    </div>
  );
}

function AddTaskModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (input: { title: string; area: TaskArea; dueDate: string; priority: TaskPriority }) => void;
}) {
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<TaskArea>('기타');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="업무 추가"
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
              onAdd({ title: title.trim(), area, dueDate, priority });
              setTitle('');
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
          <span className="text-slate-700">업무 이름</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="평가 계획 제출"
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>

        <div className="flex gap-3">
          <label className="block flex-1 text-sm">
            <span className="text-slate-700">영역</span>
            <select
              value={area}
              onChange={(event) => setArea(event.target.value as TaskArea)}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-2"
            >
              {TASK_AREAS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>

          <label className="block flex-1 text-sm">
            <span className="text-slate-700">중요도</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-2"
            >
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-slate-700">마감일 (선택)</span>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>
      </div>
    </Modal>
  );
}
