# 2-나-1 시간표 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교사가 우리 반 시간표를 한 번 짜 두면, 홈 화면이 오늘 교시를 순서대로 보여 준다.

**Architecture:** `SuiteData.timetableEntries`에 `(classId, weekday, period) → subject` 한 칸씩 담는다. 판단은 전부 `timetableCore.ts`의 순수 함수에 두고, 화면 둘(설정 탭 · 홈 카드)은 그것을 부른다. NEIS는 안 부른다 — 열쇠 없이는 6교시가 잘려서 못 쓴다는 것을 확인했다.

**Tech Stack:** React 19 · TypeScript 5.8 (`strict`, `noUncheckedIndexedAccess`) · Vitest · Testing Library · Tailwind 4

## Global Constraints

- 기능 코드는 `localStorage`를 직접 부르지 않는다. 반드시 `useSuite()`의 `update()`를 거친다.
- 필수 환경변수를 만들지 않는다.
- 주석은 한국어로, **무엇이 아니라 왜**를 적는다.
- 이 판은 NEIS를 부르지 않는다. `NeisSource`·`TauriHttpClient`·`CacheStore`를 import하지 않는다.
- 웹과 설치형 양쪽에서 똑같이 돈다. `isDesktop()` 분기를 새로 만들지 않는다 — 시간표는 바깥 통신이 없어 웹에서도 된다.
- 교시는 1~7, 요일은 1(월)~5(금).
- 빈 칸은 '그날 그 교시가 없다'는 뜻이다. 빈 글자 항목을 만들지 않고 항목 자체를 없앤다.
- 각 과제는 `npm run verify`가 통과해야 커밋한다.

---

### Task 1: 자료 모델

**Files:**
- Modify: `src/shared/domain/types.ts` (`TimetableEntry` 추가, `SuiteData`에 칸 추가)
- Modify: `src/shared/domain/factories.ts:446` (`createEmptySuiteData`)
- Modify: `src/shared/storage/schema.ts` (`parseTimetableEntry`, `parseList` 한 줄)
- Test: `tests/storage/timetableSchema.test.ts`

**Interfaces:**
- Produces: `TimetableEntry { classId: string; weekday: number; period: number; subject: string }`, `SuiteData.timetableEntries: TimetableEntry[]`

- [ ] **Step 1: 실패하는 시험을 쓴다**

`tests/storage/timetableSchema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { createEmptySuiteData } from '../../src/shared/domain/factories';
import { parseSuiteData, serializeSuiteData } from '../../src/shared/storage/schema';

/*
 * 시간표는 학급 자료다. 백업 파일에 안 들어가면 컴퓨터를 바꾼 교사가
 * 서른다섯 칸을 다시 채워야 한다. 왕복이 되는지부터 못 박는다.
 */
describe('시간표 저장·복원', () => {
  it('담은 칸이 그대로 돌아온다', () => {
    const data = createEmptySuiteData();
    data.timetableEntries = [
      { classId: 'class-1', weekday: 1, period: 3, subject: '수학' },
      { classId: 'class-1', weekday: 5, period: 1, subject: '즐거운생활' },
    ];

    const back = parseSuiteData(serializeSuiteData(data));

    expect(back.data.timetableEntries).toEqual(data.timetableEntries);
  });

  it('시간표 칸이 없는 옛 자료도 열린다', () => {
    // 2-가까지 쓰던 백업 파일에는 이 칸이 아예 없다.
    const old = JSON.parse(serializeSuiteData(createEmptySuiteData())) as Record<string, unknown>;
    delete old['timetableEntries'];

    const back = parseSuiteData(JSON.stringify(old));

    expect(back.data.timetableEntries).toEqual([]);
  });

  it('망가진 칸은 버리고 나머지를 살린다', () => {
    const data = createEmptySuiteData();
    const raw = JSON.parse(serializeSuiteData(data)) as Record<string, unknown>;
    raw['timetableEntries'] = [
      { classId: 'class-1', weekday: 1, period: 1, subject: '국어' },
      { weekday: 2, period: 1, subject: '학급이 없다' },
      { classId: 'class-1', period: 1, subject: '요일이 없다' },
      '글자가 왔다',
    ];

    const back = parseSuiteData(JSON.stringify(raw));

    // 한 칸이 망가졌다고 시간표 전체를 버리면 안 된다.
    expect(back.data.timetableEntries).toEqual([
      { classId: 'class-1', weekday: 1, period: 1, subject: '국어' },
    ]);
    expect(back.repairs.length).toBeGreaterThan(0);
  });

  it('범위를 벗어난 교시·요일은 버린다', () => {
    const data = createEmptySuiteData();
    const raw = JSON.parse(serializeSuiteData(data)) as Record<string, unknown>;
    raw['timetableEntries'] = [
      { classId: 'class-1', weekday: 6, period: 1, subject: '토요일' },
      { classId: 'class-1', weekday: 1, period: 8, subject: '8교시' },
      { classId: 'class-1', weekday: 1, period: 0, subject: '0교시' },
    ];

    // 화면은 1~5요일 × 1~7교시만 그린다. 벗어난 칸은 어디에도 안 나타나면서
    // 파일만 키우고, 나중에 범위를 넓히면 유령처럼 되살아난다.
    expect(parseSuiteData(JSON.stringify(raw)).data.timetableEntries).toEqual([]);
  });
});
```

