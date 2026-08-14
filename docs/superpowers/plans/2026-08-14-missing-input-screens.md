# 빠진 입력 화면 붙이기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모델에는 있는데 입력 화면이 없어 교사가 도달할 수 없던 값들에 화면을 붙인다.

**Architecture:** 새 화면을 만들지 않고 이미 있는 세 곳(명단 학생 수정 모달·보상 점수 주기 탭·설정 학교 정보)을 넓힌다. 학생별 4종은 순수 함수 하나가 세 프로필을 한 번에 갱신한다. 지킬 수 없는 설정 두 개는 타입에서 지운다.

**Tech Stack:** TypeScript 5.8 (`strict`, `noUncheckedIndexedAccess`), React 19, Vitest + jsdom + @testing-library/react

**설계 문서:** [`../specs/2026-08-14-missing-input-screens-design.md`](../specs/2026-08-14-missing-input-screens-design.md)

## Global Constraints

- **필드는 이미 있다.** 새 필드를 만드는 것이 아니라 입력 화면을 붙이는 일이다.
- **기능 코드는 localStorage를 직접 부르지 않는다.** 전부 `update()`를 거친다.
- 세 프로필(`SeatingProfile`·`RewardProfile`·`DutyProfile`)은 **한 번의 `update`로 함께 쓴다.**
- **지키지 못할 선택지는 화면에도 타입에도 두지 않는다.**
- `npm run verify`(타입 검사 → 테스트 → 빌드)를 통과해야 커밋한다.
- **범위 밖:** `SeatingProfile.note` · 학급·학기 관리 화면 · `ScoreGoal.achievedAt` 기록 · 급식·시간표 조회.

## File Structure

| 파일 | 이번에 맡는 일 |
|---|---|
| `src/shared/domain/types.ts` | `weeklyStartDayApplyMode` 제거, `monthlyType`에서 `teacher_manual` 제거 |
| `src/shared/domain/factories.ts` | `DEFAULT_SCORE_CYCLE`에서 해당 기본값 제거 |
| `src/shared/storage/schema.ts` | 해당 파싱 제거 |
| `src/features/reward/rewardCore.ts` | `monthlyType`을 계산에 반영 |
| `src/shared/roster/studentDetail.ts` | **신규** — 세 프로필을 한 번에 갱신하는 순수 함수 |
| `src/shared/roster/RosterPage.tsx` | 학생 수정 모달 확장 |
| `src/features/reward/useReward.ts` | 주기 설정을 바꾸는 함수 추가 (지금은 읽기만 한다) |
| `src/features/reward/RewardPage.tsx` | 점수 주기 탭에 설정 두 개 |
| `src/features/settings/SettingsPage.tsx` | NEIS 코드 입력칸 둘 |
| `docs/reference/missing-features-audit.md` | 남는 셋을 B로 재분류 |

---

## Task 1: 지킬 수 없는 설정을 걷어낸다

**Files:**
- Modify: `src/shared/domain/types.ts:375-376`, `src/shared/domain/factories.ts:318`, `src/shared/storage/schema.ts:448-456`
- Test: `tests/storage/schema.test.ts`

**Interfaces:**
- Produces: `ScoreCycle { weeklyStartDay; monthlyType: '1st_to_end' | 'specific_day'; monthlyStartDay; showLifetimeCumulative }`

- [ ] **Step 1: 옛 값이 조용히 버려지는지 확인하는 테스트를 쓴다**

`tests/storage/schema.test.ts` 끝에 추가:

```ts
describe('parseSuiteData — 걷어낸 점수 주기 설정', () => {
  it('옛 저장 자료의 weeklyStartDayApplyMode를 조용히 버린다', () => {
    const raw = {
      schemaVersion: 1,
      scoreCycle: {
        weeklyStartDay: 1,
        weeklyStartDayApplyMode: 'next_period',
        monthlyType: '1st_to_end',
        monthlyStartDay: 1,
        showLifetimeCumulative: false,
      },
    };

    const result = parseSuiteData(raw);

    expect('weeklyStartDayApplyMode' in result.data.scoreCycle).toBe(false);
    // 사용자가 고른 적 없는 값이라 복구 알림을 띄우지 않는다.
    expect(result.repairs).toEqual([]);
  });

  it("teacher_manual은 화면에 있던 적이 없으므로 알리지 않고 기본값으로 되돌린다", () => {
    const raw = {
      schemaVersion: 1,
      scoreCycle: { weeklyStartDay: 1, monthlyType: 'teacher_manual', monthlyStartDay: 1 },
    };

    const result = parseSuiteData(raw);

    expect(result.data.scoreCycle.monthlyType).toBe('1st_to_end');
    expect(result.repairs).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/storage/schema.test.ts`
Expected: FAIL — `weeklyStartDayApplyMode`가 아직 결과에 남아 있다

- [ ] **Step 3: 타입에서 지운다**

`src/shared/domain/types.ts`의 `ScoreCycle`:

```ts
export interface ScoreCycle {
  /** 0=일 … 6=토 */
  weeklyStartDay: number;
  /**
   * 월 주기 기준.
   *
   * 원본에는 'teacher_manual'(교사가 직접 주기를 끊는 방식)도 있었지만 빼 두었다.
   * 그것을 지키려면 주기 관리 화면이 통째로 필요하다.
   * 지키지 못할 선택지를 타입에 남겨 두면 다음 사람이 '화면만 붙이면 되겠네'라고
   * 읽고 같은 함정에 빠진다.
   */
  monthlyType: '1st_to_end' | 'specific_day';
  /** 1~31 */
  monthlyStartDay: number;
  showLifetimeCumulative: boolean;
}
```

`weeklyStartDayApplyMode` 줄은 지운다. 왜 없는지는 설계 문서에 남는다.

- [ ] **Step 4: 기본값과 파싱에서 지운다**

`src/shared/domain/factories.ts`의 `DEFAULT_SCORE_CYCLE`에서 `weeklyStartDayApplyMode: 'next_period',` 줄을 지운다.

`src/shared/storage/schema.ts`에서 `weeklyStartDayApplyMode: oneOf(...)` 블록 전체를 지우고,
`monthlyType`의 허용 목록에서 `'teacher_manual'`을 뺀다:

```ts
    monthlyType: oneOf(
      raw['monthlyType'],
      ['1st_to_end', 'specific_day'] as const,
      DEFAULT_SCORE_CYCLE.monthlyType,
    ),
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npm run verify`
Expected: 타입 0, 테스트 320개 + 새 2개 통과, 빌드 성공

- [ ] **Step 6: 커밋**

```bash
git add src/shared/domain/types.ts src/shared/domain/factories.ts src/shared/storage/schema.ts tests/storage/schema.test.ts
git commit -m "refactor(domain): 지킬 수 없는 점수 주기 설정을 걷어낸다"
```

---

## Task 2: `monthlyType`을 계산에 반영한다

**Files:**
- Modify: `src/features/reward/rewardCore.ts:53-56`
- Test: `tests/reward/rewardCore.test.ts`

