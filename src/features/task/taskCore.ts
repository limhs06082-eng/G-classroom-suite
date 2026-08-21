import type { TaskItem, TaskPriority } from '../../shared/domain/types';

/**
 * 업무 목록 계산.
 *
 * 원본 G-task-manager는 필터·정렬이 화면 안에 흩어져 있었다.
 * "기한 초과"의 기준처럼 조용히 어긋나는 것들이라 밖으로 뺐다.
 */

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: '중요',
  normal: '보통',
  low: '나중에',
};

export type TaskFilter = 'today' | 'week' | 'overdue' | 'open' | 'done' | 'all';

export const FILTER_LABELS: Record<TaskFilter, string> = {
  today: '오늘',
  week: '이번 주',
  overdue: '기한 초과',
  open: '진행 중',
  done: '완료',
  all: '전체',
};

/** 'YYYY-MM-DD' 사이의 일수. 지역 시간 기준. */
export function daysUntil(today: string, dueDate: string): number | null {
  const parse = (value: string): Date | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    // 2026-02-31 같은 값은 3월로 넘어간다.
    return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  };

  const from = parse(today);
  const to = parse(dueDate);
  if (from === null || to === null) return null;

  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * 기한이 지났는가.
 *
 * **완료한 업무는 기한이 지나도 초과가 아니다.** 이걸 빠뜨리면 지난 학기에
 * 끝낸 업무가 계속 빨갛게 남아 진짜 급한 것이 묻힌다.
 */
export function isOverdue(task: TaskItem, today: string): boolean {
  if (task.done || task.dueDate === '') return false;

  const days = daysUntil(today, task.dueDate);
  return days !== null && days < 0;
}

export function stepProgress(task: TaskItem): { done: number; total: number; ratio: number } {
  const total = task.steps.length;
  const done = task.steps.filter((step) => step.done).length;

  return { done, total, ratio: total === 0 ? 0 : done / total };
}

export function matchesFilter(task: TaskItem, filter: TaskFilter, today: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'done') return task.done;
  if (filter === 'open') return !task.done;
  if (filter === 'overdue') return isOverdue(task, today);

  // 기한이 없는 업무는 날짜 필터에 걸리지 않는다.
  if (task.done || task.dueDate === '') return false;
  const days = daysUntil(today, task.dueDate);
  if (days === null) return false;

  // 오늘·이번 주에는 이미 지난 것도 함께 보여 준다. 놓친 것을 숨기면 안 된다.
  if (filter === 'today') return days <= 0;
  return days <= 7;
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };

/**
 * 정렬: 미완료 먼저 → 기한 가까운 순 → 중요도 → 만든 순.
 * 기한 없는 업무는 기한 있는 것 뒤로 보낸다.
 */
export function compareTasks(a: TaskItem, b: TaskItem): number {
  if (a.done !== b.done) return a.done ? 1 : -1;

  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === '') return 1;
    if (b.dueDate === '') return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }

  const priority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  return priority !== 0 ? priority : a.createdAt.localeCompare(b.createdAt);
}

export interface TaskSummary {
  overdue: number;
  today: number;
  week: number;
  open: number;
  done: number;
}

export function summarizeTasks(tasks: readonly TaskItem[], today: string): TaskSummary {
  return {
    overdue: tasks.filter((task) => isOverdue(task, today)).length,
    today: tasks.filter((task) => matchesFilter(task, 'today', today)).length,
    week: tasks.filter((task) => matchesFilter(task, 'week', today)).length,
    open: tasks.filter((task) => !task.done).length,
    done: tasks.filter((task) => task.done).length,
  };
}
