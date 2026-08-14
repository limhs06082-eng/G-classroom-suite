# 학급·학기 관리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 처음 설정 마법사 뒤로도 학급을 만들고 고치고 지울 수 있게 하고, 학기를 만들고 보관할 수 있게 한다.

**Architecture:** 규칙은 순수 함수(`classOps.ts`)가 갖고 화면은 그것을 부른다. 학급 삭제는 14개 배열을 직접 지운다 — 불변조건 검사의 고아 정리에 맡기면 정상 삭제인데도 복구 경보가 뜬다. 화면은 설정에 탭 하나로 붙인다.

**Tech Stack:** TypeScript 5.8 (`strict`, `noUncheckedIndexedAccess`), React 19, Vitest + jsdom + @testing-library/react

**설계 문서:** [`../specs/2026-08-14-class-term-management-design.md`](../specs/2026-08-14-class-term-management-design.md)

## Global Constraints

- **규칙은 순수 함수에 둔다.** 화면에 로직을 두면 검증할 수 없다. `rosterOps.ts`와 같은 방침이다.
- **학급 삭제는 14개 배열을 직접 지운다.** 불변조건 검사에 맡기지 않는다.
- **마지막 학급은 지울 수 없다.** 활성 학기는 보관할 수 없다.
- **학기 삭제는 만들지 않는다.**
- 세는 항목과 지우는 항목은 일치해야 한다. 보여 주는 항목은 그 부분집합이다.
- `npm run verify`(타입 검사 → 테스트 → 빌드)를 통과해야 커밋한다.
- **범위 밖:** 학기 이월(진급) · 학급 순서 · 학급별 색상.

## File Structure

| 파일 | 이번에 맡는 일 |
|---|---|
| `src/shared/roster/classOps.ts` | **신규** — 학급·학기 순수 함수 |
| `src/features/settings/ClassTermTab.tsx` | **신규** — 설정의 `학급·학기` 탭 |
| `src/features/settings/SettingsPage.tsx` | 탭 추가 |
| `src/app/ClassSwitcher.tsx` | `학급 관리` 링크 |

`classOps.ts`를 `shared/roster`에 두는 이유: 학급·학기는 명단이 사는 곳이고
`rosterOps.ts`와 같은 자료를 건드린다. 기능(feature)이 아니라 공유 계층이다.

---

## Task 1: 학급 순수 함수

**Files:**
- Create: `src/shared/roster/classOps.ts`
- Test: `tests/roster/classOps.test.ts`