**Interfaces:**
- Consumes: Task 1의 `ScoreCycle`
- Produces: `cycleRangeFor`가 `monthlyType`을 본다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/reward/rewardCore.test.ts`의 `cycleRangeFor` describe 안에 추가.
기존 파일이 쓰는 헬퍼와 같은 방식으로 `ScoreCycle`을 만든다:

```ts
  it('1일~말일 기준이면 시작일 설정을 무시한다', () => {
    const cycle = {
      weeklyStartDay: 1,
      monthlyType: '1st_to_end' as const,
      monthlyStartDay: 15,
      showLifetimeCumulative: false,
    };

    const range = cycleRangeFor('monthly', cycle, '2026-08-20');

    expect(range.since?.slice(0, 10)).toBe('2026-08-01');
  });

  it('지정일 기준이면 그 날부터 센다', () => {
    const cycle = {
      weeklyStartDay: 1,
      monthlyType: 'specific_day' as const,
      monthlyStartDay: 15,
      showLifetimeCumulative: false,
    };

    const range = cycleRangeFor('monthly', cycle, '2026-08-20');

    expect(range.since?.slice(0, 10)).toBe('2026-08-15');
  });

  it('지정일이 아직 안 왔으면 지난달 그 날부터다', () => {
    const cycle = {
      weeklyStartDay: 1,
      monthlyType: 'specific_day' as const,
      monthlyStartDay: 15,
      showLifetimeCumulative: false,
    };

    const range = cycleRangeFor('monthly', cycle, '2026-08-10');

    expect(range.since?.slice(0, 10)).toBe('2026-07-15');
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/reward/rewardCore.test.ts`
Expected: FAIL — 첫 테스트가 `2026-08-15`를 받는다 (지금은 항상 `monthlyStartDay`를 쓴다)

- [ ] **Step 3: 계산에 반영한다**

`src/features/reward/rewardCore.ts`에서 `const startDay = ...` 줄을 바꾼다:

```ts
  // 1일~말일 기준이면 시작일 설정은 쓰지 않는다.
  const startDay =
    cycle.monthlyType === '1st_to_end' ? 1 : Math.min(Math.max(1, cycle.monthlyStartDay), 28);
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm run verify`
Expected: 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add src/features/reward/rewardCore.ts tests/reward/rewardCore.test.ts
git commit -m "feat(reward): 월 주기 기준을 계산에 반영"
```

---

## Task 3: 세 프로필을 한 번에 갱신하는 순수 함수

**Files:**
- Create: `src/shared/roster/studentDetail.ts`
- Test: `tests/roster/studentDetail.test.ts`

**Interfaces:**
- Produces:
  - `interface StudentDetail { gender: Gender; tags: string[]; nickname: string; fixedRoleId: string | null }`
  - `readStudentDetail(data: SuiteData, studentId: string): StudentDetail`
  - `applyStudentDetail(data: SuiteData, studentId: string, patch: Partial<StudentDetail>): SuiteData`
  - `collectTags(data: SuiteData, classId: string): string[]`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `tests/roster/studentDetail.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  applyStudentDetail,
  collectTags,
  readStudentDetail,
} from '../../src/shared/roster/studentDetail';
import {
  createClassRoom,
  createDutyProfile,
  createEmptySuiteData,
  createRewardProfile,
  createSeatingProfile,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { DutyRole, SuiteData } from '../../src/shared/domain/types';

const NOW = '2026-08-14T09:00:00.000Z';

function role(id: string, classId: string): DutyRole {
  return {
    id,
    classId,
    name: id,
    category: '기타',
    description: '',
    neededCount: 1,
    cycle: 'weekly',
    activeDays: [1, 2, 3, 4, 5],
    isActive: true,
    fixedStudentIds: [],
    excludedStudentIds: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** 학생 하나와 학급 둘이 있는 자료 */
function seeded(): { data: SuiteData; studentId: string } {
  const term = createTerm(
    { schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    NOW,
  );
  const mine = createClassRoom({ termId: term.id, name: '우리 반' }, NOW);
  const other = createClassRoom({ termId: term.id, name: '옆 반' }, NOW);
  const student = createStudent({ classId: mine.id, number: 1, name: '김하나' }, NOW);

  return {
    studentId: student.id,
    data: {
      ...createEmptySuiteData(),
      terms: [term],
      classRooms: [mine, other],
      students: [student],
      seatingProfiles: [createSeatingProfile(student.id)],
      rewardProfiles: [createRewardProfile(student.id)],
      dutyProfiles: [createDutyProfile(student.id, 1)],
      dutyRoles: [role('r-mine', mine.id), role('r-other', other.id)],
      activeTermId: term.id,
      activeClassId: mine.id,
    },
  };
}

describe('applyStudentDetail', () => {
  it('세 프로필을 한 번에 갱신한다', () => {
    const { data, studentId } = seeded();

    const next = applyStudentDetail(data, studentId, {
      gender: 'female',
      tags: ['앞자리'],
      nickname: '하나',
      fixedRoleId: 'r-mine',
    });

    expect(next.seatingProfiles[0]?.gender).toBe('female');
    expect(next.seatingProfiles[0]?.tags).toEqual(['앞자리']);
    expect(next.rewardProfiles[0]?.nickname).toBe('하나');
    expect(next.dutyProfiles[0]?.fixedRoleId).toBe('r-mine');
  });

  it('넘기지 않은 항목은 그대로 둔다', () => {
    const { data, studentId } = seeded();

    const once = applyStudentDetail(data, studentId, { nickname: '하나' });
    const twice = applyStudentDetail(once, studentId, { gender: 'male' });

    expect(twice.rewardProfiles[0]?.nickname).toBe('하나');
    expect(twice.seatingProfiles[0]?.gender).toBe('male');
  });

  it('다른 학급 역할을 고정 역할로 주면 비운다', () => {
    // 화면에서 못 고르게 막지만, 가져오기 같은 다른 경로로도 들어올 수 있다.
    const { data, studentId } = seeded();

    const next = applyStudentDetail(data, studentId, { fixedRoleId: 'r-other' });

    expect(next.dutyProfiles[0]?.fixedRoleId).toBeNull();
  });

  it('없는 역할 id도 비운다', () => {
    const { data, studentId } = seeded();

    const next = applyStudentDetail(data, studentId, { fixedRoleId: '없는역할' });

    expect(next.dutyProfiles[0]?.fixedRoleId).toBeNull();
  });

  it('태그의 공백·빈 값·중복을 정리한다', () => {
    // 같은 태그가 두 번 들어가면 배치 조건 계산이 어긋난다.
    const { data, studentId } = seeded();

    const next = applyStudentDetail(data, studentId, {
      tags: ['  앞자리 ', '앞자리', '', '   ', '조용함'],
    });

    expect(next.seatingProfiles[0]?.tags).toEqual(['앞자리', '조용함']);
  });

  it('프로필이 없던 학생에게도 만들어 넣는다', () => {
    const { data, studentId } = seeded();
    const bare: SuiteData = { ...data, seatingProfiles: [], rewardProfiles: [], dutyProfiles: [] };

    const next = applyStudentDetail(bare, studentId, { gender: 'male', nickname: '하나' });

    expect(next.seatingProfiles).toHaveLength(1);
    expect(next.seatingProfiles[0]?.gender).toBe('male');
    expect(next.rewardProfiles[0]?.nickname).toBe('하나');
    expect(next.dutyProfiles).toHaveLength(1);
  });

  it('없는 학생이면 아무것도 바꾸지 않는다', () => {
    const { data } = seeded();

    expect(applyStudentDetail(data, '없는학생', { nickname: 'x' })).toBe(data);
  });
});

describe('readStudentDetail', () => {
  it('세 프로필에서 값을 모아 온다', () => {
    const { data, studentId } = seeded();
    const saved = applyStudentDetail(data, studentId, { gender: 'female', nickname: '하나' });

    expect(readStudentDetail(saved, studentId)).toEqual({
      gender: 'female',
      tags: [],
      nickname: '하나',
      fixedRoleId: null,
    });
  });

  it('프로필이 없으면 빈 값을 준다', () => {
    const { data, studentId } = seeded();
    const bare: SuiteData = { ...data, seatingProfiles: [], rewardProfiles: [], dutyProfiles: [] };

    expect(readStudentDetail(bare, studentId)).toEqual({
      gender: 'none',
      tags: [],
      nickname: '',
      fixedRoleId: null,
    });
  });
});

describe('collectTags', () => {
  it('그 학급에서 이미 쓴 태그를 모아 준다', () => {
    const { data, studentId } = seeded();
    const saved = applyStudentDetail(data, studentId, { tags: ['조용함', '앞자리'] });

    expect(collectTags(saved, saved.activeClassId ?? '')).toEqual(['앞자리', '조용함']);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/roster/studentDetail.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 순수 함수를 만든다**

Create `src/shared/roster/studentDetail.ts`:

```ts
import {
  createDutyProfile,
  createRewardProfile,
  createSeatingProfile,
} from '../domain/factories';
import type { Gender, SuiteData } from '../domain/types';

/**
 * 학생 한 명의 부가 정보.
 *
 * 세 기능(자리·보상·당번)에 흩어져 저장되지만 교사에게는 전부
 * "이 학생의 정보"다. 명단을 한 번만 등록한다는 통합의 전제와 같은 논리로
 * 한 화면에서 함께 다룬다.
 */
export interface StudentDetail {
  gender: Gender;
  /** 자리 배치 조건에 쓰는 특성 태그 */
  tags: string[];
  nickname: string;
  fixedRoleId: string | null;
}

/** 앞뒤 공백을 없애고 빈 값과 중복을 뺀다. 중복은 배치 조건 계산을 어긋나게 한다. */
function cleanTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (trimmed !== '') seen.add(trimmed);
  }
  return [...seen];
}

