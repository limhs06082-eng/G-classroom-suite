import { describe, expect, it } from 'vitest';

import {
  archivedAssignments,
  byDueDate,
  daysBetween,
  nextStatus,
  statusFromIndex,
  statusOf,
  submissionIndex,
  summarize,
  summarizeStudent,
  SUBMISSION_SHORT,
  visibleAssignments,
} from '../../src/features/assignment/assignmentCore';
import { createAssignment, createStudent, createSubmission } from '../../src/shared/domain/factories';
import type { Assignment, Student, Submission } from '../../src/shared/domain/types';

const NOW = '2026-03-02T09:00:00.000Z';
const TODAY = '2026-03-02';

function roster(count: number): Student[] {
  return Array.from({ length: count }, (_, i) =>
    createStudent({ id: `stu-${i + 1}`, classId: 'class-1', number: i + 1, name: `학생${i + 1}` }, NOW),
  );
}

const task = (dueDate = '') =>
  createAssignment({ id: 'a-1', classId: 'class-1', title: '독서록', dueDate }, NOW);

function subs(list: Array<[string, Submission['status']]>): Submission[] {
  return list.map(([studentId, status]) => createSubmission('a-1', studentId, status, NOW));
}

describe('nextStatus', () => {
  it('누를 때마다 미제출 → 제출 → 보완 → 완료 → 미제출로 돈다', () => {
    expect(nextStatus('unsubmitted')).toBe('submitted');
    expect(nextStatus('submitted')).toBe('supplement');
    expect(nextStatus('supplement')).toBe('completed');
    expect(nextStatus('completed')).toBe('unsubmitted');
  });
});

describe('statusOf', () => {
  it('기록이 없으면 미제출이다', () => {
    // 기록을 미리 만들지 않는 설계. 학생이 늘어도 맞출 것이 없다.
    expect(statusOf([], 'a-1', 'stu-1')).toBe('unsubmitted');
  });

  it('기록이 있으면 그 상태를 쓴다', () => {
    expect(statusOf(subs([['stu-1', 'completed']]), 'a-1', 'stu-1')).toBe('completed');
  });

  it('다른 과제의 기록과 섞이지 않는다', () => {
    const other = createSubmission('a-2', 'stu-1', 'completed', NOW);

    expect(statusOf([other], 'a-1', 'stu-1')).toBe('unsubmitted');
  });
});

describe('daysBetween', () => {
  it('남은 일수를 센다', () => {
    expect(daysBetween('2026-03-02', '2026-03-05')).toBe(3);
    expect(daysBetween('2026-03-05', '2026-03-02')).toBe(-3);
    expect(daysBetween('2026-03-02', '2026-03-02')).toBe(0);
  });

  it('월을 넘어가도 정확하다', () => {
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3);
  });

  it('읽을 수 없는 날짜는 null', () => {
    expect(daysBetween('아무거나', '2026-03-02')).toBeNull();
  });
});

describe('summarize', () => {
  it('상태별 인원을 센다', () => {
    const progress = summarize(
      task(),
      roster(4),
      subs([
        ['stu-1', 'submitted'],
        ['stu-2', 'completed'],
        ['stu-3', 'supplement'],
      ]),
      TODAY,
    );

    expect(progress.counts).toEqual({ unsubmitted: 1, submitted: 1, supplement: 1, completed: 1 });
    expect(progress.total).toBe(4);
  });

  it('보완은 끝난 것으로 세지 않는다', () => {
    // 보완은 다시 내야 하는 상태다. 완료율에 넣으면 교사가 놓친다.
    const progress = summarize(task(), roster(2), subs([['stu-1', 'supplement']]), TODAY);

    expect(progress.doneRatio).toBe(0);
  });

  it('기한이 지났는데 안 낸 학생이 있으면 지연으로 표시한다', () => {
    const progress = summarize(task('2026-03-01'), roster(2), subs([['stu-1', 'completed']]), TODAY);

    expect(progress.daysLeft).toBe(-1);
    expect(progress.isOverdue).toBe(true);
  });

  it('기한이 지나도 전원이 냈으면 지연이 아니다', () => {
    const progress = summarize(
      task('2026-03-01'),
      roster(2),
      subs([
        ['stu-1', 'completed'],
        ['stu-2', 'submitted'],
      ]),
      TODAY,
    );

    expect(progress.isOverdue).toBe(false);
  });

  it('보완 상태가 남아 있으면 기한 후에는 지연이다', () => {
    const progress = summarize(
      task('2026-03-01'),
      roster(2),
      subs([
        ['stu-1', 'completed'],
        ['stu-2', 'supplement'],
      ]),
      TODAY,
    );

    expect(progress.isOverdue).toBe(true);
  });

  it('기한이 없으면 남은 일수도 지연도 없다', () => {
    const progress = summarize(task(), roster(2), [], TODAY);

    expect(progress.daysLeft).toBeNull();
    expect(progress.isOverdue).toBe(false);
  });

  it('학생이 없어도 나눗셈이 깨지지 않는다', () => {
    const progress = summarize(task(), [], [], TODAY);

    expect(progress.doneRatio).toBe(0);
    expect(Number.isNaN(progress.doneRatio)).toBe(false);
  });
});