**Interfaces:**
- Produces:
  - `interface ClassDataCount { students; groups; seatingStates; seatingProfiles; dutyProfiles; rewardProfiles; dutyRoles; dutyRounds; dutyCompletions; behaviorPresets; scoreEntries; scoreGoals; assignments; submissions }` (모두 `number`)
  - `countClassData(data: SuiteData, classId: string): ClassDataCount`
  - `addClassRoom(data, input: { termId: string; name: string; grade?: number; classNo?: number }, now?: string): SuiteData`
  - `updateClassRoom(data, classId: string, patch: { name?: string; grade?: number; classNo?: number }, now?: string): SuiteData`
  - `deleteClassRoom(data, classId: string): SuiteData`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `tests/roster/classOps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { validateAndRepair } from '../../src/shared/domain/invariants';
import {
  addClassRoom,
  countClassData,
  deleteClassRoom,
  updateClassRoom,
} from '../../src/shared/roster/classOps';
import {
  createClassRoom,
  createDutyProfile,
  createEmptySuiteData,
  createRewardProfile,
  createSeatingProfile,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';

const NOW = '2026-08-14T09:00:00.000Z';

/**
 * 학급 둘에 자료가 골고루 든 상태.
 * 한쪽을 지웠을 때 다른 쪽이 멀쩡한지 봐야 하므로 둘 다 채운다.
 */
function seeded(): { data: SuiteData; mineId: string; otherId: string; studentId: string } {
  const term = createTerm(
    { schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    NOW,
  );
  const mine = createClassRoom({ termId: term.id, name: '우리 반' }, NOW);
  const other = createClassRoom({ termId: term.id, name: '옆 반' }, NOW);

  const a = createStudent({ classId: mine.id, number: 1, name: '김하나' }, NOW);
  const b = createStudent({ classId: other.id, number: 1, name: '이두리' }, NOW);

  const data: SuiteData = {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [mine, other],
    students: [a, b],
    seatingProfiles: [createSeatingProfile(a.id), createSeatingProfile(b.id)],
    dutyProfiles: [createDutyProfile(a.id, 1), createDutyProfile(b.id, 1)],
    rewardProfiles: [createRewardProfile(a.id), createRewardProfile(b.id)],
    groups: [
      { id: 'g-mine', classId: mine.id, name: '1모둠', color: 'blue', studentIds: [a.id], leaderId: null, createdAt: NOW, updatedAt: NOW },
      { id: 'g-other', classId: other.id, name: '1모둠', color: 'blue', studentIds: [b.id], leaderId: null, createdAt: NOW, updatedAt: NOW },
    ],
    seatingStates: [
      { classId: mine.id, rows: 4, cols: 5, disabledSeatIds: [], positions: [], updatedAt: NOW },
      { classId: other.id, rows: 4, cols: 5, disabledSeatIds: [], positions: [], updatedAt: NOW },
    ],
    dutyRoles: [
      { id: 'r-mine', classId: mine.id, name: '칠판', category: '기타', description: '', neededCount: 1, cycle: 'weekly', activeDays: [1], isActive: true, fixedStudentIds: [], excludedStudentIds: [], createdAt: NOW, updatedAt: NOW },
      { id: 'r-other', classId: other.id, name: '칠판', category: '기타', description: '', neededCount: 1, cycle: 'weekly', activeDays: [1], isActive: true, fixedStudentIds: [], excludedStudentIds: [], createdAt: NOW, updatedAt: NOW },
    ],
    dutyRounds: [
      { id: 'dr-mine', classId: mine.id, startDate: '2026-08-10', endDate: '2026-08-14', label: '1주', status: 'active', assignments: [], lockedRoleIds: [], createdAt: NOW, updatedAt: NOW },
    ],
    dutyCompletions: [{ classId: mine.id, date: '2026-08-14', completed: [], substitutions: [] }],
    behaviorPresets: [
      { id: 'bp-mine', classId: mine.id, name: '칭찬', defaultPoints: 1, targetUnit: 'student', color: 'blue', isActive: true, order: 0, createdAt: NOW },
    ],
    scoreEntries: [
      { id: 'se-mine', classId: mine.id, occurredAt: NOW, targetUnit: 'student', targetId: a.id, points: 1, reason: '칭찬', presetId: 'bp-mine' },
    ],
    scoreGoals: [
      { id: 'sg-mine', classId: mine.id, title: '목표', targetUnit: 'class', targetId: mine.id, targetPoints: 100, reward: '', startDate: '2026-08-01', createdAt: NOW },
    ],
    assignments: [
      { id: 'as-mine', classId: mine.id, title: '과제', description: '', dueDate: '2026-08-20', status: 'open', createdAt: NOW, updatedAt: NOW },
    ],
    submissions: [{ assignmentId: 'as-mine', studentId: a.id, status: 'submitted', note: '', updatedAt: NOW }],
    activeTermId: term.id,
    activeClassId: mine.id,
  };

  return { data, mineId: mine.id, otherId: other.id, studentId: a.id };
}

describe('countClassData', () => {
  it('그 학급에 딸린 자료를 센다', () => {
    const { data, mineId } = seeded();

    expect(countClassData(data, mineId)).toEqual({
      students: 1,
      groups: 1,
      seatingStates: 1,
      seatingProfiles: 1,
      dutyProfiles: 1,
      rewardProfiles: 1,
      dutyRoles: 1,
      dutyRounds: 1,
      dutyCompletions: 1,
      behaviorPresets: 1,
      scoreEntries: 1,
      scoreGoals: 1,
      assignments: 1,
      submissions: 1,
    });
  });

  it('다른 학급 것은 세지 않는다', () => {
    const { data, otherId } = seeded();
    const count = countClassData(data, otherId);

    expect(count.students).toBe(1);
    expect(count.dutyRounds).toBe(0);
    expect(count.scoreEntries).toBe(0);
  });
});

describe('deleteClassRoom', () => {
  it('14개 배열에서 그 학급 것이 함께 사라진다', () => {
    const { data, mineId } = seeded();

    const next = deleteClassRoom(data, mineId);

    expect(countClassData(next, mineId)).toEqual({
      students: 0,
      groups: 0,
      seatingStates: 0,
      seatingProfiles: 0,
      dutyProfiles: 0,
      rewardProfiles: 0,
      dutyRoles: 0,
      dutyRounds: 0,
      dutyCompletions: 0,
      behaviorPresets: 0,
      scoreEntries: 0,
      scoreGoals: 0,
      assignments: 0,
      submissions: 0,
    });
    expect(next.classRooms.some((room) => room.id === mineId)).toBe(false);
  });

  it('다른 학급 자료는 하나도 건드리지 않는다', () => {
    const { data, mineId, otherId } = seeded();

    const next = deleteClassRoom(data, mineId);

    expect(countClassData(next, otherId)).toEqual(countClassData(data, otherId));
  });

  it('지운 뒤 불변조건 검사가 아무것도 고치지 않는다', () => {
    /*
     * 이 테스트가 14개 중 하나를 빠뜨린 것을 잡는다.
     * 고아가 남으면 검사가 정리하면서 복구 기록을 남긴다.
     */
    const { data, mineId } = seeded();

    const { repairs } = validateAndRepair(deleteClassRoom(data, mineId));

    expect(repairs).toEqual([]);
  });

  it('마지막 학급은 지우지 않는다', () => {
    const { data, mineId, otherId } = seeded();
    const oneLeft = deleteClassRoom(data, otherId);

    expect(deleteClassRoom(oneLeft, mineId)).toBe(oneLeft);
  });

  it('활성 학급을 지우면 남은 학급으로 옮겨 간다', () => {
    const { data, mineId, otherId } = seeded();

    const next = deleteClassRoom(data, mineId);

    expect(next.activeClassId).toBe(otherId);
  });

  it('없는 학급이면 아무것도 바꾸지 않는다', () => {
    const { data } = seeded();

    expect(deleteClassRoom(data, '없는학급')).toBe(data);
  });
});

describe('addClassRoom', () => {
  it('학년·반을 안 넣어도 만들어진다', () => {
    const { data } = seeded();

    const next = addClassRoom(data, { termId: data.terms[0]?.id ?? '', name: '3학년 3반' }, NOW);
    const made = next.classRooms.at(-1);

    expect(made?.name).toBe('3학년 3반');
    expect(next.classRooms).toHaveLength(3);
  });

  it('빈 이름은 만들지 않는다', () => {
    const { data } = seeded();

    expect(addClassRoom(data, { termId: data.terms[0]?.id ?? '', name: '   ' }, NOW)).toBe(data);
  });

  it('없는 학기면 만들지 않는다', () => {
    const { data } = seeded();

    expect(addClassRoom(data, { termId: '없는학기', name: '3학년 3반' }, NOW)).toBe(data);
  });
});

describe('updateClassRoom', () => {
  it('이름과 학년·반을 고친다', () => {
    const { data, mineId } = seeded();

    const next = updateClassRoom(data, mineId, { name: '4학년 1반', grade: 4, classNo: 1 }, NOW);
    const room = next.classRooms.find((r) => r.id === mineId);

    expect(room?.name).toBe('4학년 1반');
    expect(room?.grade).toBe(4);
    expect(room?.classNo).toBe(1);
  });

  it('빈 이름으로는 고치지 않는다', () => {
    const { data, mineId } = seeded();

    const next = updateClassRoom(data, mineId, { name: '  ' }, NOW);

    expect(next.classRooms.find((r) => r.id === mineId)?.name).toBe('우리 반');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/roster/classOps.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음

타입 오류가 나면 `src/shared/domain/types.ts`에서 실제 필드를 확인해 픽스처를 맞춘다.
`Group`·`DutyRole`·`ScoreEntry` 등의 필수 필드가 계획과 다를 수 있다.

- [ ] **Step 3: 순수 함수를 만든다**

Create `src/shared/roster/classOps.ts`:

```ts
import { createClassRoom, createTerm } from '../domain/factories';
import type { SuiteData } from '../domain/types';

