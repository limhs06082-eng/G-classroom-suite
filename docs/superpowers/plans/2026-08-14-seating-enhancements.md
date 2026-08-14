# 자리·모둠 강화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 원본 `G-seat-group-maker`에 있었으나 통합 때 빠진 교사 시점 전환·균형 모둠 편성·자리표 저장을 되살린다.

**Architecture:** 좌석 뒤집기·균형 배분·자리표 조작을 전부 순수 함수로 만들고 화면은 배선만 한다. 저장은 기존대로 `useSuite().update`를 거친다.

**Tech Stack:** React 19 · TypeScript 5.8 (`strict`, `noUncheckedIndexedAccess`) · Tailwind 4 · Vitest + Testing Library

**설계:** [`../specs/2026-08-14-seating-enhancements-design.md`](../specs/2026-08-14-seating-enhancements-design.md)

## Global Constraints

- 기능 코드는 `localStorage`를 직접 부르지 않는다. 항상 `StorageAdapter` / `update()`를 거친다.
- `noUncheckedIndexedAccess`가 켜져 있다. `array[i]`는 `T | undefined`다.
- optional 필드에 "없음"을 넣을 때는 `null`이 아니라 **키를 뺀다.**
- 각 Task는 `npm run verify`(tsc + eslint + vitest + build)가 통과해야 커밋한다.
- 새 화면 문구는 존댓말 한국어. 교사가 읽는다.
- 현재 기준: 테스트 **352개** 통과.

---

### Task 1: 교사 시점 — 모델·순수 함수·그리기

**Files:**
- Modify: `src/shared/domain/types.ts` (`SeatingState`)
- Modify: `src/shared/domain/factories.ts:142` (`createSeatingState`)
- Modify: `src/shared/storage/schema.ts:242` (`parseSeatingState`)
- Modify: `src/features/seating/types.ts` (`flipSeats` 추가)
- Modify: `src/features/seating/ClassroomGrid.tsx`
- Modify: `tests/roster/classOps.test.ts:55-58` (필수 필드가 늘어 fixture가 깨진다)
- Test: `tests/seating/flipSeats.test.ts` (신규)
- Test: `tests/seating/ClassroomGrid.test.tsx` (신규)

**Interfaces:**
- Produces: `SeatingPerspective`, `SEATING_PERSPECTIVES`, `SeatingState.perspective`, `flipSeats(seats)`, `ClassroomGrid`의 `perspective?: SeatingPerspective` prop

- [ ] **Step 1: `flipSeats` 실패 테스트를 쓴다**

`tests/seating/flipSeats.test.ts` 생성:

```ts
import { describe, expect, it } from 'vitest';

import { buildSeats, flipSeats, seatId } from '../../src/features/seating/types';

describe('flipSeats', () => {
  it('행과 열이 함께 뒤집혀 첫 좌석이 마지막이 된다', () => {
    const seats = buildSeats(4, 5, []);
    const flipped = flipSeats(seats);

    expect(flipped).toHaveLength(20);
    expect(flipped[0]?.id).toBe(seatId(4, 5));
    expect(flipped[1]?.id).toBe(seatId(4, 4));
    expect(flipped[19]?.id).toBe(seatId(1, 1));
  });

  it('열이 홀수여도 맞는다', () => {
    const flipped = flipSeats(buildSeats(2, 3, []));

    expect(flipped.map((seat) => seat.id)).toEqual([
      seatId(2, 3),
      seatId(2, 2),
      seatId(2, 1),
      seatId(1, 3),
      seatId(1, 2),
      seatId(1, 1),
    ]);
  });

  it('사용 안 함 표시는 좌석을 따라간다', () => {
    const flipped = flipSeats(buildSeats(2, 2, [seatId(1, 1)]));

    expect(flipped.find((seat) => seat.id === seatId(1, 1))?.isDisabled).toBe(true);
    expect(flipped.find((seat) => seat.id === seatId(2, 2))?.isDisabled).toBe(false);
  });

  it('id·row·column 값은 바꾸지 않는다', () => {
    const flipped = flipSeats(buildSeats(2, 2, []));
    const first = flipped[0];

    expect(first?.id).toBe(seatId(2, 2));
    expect(first?.row).toBe(2);
    expect(first?.column).toBe(2);
  });

  it('원본 배열을 건드리지 않는다', () => {
    const seats = buildSeats(2, 2, []);
    flipSeats(seats);

    expect(seats[0]?.id).toBe(seatId(1, 1));
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run tests/seating/flipSeats.test.ts
```

Expected: FAIL — `flipSeats` is not exported.

- [ ] **Step 3: `flipSeats`를 만든다**

`src/features/seating/types.ts` 끝에 추가:

```ts
/**
 * 좌석 배열을 교탁에서 본 순서로 뒤집는다.
 *
 * buildSeats가 행 우선(1행 1열 → 1행 n열 → 2행 1열 …)으로 만들고
 * ClassroomGrid가 그 순서대로 그린다. 그래서 배열을 통째로 뒤집으면
 * 행과 열이 함께 뒤집혀 정확히 180도 회전이 된다.
 *
 * seat.id·row·column 값은 건드리지 않는다. 좌석 클릭도 저장된 positions도
 * id로 이어져 있어서, 값까지 바꾸면 누른 자리와 앉는 자리가 어긋난다.
 */
export function flipSeats(seats: readonly Seat[]): Seat[] {
  return [...seats].reverse();
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
npx vitest run tests/seating/flipSeats.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: `SeatingState`에 `perspective`를 더한다**

`src/shared/domain/types.ts` — `StudentPosition` 아래, `SeatingState` 위에 추가:

```ts
export const SEATING_PERSPECTIVES = ['student', 'teacher'] as const;

/**
 * 자리표를 어느 방향으로 볼지.
 *
 * 'student'는 학생이 앉아서 보는 방향(칠판이 위), 'teacher'는 교탁에서
 * 학생들을 마주 본 방향(칠판이 아래, 좌우도 뒤집힌다)이다.
 */
export type SeatingPerspective = (typeof SEATING_PERSPECTIVES)[number];
```

`SeatingState`에 필드를 넣는다:

```ts
export interface SeatingState {
  classId: string;
  rows: number;
  cols: number;
  /** 책상이 없거나 쓰지 않는 자리 */
  disabledSeatIds: string[];
  positions: StudentPosition[];
  /** 교사 화면에서만 쓴다. 전자칠판은 학생이 보는 화면이라 항상 학생 시점이다. */
  perspective: SeatingPerspective;
  updatedAt: string;
}
```

- [ ] **Step 6: 만들기·읽기 두 곳을 맞춘다**

`src/shared/domain/factories.ts` `createSeatingState`에 `perspective: 'student',`를 `positions: []` 다음 줄에 추가한다.

`src/shared/storage/schema.ts` `parseSeatingState`의 반환 객체에 추가한다 (`positions,` 다음 줄):

```ts
    perspective: oneOf(raw['perspective'], SEATING_PERSPECTIVES, 'student'),
```

`schema.ts` 상단 `../domain/types` import 목록에 `SEATING_PERSPECTIVES`를 값으로 추가한다. (기존 `type SeatingState`는 타입 전용이므로 `SEATING_PERSPECTIVES,`는 `type` 없이 넣는다.)

- [ ] **Step 7: 깨진 fixture를 고친다**

`tests/roster/classOps.test.ts:55-58`의 두 줄에 `perspective: 'student',`를 넣는다:

```ts
    seatingStates: [
      { classId: mine.id, rows: 4, cols: 5, disabledSeatIds: [], positions: [], perspective: 'student', updatedAt: NOW },
      { classId: other.id, rows: 4, cols: 5, disabledSeatIds: [], positions: [], perspective: 'student', updatedAt: NOW },
    ],