export function readStudentDetail(data: SuiteData, studentId: string): StudentDetail {
  const seating = data.seatingProfiles.find((p) => p.studentId === studentId);
  const reward = data.rewardProfiles.find((p) => p.studentId === studentId);
  const duty = data.dutyProfiles.find((p) => p.studentId === studentId);

  return {
    gender: seating?.gender ?? 'none',
    tags: [...(seating?.tags ?? [])],
    nickname: reward?.nickname ?? '',
    fixedRoleId: duty?.fixedRoleId ?? null,
  };
}

/**
 * 세 프로필을 한 번에 갱신한다.
 *
 * update를 세 번 나눠 부르지 않는다. 중간에 실패하면 학생 정보가 반쪽이 된다.
 */
export function applyStudentDetail(
  data: SuiteData,
  studentId: string,
  patch: Partial<StudentDetail>,
): SuiteData {
  const student = data.students.find((s) => s.id === studentId);
  if (student === undefined) return data;

  /*
   * 고정 역할은 그 학생 학급의 역할이어야 한다.
   * 화면에서 못 고르게 막지만 가져오기 같은 다른 경로로도 들어올 수 있고,
   * 참조가 깨지면 불변조건 검사가 조용히 되돌린다. 여기서 먼저 막는다.
   */
  let fixedRoleId = patch.fixedRoleId;
  if (fixedRoleId !== undefined && fixedRoleId !== null) {
    const role = data.dutyRoles.find((r) => r.id === fixedRoleId);
    if (role === undefined || role.classId !== student.classId) fixedRoleId = null;
  }

  const hasSeating = data.seatingProfiles.some((p) => p.studentId === studentId);
  const hasReward = data.rewardProfiles.some((p) => p.studentId === studentId);
  const hasDuty = data.dutyProfiles.some((p) => p.studentId === studentId);

  // 명단 가져오기 경로에 따라 프로필이 없을 수 있다. 없으면 만들어 넣는다.
  const seatingProfiles = hasSeating
    ? data.seatingProfiles
    : [...data.seatingProfiles, createSeatingProfile(studentId)];
  const rewardProfiles = hasReward
    ? data.rewardProfiles
    : [...data.rewardProfiles, createRewardProfile(studentId)];
  const dutyProfiles = hasDuty
    ? data.dutyProfiles
    : [...data.dutyProfiles, createDutyProfile(studentId, student.number)];

  return {
    ...data,
    seatingProfiles: seatingProfiles.map((p) =>
      p.studentId !== studentId
        ? p
        : {
            ...p,
            gender: patch.gender ?? p.gender,
            tags: patch.tags === undefined ? p.tags : cleanTags(patch.tags),
          },
    ),
    rewardProfiles: rewardProfiles.map((p) =>
      p.studentId !== studentId ? p : { ...p, nickname: patch.nickname ?? p.nickname },
    ),
    dutyProfiles: dutyProfiles.map((p) =>
      p.studentId !== studentId
        ? p
        : { ...p, fixedRoleId: fixedRoleId === undefined ? p.fixedRoleId : fixedRoleId },
    ),
  };
}