- [ ] **Step 2: 시험이 실패하는지 확인한다**

Run: `npx vitest run tests/storage/timetableSchema.test.ts`
Expected: FAIL — `timetableEntries`가 `SuiteData`에 없어 타입 오류

- [ ] **Step 3: 타입을 더한다**

`src/shared/domain/types.ts` — `SuiteData` 선언 바로 앞에 넣는다:

```ts
// ─────────────────────────────────────────────────────────────
// 시간표 (features/timetable)
// ─────────────────────────────────────────────────────────────

/** 시간표에 둘 수 있는 가장 늦은 교시. 초등은 6교시가 흔하고 7교시를 쓰는 학교가 있다. */
export const MAX_PERIOD = 7;

/**
 * 시간표 한 칸.
 *
 * id를 두지 않는다. `(classId, weekday, period)`가 자연키이고, 한 칸에 두
 * 과목이 있을 수 없으므로 id는 중복을 허용하는 구멍만 된다.
 *
 * **없는 교시는 항목 자체가 없다.** 빈 글자로 두지 않는다. 그래서 요일마다
 * 몇 교시인지 따로 묻지 않아도 된다 — 금요일에 넷만 채우면 금요일은 4교시다.
 */
export interface TimetableEntry {
  classId: string;
  /** 1(월) ~ 5(금). 초등 시간표에 주말은 없다. */
  weekday: number;
  /** 1 ~ MAX_PERIOD */
  period: number;
  subject: string;
}
```

`SuiteData`에 `submissions: Submission[];` 바로 아래로 한 줄 더한다:

```ts
  /** 학급마다 한 벌. 학기가 바뀌어 학급을 새로 만들면 시간표도 새로 시작한다. */
  timetableEntries: TimetableEntry[];
```

- [ ] **Step 4: 빈 자료에 칸을 더한다**

`src/shared/domain/factories.ts`의 `createEmptySuiteData` 안, `submissions: [],` 아래:

```ts
    timetableEntries: [],
```

- [ ] **Step 5: 읽는 쪽을 더한다**

`src/shared/storage/schema.ts` — `parseSavedLayout` 함수 바로 위에 넣는다:

```ts
function parseTimetableEntry(raw: unknown): TimetableEntry | null {
  if (!isRecord(raw)) return null;

  const classId = requiredStr(raw['classId']);
  const subject = requiredStr(raw['subject']);
  if (classId === null || subject === null) return null;

  const weekday = Math.round(num(raw['weekday'], 0));
  const period = Math.round(num(raw['period'], 0));

  /*
   * 범위를 벗어난 칸은 버린다. 화면이 1~5요일 × 1~7교시만 그리므로 그런
   * 칸은 어디에도 안 보이면서 파일만 키우고, 나중에 범위를 넓히면 유령처럼
   * 되살아난다.
   */
  if (weekday < 1 || weekday > 5) return null;
  if (period < 1 || period > MAX_PERIOD) return null;

  return { classId, weekday, period, subject };
}
```

`schema.ts` 맨 위의 `types` import에 `MAX_PERIOD`와 `type TimetableEntry`를 더한다.

`shaped` 객체의 `submissions:` 줄 아래에 한 줄 더한다:

```ts
    timetableEntries: parseList('timetableEntries', '시간표', parseTimetableEntry),
```

- [ ] **Step 6: 시험이 통과하는지 확인한다**

Run: `npx vitest run tests/storage/timetableSchema.test.ts`
Expected: PASS (4개)

- [ ] **Step 7: 전체 검증**

Run: `npm run verify`
Expected: exit 0. 시험 수는 874 + 4 = 878.

- [ ] **Step 8: 커밋**

```bash
git add -A && git commit -m "feat: 시간표 칸을 학급 자료에 더한다"
```

---

### Task 2: 판단하는 자리 — `timetableCore.ts`

**Files:**
- Create: `src/features/timetable/timetableCore.ts`
- Test: `tests/timetable/timetableCore.test.ts`

**Interfaces:**
- Consumes: `TimetableEntry`, `MAX_PERIOD` (Task 1)
- Produces:
  - `WEEKDAY_NAMES: readonly string[]` — `['월','화','수','목','금']`
  - `DEFAULT_SUBJECTS: readonly string[]`
  - `subjectButtons(entries: TimetableEntry[], classId: string): string[]`
  - `cellSubject(entries: TimetableEntry[], classId: string, weekday: number, period: number): string`
  - `paintCell(entries: TimetableEntry[], classId: string, weekday: number, period: number, subject: string): TimetableEntry[]`
  - `todayPeriods(entries: TimetableEntry[], classId: string, weekday: number): { period: number; subject: string }[]`
  - `weekdayOf(date: Date): number` — 월=1…금=5, 주말은 0

- [ ] **Step 1: 실패하는 시험을 쓴다**