```

- [ ] **Step 8: 타입과 전체 테스트를 확인한다**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: PASS — 357 tests (352 + flipSeats 5)

- [ ] **Step 9: `ClassroomGrid` 실패 테스트를 쓴다**

`tests/seating/ClassroomGrid.test.tsx` 생성:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ClassroomGrid } from '../../src/features/seating/ClassroomGrid';
import { buildSeats } from '../../src/features/seating/types';
import type { Student } from '../../src/shared/domain/types';

const NOW = '2026-08-14T09:00:00.000Z';

function student(id: string, number: number, name: string): Student {
  return {
    id,
    classId: 'class-1',
    number,
    name,
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** 좌석 칸의 aria-label을 그려진 순서대로 모은다. */
function seatLabels(): string[] {
  return screen
    .getAllByLabelText(/행 \d+열/)
    .map((element) => element.getAttribute('aria-label') ?? '');
}

describe('ClassroomGrid 시점', () => {
  const seats = buildSeats(2, 2, []);
  const studentBySeat = new Map([['r1c1', student('s-1', 1, '김하나')]]);

  it('기본값은 학생 시점이다 — 1행 1열이 먼저 그려진다', () => {
    render(
      <ClassroomGrid
        seats={seats}
        cols={2}
        studentBySeat={studentBySeat}
        lockedStudentIds={new Set()}
      />,
    );

    expect(seatLabels()[0]).toContain('1행 1열');
    expect(seatLabels()[3]).toContain('2행 2열');
  });

  it('교사 시점이면 순서가 뒤집힌다', () => {
    render(
      <ClassroomGrid
        seats={seats}
        cols={2}
        studentBySeat={studentBySeat}
        lockedStudentIds={new Set()}
        perspective="teacher"
      />,
    );

    expect(seatLabels()[0]).toContain('2행 2열');
    expect(seatLabels()[3]).toContain('1행 1열');
  });

  it('교사 시점이면 칠판이 아래로 간다', () => {
    const { container } = render(
      <ClassroomGrid
        seats={seats}
        cols={2}
        studentBySeat={studentBySeat}
        lockedStudentIds={new Set()}
        perspective="teacher"
      />,
    );

    expect(container.firstElementChild?.className).toContain('flex-col-reverse');
  });
});
```

- [ ] **Step 10: 실패를 확인한다**

```bash
npx vitest run tests/seating/ClassroomGrid.test.tsx
```

Expected: FAIL — `perspective` prop이 없어 순서가 그대로다.

- [ ] **Step 11: `ClassroomGrid`에 `perspective`를 단다**

`src/features/seating/ClassroomGrid.tsx`:

import 줄을 바꾼다.

```tsx
import type { SeatingPerspective, Student } from '../../shared/domain/types';
import { cx } from '../../shared/ui';
import { flipSeats, type Seat } from './types';
```

`Props`에 추가한다 (`showNumbers` 위):

```tsx
  /** 'teacher'면 교탁에서 본 방향으로 뒤집어 그린다. 전자칠판은 넘기지 않는다. */
  perspective?: SeatingPerspective;
```

함수 시그니처의 기본값 목록에 `perspective = 'student',`를 넣고, `const isBoard` 아래에 두 줄을 더한다:

```tsx
  const isBoard = scale === 'board';
  const isTeacher = perspective === 'teacher';

  /*
   * 칠판 막대는 DOM 순서를 그대로 두고 flex-col-reverse로 아래에 보낸다.
   * 좌석은 배열을 뒤집는다. 둘이 함께여야 180도 회전이 완성된다.
   */
  const ordered = isTeacher ? flipSeats(seats) : seats;
```

바깥 `div`의 className을 바꾼다:

```tsx
    <div
      className={cx(
        'flex items-center gap-3',
        isTeacher ? 'flex-col-reverse' : 'flex-col',
      )}
    >
```

`{seats.map((seat) => {`를 `{ordered.map((seat) => {`로 바꾼다.

- [ ] **Step 12: 통과를 확인한다**