/** 그 학급에서 이미 쓴 태그. 새로 칠 때 고를 수 있게 보여 준다. */
export function collectTags(data: SuiteData, classId: string): string[] {
  const ids = new Set(data.students.filter((s) => s.classId === classId).map((s) => s.id));
  const tags = new Set<string>();

  for (const profile of data.seatingProfiles) {
    if (!ids.has(profile.studentId)) continue;
    for (const tag of profile.tags) tags.add(tag);
  }

  return [...tags].sort((a, b) => a.localeCompare(b, 'ko'));
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm run verify`
Expected: 전부 통과

`createDutyProfile`·`createRewardProfile`·`createSeatingProfile`의 인자가 다르면
`src/shared/domain/factories.ts`에서 실제 시그니처를 확인해 맞춘다.

- [ ] **Step 5: 커밋**

```bash
git add src/shared/roster/studentDetail.ts tests/roster/studentDetail.test.ts
git commit -m "feat(roster): 학생 부가 정보를 한 번에 갱신하는 순수 함수"
```

---

## Task 4: 학생 수정 모달을 넓힌다

**Files:**
- Modify: `src/shared/roster/RosterPage.tsx`
- Test: `tests/roster/RosterPage.test.tsx` (없으면 새로 만든다)

**Interfaces:**
- Consumes: Task 3의 `readStudentDetail` · `applyStudentDetail` · `collectTags` · `StudentDetail`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/roster/studentDetailModal.test.tsx`를 새로 만든다:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import RosterPage from '../../src/shared/roster/RosterPage';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';
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

function seeded(): SuiteData {
  const term = createTerm(
    { schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    NOW,
  );
  const room = createClassRoom({ termId: term.id, name: '우리 반' }, NOW);
  const student = createStudent({ classId: room.id, number: 1, name: '김하나' }, NOW);

  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room],
    students: [student],
    seatingProfiles: [createSeatingProfile(student.id)],
    rewardProfiles: [createRewardProfile(student.id)],
    dutyProfiles: [createDutyProfile(student.id, 1)],
    activeTermId: term.id,
    activeClassId: room.id,
  };
}