`tests/timetable/timetableCore.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { TimetableEntry } from '../../src/shared/domain/types';
import {
  cellSubject,
  paintCell,
  subjectButtons,
  todayPeriods,
  weekdayOf,
} from '../../src/features/timetable/timetableCore';

const CLASS = 'class-1';

function at(weekday: number, period: number, subject: string): TimetableEntry {
  return { classId: CLASS, weekday, period, subject };
}

describe('칸 찍기', () => {
  it('빈 칸에 찍으면 들어간다', () => {
    const after = paintCell([], CLASS, 1, 3, '수학');

    expect(after).toEqual([at(1, 3, '수학')]);
  });

  it('찬 칸에 다른 과목을 찍으면 바뀐다', () => {
    const after = paintCell([at(1, 3, '국어')], CLASS, 1, 3, '수학');

    // 한 칸에 두 과목이 있을 수 없다. 늘어나면 화면이 둘을 겹쳐 그린다.
    expect(after).toEqual([at(1, 3, '수학')]);
  });

  it('같은 과목을 다시 찍으면 지워진다', () => {
    const after = paintCell([at(1, 3, '수학')], CLASS, 1, 3, '수학');

    // 지우개를 따로 두지 않는다. 잘못 찍었을 때 되돌리는 길이 손에 있어야 한다.
    expect(after).toEqual([]);
  });

  it('다른 학급 칸은 건드리지 않는다', () => {
    const other: TimetableEntry = { classId: 'class-2', weekday: 1, period: 3, subject: '영어' };

    const after = paintCell([other], CLASS, 1, 3, '수학');

    expect(after).toHaveLength(2);
    expect(after).toContainEqual(other);
  });

  it('빈 과목을 찍으면 지워진다', () => {
    // 직접 입력 칸을 비운 채 찍은 경우다. 빈 글자 항목이 남으면 안 된다.
    expect(paintCell([at(1, 3, '수학')], CLASS, 1, 3, '')).toEqual([]);
  });
});

describe('칸 읽기', () => {
  it('찍힌 과목을 돌려준다', () => {
    expect(cellSubject([at(2, 4, '체육')], CLASS, 2, 4)).toBe('체육');
  });

  it('빈 칸은 빈 글자다', () => {
    expect(cellSubject([at(2, 4, '체육')], CLASS, 2, 5)).toBe('');
  });

  it('다른 학급 것을 가져오지 않는다', () => {
    const other: TimetableEntry = { classId: 'class-2', weekday: 2, period: 4, subject: '영어' };

    expect(cellSubject([other], CLASS, 2, 4)).toBe('');
  });
});

describe('과목 단추', () => {
  it('기본 목록으로 시작한다', () => {
    const buttons = subjectButtons([], CLASS);

    expect(buttons).toContain('국어');
    expect(buttons).toContain('창체');
  });

  it('직접 입력한 과목이 단추가 된다', () => {
    /*
     * 기본 목록은 고학년에 맞춰져 있다. 저학년은 '즐거운생활'을 쓰는데,
     * 한 벌로 두 쪽을 다 덮을 수 없다. 한 번 치면 그 뒤로는 단추다.
     */
    const buttons = subjectButtons([at(1, 1, '즐거운생활')], CLASS);

    expect(buttons).toContain('즐거운생활');
  });

  it('기본에 있는 과목을 써도 두 번 나오지 않는다', () => {
    const buttons = subjectButtons([at(1, 1, '국어')], CLASS);

    expect(buttons.filter((s) => s === '국어')).toHaveLength(1);
  });

  it('다른 학급이 쓴 과목은 안 가져온다', () => {
    const other: TimetableEntry = { classId: 'class-2', weekday: 1, period: 1, subject: '중국어' };

    expect(subjectButtons([other], CLASS)).not.toContain('중국어');
  });
});

describe('오늘 교시', () => {
  it('교시 순서대로 돌려준다', () => {
    const entries = [at(3, 2, '수학'), at(3, 1, '국어'), at(3, 4, '체육')];

    expect(todayPeriods(entries, CLASS, 3)).toEqual([
      { period: 1, subject: '국어' },
      { period: 2, subject: '수학' },
      { period: 4, subject: '체육' },
    ]);
  });

  it('중간이 비어도 그대로 둔다', () => {
    // 3교시가 빈 것은 자료가 빠진 게 아니라 그 교시가 없다는 뜻이다.
    const entries = [at(3, 1, '국어'), at(3, 4, '체육')];

    expect(todayPeriods(entries, CLASS, 3).map((p) => p.period)).toEqual([1, 4]);
  });

  it('다른 요일은 안 섞는다', () => {
    const entries = [at(3, 1, '국어'), at(4, 1, '수학')];

    expect(todayPeriods(entries, CLASS, 3)).toEqual([{ period: 1, subject: '국어' }]);
  });

  it('주말은 빈 목록이다', () => {
    expect(todayPeriods([at(1, 1, '국어')], CLASS, 0)).toEqual([]);
  });
});

describe('요일 재기', () => {
  it('월요일은 1이다', () => {
    // 2026-08-24는 월요일이다.
    expect(weekdayOf(new Date(2026, 7, 24))).toBe(1);
  });

  it('금요일은 5다', () => {
    expect(weekdayOf(new Date(2026, 7, 28))).toBe(5);
  });

  it('주말은 0이다', () => {
    // Date의 getDay()는 일요일이 0이라 그대로 쓰면 일요일이 월요일이 된다.
    expect(weekdayOf(new Date(2026, 7, 29))).toBe(0);
    expect(weekdayOf(new Date(2026, 7, 30))).toBe(0);
  });
});
```