```bash
npx vitest run tests/seating/ClassroomGrid.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 13: 전체 검증 후 커밋**

```bash
npm run verify
```

Expected: PASS — 360 tests

```bash
git add -A && git commit -m "feat: 자리표 교사 시점 전환"
```

---

### Task 2: 균형 모둠 편성

**Files:**
- Modify: `src/features/seating/groupingCore.ts`
- Modify: `src/features/seating/useGrouping.ts`
- Test: `tests/seating/groupingCore.test.ts`

**Interfaces:**
- Consumes: 없음 (Task 1과 독립)
- Produces: `BalancedInput`, `performBalancedGrouping(students, classId, targetGroupCount, existingGroups, lockedStudentIds, now, rng?): GroupingResult`, `GroupingView.balanceGroups(targetCount): { lockCleared: boolean }`

- [ ] **Step 1: 실패 테스트를 쓴다**

`tests/seating/groupingCore.test.ts` 맨 아래에 추가한다. import 목록에 `performBalancedGrouping`과 `type BalancedInput`을 더하고, `Gender` 타입도 가져온다.

```ts
import type { Gender, Group } from '../../src/shared/domain/types';
```

```ts
describe('performBalancedGrouping', () => {
  const person = (id: string, gender: Gender, tags: string[] = []): BalancedInput => ({
    studentId: id,
    gender,
    tags,
  });

  /** 남녀 번갈아 24명. */
  const mixed = (): BalancedInput[] =>
    Array.from({ length: 24 }, (_, i) => person(`stu-${i + 1}`, i % 2 === 0 ? 'male' : 'female'));

  const memberCount = (groups: Group[]): number =>
    groups.reduce((sum, group) => sum + group.studentIds.length, 0);

  it('총원이 보존된다 — 빠지거나 겹치지 않는다', () => {
    const people = mixed();
    const { groups } = performBalancedGrouping(people, 'class-1', 4, [], [], NOW, rng());

    const all = groups.flatMap((group) => group.studentIds);
    expect(all).toHaveLength(24);
    expect(new Set(all).size).toBe(24);
  });

  it('성별이 모둠마다 고르게 퍼진다', () => {
    const people = mixed();
    const male = new Set(people.filter((p) => p.gender === 'male').map((p) => p.studentId));
    const { groups } = performBalancedGrouping(people, 'class-1', 4, [], [], NOW, rng());

    for (const group of groups) {
      const males = group.studentIds.filter((id) => male.has(id)).length;
      // 12명을 4모둠에 나누므로 정확히 3명씩이어야 한다.
      expect(males).toBe(3);
    }
  });

  it('같은 태그를 가진 학생이 서로 다른 모둠으로 흩어진다', () => {
    const people: BalancedInput[] = [
      ...Array.from({ length: 3 }, (_, i) => person(`care-${i + 1}`, 'male', ['도움 필요'])),
      ...Array.from({ length: 9 }, (_, i) => person(`plain-${i + 1}`, 'female')),
    ];
    const { groups } = performBalancedGrouping(people, 'class-1', 3, [], [], NOW, rng());

    for (const group of groups) {
      expect(group.studentIds.filter((id) => id.startsWith('care-'))).toHaveLength(1);
    }
  });

  it('고정된 학생은 원래 모둠에 남는다', () => {
    const people = mixed();
    const existing = [
      group('g-1', '1모둠', ['stu-1', 'stu-2']),
      group('g-2', '2모둠', ['stu-3']),
    ];

    const { groups, lockedStudentIds } = performBalancedGrouping(
      people,
      'class-1',
      4,
      existing,
      ['stu-1', 'stu-3'],
      NOW,
      rng(),
    );

    expect(groups[0]?.studentIds).toContain('stu-1');
    expect(groups[1]?.studentIds).toContain('stu-3');
    expect(lockedStudentIds).toEqual(['stu-1', 'stu-3']);
  });

  it('모둠 수가 줄어 갈 곳이 없어진 고정은 알린다', () => {
    const people = mixed();
    const existing = [
      group('g-1', '1모둠', []),
      group('g-2', '2모둠', []),
      group('g-3', '3모둠', ['stu-5']),
    ];

    const { lockCleared } = performBalancedGrouping(
      people,
      'class-1',
      2,
      existing,
      ['stu-5'],
      NOW,
      rng(),
    );

    expect(lockCleared).toBe(true);
  });

  it('태그가 하나도 없어도 동작한다', () => {
    const { groups } = performBalancedGrouping(mixed(), 'class-1', 3, [], [], NOW, rng());
    expect(memberCount(groups)).toBe(24);
  });

  it('한쪽 성별만 있어도 깨지지 않는다', () => {
    const people = Array.from({ length: 10 }, (_, i) => person(`stu-${i + 1}`, 'male'));
    const { groups } = performBalancedGrouping(people, 'class-1', 3, [], [], NOW, rng());

    expect(memberCount(groups)).toBe(10);
    expect(groups.map((g) => g.studentIds.length).sort()).toEqual([3, 3, 4]);
  });

  it('성별이 지정되지 않아도(none) 인원은 고르게 나뉜다', () => {
    const people = Array.from({ length: 9 }, (_, i) => person(`stu-${i + 1}`, 'none'));
    const { groups } = performBalancedGrouping(people, 'class-1', 3, [], [], NOW, rng());

    expect(groups.map((g) => g.studentIds.length)).toEqual([3, 3, 3]);
  });

  it('모둠 수가 학생 수보다 많아도 깨지지 않는다', () => {
    const people = [person('stu-1', 'male'), person('stu-2', 'female')];
    const { groups } = performBalancedGrouping(people, 'class-1', 5, [], [], NOW, rng());

    expect(groups).toHaveLength(5);
    expect(memberCount(groups)).toBe(2);
  });

  it('학생이 없어도 빈 모둠을 돌려준다', () => {
    const { groups } = performBalancedGrouping([], 'class-1', 3, [], [], NOW, rng());

    expect(groups).toHaveLength(3);
    expect(memberCount(groups)).toBe(0);
  });

  it('같은 씨앗이면 같은 편성이 나온다', () => {
    const people = mixed();
    const a = performBalancedGrouping(people, 'class-1', 4, [], [], NOW, createSeededRng(7));
    const b = performBalancedGrouping(people, 'class-1', 4, [], [], NOW, createSeededRng(7));

    expect(a.groups.map((g) => g.studentIds)).toEqual(b.groups.map((g) => g.studentIds));
  });

  it('기존 모둠의 이름과 색은 유지한다', () => {
    const existing = [group('g-1', '독수리', []), group('g-2', '호랑이', [])];
    const { groups } = performBalancedGrouping(mixed(), 'class-1', 2, existing, [], NOW, rng());

    expect(groups.map((g) => g.name)).toEqual(['독수리', '호랑이']);
    expect(groups[0]?.id).toBe('g-1');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run tests/seating/groupingCore.test.ts
```

Expected: FAIL — `performBalancedGrouping` is not exported.

- [ ] **Step 3: 공통 부분을 함수로 뺀다**

`performRandomGrouping`과 균형 편성은 모둠 껍데기 만들기·고정 학생 앉히기·모둠장 되살리기가 완전히 같다. 두 벌로 두면 한쪽만 고쳐지는 날이 온다.

`src/features/seating/groupingCore.ts`의 `GroupingResult`와 `createDefaultGroups` 사이에 세 함수를 넣는다:

```ts
/** 기존 모둠은 이름·색·id를 유지하고 구성원만 비운다. 교사가 붙인 이름이 사라지면 안 된다. */
function buildGroupShells(
  groupCount: number,
  classId: string,
  existingGroups: readonly Group[],
  now: string,
): Group[] {
  return Array.from({ length: groupCount }, (_, index) => {
    const existing = existingGroups[index];
    if (existing) return { ...existing, studentIds: [], updatedAt: now };

    const color = GROUP_COLORS[index % GROUP_COLORS.length];
    return {
      id: createId(),
      classId,
      name: `${index + 1}모둠`,
      color: color?.id ?? 'slate',
      studentIds: [],
      leaderId: null,
      createdAt: now,
      updatedAt: now,
    };
  });
}

interface LockOutcome {
  placed: Set<string>;
  keptLocked: string[];
  lockCleared: boolean;
}

/** 고정된 학생을 원래 모둠에 먼저 앉힌다. groups를 직접 고친다. */
function seatLockedStudents(
  groups: Group[],
  studentIds: readonly string[],
  existingGroups: readonly Group[],
  lockedStudentIds: readonly string[],
): LockOutcome {
  const previousGroupIndex = new Map<string, number>();
  existingGroups.forEach((group, index) => {
    for (const studentId of group.studentIds) previousGroupIndex.set(studentId, index);
  });

  const locked = new Set(lockedStudentIds);
  const keptLocked: string[] = [];
  const placed = new Set<string>();
  let lockCleared = false;

  for (const studentId of studentIds) {
    if (!locked.has(studentId)) continue;

    const index = previousGroupIndex.get(studentId);
    if (index !== undefined && index < groups.length) {
      groups[index]?.studentIds.push(studentId);
      placed.add(studentId);
      keptLocked.push(studentId);
    } else {
      // 모둠 수를 줄이면 갈 곳이 없어진다. 조용히 흘리지 않고 알린다.
      lockCleared = true;
    }
  }

  return { placed, keptLocked, lockCleared };
}

/** 모둠장은 그 모둠에 남아 있을 때만 유지한다. groups를 직접 고친다. */
function restoreLeaders(groups: Group[], existingGroups: readonly Group[]): void {
  for (const [index, group] of groups.entries()) {
    const previousLeader = existingGroups[index]?.leaderId ?? null;
    group.leaderId =
      previousLeader !== null && group.studentIds.includes(previousLeader) ? previousLeader : null;
  }
}
```

- [ ] **Step 4: `performRandomGrouping`이 그 함수들을 쓰게 한다**

`performRandomGrouping`의 본문 앞부분(groups 생성 ~ lockCleared 계산)과 끝의 모둠장 처리를 갈아 끼운다. 동작은 그대로다.

```ts
export function performRandomGrouping(
  studentIds: readonly string[],
  classId: string,
  targetGroupCount: number,
  existingGroups: readonly Group[],
  lockedStudentIds: readonly string[],
  now: string,
  rng: Rng = systemRng,
): GroupingResult {
  const groupCount = Math.max(1, targetGroupCount);
  const groups = buildGroupShells(groupCount, classId, existingGroups, now);
  const { placed, keptLocked, lockCleared } = seatLockedStudents(
    groups,
    studentIds,
    existingGroups,
    lockedStudentIds,
  );

  const capacities = computeTargetCapacities(studentIds.length, groupCount);
  const remaining = shuffle(
    studentIds.filter((studentId) => !placed.has(studentId)),
    rng,
  );

  const leftover: string[] = [];
  for (const studentId of remaining) {
    const target = groups.findIndex(
      (group, index) => group.studentIds.length < (capacities[index] ?? 0),
    );

    if (target === -1) leftover.push(studentId);
    else groups[target]?.studentIds.push(studentId);
  }

  /*
   * 누락 방지 backstop.
   *
   * 현재 정원 계산으로는 여기에 도달하지 않는다. 정원의 합이 전체 인원과 같고,
   * 한 모둠이 정원을 넘겨도 다른 모둠의 정원은 줄지 않으므로 남은 자리 합은
   * 항상 남은 학생 수 이상이다. (원본에는 이 단계가 없었지만 그것도 결함은 아니었다.)
   *
   * 그래도 남겨 둔다. 정원 계산 방식이 바뀌면 즉시 깨지는 곳이고,
   * 학생이 조용히 빠지는 결과는 화면상 정상으로 보여 알아채기 어렵다.
   * 비용은 빈 배열 순회 한 번이다.
   */
  for (const studentId of leftover) {
    const smallest = groups.reduce(
      (best, group, index) =>
        group.studentIds.length < (groups[best]?.studentIds.length ?? Infinity) ? index : best,
      0,
    );
    groups[smallest]?.studentIds.push(studentId);
  }

  restoreLeaders(groups, existingGroups);

  return { groups, lockedStudentIds: keptLocked, lockCleared };
}
```

- [ ] **Step 5: 기존 테스트가 그대로 통과하는지 본다**

리팩터링이 동작을 바꾸지 않았는지 여기서 확인한다. 균형 편성 테스트는 아직 실패한다.

```bash
npx vitest run tests/seating/groupingCore.test.ts -t "performRandomGrouping"
```

Expected: PASS — 기존 케이스 전부

- [ ] **Step 6: `performBalancedGrouping`을 만든다**

`groupingCore.ts` 맨 아래에 추가한다:

```ts
export interface BalancedInput {
  studentId: string;
  gender: Gender;
  tags: readonly string[];
}

interface Fit {
  /** 이 학생의 태그와 겹치는 인원 */
  tagClash: number;
  /** 같은 성별 인원 */
  sameGender: number;
  size: number;
}

function fitOf(group: Group, student: BalancedInput, byId: Map<string, BalancedInput>): Fit {
  const tags = new Set(student.tags);
  let tagClash = 0;
  let sameGender = 0;

  for (const memberId of group.studentIds) {
    const member = byId.get(memberId);
    // 명단에서 빠졌는데 고정 자리에 남아 있는 학생. 균형 계산에서는 뺀다.
    if (member === undefined) continue;

    if (member.gender === student.gender) sameGender += 1;
    if (member.tags.some((tag) => tags.has(tag))) tagClash += 1;
  }

  return { tagClash, sameGender, size: group.studentIds.length };
}

/** 앞 기준에서 갈리면 뒤는 보지 않는다. 같으면 false — 먼저 본 모둠이 이긴다. */
function isBetterFit(candidate: Fit, best: Fit): boolean {
  if (candidate.tagClash !== best.tagClash) return candidate.tagClash < best.tagClash;
  if (candidate.sameGender !== best.sameGender) return candidate.sameGender < best.sameGender;
  return candidate.size < best.size;
}

/**
 * 성별과 특성 태그를 고르게 나누는 편성.
 *
 * performRandomGrouping을 대체하지 않는다. "그냥 무작위"도 교사가 고를 수 있어야 한다.
 *
 * 한 명씩 보며 가장 아쉬운 모둠에 넣는다. 성별로 미리 나눠 뱀 순서로 돌리는
 * 방법도 있지만 이쪽을 쓴다. 성별과 태그가 같은 저울에 올라가기 때문이다.
 * 성별로 먼저 나누면 태그는 그 안에서만 조정되고, 성별이 치우친 학급에서 태그가 뭉친다.
 *
 * 완벽한 균형을 약속하지 않는다. 25명을 4모둠으로 나누면 6·6·6·7이고,
 * 남학생이 3명뿐이면 한 모둠은 남학생이 없다. 화면에서 교사가 고칠 수 있다.
 */
export function performBalancedGrouping(
  students: readonly BalancedInput[],
  classId: string,
  targetGroupCount: number,
  existingGroups: readonly Group[],
  lockedStudentIds: readonly string[],
  now: string,
  rng: Rng = systemRng,
): GroupingResult {
  const groupCount = Math.max(1, targetGroupCount);
  const groups = buildGroupShells(groupCount, classId, existingGroups, now);

  const studentIds = students.map((student) => student.studentId);
  const { placed, keptLocked, lockCleared } = seatLockedStudents(
    groups,
    studentIds,
    existingGroups,
    lockedStudentIds,
  );

  const byId = new Map(students.map((student) => [student.studentId, student]));
  const capacities = computeTargetCapacities(students.length, groupCount);

  const remaining = shuffle(
    students.filter((student) => !placed.has(student.studentId)),
    rng,
  );

  for (const student of remaining) {
    const roomy: number[] = [];
    groups.forEach((group, index) => {
      if (group.studentIds.length < (capacities[index] ?? 0)) roomy.push(index);
    });

    // 고정 학생이 한 모둠에 몰려 정원이 다 찬 경우. 그래도 반드시 어딘가에 넣는다.
    const candidates = roomy.length > 0 ? roomy : groups.map((_, index) => index);

    let bestIndex = -1;
    let bestFit: Fit | null = null;

    for (const index of candidates) {
      const group = groups[index];
      if (group === undefined) continue;

      const fit = fitOf(group, student, byId);
      if (bestFit === null || isBetterFit(fit, bestFit)) {
        bestIndex = index;
        bestFit = fit;
      }
    }

    groups[bestIndex]?.studentIds.push(student.studentId);
  }

  restoreLeaders(groups, existingGroups);

  return { groups, lockedStudentIds: keptLocked, lockCleared };
}
```

`groupingCore.ts` 상단 import에 `Gender`를 더한다:

```ts
import type { Gender, Group } from '../../shared/domain/types';
```

- [ ] **Step 7: 통과를 확인한다**

```bash
npx vitest run tests/seating/groupingCore.test.ts
```

Expected: PASS — 기존 케이스 + 균형 편성 12개

- [ ] **Step 8: `useGrouping`에 `balanceGroups`를 붙인다**

`src/features/seating/useGrouping.ts`:

import를 바꾼다.

```ts
import { computeGroupCount, performBalancedGrouping, performRandomGrouping } from './groupingCore';
```

`GroupingView`에 `shuffleGroups` 바로 아래로 추가한다:

```ts
  /** 성별·특성 태그를 고르게 나눠 편성한다. */
  balanceGroups: (targetCount: number) => { lockCleared: boolean };
```

`shuffleGroups` 정의 다음에 넣는다:

```ts
  const balanceGroups = useCallback(
    (targetCount: number): { lockCleared: boolean } => {
      if (classId === null) return { lockCleared: false };

      const profileById = new Map(data.seatingProfiles.map((p) => [p.studentId, p]));
      const now = new Date().toISOString();

      const result = performBalancedGrouping(
        roster.map((student) => {
          const profile = profileById.get(student.id);
          // 명단에만 있고 프로필이 아직 없는 학생. 성별 미지정으로 본다.
          return {
            studentId: student.id,
            gender: profile?.gender ?? 'none',
            tags: profile?.tags ?? [],
          };
        }),
        classId,
        targetCount,
        groups,
        [...lockedStudentIds],
        now,
      );

      update((current) => replaceClassGroups(current, classId, result.groups));
      return { lockCleared: result.lockCleared };
    },
    [classId, roster, groups, lockedStudentIds, data.seatingProfiles, update],
  );
```

반환 객체에 `balanceGroups,`를 `shuffleGroups,` 아래에 추가한다.

- [ ] **Step 9: 화면에 `균형 편성` 버튼을 단다**

`src/features/seating/GroupingPanel.tsx`:

`handleShuffle` 아래에 추가한다:

```tsx
  const handleBalance = (): void => {
    const { lockCleared } = grouping.balanceGroups(targetCount);

    toast.success(
      grouping.lockedStudentIds.size > 0
        ? `성별과 특성을 고르게 나눴습니다. 고정한 ${grouping.lockedStudentIds.size}명은 그대로 두었습니다.`
        : '성별과 특성을 고르게 나눠 편성했습니다.',
    );

    if (lockCleared) {
      toast.warning(
        '모둠 수가 줄어 갈 곳이 없어진 고정 학생이 있어 고정이 풀렸습니다. 편성을 확인해 주세요.',
      );
    }
    setMovingStudentId(null);
  };
```

버튼 묶음(`<div className="ml-auto flex gap-2">`) 안, `모둠 편성` 버튼 **앞**에 넣는다:

```tsx
          <Button icon={Scale} variant="secondary" onClick={handleBalance}>
            균형 편성
          </Button>
```

`lucide-react` import에 `Scale`을 더한다.

버튼 묶음이 든 `div` 바로 다음(같은 부모의 형제)에 안내 한 줄을 추가한다:

```tsx
        <p className="w-full text-xs text-slate-500">
          균형 편성은 성별과 특성 태그를 고르게 나눕니다. 태그는 명단에서 학생 정보를 수정해 넣습니다.
        </p>
```

- [ ] **Step 10: 검증 후 커밋**

```bash
npm run verify
```

Expected: PASS — 372 tests

```bash
git add -A && git commit -m "feat: 성별·특성 균형 모둠 편성"
```

---

### Task 3: 자리표 저장 — 모델과 순수 함수

**Files:**
- Modify: `src/shared/domain/types.ts` (`SavedLayout`, `SuiteData.savedLayouts`)
- Modify: `src/shared/domain/factories.ts:324` (`createEmptySuiteData`)
- Modify: `src/shared/storage/schema.ts` (`parseSavedLayout`, `parseList`)
- Modify: `src/shared/domain/invariants.ts` (`ORPHAN_SAVED_LAYOUT`)
- Modify: `src/shared/roster/classOps.ts` (14 → 15개 배열)
- Create: `src/features/seating/layoutOps.ts`
- Test: `tests/seating/layoutOps.test.ts` (신규)
- Test: `tests/roster/classOps.test.ts` (연쇄 삭제 추가)

**Interfaces:**
- Consumes: Task 1의 `SeatingState.perspective` (`applyLayout`이 기존 상태를 펼쳐 쓰므로 값이 유지된다)
- Produces: `SavedLayout`, `SuiteData.savedLayouts`, `saveLayout`, `deleteLayout`, `applyLayout`, `layoutsOf`

- [ ] **Step 1: 실패 테스트를 쓴다**

`tests/seating/layoutOps.test.ts` 생성:

```ts
import { describe, expect, it } from 'vitest';

import { applyLayout, deleteLayout, layoutsOf, saveLayout } from '../../src/features/seating/layoutOps';
import {
  createClassRoom,
  createEmptySuiteData,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';

const NOW = '2026-08-14T09:00:00.000Z';
const LATER = '2026-08-15T09:00:00.000Z';

function seeded(): { data: SuiteData; classId: string; studentIds: string[] } {
  const term = createTerm(
    { schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    NOW,
  );
  const room = createClassRoom({ termId: term.id, name: '우리 반' }, NOW);
  const a = createStudent({ classId: room.id, number: 1, name: '김하나' }, NOW);
  const b = createStudent({ classId: room.id, number: 2, name: '이두리' }, NOW);

  const data: SuiteData = {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room],
    students: [a, b],
    seatingStates: [
      {
        classId: room.id,
        rows: 3,
        cols: 4,
        disabledSeatIds: ['r3c4'],
        positions: [
          { studentId: a.id, seatId: 'r1c1' },
          { studentId: b.id, seatId: 'r2c2' },
        ],
        perspective: 'teacher',
        updatedAt: NOW,
      },
    ],
    activeTermId: term.id,
    activeClassId: room.id,
  };

  return { data, classId: room.id, studentIds: [a.id, b.id] };
}

describe('saveLayout', () => {
  it('지금 배치를 이름 붙여 저장한다', () => {
    const { data, classId } = seeded();
    const next = saveLayout(data, classId, '3월 자리', LATER);

    expect(next.savedLayouts).toHaveLength(1);
    const layout = next.savedLayouts[0];
    expect(layout?.name).toBe('3월 자리');
    expect(layout?.rows).toBe(3);
    expect(layout?.cols).toBe(4);
    expect(layout?.disabledSeatIds).toEqual(['r3c4']);
    expect(layout?.positions).toHaveLength(2);
    expect(layout?.createdAt).toBe(LATER);
  });

  it('이름이 비면 저장하지 않는다', () => {
    const { data, classId } = seeded();
    expect(saveLayout(data, classId, '   ', LATER).savedLayouts).toHaveLength(0);
  });

  it('자리 배치를 한 적 없는 학급은 저장할 것이 없다', () => {
    const { data, classId } = seeded();
    const empty = { ...data, seatingStates: [] };
    expect(saveLayout(empty, classId, '3월 자리', LATER).savedLayouts).toHaveLength(0);
  });

  it('저장본은 원본과 배열을 공유하지 않는다', () => {
    const { data, classId } = seeded();
    const next = saveLayout(data, classId, '3월 자리', LATER);

    expect(next.savedLayouts[0]?.positions).not.toBe(next.seatingStates[0]?.positions);
  });
});

describe('applyLayout', () => {
  it('저장한 자리와 교실 크기를 되돌린다', () => {
    const { data, classId } = seeded();
    const saved = saveLayout(data, classId, '3월 자리', LATER);
    const layoutId = saved.savedLayouts[0]?.id ?? '';

    // 저장 뒤 교실을 흩뜨려 놓는다.
    const messed: SuiteData = {
      ...saved,
      seatingStates: saved.seatingStates.map((state) => ({
        ...state,
        rows: 6,
        cols: 6,
        disabledSeatIds: [],
        positions: [],
      })),
    };

    const { data: restored, droppedStudents } = applyLayout(messed, layoutId, LATER);
    const state = restored.seatingStates[0];

    expect(droppedStudents).toBe(0);
    expect(state?.rows).toBe(3);
    expect(state?.cols).toBe(4);
    expect(state?.disabledSeatIds).toEqual(['r3c4']);
    expect(state?.positions).toHaveLength(2);
  });

  it('지금 명단에 없는 학생은 빼고 그 수를 알린다', () => {
    const { data, classId, studentIds } = seeded();
    const saved = saveLayout(data, classId, '3월 자리', LATER);
    const layoutId = saved.savedLayouts[0]?.id ?? '';

    // 이두리가 전학 갔다.
    const moved: SuiteData = {
      ...saved,
      students: saved.students.filter((student) => student.id !== studentIds[1]),
    };

    const { data: restored, droppedStudents } = applyLayout(moved, layoutId, LATER);

    expect(droppedStudents).toBe(1);
    expect(restored.seatingStates[0]?.positions).toHaveLength(1);
    expect(restored.seatingStates[0]?.positions[0]?.studentId).toBe(studentIds[0]);
  });

  it('보는 방향은 자리표에 딸리지 않는다', () => {
    const { data, classId } = seeded();
    const saved = saveLayout(data, classId, '3월 자리', LATER);
    const layoutId = saved.savedLayouts[0]?.id ?? '';

    const { data: restored } = applyLayout(saved, layoutId, LATER);

    expect(restored.seatingStates[0]?.perspective).toBe('teacher');
  });

  it('없는 자리표를 부르면 아무것도 바뀌지 않는다', () => {
    const { data } = seeded();
    const { data: same, droppedStudents } = applyLayout(data, 'no-such-id', LATER);

    expect(same).toBe(data);
    expect(droppedStudents).toBe(0);
  });
});

describe('deleteLayout · layoutsOf', () => {
  it('지운 자리표만 사라진다', () => {
    const { data, classId } = seeded();
    const twice = saveLayout(saveLayout(data, classId, '3월', LATER), classId, '4월', LATER);
    const first = twice.savedLayouts[0]?.id ?? '';

    const next = deleteLayout(twice, first);

    expect(next.savedLayouts).toHaveLength(1);
    expect(next.savedLayouts[0]?.name).toBe('4월');
  });

  it('그 학급 자리표만 골라 준다', () => {
    const { data, classId } = seeded();
    const saved = saveLayout(data, classId, '3월', LATER);

    expect(layoutsOf(saved, classId)).toHaveLength(1);
    expect(layoutsOf(saved, 'other-class')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run tests/seating/layoutOps.test.ts
```

Expected: FAIL — `layoutOps` 모듈이 없다.

- [ ] **Step 3: `SavedLayout` 타입을 더한다**

`src/shared/domain/types.ts`의 `SeatingState` 아래, `MIN_SEAT_ROWS` 위에 넣는다:

```ts
/**
 * 이름 붙여 저장해 둔 자리표.
 *
 * 교실 크기까지가 한 벌이다. 크기를 빼면 불러왔을 때 저장할 때와
 * 다른 그림이 나온다. 보는 방향(perspective)은 넣지 않는다 —
 * 그건 배치가 아니라 읽는 방향이다.
 */
export interface SavedLayout {
  id: string;
  classId: string;
  name: string;
  rows: number;
  cols: number;
  disabledSeatIds: string[];
  positions: StudentPosition[];
  createdAt: string;
}
```

`SuiteData`의 `seatingStates` 바로 아래에 넣는다:

```ts
  /** 저장해 둔 자리표. 학급마다 여러 개일 수 있다. */
  savedLayouts: SavedLayout[];
```

`createEmptySuiteData`(`factories.ts:335`)의 `seatingStates: [],` 다음 줄에 `savedLayouts: [],`를 넣는다.

- [ ] **Step 4: 읽기(schema)와 불변조건을 맞춘다**

`src/shared/storage/schema.ts` — `parseSeatingState` 아래에 넣는다:

```ts
function parseSavedLayout(raw: unknown, now: string): SavedLayout | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const classId = requiredStr(raw['classId']);
  if (id === null || classId === null) return null;

  const positions = asArray(raw['positions']).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const studentId = requiredStr(entry['studentId']);
    const seatIdValue = requiredStr(entry['seatId']);
    if (studentId === null || seatIdValue === null) return [];
    return [{ studentId, seatId: seatIdValue }];
  });

  const clamp = (value: unknown, fallback: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, Math.round(num(value, fallback))));

  return {
    id,
    classId,
    name: str(raw['name'], '이름 없는 자리표'),
    rows: clamp(raw['rows'], DEFAULT_SEAT_ROWS, MIN_SEAT_ROWS, MAX_SEAT_ROWS),
    cols: clamp(raw['cols'], DEFAULT_SEAT_COLS, MIN_SEAT_COLS, MAX_SEAT_COLS),
    disabledSeatIds: strArray(raw['disabledSeatIds']),
    positions,
    createdAt: str(raw['createdAt'], now),
  };
}
```

`import` 목록에 `type SavedLayout`을 더하고, `shaped`의 `seatingStates:` 다음 줄에 넣는다:

```ts
    savedLayouts: parseList('savedLayouts', '저장한 자리표', (r) => parseSavedLayout(r, now)),
```

`src/shared/domain/invariants.ts`:

`RepairCode` union의 `'INVALID_SEAT_POSITION'` 다음 줄에 `| 'ORPHAN_SAVED_LAYOUT'`을 넣는다.

`seatingStates` 블록(`})();`으로 끝나는 곳, 8-2절) 바로 아래에 추가한다:

```ts
  // ── 8-2b. 저장한 자리표가 실제 학급을 가리키는가 ─────────────
  //     학급 삭제 연쇄에서 빠뜨리면 여기서 잡힌다. classOps가 제대로
  //     지우면 이 규칙은 아무 일도 하지 않는다.
  const savedLayouts = (() => {
    const classIds = new Set(classRooms.map((c) => c.id));
    const dropped: string[] = [];

    const kept = input.savedLayouts.filter((layout) => {
      if (classIds.has(layout.classId)) return true;
      dropped.push(layout.id);
      return false;
    });

    if (dropped.length > 0) {
      repairs.push({
        code: 'ORPHAN_SAVED_LAYOUT',
        severity: 'info',
        entityIds: dropped,
        message: `없는 학급의 저장한 자리표 ${dropped.length}건을 정리했습니다.`,
      });
    }

    return kept;
  })();
```

반환 객체(`data: { ... }`)의 `seatingStates,` 다음 줄에 `savedLayouts,`를 넣는다.

- [ ] **Step 5: `layoutOps.ts`를 만든다**

`src/features/seating/layoutOps.ts` 생성:

```ts
import { createId, createSeatingState } from '../../shared/domain/factories';
import type { SavedLayout, SeatingState, SuiteData } from '../../shared/domain/types';

/**
 * 자리표 저장·불러오기.
 *
 * 전부 순수 함수다. 화면은 useSuite().update로 결과를 넘기기만 한다.
 *
 * 설계 근거: docs/superpowers/specs/2026-08-14-seating-enhancements-design.md
 */

function nowIso(): string {
  return new Date().toISOString();
}

/** 그 학급 자리표만. 만든 순서대로 나온다. */
export function layoutsOf(data: SuiteData, classId: string): SavedLayout[] {
  return data.savedLayouts.filter((layout) => layout.classId === classId);
}

export function saveLayout(
  data: SuiteData,
  classId: string,
  name: string,
  now: string = nowIso(),
): SuiteData {
  const trimmed = name.trim();
  // 이름 없는 자리표는 목록에서 고를 수 없다.
  if (trimmed === '') return data;

  const state = data.seatingStates.find((item) => item.classId === classId);
  // 자리 배치를 한 번도 안 한 학급은 저장할 것이 없다.
  if (state === undefined) return data;

  const layout: SavedLayout = {
    id: createId(),
    classId,
    name: trimmed,
    rows: state.rows,
    cols: state.cols,
    // 배열을 복사한다. 저장 뒤 자리를 바꿔도 저장본은 그대로여야 한다.
    disabledSeatIds: [...state.disabledSeatIds],
    positions: state.positions.map((position) => ({ ...position })),
    createdAt: now,
  };

  return { ...data, savedLayouts: [...data.savedLayouts, layout] };
}

export function deleteLayout(data: SuiteData, layoutId: string): SuiteData {
  return { ...data, savedLayouts: data.savedLayouts.filter((layout) => layout.id !== layoutId) };
}

/**
 * 저장한 자리표를 지금 교실에 되돌린다.
 *
 * 저장 뒤 전학 간 학생이 자리를 붙들고 있으면 새 학생을 앉힐 자리가 없어진다.
 * 지금 명단에 없는 학생은 빼고, 몇 명이 빠졌는지 돌려준다. 화면이 알린다.
 */
export function applyLayout(
  data: SuiteData,
  layoutId: string,
  now: string = nowIso(),
): { data: SuiteData; droppedStudents: number } {
  const layout = data.savedLayouts.find((item) => item.id === layoutId);
  if (layout === undefined) return { data, droppedStudents: 0 };

  const enrolled = new Set(
    data.students
      .filter((student) => student.classId === layout.classId && student.status === 'active')
      .map((student) => student.id),
  );

  const positions = layout.positions.filter((position) => enrolled.has(position.studentId));
  const droppedStudents = layout.positions.length - positions.length;

  const existing = data.seatingStates.find((item) => item.classId === layout.classId);

  // 보는 방향은 기존 값을 그대로 둔다. 자리표에 딸린 정보가 아니다.
  const next: SeatingState = {
    ...(existing ?? createSeatingState(layout.classId, now)),
    rows: layout.rows,
    cols: layout.cols,
    disabledSeatIds: [...layout.disabledSeatIds],
    positions: positions.map((position) => ({ ...position })),
    updatedAt: now,
  };

  return {
    data: {
      ...data,
      seatingStates:
        existing === undefined
          ? [...data.seatingStates, next]
          : data.seatingStates.map((item) => (item.classId === layout.classId ? next : item)),
    },
    droppedStudents,
  };
}
```

- [ ] **Step 6: 통과를 확인한다**

```bash
npx vitest run tests/seating/layoutOps.test.ts
```

Expected: PASS (11 tests)

- [ ] **Step 7: 학급 삭제 연쇄 테스트를 먼저 고친다**

`tests/roster/classOps.test.ts`:

`seeded()`의 `seatingStates:` 다음에 자리표를 넣는다:

```ts
    savedLayouts: [
      { id: 'sl-mine', classId: mine.id, name: '3월 자리', rows: 4, cols: 5, disabledSeatIds: [], positions: [], createdAt: NOW },
      { id: 'sl-other', classId: other.id, name: '3월 자리', rows: 4, cols: 5, disabledSeatIds: [], positions: [], createdAt: NOW },
    ],
```

`countClassData` 기대값 객체의 `seatingStates: 1,` 다음에 `savedLayouts: 1,`을 넣는다.

`deleteClassRoom` 테스트의 제목을 `'15개 배열에서 그 학급 것이 함께 사라진다'`로 바꾸고, 기대값 객체의 `seatingStates: 0,` 다음에 `savedLayouts: 0,`을 넣는다.

- [ ] **Step 8: 실패를 확인한다**

```bash
npx vitest run tests/roster/classOps.test.ts
```

Expected: FAIL — `savedLayouts`가 `ClassDataCount`에 없다(타입 오류), 그리고 삭제 뒤 `validateAndRepair`가 `ORPHAN_SAVED_LAYOUT`을 보고한다.

- [ ] **Step 9: `classOps`를 15개로 늘린다**

`src/shared/roster/classOps.ts`:

`ClassDataCount`의 `seatingStates: number;` 다음에 `savedLayouts: number;`를 넣는다.

`countClassData` 반환 객체의 `seatingStates: byClass(data.seatingStates),` 다음에 `savedLayouts: byClass(data.savedLayouts),`를 넣는다.

`deleteClassRoom`의 doc 주석 첫 줄을 `학급과 딸린 자료 15종을 지운다.`로 바꾸고, 반환 객체의 `seatingStates: keepClass(data.seatingStates),` 다음에 `savedLayouts: keepClass(data.savedLayouts),`를 넣는다.

`addTerm` 위 주석의 `그건 14개 배열 × 학급 수다`를 `그건 15개 배열 × 학급 수다`로 바꾼다.

- [ ] **Step 10: 통과를 확인한다**

```bash
npx vitest run tests/roster/classOps.test.ts
```

Expected: PASS — 삭제 뒤 `repairs`가 비어 있다.

- [ ] **Step 11: 검증 후 커밋**

```bash
npm run verify
```

Expected: PASS — 383 tests

```bash
git add -A && git commit -m "feat: 자리표 저장·불러오기 모델"
```

---

### Task 4: 화면 배선 — 시점 버튼과 자리표 목록

**Files:**
- Modify: `src/features/seating/useSeating.ts`
- Modify: `src/features/seating/SeatingPage.tsx`
- Modify: `src/features/seating/SeatingBoard.tsx` (주석만 — 기본값을 쓴다는 근거를 남긴다)

**Interfaces:**
- Consumes: Task 1의 `SeatingState.perspective` · `ClassroomGrid`의 `perspective` prop, Task 3의 `layoutOps`
- Produces: `SeatingView`에 `perspective` · `setPerspective` · `layouts` · `saveCurrentLayout` · `loadLayout` · `removeLayout`

- [ ] **Step 1: `useSeating`에 시점과 자리표를 붙인다**

`src/features/seating/useSeating.ts`:

import를 더한다.

```ts
import type {
  SavedLayout,
  SeatingPerspective,
  SeatingState,
  Student,
  StudentPosition,
  SuiteData,
} from '../../shared/domain/types';
import { applyLayout, deleteLayout, layoutsOf, saveLayout } from './layoutOps';
```

(기존 `MAX_SEAT_COLS` 등 값 import는 그대로 둔다.)

`SeatingView`에 추가한다 (`roster: Student[];` 다음):

```ts
  /** 교사 화면에서 자리표를 보는 방향. 전자칠판은 이 값을 쓰지 않는다. */
  perspective: SeatingPerspective;
  /** 이 학급에 저장해 둔 자리표 */
  layouts: SavedLayout[];

  setPerspective: (next: SeatingPerspective) => void;
```

`clearSeats: () => Promise<void>;` 다음에 추가한다:

```ts
  /** 이름이 비었거나 배치가 없으면 false를 돌려준다. */
  saveCurrentLayout: (name: string) => boolean;
  loadLayout: (layoutId: string) => { droppedStudents: number };
  removeLayout: (layoutId: string) => void;
```

`const disabledSeatIds = ...` 다음에 추가한다:

```ts
  const perspective: SeatingPerspective = state?.perspective ?? 'student';

  const layouts = useMemo(
    () => (classId === null ? [] : layoutsOf(data, classId)),
    [data, classId],
  );
```

`setSize` 정의 다음에 추가한다:

```ts
  const setPerspective = useCallback(
    (next: SeatingPerspective): void => {
      mutate((prev) => ({ ...prev, perspective: next }));
    },
    [mutate],
  );
```

`clearSeats` 정의 다음에 추가한다:

```ts
  const saveCurrentLayout = useCallback(
    (name: string): boolean => {
      if (classId === null) return false;

      const now = new Date().toISOString();
      let saved = false;

      update((current) => {
        const next = saveLayout(current, classId, name, now);
        // saveLayout은 저장할 것이 없으면 받은 데이터를 그대로 돌려준다.
        saved = next !== current;
        return next;
      });

      return saved;
    },
    [classId, update],
  );

  const loadLayout = useCallback(
    (layoutId: string): { droppedStudents: number } => {
      const now = new Date().toISOString();
      // 몇 명이 빠졌는지는 화면이 알려야 하므로 update 밖에서 한 번 더 계산한다.
      const preview = applyLayout(data, layoutId, now);

      update((current) => applyLayout(current, layoutId, now).data);

      return { droppedStudents: preview.droppedStudents };
    },
    [data, update],
  );

  const removeLayout = useCallback(
    (layoutId: string): void => {
      update((current) => deleteLayout(current, layoutId));
    },
    [update],
  );
```

반환 객체에 `perspective,` · `layouts,` · `setPerspective,` · `saveCurrentLayout,` · `loadLayout,` · `removeLayout,`를 더한다.

- [ ] **Step 2: 타입을 확인한다**

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: `SeatingPage`에 시점 버튼을 단다**

`src/features/seating/SeatingPage.tsx`:

`ClassroomGrid`를 감싼 `Card`의 `action` 안, `SizeStepper` 두 개 **앞**에 넣는다:

```tsx
            <div
              className="inline-flex rounded-control border border-slate-200 p-0.5"
              role="group"
              aria-label="자리표 보는 방향"
            >
              <Button
                size="sm"
                variant={seating.perspective === 'student' ? 'primary' : 'ghost'}
                aria-pressed={seating.perspective === 'student'}
                onClick={() => seating.setPerspective('student')}
              >
                학생 시점
              </Button>
              <Button
                size="sm"
                variant={seating.perspective === 'teacher' ? 'primary' : 'ghost'}
                aria-pressed={seating.perspective === 'teacher'}
                onClick={() => seating.setPerspective('teacher')}
              >
                교사 시점
              </Button>
            </div>
```

`<ClassroomGrid ... />`에 prop을 더한다 (`mode={mode}` 위):

```tsx
          perspective={seating.perspective}
```

안내 문단(`<p className="mb-3 text-sm text-slate-500">`) 바로 위에 한 줄을 더한다:

```tsx
        {seating.perspective === 'teacher' ? (
          <p className="mb-2 text-sm text-brand-700">
            교탁에서 본 방향입니다. 칠판이 아래에 있습니다. 전자칠판에는 학생 시점으로 나갑니다.
          </p>
        ) : null}
```

- [ ] **Step 4: 저장한 자리표 카드를 붙인다**

같은 파일. `useState` 목록에 추가한다:

```tsx
  const [layoutName, setLayoutName] = useState('');
  const [confirmDeleteLayoutId, setConfirmDeleteLayoutId] = useState<string | null>(null);
```

`handleShuffle` 다음에 추가한다:

```tsx
  const handleSaveLayout = (): void => {
    if (seating.saveCurrentLayout(layoutName)) {
      toast.success(`'${layoutName.trim()}' 자리표를 저장했습니다.`);
      setLayoutName('');
    } else {
      toast.error('자리표 이름을 입력해 주세요.');
    }
  };

  const handleLoadLayout = (layout: { id: string; name: string }): void => {
    const { droppedStudents } = seating.loadLayout(layout.id);

    toast.success(
      droppedStudents > 0
        ? `'${layout.name}' 자리표를 불러왔습니다. 지금 명단에 없는 ${droppedStudents}명은 자리에서 뺐습니다.`
        : `'${layout.name}' 자리표를 불러왔습니다.`,
    );
    setSelectedSeatId(null);
    setSelectedStudentId(null);
  };
```

"아직 자리가 없는 학생" 카드 **다음**, 탭 닫는 `</div>` 앞에 카드를 넣는다:

```tsx
      <Card title="저장한 자리표" icon={Bookmark}>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 text-sm text-slate-600">
            자리표 이름
            <input
              type="text"
              value={layoutName}
              onChange={(event) => setLayoutName(event.target.value)}
              placeholder="예: 3월 자리, 시험 대형"
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
            />
          </label>
          <Button variant="secondary" onClick={handleSaveLayout}>
            지금 배치 저장
          </Button>
        </div>

        {seating.layouts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            저장한 자리표가 없습니다. 자리를 배치한 뒤 이름을 붙여 저장하면 나중에 그대로
            불러올 수 있습니다.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {seating.layouts.map((layout) => (
              <li
                key={layout.id}
                className="flex flex-wrap items-center gap-2 rounded-control border border-slate-200 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                  {layout.name}
                </span>
                <span className="text-xs text-slate-400">
                  {layout.rows}행 {layout.cols}열 · {layout.positions.length}명
                </span>
                <Button size="sm" variant="secondary" onClick={() => handleLoadLayout(layout)}>
                  불러오기
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDeleteLayoutId(layout.id)}
                >
                  삭제
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
```

`lucide-react` import에 `Bookmark`를 더한다.

기존 `ConfirmDialog` 다음에 하나 더 둔다:

```tsx
      <ConfirmDialog
        open={confirmDeleteLayoutId !== null}
        title="저장한 자리표를 지울까요?"
        description="지금 교실 배치는 그대로 남습니다. 저장해 둔 자리표만 사라집니다."
        confirmLabel="자리표 지우기"
        onCancel={() => setConfirmDeleteLayoutId(null)}
        onConfirm={() => {
          if (confirmDeleteLayoutId !== null) seating.removeLayout(confirmDeleteLayoutId);
          setConfirmDeleteLayoutId(null);
          toast.info('저장한 자리표를 지웠습니다.');
        }}
      />
```

- [ ] **Step 5: 전자칠판이 왜 prop을 안 넘기는지 남긴다**

`src/features/seating/SeatingBoard.tsx`의 자리표용 `<ClassroomGrid ... scale="board" />` 바로 위에 주석을 넣는다:

```tsx
          /*
           * perspective를 넘기지 않는다. 기본값 'student'로 그린다.
           * 이 화면은 학생이 보는 화면이다. 교사가 자기 화면을 교사 시점으로
           * 돌렸다고 여기까지 뒤집히면, 학생은 눈앞에 칠판을 두고 칠판이
           * 아래에 그려진 자리표를 보게 된다.
           */
```

(JSX 안이므로 `{/* … */}` 형태로 넣는다.)

- [ ] **Step 6: 검증한다**

```bash
npm run verify
```

Expected: PASS — 383 tests

- [ ] **Step 7: 브라우저로 눈으로 확인한다**

`preview_start`로 dev 서버를 띄우고 `/seating`에서 확인한다.

1. `교사 시점`을 누르면 좌석 순서가 뒤집히고 칠판 막대가 아래로 간다
2. 새로 고쳐도 교사 시점이 유지된다
3. `모둠 편성` 탭에서 `균형 편성`을 누르면 편성이 바뀌고 안내 토스트가 뜬다
4. 자리표를 저장하면 목록에 뜨고, 배치를 흩뜨린 뒤 `불러오기`로 되돌아온다
5. `read_console_messages`로 오류가 없는지 본다

- [ ] **Step 8: 커밋**

```bash
git add -A && git commit -m "feat: 자리표 시점 전환·저장 화면 배선"
```

---

### Task 5: 점검 문서 갱신

**Files:**
- Modify: `docs/reference/missing-features-audit.md`

- [ ] **Step 1: B 목록 표를 고친다**

`## B. 그릇도 없는 것` 표에서 세 줄의 우선순위 칸을 바꾼다:

| 기능 | 새 값 |
|---|---|
| 교사 시점 전환 | `**완료 2026-08-14**` |
| 균형 모둠 편성 | `**완료 2026-08-14**` |
| 자리표 저장·불러오기 | `**완료 2026-08-14**` |

표 아래에 한 문단을 더한다:

```markdown
### B-4. 묶음 2 완료 (2026-08-14)

교사 시점은 좌석 배열만 뒤집는다. `buildSeats`가 행 우선으로 만들고
`ClassroomGrid`가 그 순서대로 그리므로 배열을 뒤집으면 정확히 180도가 된다.
전자칠판은 학생이 보는 화면이라 저장된 시점과 무관하게 학생 시점으로 그린다.

균형 편성은 `performRandomGrouping`을 대체하지 않는다. 한 명씩 보며
태그 겹침 → 같은 성별 수 → 인원 순으로 가장 아쉬운 모둠에 넣는다.
완벽한 균형은 약속하지 않는다.

자리표가 늘어 학급 삭제 연쇄가 **15개 배열**이 됐다.
불변조건 검사에 `ORPHAN_SAVED_LAYOUT`을 넣어, 연쇄에서 빠뜨리면
"삭제 뒤 `validateAndRepair`가 아무것도 고치지 않는다" 테스트가 실패하게 했다.

설계: [`../superpowers/specs/2026-08-14-seating-enhancements-design.md`](../superpowers/specs/2026-08-14-seating-enhancements-design.md)
```

`### 점검에 쓴 스크립트` 절 위의 문단 중 "교사 시점 전환과 균형 모둠 편성이 높은 이유" 문장은 그대로 둔다 — 왜 먼저 했는지의 기록이다.

- [ ] **Step 2: 커밋**

```bash
git add -A && git commit -m "docs: 묶음 2 완료 반영"
```

---

## Self-Review

**1. 스펙 대응**

| 스펙 절 | Task |
|---|---|
| §2 교사 시점 · `flipSeats` | Task 1 |
| §2.2 전자칠판은 학생 시점 | Task 4 Step 5 |
| §3 균형 편성 | Task 2 |
| §3.3 총원 보존 | Task 2 Step 1 첫 테스트 |
| §4 자리표 저장 | Task 3 |
| §4.2 삭제 연쇄 15개 + `ORPHAN_SAVED_LAYOUT` | Task 3 Step 4·9 |
| §5 화면 | Task 2 Step 9, Task 4 |
| §6 테스트 | 각 Task Step 1 |

**2. 빠뜨리기 쉬운 것**

- `SeatingState.perspective`는 **필수** 필드다. `tests/roster/classOps.test.ts:55-58`의 literal fixture가 깨진다 (Task 1 Step 7).
- `SuiteData.savedLayouts`도 필수다. `createEmptySuiteData`를 안 고치면 모든 fixture가 깨진다 (Task 3 Step 3).
- `deleteClassRoom`에 `savedLayouts`를 안 넣으면 Task 3 Step 10에서 잡힌다 — 단, `ORPHAN_SAVED_LAYOUT` 규칙(Step 4)이 있어야 잡힌다.

**3. 이름 일관성**

`flipSeats` · `performBalancedGrouping` · `BalancedInput` · `saveLayout` · `applyLayout` · `deleteLayout` · `layoutsOf` · `setPerspective` · `saveCurrentLayout` · `loadLayout` · `removeLayout` — Task 사이에서 같은 이름으로 쓴다.

**4. 검증 지점**

| Task 후 | 테스트 수 |
|---|---|
| 시작 | 352 |
| 1 | 360 |
| 2 | 372 |
| 3 | 383 |
| 4 | 383 |