function renderRoster() {
  render(
    <ToastProvider>
      <SuiteDataProvider
        adapter={stubAdapter({
          load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }),
        })}
      >
        <RosterPage />
      </SuiteDataProvider>
    </ToastProvider>,
  );
}

describe('학생 정보 수정 모달', () => {
  it('성별·별명 입력이 있다', async () => {
    renderRoster();

    await userEvent.click(await screen.findByRole('button', { name: /김하나 정보 수정/ }));

    expect(await screen.findByLabelText('별명')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '여' })).toBeInTheDocument();
  });

  it('별명을 저장하면 화면에 남는다', async () => {
    renderRoster();

    await userEvent.click(await screen.findByRole('button', { name: /김하나 정보 수정/ }));
    await userEvent.type(await screen.findByLabelText('별명'), '하나');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    // 다시 열었을 때 값이 남아 있으면 세 프로필에 반영된 것이다.
    await userEvent.click(await screen.findByRole('button', { name: /김하나 정보 수정/ }));
    expect(await screen.findByLabelText('별명')).toHaveValue('하나');
  });
});
```


- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/roster/studentDetailModal.test.tsx`
Expected: FAIL — `별명` 입력을 찾지 못한다

- [ ] **Step 3: 모달에 네 항목을 넣는다**

`src/shared/roster/RosterPage.tsx`의 편집 모달(`title="학생 정보 수정"`)을 넓힌다.

