import { describe, expect, it } from 'vitest';

import {
  compareTasks,
  daysUntil,
  isOverdue,
  matchesFilter,
  stepProgress,
  summarizeTasks,
} from '../../src/features/task/taskCore';
import { createTask } from '../../src/shared/domain/factories';
import type { TaskItem } from '../../src/shared/domain/types';

const NOW = '2026-08-12T09:00:00.000Z';
const TODAY = '2026-08-12';

const task = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  ...createTask({ id: 't-1', title: '평가 계획 제출' }, NOW),
  ...overrides,
});

describe('daysUntil', () => {
  it('남은 일수를 센다', () => {
    expect(daysUntil(TODAY, '2026-08-15')).toBe(3);
    expect(daysUntil(TODAY, '2026-08-10')).toBe(-2);
    expect(daysUntil(TODAY, TODAY)).toBe(0);
  });

  it('월을 넘어가도 정확하다', () => {
    expect(daysUntil('2026-08-30', '2026-09-02')).toBe(3);
  });

  it('없는 날짜를 거절한다', () => {
    expect(daysUntil(TODAY, '2026-02-31')).toBeNull();
    expect(daysUntil(TODAY, '아무거나')).toBeNull();
  });
});

describe('isOverdue', () => {
  it('기한이 지나면 초과다', () => {
    expect(isOverdue(task({ dueDate: '2026-08-10' }), TODAY)).toBe(true);
  });

  it('완료한 업무는 기한이 지나도 초과가 아니다', () => {
    /*
     * 빠뜨리면 지난 학기에 끝낸 업무가 계속 빨갛게 남아
     * 진짜 급한 것이 묻힌다.
     */
    expect(isOverdue(task({ dueDate: '2026-01-01', done: true }), TODAY)).toBe(false);
  });

  it('오늘이 기한이면 아직 초과가 아니다', () => {
    expect(isOverdue(task({ dueDate: TODAY }), TODAY)).toBe(false);
  });

  it('기한이 없으면 초과가 아니다', () => {
    expect(isOverdue(task({ dueDate: '' }), TODAY)).toBe(false);
  });
});

describe('stepProgress', () => {
  it('세부 단계 진행률을 센다', () => {
    const withSteps = task({
      steps: [
        { id: 's1', text: '초안', done: true },
        { id: 's2', text: '검토', done: true },
        { id: 's3', text: '제출', done: false },
      ],
    });

    expect(stepProgress(withSteps)).toEqual({ done: 2, total: 3, ratio: 2 / 3 });
  });

  it('단계가 없어도 나눗셈이 깨지지 않는다', () => {
    const progress = stepProgress(task());

    expect(progress.ratio).toBe(0);
    expect(Number.isNaN(progress.ratio)).toBe(false);
  });
});

describe('matchesFilter', () => {
  it('오늘 필터는 오늘까지가 기한인 것을 보여 준다', () => {
    expect(matchesFilter(task({ dueDate: TODAY }), 'today', TODAY)).toBe(true);
    expect(matchesFilter(task({ dueDate: '2026-08-13' }), 'today', TODAY)).toBe(false);
  });

  it('오늘 필터에 이미 지난 업무도 함께 보인다', () => {
    // 놓친 것을 숨기면 영영 못 본다.
    expect(matchesFilter(task({ dueDate: '2026-08-01' }), 'today', TODAY)).toBe(true);
  });

  it('이번 주 필터는 7일 이내를 보여 준다', () => {
    expect(matchesFilter(task({ dueDate: '2026-08-19' }), 'week', TODAY)).toBe(true);
    expect(matchesFilter(task({ dueDate: '2026-08-20' }), 'week', TODAY)).toBe(false);
  });

  it('완료한 업무는 날짜 필터에 걸리지 않는다', () => {
    expect(matchesFilter(task({ dueDate: TODAY, done: true }), 'today', TODAY)).toBe(false);
  });

  it('기한 없는 업무는 날짜 필터에 걸리지 않는다', () => {
    expect(matchesFilter(task({ dueDate: '' }), 'week', TODAY)).toBe(false);
    expect(matchesFilter(task({ dueDate: '' }), 'open', TODAY)).toBe(true);
  });

  it('진행 중·완료·전체 필터', () => {
    expect(matchesFilter(task({ done: false }), 'open', TODAY)).toBe(true);
    expect(matchesFilter(task({ done: true }), 'done', TODAY)).toBe(true);
    expect(matchesFilter(task({ done: true }), 'all', TODAY)).toBe(true);
  });
});

describe('compareTasks', () => {
  it('완료한 업무를 뒤로 보낸다', () => {
    const list = [task({ id: 'a', done: true }), task({ id: 'b', done: false })];

    expect([...list].sort(compareTasks).map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('기한이 가까운 순으로 놓는다', () => {
    const list = [
      task({ id: 'a', dueDate: '2026-08-20' }),
      task({ id: 'b', dueDate: '2026-08-13' }),
    ];

    expect([...list].sort(compareTasks).map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('기한 없는 업무를 뒤로 보낸다', () => {
    const list = [task({ id: 'a', dueDate: '' }), task({ id: 'b', dueDate: '2026-08-20' })];

    expect([...list].sort(compareTasks).map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('기한이 같으면 중요한 것을 먼저 놓는다', () => {
    const list = [
      task({ id: 'a', dueDate: TODAY, priority: 'low' }),
      task({ id: 'b', dueDate: TODAY, priority: 'high' }),
    ];

    expect([...list].sort(compareTasks).map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('summarizeTasks', () => {
  it('상태별 개수를 센다', () => {
    const tasks = [
      task({ id: 'a', dueDate: '2026-08-01' }),
      task({ id: 'b', dueDate: TODAY }),
      task({ id: 'c', dueDate: '2026-08-16' }),
      task({ id: 'd', dueDate: '2026-09-30' }),
      task({ id: 'e', done: true }),
    ];

    expect(summarizeTasks(tasks, TODAY)).toEqual({
      overdue: 1,
      today: 2,
      week: 3,
      open: 4,
      done: 1,
    });
  });

  it('업무가 없어도 0으로 센다', () => {
    expect(summarizeTasks([], TODAY)).toEqual({ overdue: 0, today: 0, week: 0, open: 0, done: 0 });
  });
});