/**
 * 학급·학기 조작.
 *
 * 전부 순수 함수다. 화면에 로직을 두면 검증할 수 없다.
 * rosterOps.ts와 같은 방침이고 같은 자료를 건드린다.
 *
 * 설계 근거: docs/superpowers/specs/2026-08-14-class-term-management-design.md
 */

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 학급 하나에 딸린 자료 수.
 *
 * 세는 항목과 deleteClassRoom이 지우는 항목은 **반드시 같아야 한다.**
 * 어긋나면 교사가 못 본 자료가 사라진다.
 */
export interface ClassDataCount {
  students: number;
  groups: number;
  seatingStates: number;
  seatingProfiles: number;
  dutyProfiles: number;
  rewardProfiles: number;
  dutyRoles: number;
  dutyRounds: number;
  dutyCompletions: number;
  behaviorPresets: number;
  scoreEntries: number;
  scoreGoals: number;
  assignments: number;
  submissions: number;
}

/** 그 학급 학생의 id 집합. 프로필 세 종류가 이것으로 딸려 온다. */
function studentIdsOf(data: SuiteData, classId: string): Set<string> {
  return new Set(
    data.students.filter((student) => student.classId === classId).map((student) => student.id),
  );
}

/** 그 학급 과제의 id 집합. submissions가 이것으로 딸려 온다. */
function assignmentIdsOf(data: SuiteData, classId: string): Set<string> {
  return new Set(
    data.assignments.filter((item) => item.classId === classId).map((item) => item.id),
  );
}