`onSave`의 타입을 바꾼다:

```tsx
  onSave: (patch: { number: number; name: string; detail: Partial<StudentDetail> }) => void;
```

모달 안에 번호·이름 아래로 네 항목을 넣는다. 기존 `<label>` 패턴을 그대로 따른다.

- **성별** — `남`·`여`·`지정 안 함` 세 버튼. 고른 것은 `variant="primary"`, 나머지는 `secondary`.
  값은 `'male'`·`'female'`·`'none'`.
- **특성 태그** — 한 줄 입력 + `Enter`로 추가. 추가된 태그는 `Badge`로 보이고 누르면 지운다.
  아래에 `collectTags(data, classId)` 결과 중 아직 안 쓴 것을 눌러 담을 수 있게 둔다.
- **별명** — `<input>` 한 줄. `aria-label="별명"`.
- **고정 역할** — `<select>`. 첫 항목은 `(고정 역할 없음)`이고 값은 빈 문자열.
  목록은 **현재 학급 역할만**: `data.dutyRoles.filter((r) => r.classId === student.classId)`.

모달을 열 때 `readStudentDetail(data, student.id)`로 초기값을 채운다.

- [ ] **Step 4: 저장을 잇는다**

`onSave` 처리부(지금 `updateStudent`를 부르는 자리)에서 한 번의 `update`로 함께 쓴다:

```tsx
        onSave={(patch) => {
          update((current) => {
            const renamed = updateStudent(current, editing.id, {
              number: patch.number,
              name: patch.name,
            });
            // 두 번 나눠 쓰지 않는다. 중간에 실패하면 학생 정보가 반쪽이 된다.
            return applyStudentDetail(renamed, editing.id, patch.detail);
          });
          setEditing(null);
        }}
```

`updateStudent`의 실제 시그니처를 `src/shared/roster/rosterOps.ts:63`에서 확인해 맞춘다.

- [ ] **Step 5: 통과를 확인한다**

Run: `npm run verify`
Expected: 전부 통과

- [ ] **Step 6: 커밋**

```bash
git add src/shared/roster/RosterPage.tsx tests/roster/studentDetailModal.test.tsx
git commit -m "feat(roster): 학생 수정 모달에 성별·태그·별명·고정 역할"
```

---

## Task 5: 점수 주기 설정과 NEIS 코드

**Files:**
- Modify: `src/features/reward/useReward.ts`, `src/features/reward/RewardPage.tsx`, `src/features/settings/SettingsPage.tsx`

**Interfaces:**
- Consumes: Task 1의 `ScoreCycle`, Task 2의 계산
- Produces: `useReward()`에 `setCycle: (patch: Partial<ScoreCycle>) => void`

- [ ] **Step 1: 주기를 바꾸는 함수를 만든다**

`useReward`는 지금 `data.scoreCycle`을 **읽기만 한다.** 바꾸는 길이 없다.

`src/features/reward/useReward.ts`의 반환 인터페이스에 추가:

```ts
  /** 점수 주기 설정을 바꾼다 */
  setCycle: (patch: Partial<ScoreCycle>) => void;
```

구현:

```ts
  const setCycle = useCallback(
    (patch: Partial<ScoreCycle>): void => {
      update((current) => ({ ...current, scoreCycle: { ...current.scoreCycle, ...patch } }));
    },
    [update],
  );
```

`ScoreCycle` 타입 임포트와 반환 객체에 `setCycle`을 넣는 것을 잊지 않는다.

- [ ] **Step 2: 점수 주기 탭에 설정 둘을 넣는다**

`src/features/reward/RewardPage.tsx`의 `score` 탭에 `Card`를 하나 더한다.

- **월 주기 기준** — `1일~말일`·`지정일부터` 두 버튼.
  `지정일부터`를 고른 경우에만 `monthlyStartDay` 숫자 입력(1~28)을 보인다.
