# 과제 화면 보강 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 과제 화면에 표 보기·학생별 보기를 더하고, 화면이 없어 죽어 있던 `Submission.note`와 `Assignment.description`을 되살린다.

**Architecture:** 셈은 전부 `assignmentCore.ts`의 순수 함수로, 저장은 기존 `useAssignment` 훅으로. 새 화면 둘은 각자 파일을 갖고 `AssignmentPage`가 `Tabs`로 묶는다.

**Tech Stack:** React 19 · TypeScript 5.8 (`strict`, `noUncheckedIndexedAccess`) · Tailwind 4 · Vitest + Testing Library

**설계:** [`../specs/2026-08-14-assignment-views-design.md`](../specs/2026-08-14-assignment-views-design.md)

## Global Constraints

- 기능 코드는 `localStorage`를 직접 부르지 않는다. 항상 `update()`를 거친다.
- `noUncheckedIndexedAccess`가 켜져 있다. `array[i]`는 `T | undefined`다.
- 색만으로 상태를 구분하지 않는다. 글자·색·`aria-label`을 함께 쓴다.
- 각 Task는 `npm run verify`가 통과해야 커밋한다.
- 현재 기준: 테스트 **388개** 통과.

**공유 `Table`을 쓰지 않는 이유:** 표 보기는 열 수가 과제 수만큼 변하고,
학생 이름 열이 `sticky left-0`이어야 하고, 칸이 눌리는 버튼이다.
`src/shared/ui/Table.tsx`는 `w-full` 고정 폭에 명렬표용이라 이 셋을 다 넣으면
호출자 하나만 쓰는 prop이 셋 늘어난다. 표 보기는 제 파일에서 `<table>`을 직접 그린다.

---

### Task 1: 순수 함수 — 인덱스와 학생별 집계

**Files:**
- Modify: `src/features/assignment/assignmentCore.ts`
- Test: `tests/assignment/assignmentCore.test.ts`

**Interfaces:**
- Produces: `SUBMISSION_SHORT`, `submissionIndex`, `statusFromIndex`, `StudentProgress`, `summarizeStudent`

- [ ] **Step 1: 실패 테스트를 쓴다**

`tests/assignment/assignmentCore.test.ts` 맨 아래에 붙인다. import에
`statusFromIndex` · `submissionIndex` · `summarizeStudent` · `SUBMISSION_SHORT`를,
타입 import에 `Assignment`를 더한다.

```ts
describe('submissionIndex · statusFromIndex', () => {
  it('기록이 없으면 미제출이다', () => {
    const index = submissionIndex([]);
    expect(statusFromIndex(index, 'a-1', 'stu-1')).toBe('unsubmitted');
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
    expect(result.counts).toEqual({
      unsubmitted: 1,
      submitted: 1,
      supplement: 1,
      completed: 0,
    });
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
    // TODAY는 2026-03-02. a-1은 기한이 지났고 a-2는 안 지났다.
    const result = summarizeStudent(student, tasks, [], TODAY);

    expect(result.overdueCount).toBe(1);
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
    const onlyOpen = [tasks[2]].filter((t) => t !== undefined);
    const result = summarizeStudent(student, onlyOpen, [], TODAY);

    expect(result.overdueCount).toBe(0);
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
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run tests/assignment/assignmentCore.test.ts
```

Expected: FAIL — 새 함수들이 export되지 않았다.

- [ ] **Step 3: 함수를 만든다**

`src/features/assignment/assignmentCore.ts`.

import에 `Assignment`는 이미 있다. 파일 맨 아래에 붙인다:

```ts
/** 표 보기 칸에 쓰는 한 글자. 과제 20개를 한 화면에 넣으려면 세 글자가 안 들어간다. */
export const SUBMISSION_SHORT: Record<SubmissionStatus, string> = {
  unsubmitted: '미',
  submitted: '제',
  supplement: '보',
  completed: '완',
};

/**
 * `assignmentId|studentId` → 상태.
 *
 * 표 보기는 학생 24명 × 과제 20개면 칸이 480개다. 칸마다 statusOf를 부르면
 * 배열을 480번 훑는다. 지금 학급 크기에서 느려지지는 않지만,
 * 이런 것은 나중에 원인을 찾기 어렵다.
 */
export function submissionIndex(
  submissions: readonly Submission[],
): Map<string, SubmissionStatus> {
  const index = new Map<string, SubmissionStatus>();

  for (const item of submissions) {
    const key = `${item.assignmentId}|${item.studentId}`;
    // 중복은 불변조건 검사가 막지만, 여기서도 먼저 것을 쓴다고 정해 둔다.
    if (!index.has(key)) index.set(key, item.status);
  }

  return index;
}

export function statusFromIndex(
  index: ReadonlyMap<string, SubmissionStatus>,
  assignmentId: string,
  studentId: string,
): SubmissionStatus {
  return index.get(`${assignmentId}|${studentId}`) ?? 'unsubmitted';
}

export interface StudentProgress {
  student: Student;
  counts: Record<SubmissionStatus, number>;
  total: number;
  /** 제출·완료로 끝난 과제 비율 0~1 */
  doneRatio: number;
  /** 기한이 지났는데 아직 안 낸 과제 수 */
  overdueCount: number;
}

/**
 * summarize를 학생 쪽으로 뒤집은 것.
 *
 * 같은 자료를 가로로 세느냐 세로로 세느냐의 차이라 셈법도 같게 맞춘다.
 * 보완은 끝난 것으로 세지 않는다.
 */
export function summarizeStudent(
  student: Student,
  assignments: readonly Assignment[],
  submissions: readonly Submission[],
  today: string,
): StudentProgress {
  const index = submissionIndex(submissions);

  const counts: Record<SubmissionStatus, number> = {
    unsubmitted: 0,
    submitted: 0,
    supplement: 0,
    completed: 0,
  };

  let overdueCount = 0;

  for (const assignment of assignments) {
    const status = statusFromIndex(index, assignment.id, student.id);
    counts[status] += 1;

    if (status === 'unsubmitted' || status === 'supplement') {
      const daysLeft = assignment.dueDate === '' ? null : daysBetween(today, assignment.dueDate);
      if (daysLeft !== null && daysLeft < 0) overdueCount += 1;
    }
  }

  const total = assignments.length;
  const done = counts.submitted + counts.completed;

  return {
    student,
    counts,
    total,
    doneRatio: total === 0 ? 0 : done / total,
    overdueCount,
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
npx vitest run tests/assignment/assignmentCore.test.ts
```

Expected: PASS

- [ ] **Step 5: 훅에 붙인다**

`src/features/assignment/useAssignment.ts`:

import를 바꾼다.

```ts
import {
  byDueDate,
  nextStatus,
  statusOf,
  submissionIndex,
  summarize,
  summarizeStudent,
  type AssignmentProgress,
  type StudentProgress,
} from './assignmentCore';
import type { SubmissionStatus } from '../../shared/domain/types';
```

(`SubmissionStatus`는 이미 있다. 위 import 목록에 `Map` 타입을 위해 새로 추가할 것은 없다.)

`AssignmentView`에 `progress` 다음 줄로 넣는다:

```ts
  /** 학생별 집계. 표 보기·학생별 보기가 쓴다. */
  studentProgress: StudentProgress[];
  /** `assignmentId|studentId` → 상태. 표 보기가 칸마다 배열을 훑지 않게 한다. */
  statusIndex: ReadonlyMap<string, SubmissionStatus>;
```

`progress` useMemo 다음에 넣는다:

```ts
  const statusIndex = useMemo(() => submissionIndex(submissions), [submissions]);

  const studentProgress = useMemo(
    () => roster.map((student) => summarizeStudent(student, assignments, submissions, today)),
    [roster, assignments, submissions, today],
  );
```

반환 객체에 `studentProgress,` · `statusIndex,`를 `progress,` 다음에 더한다.

- [ ] **Step 6: 검증 후 커밋**

```bash
npm run verify
```

Expected: PASS — 401 tests

```bash
git add -A && git commit -m "feat: 과제 학생별 집계와 제출 인덱스"
```

---

### Task 2: 표 보기