export function countClassData(data: SuiteData, classId: string): ClassDataCount {
  const studentIds = studentIdsOf(data, classId);
  const assignmentIds = assignmentIdsOf(data, classId);
  const byClass = <T extends { classId: string }>(rows: readonly T[]): number =>
    rows.filter((row) => row.classId === classId).length;
  const byStudent = <T extends { studentId: string }>(rows: readonly T[]): number =>
    rows.filter((row) => studentIds.has(row.studentId)).length;

  return {
    students: studentIds.size,
    groups: byClass(data.groups),
    seatingStates: byClass(data.seatingStates),
    seatingProfiles: byStudent(data.seatingProfiles),
    dutyProfiles: byStudent(data.dutyProfiles),
    rewardProfiles: byStudent(data.rewardProfiles),
    dutyRoles: byClass(data.dutyRoles),
    dutyRounds: byClass(data.dutyRounds),
    dutyCompletions: byClass(data.dutyCompletions),
    behaviorPresets: byClass(data.behaviorPresets),
    scoreEntries: byClass(data.scoreEntries),
    scoreGoals: byClass(data.scoreGoals),
    assignments: assignmentIds.size,
    submissions: data.submissions.filter((row) => assignmentIds.has(row.assignmentId)).length,
  };
}

export function addClassRoom(
  data: SuiteData,
  input: { termId: string; name: string; grade?: number; classNo?: number },
  now: string = nowIso(),
): SuiteData {
  const name = input.name.trim();
  if (name === '') return data;
  if (!data.terms.some((term) => term.id === input.termId)) return data;

  const room = createClassRoom(
    {
      termId: input.termId,
      name,
      ...(input.grade === undefined ? {} : { grade: input.grade }),
      ...(input.classNo === undefined ? {} : { classNo: input.classNo }),
    },
    now,
  );

  return { ...data, classRooms: [...data.classRooms, room] };
}