describe('byDueDate', () => {
  it('마감이 가까운 순으로 정렬한다', () => {
    const a = createAssignment({ id: 'a', classId: 'c', title: 'A', dueDate: '2026-03-10' }, NOW);
    const b = createAssignment({ id: 'b', classId: 'c', title: 'B', dueDate: '2026-03-05' }, NOW);

    expect([a, b].sort(byDueDate).map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('기한 없는 과제는 뒤로 보낸다', () => {
    const dated = createAssignment({ id: 'a', classId: 'c', title: 'A', dueDate: '2026-03-10' }, NOW);
    const undated = createAssignment({ id: 'b', classId: 'c', title: 'B' }, NOW);

    expect([undated, dated].sort(byDueDate).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('submissionIndex · statusFromIndex', () => {
  it('기록이 없으면 미제출이다', () => {
    expect(statusFromIndex(submissionIndex([]), 'a-1', 'stu-1')).toBe('unsubmitted');
  });

  it('기록한 상태를 그대로 돌려준다', () => {
    const index = submissionIndex(subs([['stu-1', 'submitted'], ['stu-2', 'supplement']]));

    expect(statusFromIndex(index, 'a-1', 'stu-1')).toBe('submitted');
    expect(statusFromIndex(index, 'a-1', 'stu-2')).toBe('supplement');
    expect(statusFromIndex(index, 'a-1', 'stu-3')).toBe('unsubmitted');
  });

  it('같은 학생·과제 기록이 둘이면 먼저 것을 쓴다', () => {
    const index = submissionIndex([
      createSubmission('a-1', 'stu-1', 'submitted', NOW),
      createSubmission('a-1', 'stu-1', 'completed', NOW),
    ]);

    expect(statusFromIndex(index, 'a-1', 'stu-1')).toBe('submitted');
  });

  it('과제가 다르면 섞이지 않는다', () => {
    const index = submissionIndex([
      createSubmission('a-1', 'stu-1', 'submitted', NOW),
      createSubmission('a-2', 'stu-1', 'completed', NOW),
    ]);

    expect(statusFromIndex(index, 'a-1', 'stu-1')).toBe('submitted');
    expect(statusFromIndex(index, 'a-2', 'stu-1')).toBe('completed');
  });
});

describe('summarizeStudent', () => {
  const student = createStudent(
    { id: 'stu-1', classId: 'class-1', number: 1, name: '학생1' },
    NOW,
  );

  // TODAY는 2026-03-02. a-1은 기한이 지났고 a-2는 안 지났다.
  const tasks: Assignment[] = [
    createAssignment({ id: 'a-1', classId: 'class-1', title: '독서록', dueDate: '2026-03-01' }, NOW),
    createAssignment({ id: 'a-2', classId: 'class-1', title: '일기', dueDate: '2026-03-10' }, NOW),
    createAssignment({ id: 'a-3', classId: 'class-1', title: '자유', dueDate: '' }, NOW),
  ];

  it('상태별로 센다', () => {
    const result = summarizeStudent(
      student,
      tasks,
      [
        createSubmission('a-1', 'stu-1', 'submitted', NOW),
        createSubmission('a-2', 'stu-1', 'supplement', NOW),
      ],
      TODAY,
    );

    expect(result.total).toBe(3);
    expect(result.counts).toEqual({ unsubmitted: 1, submitted: 1, supplement: 1, completed: 0 });
  });

  it('보완은 끝난 것으로 세지 않는다 — summarize와 같은 셈법', () => {
    const result = summarizeStudent(
      student,
      tasks,
      [
        createSubmission('a-1', 'stu-1', 'submitted', NOW),
        createSubmission('a-2', 'stu-1', 'supplement', NOW),
        createSubmission('a-3', 'stu-1', 'completed', NOW),
      ],
      TODAY,
    );

    expect(result.doneRatio).toBeCloseTo(2 / 3);
  });

  it('기한이 지났는데 안 낸 과제만 지연으로 센다', () => {
    expect(summarizeStudent(student, tasks, [], TODAY).overdueCount).toBe(1);
  });

  it('보완도 아직 안 낸 것으로 보고 지연에 넣는다', () => {
    const result = summarizeStudent(
      student,
      tasks,
      [createSubmission('a-1', 'stu-1', 'supplement', NOW)],
      TODAY,
    );

    expect(result.overdueCount).toBe(1);
  });

  it('기한이 지나도 냈으면 지연이 아니다', () => {
    const result = summarizeStudent(
      student,
      tasks,
      [createSubmission('a-1', 'stu-1', 'submitted', NOW)],
      TODAY,
    );

    expect(result.overdueCount).toBe(0);
  });

  it('기한 없는 과제는 지연이 아니다', () => {
    const onlyOpen = tasks.filter((task) => task.dueDate === '');

    expect(summarizeStudent(student, onlyOpen, [], TODAY).overdueCount).toBe(0);
  });

  it('과제가 없으면 0으로 나누지 않는다', () => {
    const result = summarizeStudent(student, [], [], TODAY);

    expect(result.total).toBe(0);
    expect(result.doneRatio).toBe(0);
    expect(result.overdueCount).toBe(0);
  });
});

describe('SUBMISSION_SHORT', () => {
  it('네 상태가 모두 한 글자다', () => {
    expect(Object.values(SUBMISSION_SHORT)).toEqual(['미', '제', '보', '완']);
  });
});

describe('visibleAssignments · archivedAssignments', () => {
  const list = [
    createAssignment({ id: 'a-1', classId: 'class-1', title: '진행', status: 'active' }, NOW),
    createAssignment({ id: 'a-2', classId: 'class-1', title: '마감', status: 'closed' }, NOW),
    createAssignment({ id: 'a-3', classId: 'class-1', title: '보관', status: 'archived' }, NOW),
  ];

  it('보관한 것만 갈라진다', () => {
    expect(visibleAssignments(list).map((item) => item.id)).toEqual(['a-1', 'a-2']);
    expect(archivedAssignments(list).map((item) => item.id)).toEqual(['a-3']);
  });

  it('마감은 보이는 쪽에 남는다', () => {
    // 마감은 '더 안 받는다'는 표시지 '안 보인다'가 아니다.
    expect(visibleAssignments(list).some((item) => item.status === 'closed')).toBe(true);
  });

  it('원본 순서를 지킨다', () => {
    const shuffled = [list[2], list[0], list[1]].filter((item) => item !== undefined);

    expect(visibleAssignments(shuffled).map((item) => item.id)).toEqual(['a-1', 'a-2']);
  });
});

describe('마감한 과제는 지연이 아니다', () => {
  const OVERDUE = '2026-03-01'; // TODAY(2026-03-02)보다 하루 전

  const student = createStudent(
    { id: 'stu-1', classId: 'class-1', number: 1, name: '학생1' },
    NOW,
  );

  const withStatus = (status: Assignment['status']): Assignment =>
    createAssignment({ id: 'a-1', classId: 'class-1', title: '독서록', dueDate: OVERDUE, status }, NOW);

  it('summarize — 진행 중이면 지연이다', () => {
    expect(summarize(withStatus('active'), roster(3), [], TODAY).isOverdue).toBe(true);
  });

  it('summarize — 마감하면 지연이 아니다', () => {
    expect(summarize(withStatus('closed'), roster(3), [], TODAY).isOverdue).toBe(false);
  });

  it('summarize — 보관해도 지연이 아니다', () => {
    expect(summarize(withStatus('archived'), roster(3), [], TODAY).isOverdue).toBe(false);
  });

  it('summarizeStudent — 마감한 과제는 지연으로 세지 않는다', () => {
    expect(summarizeStudent(student, [withStatus('active')], [], TODAY).overdueCount).toBe(1);
    expect(summarizeStudent(student, [withStatus('closed')], [], TODAY).overdueCount).toBe(0);
  });

  it('마감해도 미제출 수는 그대로 센다', () => {
    // 지연이 아닐 뿐, 누가 안 냈는지는 여전히 봐야 한다.
    const result = summarize(withStatus('closed'), roster(3), [], TODAY);

    expect(result.counts.unsubmitted).toBe(3);
  });
});