**Files:**
- Create: `src/features/assignment/AssignmentMatrix.tsx`
- Test: `tests/assignment/AssignmentMatrix.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `statusIndex` · `studentProgress` · `SUBMISSION_SHORT`
- Produces: `<AssignmentMatrix />` (props 없음. 훅에서 직접 읽는다)

- [ ] **Step 1: 컴포넌트를 만든다**

이 컴포넌트는 테스트가 `SuiteDataProvider` 전체를 세워야 해서
TDD 순서를 뒤집는다. 먼저 만들고 렌더 테스트로 확인한다.

`src/features/assignment/AssignmentMatrix.tsx`:

```tsx
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
 * 과제별 탭은 과제 하나씩만 보여 준다. 누가 여러 개 밀렸는지는 그렇게 볼 수 없다.
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
        description="과제를 등록하면 학생과 과제를 한 화면에서 볼 수 있습니다."
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
                          'h-8 w-full rounded-control border border-slate-200 font-medium hover:border-slate-400',
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
```

- [ ] **Step 2: 렌더 테스트를 쓴다**

`tests/assignment/AssignmentMatrix.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { AssignmentMatrix } from '../../src/features/assignment/AssignmentMatrix';
import {
  createAssignment,
  createClassRoom,
  createEmptySuiteData,
  createStudent,
  createSubmission,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

const NOW = '2026-03-02T09:00:00.000Z';

function seeded(): SuiteData {
  const term = createTerm(
    { schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    NOW,
  );
  const room = createClassRoom({ termId: term.id, name: '우리 반' }, NOW);

  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room],
    students: [
      createStudent({ id: 'stu-1', classId: room.id, number: 1, name: '김하나' }, NOW),
      createStudent({ id: 'stu-2', classId: room.id, number: 2, name: '이두리' }, NOW),
    ],
    assignments: [
      createAssignment({ id: 'a-1', classId: room.id, title: '독서록', dueDate: '2026-03-10' }, NOW),
      createAssignment({ id: 'a-2', classId: room.id, title: '일기', dueDate: '' }, NOW),
    ],
    submissions: [createSubmission('a-1', 'stu-1', 'submitted', NOW)],
    activeTermId: term.id,
    activeClassId: room.id,
  };
}

async function renderMatrix(): Promise<void> {
  render(
    <ToastProvider>
      <SuiteDataProvider adapter={stubAdapter(seeded())}>
        <AssignmentMatrix />
      </SuiteDataProvider>
    </ToastProvider>,
  );

  await screen.findByRole('table');
}

describe('AssignmentMatrix', () => {
  it('학생 수 × 과제 수만큼 칸이 그려진다', async () => {
    await renderMatrix();

    const cells = screen.getAllByRole('button');
    expect(cells).toHaveLength(4);
  });

  it('칸의 이름표에 학생·과제·상태가 줄임 없이 들어간다', async () => {
    await renderMatrix();

    expect(screen.getByLabelText('김하나, 독서록, 제출')).toBeTruthy();
    expect(screen.getByLabelText('이두리, 독서록, 미제출')).toBeTruthy();
    expect(screen.getByLabelText('김하나, 일기, 미제출')).toBeTruthy();
  });

  it('칸에는 한 글자만 보인다', async () => {
    await renderMatrix();

    expect(screen.getByLabelText('김하나, 독서록, 제출').textContent).toBe('제');
    expect(screen.getByLabelText('이두리, 독서록, 미제출').textContent).toBe('미');
  });

  it('학생 이름 열이 스크롤을 따라다닌다', async () => {
    await renderMatrix();

    const row = screen.getByRole('row', { name: /김하나/ });
    const header = within(row).getByRole('rowheader');
    expect(header.className).toContain('sticky');
  });

  it('행 끝에 그 학생이 낸 수가 나온다', async () => {
    await renderMatrix();

    const row = screen.getByRole('row', { name: /김하나/ });
    expect(within(row).getByText('1/2')).toBeTruthy();
  });
});
```

- [ ] **Step 3: 실행한다**

```bash
npx vitest run tests/assignment/AssignmentMatrix.test.tsx
```

Expected: PASS. `stubAdapter`의 정확한 시그니처는 `tests/helpers/stubAdapter.ts`를
읽어 맞춘다. 다른 인자를 받으면 그쪽에 맞춘다.

- [ ] **Step 4: 커밋**

```bash
npm run verify && git add -A && git commit -m "feat: 과제 표 보기"
```

---

### Task 3: 학생별 보기와 보완 사유

**Files:**
- Create: `src/features/assignment/StudentAssignments.tsx`
- Test: `tests/assignment/StudentAssignments.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `studentProgress`, 기존 훅의 `setNote` · `cycleStatus` · `statusFor`
- Produces: `<StudentAssignments />`