export function updateClassRoom(
  data: SuiteData,
  classId: string,
  patch: { name?: string; grade?: number; classNo?: number },
  now: string = nowIso(),
): SuiteData {
  if (!data.classRooms.some((room) => room.id === classId)) return data;

  // 빈 이름으로는 고치지 않는다. 이름 없는 학급은 목록에서 찾을 수 없다.
  const name = patch.name?.trim();

  return {
    ...data,
    classRooms: data.classRooms.map((room) =>
      room.id !== classId
        ? room
        : {
            ...room,
            name: name === undefined || name === '' ? room.name : name,
            grade: patch.grade ?? room.grade,
            classNo: patch.classNo ?? room.classNo,
            updatedAt: now,
          },
    ),
  };
}

/**
 * 학급과 딸린 자료 14종을 지운다.
 *
 * 불변조건 검사의 고아 정리에 맡기지 않는다. 그쪽에 맡기면 정상 삭제인데도
 * "자료가 깨졌으니 고쳤다"는 복구 경보가 뜨고, 학생은 '복구된 학급'이라는
 * 낯선 반으로 옮겨진다.
 */
export function deleteClassRoom(data: SuiteData, classId: string): SuiteData {
  if (!data.classRooms.some((room) => room.id === classId)) return data;

  // 마지막 학급은 지우지 않는다. 0개가 되면 모든 화면이 빈 상태가 된다.
  if (data.classRooms.length <= 1) return data;

  const studentIds = studentIdsOf(data, classId);
  const assignmentIds = assignmentIdsOf(data, classId);
  const keepClass = <T extends { classId: string }>(rows: readonly T[]): T[] =>
    rows.filter((row) => row.classId !== classId);
  const keepStudent = <T extends { studentId: string }>(rows: readonly T[]): T[] =>
    rows.filter((row) => !studentIds.has(row.studentId));

  const classRooms = data.classRooms.filter((room) => room.id !== classId);

  // 지운 학급을 보고 있었으면 다른 학급으로 옮긴다. 같은 학기를 먼저 찾는다.
  const removed = data.classRooms.find((room) => room.id === classId);
  const nextActive =
    data.activeClassId !== classId
      ? data.activeClassId
      : (classRooms.find((room) => room.termId === removed?.termId)?.id ??
        classRooms[0]?.id ??
        null);

  return {
    ...data,
    classRooms,
    students: keepClass(data.students),
    groups: keepClass(data.groups),
    seatingStates: keepClass(data.seatingStates),
    seatingProfiles: keepStudent(data.seatingProfiles),
    dutyProfiles: keepStudent(data.dutyProfiles),
    rewardProfiles: keepStudent(data.rewardProfiles),
    dutyRoles: keepClass(data.dutyRoles),
    dutyRounds: keepClass(data.dutyRounds),
    dutyCompletions: keepClass(data.dutyCompletions),
    behaviorPresets: keepClass(data.behaviorPresets),
    scoreEntries: keepClass(data.scoreEntries),
    scoreGoals: keepClass(data.scoreGoals),
    assignments: data.assignments.filter((item) => item.classId !== classId),
    submissions: data.submissions.filter((row) => !assignmentIds.has(row.assignmentId)),
    activeClassId: nextActive,
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm run verify`
Expected: 타입 0, 테스트 335개 + 새 12개 통과, 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add src/shared/roster/classOps.ts tests/roster/classOps.test.ts
git commit -m "feat(roster): 학급 조작 순수 함수와 삭제 연쇄"
```

---

## Task 2: 학기 순수 함수

**Files:**
- Modify: `src/shared/roster/classOps.ts`
- Test: `tests/roster/classOps.test.ts`

**Interfaces:**
- Consumes: Task 1의 `classOps.ts`
- Produces:
  - `addTerm(data, input: { schoolYear: string; semester: string; name?: string; startDate: string; endDate: string }, now?): SuiteData`
  - `updateTerm(data, termId: string, patch: { name?: string; startDate?: string; endDate?: string }, now?): SuiteData`
  - `setTermArchived(data, termId: string, archived: boolean, now?): SuiteData`
  - `visibleTerms(data: SuiteData): Term[]`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/roster/classOps.test.ts` 끝에 추가:

```ts
describe('학기', () => {
  it('새 학기를 만든다', () => {
    const { data } = seeded();

    const next = addTerm(
      { ...data },
      { schoolYear: '2027', semester: '1학기', startDate: '2027-03-02', endDate: '2027-07-20' },
      NOW,
    );

    expect(next.terms).toHaveLength(2);
    expect(next.terms.at(-1)?.schoolYear).toBe('2027');
  });

  it('활성 학기는 보관하지 않는다', () => {
    // 지금 쓰는 학기를 치우면 화면이 빈 상태가 된다.
    const { data } = seeded();
    const termId = data.terms[0]?.id ?? '';

    expect(setTermArchived(data, termId, true, NOW)).toBe(data);
  });

  it('활성이 아닌 학기는 보관하고 되돌릴 수 있다', () => {
    const { data } = seeded();
    const withSecond = addTerm(
      data,
      { schoolYear: '2027', semester: '1학기', startDate: '2027-03-02', endDate: '2027-07-20' },
      NOW,
    );
    const secondId = withSecond.terms.at(-1)?.id ?? '';

    const archived = setTermArchived(withSecond, secondId, true, NOW);
    expect(archived.terms.find((t) => t.id === secondId)?.archivedAt).toBe(NOW);
    expect(visibleTerms(archived).map((t) => t.id)).not.toContain(secondId);

    const back = setTermArchived(archived, secondId, false, NOW);
    expect(back.terms.find((t) => t.id === secondId)?.archivedAt).toBeUndefined();
    expect(visibleTerms(back).map((t) => t.id)).toContain(secondId);
  });

  it('학기 이름과 기간을 고친다', () => {
    const { data } = seeded();
    const termId = data.terms[0]?.id ?? '';

    const next = updateTerm(data, termId, { name: '고친 이름', endDate: '2026-08-31' }, NOW);
    const term = next.terms.find((t) => t.id === termId);

    expect(term?.name).toBe('고친 이름');
    expect(term?.endDate).toBe('2026-08-31');
  });
});
```

임포트에 `addTerm`, `setTermArchived`, `updateTerm`, `visibleTerms`를 더한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/roster/classOps.test.ts`
Expected: FAIL — `addTerm`을 찾을 수 없음

- [ ] **Step 3: 학기 함수를 만든다**

`src/shared/roster/classOps.ts` 끝에 추가:

```ts
/**
 * 학기 삭제는 만들지 않는다.
 * 학기를 지우면 그 안 학급이 전부 딸려 오고, 그건 14개 배열 × 학급 수다.
 * 위험 대비 값이 없다. 대신 보관으로 목록에서 치운다.
 */
export function addTerm(
  data: SuiteData,
  input: { schoolYear: string; semester: string; name?: string; startDate: string; endDate: string },
  now: string = nowIso(),
): SuiteData {
  const term = createTerm(
    {
      schoolYear: input.schoolYear,
      semester: input.semester,
      startDate: input.startDate,
      endDate: input.endDate,
      ...(input.name === undefined || input.name.trim() === '' ? {} : { name: input.name.trim() }),
    },
    now,
  );

  return { ...data, terms: [...data.terms, term] };
}

export function updateTerm(
  data: SuiteData,
  termId: string,
  patch: { name?: string; startDate?: string; endDate?: string },
  now: string = nowIso(),
): SuiteData {
  if (!data.terms.some((term) => term.id === termId)) return data;
  const name = patch.name?.trim();

  return {
    ...data,
    terms: data.terms.map((term) =>
      term.id !== termId
        ? term
        : {
            ...term,
            name: name === undefined || name === '' ? term.name : name,
            startDate: patch.startDate ?? term.startDate,
            endDate: patch.endDate ?? term.endDate,
          },
    ),
  };
}

/** 보관은 목록에서 치우는 것이지 지우는 것이 아니다. 자료는 그대로 남는다. */
export function setTermArchived(
  data: SuiteData,
  termId: string,
  archived: boolean,
  now: string = nowIso(),
): SuiteData {
  if (!data.terms.some((term) => term.id === termId)) return data;

  // 지금 쓰는 학기를 치우면 화면이 빈 상태가 된다.
  if (archived && data.activeTermId === termId) return data;

  return {
    ...data,
    terms: data.terms.map((term) => {
      if (term.id !== termId) return term;
      if (!archived) {
        const { archivedAt: _dropped, ...rest } = term;
        return rest;
      }
      return { ...term, archivedAt: now };
    }),
  };
}

/** 보관하지 않은 학기. 학급 목록과 전환기에서 이것만 쓴다. */
export function visibleTerms(data: SuiteData): Term[] {
  return data.terms.filter((term) => term.archivedAt === undefined);
}
```

`Term` 타입 임포트를 더한다: `import type { SuiteData, Term } from '../domain/types';`

`Term.archivedAt`이 `string | null`이면 `undefined` 대신 `null`로 맞춘다.
`src/shared/domain/types.ts`에서 확인한다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npm run verify`
Expected: 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add src/shared/roster/classOps.ts tests/roster/classOps.test.ts
git commit -m "feat(roster): 학기 만들기·수정·보관"
```

---

## Task 3: 설정에 `학급·학기` 탭

**Files:**
- Create: `src/features/settings/ClassTermTab.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`

**Interfaces:**
- Consumes: Task 1·2의 `classOps.ts` 전부
- Produces: `ClassTermTab` (이름 붙은 내보내기)

- [ ] **Step 1: 탭을 만든다**

Create `src/features/settings/ClassTermTab.tsx`.

**학급 카드** — 현재 보이는 학기(`visibleTerms`)별로 학급을 묶어 보여 준다.
각 줄에 이름·학년·반·학생 수와 `수정`·`삭제` 버튼.
카드 머리에 `학급 추가` 버튼.

**학급 추가·수정 모달** — 이름(필수) · 학년 · 반. 학년·반 아래에 안내를 단다.

```tsx
<p className="text-sm text-slate-500">
  학년·반은 비워 두어도 됩니다. 나중에 시간표를 불러올 때 씁니다.
</p>
```

**삭제 확인** — `countClassData`로 센 뒤 0이 아닌 것만 문장으로 만든다.
프로필 셋과 `dutyCompletions`는 문장에 넣지 않는다. 교사가 만든 적 없는 내부 자료다.

```tsx
function deleteSummary(count: ClassDataCount): string {
  const parts = [
    count.students > 0 ? `학생 ${count.students}명` : null,
    count.groups > 0 ? `모둠 ${count.groups}개` : null,
    count.dutyRoles > 0 ? `역할 ${count.dutyRoles}개` : null,
    count.scoreEntries > 0 ? `점수 기록 ${count.scoreEntries}건` : null,
    count.scoreGoals > 0 ? `목표 ${count.scoreGoals}개` : null,
    count.assignments > 0 ? `과제 ${count.assignments}개` : null,
  ].filter((part): part is string => part !== null);

  return parts.length === 0
    ? '이 학급에는 아직 자료가 없습니다.'
    : `${parts.join(' · ')}가 함께 사라집니다.`;
}
```

`ConfirmDialog`에 `destructive`와 `confirmPhrase={room.name}`을 준다.
확인 전에 `guard('학급 삭제 직전')`을 부른다.

**마지막 학급이면 삭제 버튼을 `disabled`로 두고** 이유를 단다.

```tsx
<p className="text-sm text-slate-500">학급이 하나뿐일 때는 지울 수 없습니다.</p>
```

**학기 카드** — 학기 목록. 각 줄에 이름·기간·학급 수와 `수정`·`보관`(또는 `되돌리기`).
활성 학기는 `보관` 버튼을 `disabled`로 두고 `사용 중` 뱃지를 단다.
카드 머리에 `학기 추가` 버튼.

보관된 학기는 목록 아래쪽에 흐리게 따로 모은다.

- [ ] **Step 2: 설정에 탭을 더한다**

`src/features/settings/SettingsPage.tsx`:

```tsx
type SettingsTab = 'school' | 'classes' | 'backup' | 'legacy';
```

탭 목록에 `{ id: 'classes', label: '학급·학기' }`를 `school` 다음에 넣고,
본문 분기에 `{tab === 'classes' ? <ClassTermTab /> : null}`을 더한다.

- [ ] **Step 3: 통과를 확인한다**

Run: `npm run verify`
Expected: 전부 통과

- [ ] **Step 4: 브라우저에서 확인한다**

`npm run dev` → 설정 → 학급·학기

- 학급을 추가하면 헤더 전환기에 나타나는가
- 학급이 둘일 때 삭제 버튼이 열리고, 하나면 비활성인가
- 삭제 확인창에 실제 개수가 뜨고 이름을 쳐야 열리는가
- 지운 뒤 **복구 알림이 뜨지 않는가** (뜨면 14개 중 하나를 빠뜨린 것)
- 학기를 추가하고 보관·되돌리기가 되는가
- 활성 학기의 보관 버튼이 비활성인가

- [ ] **Step 5: 커밋**

```bash
git add src/features/settings
git commit -m "feat(settings): 학급·학기 관리 탭"
```

---

## Task 4: `ClassSwitcher`에 관리 링크

**Files:**
- Modify: `src/app/ClassSwitcher.tsx`

- [ ] **Step 1: 링크를 더한다**

학급 목록 드롭다운 맨 아래에 구분선과 함께 `학급 관리` 링크를 넣는다.
`to="/settings"`로 보낸다.

학급이 하나뿐이라 드롭다운이 안 뜨는 경우(`siblings.length <= 1`)에도
학급을 추가할 길이 있어야 한다. 그 분기의 표시를 **버튼으로 바꿔** 같은 곳으로 보낸다.

```tsx
  if (siblings.length <= 1) {
    return (
      <Link
        to="/settings"
        className="hidden min-w-0 items-baseline gap-1.5 rounded-control px-2 py-1 text-sm hover:bg-slate-100 sm:flex"
      >
        {term === null ? null : <span className="truncate text-slate-500">{term.name}</span>}
        <span className="truncate">{summary}</span>
      </Link>
    );
  }
```

- [ ] **Step 2: 통과를 확인한다**

Run: `npm run verify`
Expected: 전부 통과

- [ ] **Step 3: 브라우저에서 확인한다**

학급이 하나일 때 헤더의 학급 이름을 누르면 설정으로 가는가.

- [ ] **Step 4: 커밋**

```bash
git add src/app/ClassSwitcher.tsx
git commit -m "feat(app): 학급 전환기에서 관리 화면으로 가는 길"
```

---

## Task 5: 점검 문서 갱신

**Files:**
- Modify: `docs/reference/missing-features-audit.md`

- [ ] **Step 1: B-2에서 끝난 것을 옮긴다**

`학급 관리 화면`과 `학기 관리 화면`을 완료로 표시하고 날짜를 적는다.
`ClassRoom.grade`·`classNo`·`Term.archivedAt`이 이제 쓰인다.

- [ ] **Step 2: 미사용 필드 검사를 다시 돌린다**

```bash
node "<scratchpad>/deadfields.mjs" "<repo>" "src/shared/domain/types.ts"
```

Expected: `ScoreGoal.achievedAt`과 `SuiteData.schemaVersion`만 남는다.
`grade`·`classNo`·`archivedAt`이 남아 있으면 화면에서 안 쓰고 있는 것이다.

- [ ] **Step 3: 커밋**

```bash
git add docs/reference/missing-features-audit.md
git commit -m "docs: 학급·학기 관리 완료 반영"
```

---

## 완료 확인

- [ ] `npm run verify` 통과
- [ ] 브라우저에서 학급 추가·수정·삭제, 학기 추가·보관 확인
- [ ] 학급 삭제 뒤 복구 알림이 뜨지 않음
- [ ] 미사용 필드 검사에서 `grade`·`classNo`·`archivedAt`이 사라짐
- [ ] push