- **통산 점수 표시** — 켜기/끄기 버튼 하나. `showLifetimeCumulative`.

`showLifetimeCumulative`가 켜져 있으면 점수 목록에 `전체` 기간 합계를 함께 보인다.
계산은 이미 `cycleRangeFor('all', ...)`로 있으므로 표시만 더한다.

- [ ] **Step 3: NEIS 코드 입력칸을 넣는다**

`src/features/settings/SettingsPage.tsx`의 학교 정보 탭에 학교 이름·선생님 이름과
같은 방식으로 두 칸을 더한다.

```tsx
        <label className="block text-sm">
          <span className="text-slate-700">교육청 코드</span>
          <input
            type="text"
            defaultValue={data.profile.officeCode}
            onBlur={(event) => {
              const officeCode = event.target.value.trim();
              if (officeCode !== data.profile.officeCode) {
                update((current) => ({ ...current, profile: { ...current.profile, officeCode } }));
                toast.success('교육청 코드를 저장했습니다.');
              }
            }}
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>
```

`schoolCode`도 같은 모양으로 넣는다.

두 칸 아래에 안내를 한 줄 단다. **지금 아무 일도 일어나지 않는 칸이므로 설명이 없으면
교사가 고장으로 읽는다.**

```tsx
        <p className="text-sm text-slate-500">
          나중에 급식·시간표를 불러올 때 쓰는 값입니다. 지금은 저장만 해 둡니다.
        </p>
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm run verify`
Expected: 전부 통과

- [ ] **Step 5: 브라우저에서 확인한다**

`npm run dev` 후:

- 명단에서 학생을 열어 성별·태그·별명·고정 역할을 넣고 저장 → 다시 열었을 때 남아 있는지
- 활동·보상 → 점수 주기에서 `1일~말일`과 `지정일부터`를 바꿔 `이번 달` 합계가 달라지는지
- 설정 → 학교 정보에 코드를 넣고 새로고침해도 남는지

- [ ] **Step 6: 커밋**

```bash
git add src/features/reward src/features/settings
git commit -m "feat(reward,settings): 월 주기 기준·통산 표시·NEIS 코드 입력"
```

---

## Task 6: 점검 문서를 사실에 맞춘다

**Files:**
- Modify: `docs/reference/missing-features-audit.md`

- [ ] **Step 1: A 목록에서 끝난 것을 지우고 남는 셋을 B로 옮긴다**

A 목록에서 이번에 화면을 붙인 것들(성별·태그, 별명, 고정 역할, 점수 주기 2종, NEIS 코드)을
`완료 2026-08-14`로 표시한다.

남는 셋을 B로 옮기고 이유를 적는다.

| 항목 | B로 옮기는 이유 |
|---|---|
| `ClassRoom.grade`·`classNo` | 학급 관리 화면이 통째로 없다. 처음 설정 마법사 뒤로는 학급을 늘리거나 고칠 수 없다 |
| `Term.archivedAt` | 학기 관리 화면이 없다 |
| `ScoreGoal.achievedAt` | 입력 화면 문제가 아니라 로직 누락이다. 화면은 점수 합계로 달성 여부를 계산할 뿐 시각을 기록하지 않는다 |

걷어낸 두 설정도 B에 적는다.

| 항목 | 되살리려면 |
|---|---|
| `weeklyStartDayApplyMode` | 바꾼 시점을 저장할 필드를 모델에 더해야 한다 |
| `monthlyType`의 `teacher_manual` | 주기 관리 화면이 필요하다 |

- [ ] **Step 2: 커밋**

```bash
git add docs/reference/missing-features-audit.md
git commit -m "docs: 점검 결과를 이번 작업 뒤 상태로 갱신"
```

---

## 완료 확인

- [ ] `npm run verify` 통과
- [ ] 브라우저에서 세 화면 확인
- [ ] `grep -rn "weeklyStartDayApplyMode\|teacher_manual" src/` 결과 없음
- [ ] push