- [ ] **Step 1: 컴포넌트를 만든다**

`src/features/assignment/StudentAssignments.tsx`:

```tsx
import { ClipboardCheck, Users } from 'lucide-react';
import { useState } from 'react';

import type { SubmissionStatus } from '../../shared/domain/types';
import { Badge, Card, cx, EmptyState } from '../../shared/ui';
import { SUBMISSION_LABELS } from './assignmentCore';
import { useAssignment } from './useAssignment';

const STATUS_TONE: Record<SubmissionStatus, string> = {
  unsubmitted: 'border-slate-200 bg-white text-slate-500',
  submitted: 'border-success-200 bg-success-50 text-success-700',
  supplement: 'border-warning-200 bg-warning-50 text-warning-700',
  completed: 'border-brand-200 bg-brand-50 text-brand-700',
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
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
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
          }
        >
          <ul className="flex flex-col gap-2">
            {assignment.assignments.map((item) => {
              const status = assignment.statusFor(item.id, selected.student.id);
              const note =
                assignment.submissions.find(
                  (s) => s.assignmentId === item.id && s.studentId === selected.student.id,
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
                      'h-8 w-16 shrink-0 rounded-control border text-sm font-medium',
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
```

- [ ] **Step 2: 테스트를 쓴다**

`tests/assignment/StudentAssignments.test.tsx`. Task 2의 `seeded()`와
`stubAdapter` 사용법을 그대로 가져다 쓴다(복사해 붙인다 — 테스트 파일끼리
헬퍼를 공유하면 한쪽 fixture를 고칠 때 다른 쪽이 조용히 바뀐다).

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StudentAssignments } from '../../src/features/assignment/StudentAssignments';
/* …seeded()·renderPanel()은 AssignmentMatrix.test.tsx와 같은 방식… */

describe('StudentAssignments', () => {
  it('고른 학생의 과제가 전부 나온다', async () => {
    await renderPanel();

    expect(screen.getByLabelText('독서록 제출')).toBeTruthy();
    expect(screen.getByLabelText('일기 미제출')).toBeTruthy();
  });

  it('보완 사유를 적으면 저장된다', async () => {
    await renderPanel();

    const input = screen.getByLabelText('독서록 보완 사유');
    fireEvent.change(input, { target: { value: '분량 부족' } });

    expect((screen.getByLabelText('독서록 보완 사유') as HTMLInputElement).value).toBe('분량 부족');
  });

  it('지연이 있으면 학생 칩에 표시한다', async () => {
    await renderPanel();

    // seeded()에서 이두리는 기한 지난 독서록을 안 냈다.
    expect(screen.getByText(/지연/)).toBeTruthy();
  });
});
```

`seeded()`의 `today`가 `2026-03-02`이고 `a-1`의 기한이 `2026-03-10`이라
지연이 안 생긴다. 이 테스트 파일의 `seeded()`에서는 `a-1`의 `dueDate`를
`2026-02-01`로 바꾼다. `useAssignment`는 실제 오늘 날짜를 쓰므로,
**과거 날짜를 써야 어느 날 실행해도 지연이 된다.**

- [ ] **Step 3: 실행하고 커밋**

```bash
npx vitest run tests/assignment/StudentAssignments.test.tsx
npm run verify && git add -A && git commit -m "feat: 과제 학생별 보기와 보완 사유 입력"
```

---

### Task 4: 탭 배선과 과제 안내 표시

**Files:**
- Modify: `src/features/assignment/AssignmentPage.tsx`

- [ ] **Step 1: 탭으로 묶는다**

import에 `Tabs`를 더하고, 새 컴포넌트 둘을 가져온다.

```tsx
import { AssignmentMatrix } from './AssignmentMatrix';
import { StudentAssignments } from './StudentAssignments';
```

`useState`에 추가:

```tsx
type AssignmentTab = 'byTask' | 'matrix' | 'byStudent';
```

```tsx
  const [tab, setTab] = useState<AssignmentTab>('byTask');