- [ ] **Step 2: 시험이 실패하는지 확인한다**

Run: `npx vitest run tests/timetable/timetableCore.test.ts`
Expected: FAIL — 모듈이 없다

- [ ] **Step 3: 구현한다**

`src/features/timetable/timetableCore.ts`:

```ts
import type { TimetableEntry } from '../../shared/domain/types';

/** 표의 가로줄. 초등 시간표에 주말은 없다. */
export const WEEKDAY_NAMES = ['월', '화', '수', '목', '금'] as const;

/**
 * 처음에 보여 줄 과목.
 *
 * 고학년에 맞춰져 있다. 저학년의 `즐거운생활`·`바른생활`·`슬기로운생활`은
 * 여기 없는데, 한 벌로 두 쪽을 다 덮으면 단추가 열다섯 개가 되어 고르기가
 * 더 어려워진다. 대신 직접 입력한 과목이 단추가 된다.
 */
export const DEFAULT_SUBJECTS = [
  '국어',
  '수학',
  '사회',
  '과학',
  '영어',
  '체육',
  '음악',
  '미술',
  '도덕',
  '실과',
  '창체',
] as const;

/** 이 학급 것만 고른다. 시간표는 학급마다 한 벌이다. */
function mine(entries: TimetableEntry[], classId: string): TimetableEntry[] {
  return entries.filter((entry) => entry.classId === classId);
}

/**
 * 고를 수 있는 과목.
 *
 * 기본 목록에 **이 시간표에 이미 쓰인 과목**을 더한다. 저학년 담임이
 * `즐거운생활`을 한 번 치면 그 뒤로는 단추다. 기본 목록이 자기 학년에
 * 안 맞는 문제가 한 번의 타이핑으로 끝나고, 그 뒤로는 안 겪는다.
 */
export function subjectButtons(entries: TimetableEntry[], classId: string): string[] {
  const seen = new Set<string>(DEFAULT_SUBJECTS);
  const extra: string[] = [];

  for (const entry of mine(entries, classId)) {
    if (entry.subject === '' || seen.has(entry.subject)) continue;
    seen.add(entry.subject);
    extra.push(entry.subject);
  }

  return [...DEFAULT_SUBJECTS, ...extra];
}

export function cellSubject(
  entries: TimetableEntry[],
  classId: string,
  weekday: number,
  period: number,
): string {
  const found = mine(entries, classId).find(
    (entry) => entry.weekday === weekday && entry.period === period,
  );
  return found?.subject ?? '';
}

/**
 * 칸을 찍는다. 바뀐 목록을 돌려준다.
 *
 * 같은 과목을 다시 찍으면 지워진다. **지우개를 따로 두지 않는 것이 뜻이다** —
 * 잘못 찍었을 때 되돌리는 길이 방금 누른 그 자리에 있어야 한다.
 */
export function paintCell(
  entries: TimetableEntry[],
  classId: string,
  weekday: number,
  period: number,
  subject: string,
): TimetableEntry[] {
  const rest = entries.filter(
    (entry) =>
      entry.classId !== classId || entry.weekday !== weekday || entry.period !== period,
  );

  const already = cellSubject(entries, classId, weekday, period);
  if (subject === '' || subject === already) return rest;

  return [...rest, { classId, weekday, period, subject }];
}

/** 그 요일에 채워진 교시를 순서대로. 주말(0)이면 빈 목록. */
export function todayPeriods(
  entries: TimetableEntry[],
  classId: string,
  weekday: number,
): { period: number; subject: string }[] {
  return mine(entries, classId)
    .filter((entry) => entry.weekday === weekday)
    .sort((a, b) => a.period - b.period)
    .map((entry) => ({ period: entry.period, subject: entry.subject }));
}

/**
 * 월=1 … 금=5, 주말은 0.
 *
 * `getDay()`를 그대로 쓰면 일요일이 0이라 월요일이 1이 되는 것까지는 맞지만
 * 일요일과 '요일 없음'이 구별되지 않는다. 주말을 0 하나로 모은다.
 */
export function weekdayOf(date: Date): number {
  const day = date.getDay();
  return day >= 1 && day <= 5 ? day : 0;
}
```

- [ ] **Step 4: 시험이 통과하는지 확인한다**

Run: `npx vitest run tests/timetable/timetableCore.test.ts`
Expected: PASS (22개) — 계획에 적힌 19개에 구현자가 셋을 더했다

- [ ] **Step 5: 시험에 이가 있는지 확인한다**

아래 변이를 하나씩 넣고 **각각 시험이 실패하는지** 확인한 뒤 되돌린다. 통과해 버리는 변이가 있으면 그 시험을 고친다.

| 변이 | 실패해야 하는 시험 |
|---|---|
| `paintCell`에서 `subject === already` 조건을 뺀다 | 같은 과목을 다시 찍으면 지워진다 |
| `mine()`의 `classId` 비교를 없애고 전부 돌려준다 | 다른 학급 것을 가져오지 않는다 |
| `weekdayOf`를 `date.getDay()`로 바꾼다 | 주말은 0이다 |
| `todayPeriods`의 `.sort(...)`를 뺀다 | 교시 순서대로 돌려준다 |

- [ ] **Step 6: 커밋**

```bash
git add -A && git commit -m "feat: 시간표 판단을 순수 함수로 떼어 둔다"
```

---

### Task 3: 짜는 화면 — 설정 탭

**Files:**
- Create: `src/features/timetable/TimetableTab.tsx`
- Modify: `src/features/settings/SettingsPage.tsx` (탭 목록에 한 줄, 그리는 곳에 한 줄, import)
- Test: `tests/timetable/TimetableTab.test.tsx`

**Interfaces:**
- Consumes: `timetableCore`의 전부 (Task 2), `useSuite()`, `useActiveClass()`
- Produces: `<TimetableTab />` — 인자 없음. 안에서 활성 학급을 읽는다.

**참고할 관례:** `src/features/settings/ClassTermTab.tsx`가 같은 자리에서 `useSuite()`로 학급 자료를 고친다. `update()` 쓰는 법을 거기서 본다.

- [ ] **Step 1: 실패하는 시험을 쓴다**

`tests/timetable/TimetableTab.test.tsx`:

```ts
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createClassRoom, createEmptySuiteData, createTerm } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { TimetableTab } from '../../src/features/timetable/TimetableTab';
import { stubAdapter } from '../helpers/stubAdapter';

const T0 = '2026-03-02T09:00:00.000Z';

function seeded(): SuiteData {
  const data = createEmptySuiteData();
  return {
    ...data,
    terms: [
      createTerm(
        { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
        T0,
      ),
    ],
    classRooms: [createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, T0)],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

function show(data: SuiteData = seeded()) {
  return render(
    <ToastProvider>
      <SuiteDataProvider
        adapter={stubAdapter({ load: async () => ({ data, repairs: [], isFirstRun: false }) })}
      >
        <TimetableTab />
      </SuiteDataProvider>
    </ToastProvider>,
  );
}

/** 월요일 3교시 칸. 표의 칸에는 `월요일 3교시` 라벨을 단다. */
function cell(weekdayName: string, period: number): HTMLElement {
  return screen.getByRole('button', { name: `${weekdayName}요일 ${period}교시` });
}

describe('시간표 짜기', () => {
  it('과목을 고르고 칸을 찍으면 들어간다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole('button', { name: '수학' }));
    await user.click(cell('월', 3));

    expect(within(cell('월', 3)).getByText('수학')).toBeInTheDocument();
  });

  it('과목을 안 고르고 칸을 찍으면 알려 준다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole('button', { name: '월요일 3교시' }));

    // 아무 일도 안 일어나면 선생님은 앱이 고장 났다고 여긴다.
    expect(screen.getByRole('status')).toHaveTextContent('과목을 먼저 고르세요');
  });

  it('같은 과목을 다시 찍으면 지워진다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole('button', { name: '수학' }));
    await user.click(cell('월', 3));
    await user.click(cell('월', 3));

    expect(within(cell('월', 3)).queryByText('수학')).not.toBeInTheDocument();
  });

  it('직접 입력한 과목이 단추가 된다', async () => {
    const user = userEvent.setup();
    show();

    await user.type(await screen.findByLabelText('직접 입력'), '즐거운생활');
    await user.click(screen.getByRole('button', { name: '더하기' }));

    expect(screen.getByRole('button', { name: '즐거운생활' })).toBeInTheDocument();
  });

  it('일곱 교시까지 다섯 요일을 그린다', async () => {
    show();

    await screen.findByRole('button', { name: '월요일 1교시' });
    expect(screen.getByRole('button', { name: '금요일 7교시' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '토요일 1교시' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '월요일 8교시' })).not.toBeInTheDocument();
  });

  it('직접 입력한 과목이 너무 길면 자른다', async () => {
    const user = userEvent.setup();
    show();

    await user.type(await screen.findByLabelText('직접 입력'), '아주아주긴과목이름을붙여넣었다');
    await user.click(screen.getByRole('button', { name: '더하기' }));

    // 길이를 안 자르면 단추 하나가 표를 통째로 찌그러뜨린다. 12자는
    // 수업 흐름·문제 세트가 이미 쓰는 규칙(shared/subjects.ts)이다.
    expect(screen.getByRole('button', { name: '아주아주긴과목이름을붙' })).toBeInTheDocument();
  });

  it('학급이 없으면 학급부터 만들라고 한다', async () => {
    show(createEmptySuiteData());

    // 시간표는 학급에 매인다. 학급 없이 칸을 찍게 두면 갈 곳 없는 자료가 쌓인다.
    expect(await screen.findByText(/학급을 먼저/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 시험이 실패하는지 확인한다**

Run: `npx vitest run tests/timetable/TimetableTab.test.tsx`
Expected: FAIL — 모듈이 없다

- [ ] **Step 3: 화면을 만든다**

`src/features/timetable/TimetableTab.tsx`:

```tsx
import { useState } from 'react';

import { MAX_PERIOD } from '../../shared/domain/types';
import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { CalendarDays } from 'lucide-react';