```

헤더(`<h1>`과 버튼 줄) 아래 전체를 `Tabs`로 감싼다:

```tsx
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
          <>{/* 지금 있는 과제별 내용 전체 */}</>
        )}
      </Tabs>
```

`AddAssignmentModal`과 두 `ConfirmDialog`는 `Tabs` **밖**에 남긴다.
탭을 바꿔도 열려 있던 모달이 사라지면 안 된다.

- [ ] **Step 2: 과제 안내를 보여 준다**

고른 과제 카드에서, 상태 뱃지 줄(`<div className="mb-3 flex flex-wrap gap-2">`) **앞**에 넣는다:

```tsx
              {selected.assignment.description === '' ? null : (
                <p className="mb-3 rounded-control bg-slate-50 px-3 py-2 text-sm whitespace-pre-wrap text-slate-600">
                  {selected.assignment.description}
                </p>
              )}
```

`whitespace-pre-wrap`을 쓴다. 교사가 줄바꿈해 적은 안내가 한 줄로 붙으면 안 된다.

- [ ] **Step 3: 검증하고 커밋**

```bash
npm run verify
```

브라우저에서 확인한다: 탭 셋이 뜨고, 표 보기 칸을 누르면 상태가 돌고,
학생별에서 보완 사유가 저장되고, 과제 안내가 보인다.
`read_console_messages`로 오류를 본다.

```bash
git add -A && git commit -m "feat: 과제 화면 탭 셋과 안내 표시"
```

---

### Task 5: 점검 문서 갱신

**Files:**
- Modify: `docs/reference/missing-features-audit.md`

- [ ] **Step 1: B 목록과 발견 사항을 적는다**

`과제 표(Matrix) 보기`·`과제 학생별 요약` 두 줄을 `**완료 2026-08-14**`로 바꾸고,
`B-5. 작업 중 발견한 기존 결함` 표에 두 줄을 더한다.

| 곳 | 문제 |
|---|---|
| `Assignment.description` | 추가 모달이 '안내'로 입력을 받는데 어디에도 안 보였다. **묶음 3에서 고침** |
| `Submission.note` | `setNote`가 훅에 있는데 부르는 화면이 없었다. **묶음 3에서 고침** |
| `Assignment.status` | `closed`·`archived`가 있고 `updateAssignment`도 있는데 부르는 곳이 없다. 과제는 만들면 영원히 `active`다. 과제 목록 관리 화면이 필요하다 — **미해결** |

- [ ] **Step 2: 커밋**

```bash
git add -A && git commit -m "docs: 묶음 3 완료 반영"
```

---

## Self-Review

**1. 스펙 대응**

| 스펙 절 | Task |
|---|---|
| §2 탭 셋 | Task 4 |
| §3 표 보기 (한 글자·sticky·합계) | Task 2 |
| §4 학생별 + 보완 사유 | Task 3 |
| §5 과제 안내 | Task 4 Step 2 |
| §6 순수 함수 | Task 1 |
| §7 범위 밖 (과제 마감) | Task 5 문서 |
| §8 테스트 | 각 Task |

**2. 빠뜨리기 쉬운 것**

- `useAssignment`의 `today`는 **실제 오늘**이다. 지연을 검증하는 테스트는
  과거 날짜를 fixture에 써야 어느 날 실행해도 통과한다.
- 모달·확인창을 `Tabs` 안에 넣으면 탭 전환 때 사라진다. 밖에 둔다.
- `summarizeStudent`와 `summarize`는 **같은 셈법**이어야 한다. 보완은 미완료다.

**3. 검증 지점**

| Task 후 | 테스트 수 |
|---|---|
| 시작 | 388 |
| 1 | 401 |
| 2 | 406 |
| 3 | 409 |
| 4 | 409 |