import { Button, Card, EmptyState, cx } from '../../shared/ui';
import { normalizeSubject } from '../../shared/subjects';
import { WEEKDAY_NAMES, cellSubject, paintCell, subjectButtons } from './timetableCore';

const PERIODS = Array.from({ length: MAX_PERIOD }, (_, index) => index + 1);

/**
 * 우리 반 시간표를 짠다.
 *
 * 칸마다 과목을 고르게 하면 서른다섯 칸에 일흔 번을 움직여야 한다. 뒤집었다 —
 * **과목을 먼저 고르고 칸을 찍는다.** 국어를 고르고 국어 칸 여섯을 찍고,
 * 수학을 고르고 넷을 찍는다. 고르는 횟수가 과목 수만큼으로 줄어든다.
 */
export function TimetableTab() {
  const { data, update } = useSuite();
  const activeClass = useActiveClass();
  const [picked, setPicked] = useState('');
  const [typed, setTyped] = useState('');
  const [extra, setExtra] = useState<string[]>([]);
  const [note, setNote] = useState('');

  if (activeClass === null) {
    return (
      <EmptyState
        title="학급을 먼저 만들어 주세요"
        description="시간표는 학급마다 한 벌입니다. 학급·학기 탭에서 만든 뒤 돌아오세요."
      />
    );
  }

  const classId = activeClass.id;
  const buttons = [...subjectButtons(data.timetableEntries, classId), ...extra].filter(
    (subject, index, all) => all.indexOf(subject) === index,
  );

  const tap = (weekday: number, period: number): void => {
    if (picked === '') {
      // 아무 일도 안 일어나면 선생님은 앱이 고장 났다고 여긴다.
      setNote('과목을 먼저 고르세요.');
      return;
    }
    setNote('');
    update((current) => ({
      ...current,
      timetableEntries: paintCell(current.timetableEntries, classId, weekday, period, picked),
    }));
  };

  const addTyped = (): void => {
    /*
     * normalizeSubject를 쓴다. trim만 하면 길이 제한이 없어, 어딘가에서
     * 긴 글을 붙여 넣은 교사가 표를 찌그러뜨리는 단추 하나를 만들게 된다.
     * 수업 흐름·문제 세트가 이미 이 규칙(12자)을 쓰고 있어 결도 맞는다.
     */
    const name = normalizeSubject(typed);
    if (name === '') return;
    setExtra((current) => (current.includes(name) ? current : [...current, name]));
    setPicked(name);
    setTyped('');
  };

  return (
    <Card title="우리 반 시간표" icon={CalendarDays}>
      <p className="text-sm text-slate-500">{activeClass.name}</p>

      <div className="mt-3 flex flex-wrap gap-1">
        {buttons.map((subject) => (
          <button
            key={subject}
            type="button"
            onClick={() => {
              setPicked(subject);
              setNote('');
            }}
            className={cx(
              'rounded-control border px-3 py-1 text-sm',
              picked === subject
                ? 'border-brand-600 bg-brand-600 font-medium text-white'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50',
            )}
          >
            {subject}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-end gap-2">
        <label className="text-sm">
          <span className="text-slate-700">직접 입력</span>
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="예: 즐거운생활"
            className="mt-1 h-9 w-40 rounded-control border border-slate-300 px-2"
          />
        </label>
        <Button type="button" onClick={addTyped}>
          더하기
        </Button>
      </div>

      <p role="status" className="mt-2 min-h-5 text-sm text-danger-600">
        {note}
      </p>

      <table className="mt-2 w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th className="w-10" />
            {WEEKDAY_NAMES.map((name) => (
              <th key={name} className="pb-1 text-sm font-medium text-slate-600">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period) => (
            <tr key={period}>
              <th className="text-sm font-normal text-slate-500">{period}</th>
              {WEEKDAY_NAMES.map((name, index) => {
                const weekday = index + 1;
                const subject = cellSubject(data.timetableEntries, classId, weekday, period);
                return (
                  <td key={name} className="p-0.5">
                    <button
                      type="button"
                      aria-label={`${name}요일 ${period}교시`}
                      onClick={() => tap(weekday, period)}
                      className={cx(
                        'h-9 w-full rounded-control border text-sm',
                        subject === ''
                          ? 'border-dashed border-slate-200 hover:bg-slate-50'
                          : 'border-slate-300 bg-slate-50 text-slate-900',
                      )}
                    >
                      {subject === '' ? '' : <span>{subject}</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-2 text-xs text-slate-500">
        빈 칸은 그날 그 교시가 없다는 뜻입니다. 찍은 칸을 다시 누르면 지웁니다.
      </p>
    </Card>
  );
}
```

- [ ] **Step 4: 설정 화면에 탭을 단다**

`src/features/settings/SettingsPage.tsx`:

네 군데를 고친다. 시간표는 학급에 매이므로 `학급·학기` 바로 뒤에 놓는다.

`SettingsPage.tsx:24`:

```ts
type SettingsTab = 'school' | 'classes' | 'timetable' | 'lock' | 'sync' | 'backup' | 'legacy';
```

import 줄(`import { SchoolSearch } from './SchoolSearch';` 부근, 이름순 자리):

```ts
import { TimetableTab } from '../timetable/TimetableTab';
```

탭 목록:

```tsx
          { id: 'classes', label: '학급·학기' },
          { id: 'timetable', label: '시간표' },
          { id: 'lock', label: '교사 잠금' },
```

그리는 곳:

```tsx
        {tab === 'classes' ? <ClassTermTab /> : null}
        {tab === 'timetable' ? <TimetableTab /> : null}
        {tab === 'lock' ? <LockTab /> : null}
```

`isDesktop()` 분기를 걸지 않는다. **시간표는 바깥 통신이 없어 웹에서도 그대로 돈다.**

- [ ] **Step 5: 시험이 통과하는지 확인한다**

Run: `npx vitest run tests/timetable/TimetableTab.test.tsx`
Expected: PASS (7개)

- [ ] **Step 6: 전체 검증**

Run: `npm run verify`
Expected: exit 0. 웹 첫 청크가 커졌는지 확인하고 400KB를 넘으면 보고한다.

- [ ] **Step 7: 커밋**

```bash
git add -A && git commit -m "feat: 과목을 고르고 칸을 찍어 시간표를 짠다"
```

---

### Task 4: 홈 카드

**Files:**
- Create: `src/features/home/TimetableCard.tsx`
- Modify: `src/features/home/HomePage.tsx`
- Test: `tests/home/TimetableCard.test.tsx`

**Interfaces:**
- Consumes: `todayPeriods`, `weekdayOf` (Task 2), `useToday()` (`src/shared/state/useToday`)
- Produces: `<TimetableCard />` — 인자 없음.

- [ ] **Step 1: 실패하는 시험을 쓴다**

`tests/home/TimetableCard.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createClassRoom, createEmptySuiteData, createTerm } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { TimetableCard } from '../../src/features/home/TimetableCard';
import { stubAdapter } from '../helpers/stubAdapter';

const T0 = '2026-03-02T09:00:00.000Z';

function seeded(entries: SuiteData['timetableEntries']): SuiteData {
  const data = createEmptySuiteData();
  return {
    ...data,
    terms: [
      createTerm(
        { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
        T0,
      ),
    ],
    classRooms: [createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, T0)],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
    timetableEntries: entries,
  };
}

function show(data: SuiteData) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({ load: async () => ({ data, repairs: [], isFirstRun: false }) })}
        >
          <TimetableCard />
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  /*
   * shouldAdvanceTime이 없으면 findBy*의 대기가 가짜 시계에 갇혀 멈춘다.
   * SuiteDataProvider가 자료를 비동기로 읽으므로 그 대기가 반드시 필요하다.
   */
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const MONDAY = [
  { classId: 'class-1', weekday: 1, period: 1, subject: '국어' },
  { classId: 'class-1', weekday: 1, period: 2, subject: '수학' },
];

describe('오늘 시간표 카드', () => {
  it('오늘 교시를 순서대로 보여 준다', async () => {
    // 2026-08-24는 월요일이다.
    vi.setSystemTime(new Date(2026, 7, 24, 9, 0, 0));

    show(seeded(MONDAY));

    expect(await screen.findByText('국어')).toBeInTheDocument();
    expect(screen.getByText('수학')).toBeInTheDocument();
  });

  it('다른 요일 것을 안 보여 준다', async () => {
    // 화요일. 월요일만 채워져 있으니 오늘은 비었다.
    vi.setSystemTime(new Date(2026, 7, 25, 9, 0, 0));

    show(seeded(MONDAY));

    expect(await screen.findByText(/오늘은 시간표가 비어/)).toBeInTheDocument();
    expect(screen.queryByText('국어')).not.toBeInTheDocument();
  });

  it('주말에는 수업이 없다고 한다', async () => {
    // 2026-08-29는 토요일이다.
    vi.setSystemTime(new Date(2026, 7, 29, 9, 0, 0));

    show(seeded(MONDAY));

    // '시간표가 비었다'와 '오늘은 학교에 안 간다'는 할 일이 다르다.
    expect(await screen.findByText(/오늘은 수업이 없습니다/)).toBeInTheDocument();
  });

  it('한 칸도 없으면 짜러 가는 길을 준다', async () => {
    vi.setSystemTime(new Date(2026, 7, 24, 9, 0, 0));

    show(seeded([]));

    expect(await screen.findByText(/한 번 짜 두면/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '시간표 짜기' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 시험이 실패하는지 확인한다**

Run: `npx vitest run tests/home/TimetableCard.test.tsx`
Expected: FAIL — 모듈이 없다

- [ ] **Step 3: 카드를 만든다**

`src/features/home/TimetableCard.tsx`:

```tsx
import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';

import { todayPeriods, weekdayOf } from '../timetable/timetableCore';
import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { useToday } from '../../shared/state/useToday';
import { Card } from '../../shared/ui';

/**
 * 오늘 시간표.
 *
 * `▶ 지금` 표시는 여기 없다. 그건 교시 시각(1교시 09:00~09:40)을 알아야
 * 하는데 그것은 '지금' 카드의 몫이다. 여기서는 오늘 채워진 교시를 순서대로
 * 보여 주는 데까지다.
 *
 * 세 갈래를 가르는 까닭은 **선생님이 할 일이 저마다 다르기** 때문이다.
 * 한 칸도 없으면 짜러 가야 하고, 오늘만 비었으면 오늘 칸을 채워야 하고,
 * 주말이면 아무것도 안 해도 된다.
 */
export function TimetableCard() {
  const { data } = useSuite();
  const activeClass = useActiveClass();

  // useToday를 쓰는 까닭은 하루 종일 켜 두는 화면이라서다. 자정이 지나면
  // 날짜가 저절로 바뀌어야 아침에 어제 시간표가 안 걸린다.
  const date = useToday();
  const weekday = weekdayOf(new Date(`${date}T00:00:00`));

  const classId = activeClass?.id ?? '';
  const mine = data.timetableEntries.filter((entry) => entry.classId === classId);
  const periods = todayPeriods(data.timetableEntries, classId, weekday);

  return (
    <Card title="오늘 시간표" icon={CalendarDays}>
      {mine.length === 0 ? (
        <p className="text-sm text-slate-500">
          시간표를 한 번 짜 두면 여기 나옵니다.{' '}
          <Link to="/settings" className="font-medium text-brand-700 underline">
            시간표 짜기
          </Link>
        </p>
      ) : weekday === 0 ? (
        <p className="text-sm text-slate-500">오늘은 수업이 없습니다.</p>
      ) : periods.length === 0 ? (
        <p className="text-sm text-slate-500">오늘은 시간표가 비어 있습니다.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {periods.map((slot) => (
            <li key={slot.period} className="flex gap-3 text-sm">
              <span className="w-4 text-right text-slate-400">{slot.period}</span>
              <span className="text-slate-900">{slot.subject}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: 홈에 붙인다**

`src/features/home/HomePage.tsx`에서 두 가지를 한다.

**1) 카드를 넣는다.** `{isDesktop() ? (<TodayMeal />) : (...)}` 덩어리 **바로 위**에 한 줄:

```tsx
        <TimetableCard />
```

import는 이름순 자리에 `import { TimetableCard } from './TimetableCard';`.
`isDesktop()` 분기를 걸지 않는다 — 급식과 달리 시간표는 웹에서도 된다.

**2) 웹 쪽 문구를 고친다.** 지금 웹 카드는 이렇게 말한다.

```tsx
          <SummaryCard
            to="/settings"
            label="급식 · 시간표"
            ...
            <PendingNote>
              급식과 시간표는 설치형 G-board에서 받아 옵니다.
            </PendingNote>
```

시간표는 이제 웹에서도 되므로 **이 문구가 거짓이 된다.** 급식만 남긴다:

```tsx
          <SummaryCard
            to="/settings"
            label="급식"
            icon={UtensilsCrossed}
            accentClass="text-brand-600"
            tintClass="bg-brand-50"
            pending
            cta="학교 정보 설정"
          >
            <PendingNote>
              급식은 설치형 G-board에서 받아 옵니다. NEIS가 브라우저의 직접 요청을
              막기 때문입니다.
            </PendingNote>
          </SummaryCard>
```

**3) 설정 화면의 같은 거짓 문구도 고친다.** 홈만이 아니다. `SettingsPage.tsx:180`
(`SchoolTab`의 비-설치형 갈래)이 이렇게 말한다.

```
급식·시간표는 설치형 G-board에서만 받아 옵니다. NEIS가 브라우저의
직접 요청을 막기 때문입니다.
```

바로 그 화면에 시간표 탭이 생겼으므로 **한 화면 안에서 앞뒤가 안 맞는다.**
`급식은 설치형 G-board에서만 받아 옵니다.`로 고친다. 둘 중 하나만 고치면
두 문구가 서로 다른 말을 하게 되니 반드시 함께 고친다.

`tests/settings/desktopSettings.test.ts`처럼 웹 문구를 못 박은 시험이 있으면 함께 고친다.

- [ ] **Step 5: 시험이 통과하는지 확인한다**

Run: `npx vitest run tests/home/TimetableCard.test.tsx`
Expected: PASS (4개)

- [ ] **Step 6: 사람이 볼 안내를 고친다**

`docs/gboard-first-run.md`의 확인 목록에 네 줄을 더한다:

```markdown
- [ ] 설정 → 시간표에서 과목을 고르고 칸을 찍으면 들어간다
- [ ] 같은 칸을 다시 누르면 지워진다
- [ ] 직접 입력한 과목이 단추로 남는다
- [ ] 홈 화면에 오늘 요일의 교시가 순서대로 뜬다
```

- [ ] **Step 7: 전체 검증**

Run: `npm run verify`
Expected: exit 0.

- [ ] **Step 8: 커밋**

```bash
git add -A && git commit -m "feat: 홈에 오늘 시간표가 뜬다"
```

---

## 이 판에서 안 하는 것

- NEIS `elsTimetable` — 열쇠 없이는 다섯 행만 와서 6교시가 늘 잘린다. 확인한 사실이고 설계 문서에 적었다.
- `▶ 지금` 표시와 교시 시각 — 2-나-2
- 전자칠판 큰 화면 — 2-나-2 뒤
- 시간표 여러 벌 저장 — 자리표와 달리 한 학기에 하나다
