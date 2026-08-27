# '지금' 카드 구현 계획 (2-나-2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 화면에 시간에 따라 내용만 바뀌는 '지금' 카드를 두어, 지금이 몇 교시 무슨 과목인지와 그 자리에서 쓸 도구를 보여 준다.

**Architecture:** 교시 시각(`PeriodTime`)을 학교 단위 자료로 `SuiteData`에 더한다. 판단은 전부 순수 함수 `nowCore.ts`에 모으고, 시계는 `useNow()` 갈고리 하나가 1분마다 깨워 넣는다. 도구(타이머·화면 가리개)는 **새로 만들지 않고** 이미 있는 `ToolsBar`를 작은 context로 올려 바깥에서 연다.

**Tech Stack:** React 19 · TypeScript 5.8 (`strict`, `noUncheckedIndexedAccess`) · Vitest · Testing Library · Tailwind 4

## Global Constraints

- 웹 묶음에 Tauri 코드가 섞이면 안 된다. **이 판은 `isDesktop()` 분기를 두지 않는다** — 교시 시각도 '지금' 카드도 바깥 통신이 없어 웹에서도 똑같이 돈다.
- 기능 코드는 `localStorage`를 직접 부르지 않는다. 반드시 `useSuite()`의 `update()`를 거친다.
- 주석은 한국어로, **무엇이 아니라 왜**를 적는다.
- 색을 직접 박지 않는다. `index.css`의 토큰을 경유한다.
- 초 단위 타이머를 두지 않는다. 하루 종일 켜 두는 프로그램에서 1초짜리 타이머는 그 자체로 비용이다.
- 새 필수 환경변수를 만들지 않는다.
- 각 과제는 `npm run verify`가 통과해야 커밋한다.

## 설계에서 한 곳만 좁힌다

설계 표는 등교 전에 "오늘 당번, 오늘 일정"을, 하교 후에 "오늘 마감 과제, 미제출 명단"을 보여 주라고 한다. 그런데 홈에는 **`DutySummary`와 `AssignmentSummary` 카드가 이미 나란히 있다.** 같은 화면에서 같은 것을 두 번 그리면 도움이 아니라 잡음이다.

그래서 그 두 때에는 **한 줄로 짚어만 준다.**

```
등교 전   1교시 국어 · 09:00 시작
하교 후   오늘 수업이 끝났습니다
```

수업 중·쉬는 시간·점심은 설계 그대로다. 그때는 옆 카드가 대신 말해 주지 못한다.

---

## File Structure

| 파일 | 맡는 일 |
|---|---|
| `src/shared/domain/types.ts` | `PeriodTime` 타입, `SuiteData.periodTimes` |
| `src/shared/domain/factories.ts` | `createDefaultPeriodTimes()` — 9시 시작 일곱 줄 |
| `src/shared/storage/schema.ts` | `parsePeriodTime`, 없으면 기본값으로 채우기 |
| `src/shared/domain/invariants.ts` | 교시 범위·중복·시각 형식 정리 |
| `src/features/now/nowCore.ts` | **순수 판단.** 지금이 어떤 때인가 |
| `src/shared/state/useNow.ts` | 1분마다 깨는 갈고리 |
| `src/features/tools/ToolsContext.tsx` | `ToolsBar`의 여는 상태를 올린다 |
| `src/features/timetable/PeriodTimeTab.tsx` | 교시 시각 일곱 줄 입력 |
| `src/features/home/NowCard.tsx` | 카드 그리기 |
| `src/features/home/HomePage.tsx` | 붙이기 |

---

### Task 1: 교시 시각 자료

**Files:**
- Modify: `src/shared/domain/types.ts`
- Modify: `src/shared/domain/factories.ts`
- Modify: `src/shared/storage/schema.ts`
- Modify: `src/shared/domain/invariants.ts`
- Test: `tests/storage/periodTimeSchema.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `PeriodTime`, `SuiteData.periodTimes`, `createDefaultPeriodTimes()`

- [ ] **Step 1: 타입을 더한다**

`types.ts`의 `MAX_PERIOD = 7` 바로 아래에 넣는다.

```ts
/**
 * 한 교시의 시각.
 *
 * **`classId`가 없다.** 3학년 2반과 5학년 1반의 2교시 시작 시각이 다를 리
 * 없다. 시간표는 학급마다 한 벌이지만 일과는 학교 하나다.
 *
 * 시각은 `"09:00"` 꼴의 24시간 글자다. 분으로 저장하지 않는 까닭은
 * 백업 파일을 사람이 열어 봤을 때 읽히기 때문이다.
 */
export interface PeriodTime {
  /** 1 ~ MAX_PERIOD */
  period: number;
  start: string;
  end: string;
}
```

`SuiteData`의 `timetableEntries` 바로 아래에 더한다.

```ts
  /** 학교의 일과. 늘 MAX_PERIOD줄이고, 비어 있는 일이 없다. */
  periodTimes: PeriodTime[];
```

- [ ] **Step 2: 기본값을 만든다**

`factories.ts`에 넣는다.

```ts
/**
 * 초등 일반 일과 일곱 줄.
 *
 * **빈 채로 두지 않는다.** 비워 두고 채우라고 하면 '지금' 카드가 처음부터
 * 안 뜨고, 그러면 이 기능이 있다는 것조차 모르고 지나간다. 틀린 학교는
 * 고치면 되고, 고칠 곳이 어디인지는 카드가 알려 준다.
 *
 * 09:00 시작, 40분 수업, 10분 쉬는 시간, 점심 12:20~13:10.
 */
export function createDefaultPeriodTimes(): PeriodTime[] {
  const starts = ['09:00', '09:50', '10:40', '11:30', '13:10', '14:00', '14:50'];

  return starts.map((start, index) => ({
    period: index + 1,
    start,
    end: addMinutes(start, 40),
  }));
}

/** `"09:00"` + 40 → `"09:40"`. 자정을 넘길 일이 없어 되감지 않는다. */
function addMinutes(hm: string, minutes: number): string {
  const [h = '0', m = '0'] = hm.split(':');
  const total = Number(h) * 60 + Number(m) + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
```

`createEmptySuiteData()`에 `periodTimes: createDefaultPeriodTimes(),`를 더한다.

- [ ] **Step 3: 스키마가 읽고 쓴다**

`schema.ts`에 넣는다. `parseTimetableEntry` 옆이다.

```ts
/** `"09:00"` 꼴인가. 아니면 null. */
function parseHm(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (match === null) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parsePeriodTime(raw: unknown): PeriodTime | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const row = raw as Record<string, unknown>;

  const period = typeof row.period === 'number' ? row.period : NaN;
  if (!Number.isInteger(period) || period < 1 || period > MAX_PERIOD) return null;

  const start = parseHm(row.start);
  const end = parseHm(row.end);
  if (start === null || end === null) return null;

  return { period, start, end };
}
```

`parseSuiteData` 안에서 이렇게 읽는다.

```ts
  /*
   * 한 줄이라도 못 읽으면 일곱 줄을 통째로 기본값으로 되돌린다.
   *
   * 반쪽짜리 일과는 '지금' 카드가 4교시에서 갑자기 말을 못 하게 만든다.
   * 그건 조용히 틀리는 쪽이라 차라리 전부 기본값이 낫다 — 틀렸다는 것이
   * 눈에 보이고 고칠 데도 분명하다. 이 판 이전 백업에는 아예 없는 칸이라
   * 그때도 이 길로 온다.
   */
  const readTimes = Array.isArray(raw.periodTimes)
    ? raw.periodTimes.map(parsePeriodTime).filter((t): t is PeriodTime => t !== null)
    : [];
  const periodTimes =
    readTimes.length === MAX_PERIOD ? readTimes : createDefaultPeriodTimes();
```

- [ ] **Step 4: 불변조건이 정리한다**

`invariants.ts`에 규칙 8-2d로 더한다.

```ts
  /*
   * 8-2d. 교시 시각은 늘 일곱 줄이고 교시마다 하나씩이다.
   *
   * 스키마가 이미 채워 주지만, 백업 복원이 아닌 길(가져오기, 수리)로도
   * 자료가 들어온다. 중복된 교시가 있으면 '지금' 카드가 어느 쪽을 믿을지
   * 모른다 — 앞엣것을 남기고 나머지를 버린다.
   */
  const seenPeriods = new Set<number>();
  const keptTimes: PeriodTime[] = [];
  for (const time of data.periodTimes) {
    if (seenPeriods.has(time.period)) continue;
    seenPeriods.add(time.period);
    keptTimes.push(time);
  }
  if (keptTimes.length !== MAX_PERIOD) {
    data.periodTimes = createDefaultPeriodTimes();
    repairs.push('교시 시각이 온전하지 않아 기본 일과로 되돌렸습니다.');
  } else if (keptTimes.length !== data.periodTimes.length) {
    data.periodTimes = keptTimes.sort((a, b) => a.period - b.period);
    repairs.push('교시 시각에서 겹친 줄을 정리했습니다.');
  } else {
    data.periodTimes = [...keptTimes].sort((a, b) => a.period - b.period);
  }
```

- [ ] **Step 5: 시험을 쓴다**

`tests/storage/periodTimeSchema.test.ts`

```ts
import { describe, expect, it } from 'vitest';

import { createEmptySuiteData } from '../../src/shared/domain/factories';
import { MAX_PERIOD } from '../../src/shared/domain/types';
import { parseSuiteData, serializeSuiteData } from '../../src/shared/storage/schema';

describe('교시 시각 — 저장과 복원', () => {
  it('기본값이 일곱 줄로 채워져 있다', () => {
    // 비어 있으면 '지금' 카드가 처음부터 안 뜬다.
    expect(createEmptySuiteData().periodTimes).toHaveLength(MAX_PERIOD);
  });

  it('1교시는 09:00에 시작해 09:40에 끝난다', () => {
    const first = createEmptySuiteData().periodTimes[0];

    expect(first?.start).toBe('09:00');
    expect(first?.end).toBe('09:40');
  });

  it('점심때가 5교시 앞에 있다', () => {
    const times = createEmptySuiteData().periodTimes;

    // 4교시 끝(12:10)과 5교시 시작(13:10) 사이가 하루에서 가장 긴 틈이다.
    expect(times[3]?.end).toBe('12:10');
    expect(times[4]?.start).toBe('13:10');
  });

  it('고쳐 둔 시각이 왕복해도 남는다', () => {
    const data = createEmptySuiteData();
    data.periodTimes = data.periodTimes.map((time) =>
      time.period === 1 ? { ...time, start: '08:40', end: '09:20' } : time,
    );

    const back = parseSuiteData(serializeSuiteData(data));

    expect(back.data.periodTimes[0]?.start).toBe('08:40');
  });

  it('이 판 이전 백업에는 없는 칸이라 기본값으로 채운다', () => {
    const old = JSON.parse(serializeSuiteData(createEmptySuiteData())) as Record<string, unknown>;
    delete old.periodTimes;

    const back = parseSuiteData(JSON.stringify(old));

    expect(back.data.periodTimes).toHaveLength(MAX_PERIOD);
  });

  it('한 줄이라도 깨졌으면 일곱 줄을 통째로 되돌린다', () => {
    const raw = JSON.parse(serializeSuiteData(createEmptySuiteData())) as Record<string, unknown>;
    (raw.periodTimes as unknown[])[2] = { period: 3, start: '뭐라고?', end: '10:40' };

    const back = parseSuiteData(JSON.stringify(raw));

    /*
     * 반쪽짜리 일과는 카드가 3교시에서 갑자기 말을 못 하게 만든다.
     * 조용히 틀리느니 전부 기본값이 낫다 — 틀린 것이 눈에 보인다.
     */
    expect(back.data.periodTimes).toHaveLength(MAX_PERIOD);
    expect(back.data.periodTimes[2]?.start).toBe('10:40');
  });
});
```

- [ ] **Step 6: 돌린다**

`npx vitest run tests/storage/periodTimeSchema.test.ts` → 통과.
`npm run verify` → exit 0.

- [ ] **Step 7: 커밋**

```bash
git add -A && git commit -m "feat: 교시 시각을 학교 자료로 더한다"
```

---

### Task 2: 지금이 어떤 때인가 — 순수 판단

**Files:**
- Create: `src/features/now/nowCore.ts`
- Test: `tests/now/nowCore.test.ts`

**Interfaces:**
- Consumes: `PeriodTime` (Task 1), `TimetableEntry`
- Produces: `NowState`, `nowState()`, `minutesOf()`, `lunchGap()`

- [ ] **Step 1: 실패하는 시험을 먼저 쓴다**

`tests/now/nowCore.test.ts`

```ts
import { describe, expect, it } from 'vitest';

import { createDefaultPeriodTimes } from '../../src/shared/domain/factories';
import type { PeriodTime } from '../../src/shared/domain/types';
import { lunchGap, minutesOf, nowState } from '../../src/features/now/nowCore';

const TIMES: PeriodTime[] = createDefaultPeriodTimes();

/** 오늘 채워진 교시. nowState는 이 목록만 보고 판단한다. */
const TODAY = [
  { period: 1, subject: '국어' },
  { period: 2, subject: '수학' },
  { period: 3, subject: '사회' },
  { period: 4, subject: '과학' },
  { period: 5, subject: '체육' },
];

/** `"09:20"` → 그날의 분. 시험을 읽기 쉽게 하려고 둔다. */
function at(hm: string): number {
  return minutesOf(hm) ?? 0;
}

describe('minutesOf', () => {
  it('시각을 분으로 바꾼다', () => {
    expect(minutesOf('09:00')).toBe(540);
    expect(minutesOf('00:00')).toBe(0);
  });

  it('못 읽으면 null이다', () => {
    // 던지지 않는다. 한 줄이 깨졌다고 카드가 사라지면 안 된다.
    expect(minutesOf('아홉시')).toBeNull();
    expect(minutesOf('')).toBeNull();
  });
});

describe('점심은 가장 긴 틈이다', () => {
  it('4교시 끝과 5교시 시작 사이를 찾는다', () => {
    const gap = lunchGap(TIMES);

    // 따로 묻지 않는다. 자료가 이미 말하고 있다.
    expect(gap?.start).toBe(at('12:10'));
    expect(gap?.end).toBe(at('13:10'));
  });

  it('틈이 다 같으면 점심이 없다고 본다', () => {
    const even = TIMES.map((time, index) => ({
      period: index + 1,
      start: `${String(9 + index).padStart(2, '0')}:00`,
      end: `${String(9 + index).padStart(2, '0')}:40`,
    }));

    // 쉬는 시간과 구별이 안 되면 점심이라고 우기지 않는다.
    expect(lunchGap(even)).toBeNull();
  });
});

describe('nowState', () => {
  it('시간표가 비면 아무 말도 못 한다', () => {
    expect(nowState(TIMES, [], at('10:00')).kind).toBe('no-timetable');
  });

  it('1교시 전에는 곧 시작한다고 한다', () => {
    const state = nowState(TIMES, TODAY, at('08:30'));

    expect(state).toEqual({
      kind: 'before',
      period: 1,
      subject: '국어',
      startsAt: '09:00',
      minutesUntil: 30,
    });
  });

  it('수업 중에는 지금 교시와 남은 시간을 말한다', () => {
    const state = nowState(TIMES, TODAY, at('10:58'));

    // 10:40~11:20이 3교시다.
    expect(state).toEqual({
      kind: 'lesson',
      period: 3,
      subject: '사회',
      minutesLeft: 22,
    });
  });

  it('시작하는 순간은 수업 중이다', () => {
    expect(nowState(TIMES, TODAY, at('09:00')).kind).toBe('lesson');
  });

  it('끝나는 순간은 이미 쉬는 시간이다', () => {
    /*
     * 09:40은 1교시 끝이자 쉬는 시간 시작이다. 둘 다 참이면 '남은 시간 0분'이
     * 되어 선생님이 아직 수업 중이라고 읽는다. 끝은 끝이다.
     */
    expect(nowState(TIMES, TODAY, at('09:40')).kind).toBe('break');
  });

  it('쉬는 시간에는 다음 교시를 말한다', () => {
    const state = nowState(TIMES, TODAY, at('09:45'));

    expect(state).toEqual({
      kind: 'break',
      period: 2,
      subject: '수학',
      minutesUntil: 5,
    });
  });

  it('점심때는 점심이라고 한다', () => {
    // 12:10~13:10은 가장 긴 틈이다. 쉬는 시간이 아니다.
    expect(nowState(TIMES, TODAY, at('12:30')).kind).toBe('lunch');
  });

  it('오늘 마지막 교시가 끝나면 하교 후다', () => {
    // 오늘은 5교시까지다. 5교시는 13:10~13:50.
    expect(nowState(TIMES, TODAY, at('14:00')).kind).toBe('after');
  });

  it('오늘 없는 교시의 시각은 셈에 안 넣는다', () => {
    const short = [{ period: 1, subject: '국어' }];

    /*
     * 금요일에 한 교시만 채운 반이 있다. 09:50이면 시간표상 2교시지만
     * 오늘 2교시는 없다. 있지도 않은 수업을 곧 시작한다고 하면 안 된다.
     */
    expect(nowState(TIMES, short, at('09:50')).kind).toBe('after');
  });

  it('중간이 빈 시간표도 다음 것을 옳게 찾는다', () => {
    const holed = [
      { period: 1, subject: '국어' },
      { period: 4, subject: '과학' },
    ];

    const state = nowState(TIMES, holed, at('09:45'));

    // 2·3교시가 없으니 다음은 4교시(11:30)다.
    expect(state).toEqual({
      kind: 'break',
      period: 4,
      subject: '과학',
      minutesUntil: 105,
    });
  });

  it('교시 시각이 깨져 있으면 아무 말도 안 한다', () => {
    const broken = TIMES.map((time) => ({ ...time, start: 'x', end: 'y' }));

    // 던지지 않는다. 홈 화면 전체가 사라지면 안 된다.
    expect(nowState(broken, TODAY, at('10:00')).kind).toBe('no-timetable');
  });
});
```

- [ ] **Step 2: 돌려서 실패를 본다**

`npx vitest run tests/now/nowCore.test.ts`
Expected: FAIL — `Failed to resolve import ... nowCore`

- [ ] **Step 3: 구현한다**

`src/features/now/nowCore.ts`

```ts
import { type PeriodTime } from '../../shared/domain/types';

/**
 * 지금이 어떤 때인가.
 *
 * 화면과 떼어 둔 까닭은 **경계가 많고 전부 시계에 매여 있기** 때문이다.
 * 교시가 시작하는 순간, 끝나는 순간, 오늘 없는 교시의 시각, 중간이 빈
 * 시간표 — 화면 안에 두면 이것들을 확인할 길이 없다. 여기서는 분 하나만
 * 넘겨주면 되니 전부 확인할 수 있다.
 *
 * 시계를 부르지 않는다. `now`를 받는다.
 */

/** 오늘 그 교시에 무슨 과목인가. `timetableCore.todayPeriods`가 주는 모양이다. */
export interface TodayPeriod {
  period: number;
  subject: string;
}

export type NowState =
  | { kind: 'no-timetable' }
  | { kind: 'before'; period: number; subject: string; startsAt: string; minutesUntil: number }
  | { kind: 'lesson'; period: number; subject: string; minutesLeft: number }
  | { kind: 'break'; period: number; subject: string; minutesUntil: number }
  | { kind: 'lunch' }
  | { kind: 'after' };

/** `"09:00"` → 540. 못 읽으면 null. 던지지 않는다. */
export function minutesOf(hm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (match === null) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
}

/** 점심으로 볼 만큼 긴 틈. 보통 쉬는 시간(10분)의 곱절은 되어야 한다. */
const LUNCH_MIN_GAP = 25;

/**
 * 점심때.
 *
 * 따로 묻지 않는다. 일곱 줄 사이에서 **가장 긴 틈**이 점심이고, 그 틈이
 * 쉬는 시간과 구별될 만큼 길어야 한다. 자료가 이미 말하고 있는 것을
 * 한 번 더 묻지 않는 것이 이 판의 규칙이다.
 */
export function lunchGap(times: PeriodTime[]): { start: number; end: number } | null {
  const sorted = sortable(times);
  let best: { start: number; end: number } | null = null;

  for (let index = 0; index + 1 < sorted.length; index += 1) {
    const gapStart = sorted[index]?.endMin;
    const gapEnd = sorted[index + 1]?.startMin;
    if (gapStart === undefined || gapEnd === undefined) continue;

    const length = gapEnd - gapStart;
    if (length < LUNCH_MIN_GAP) continue;
    if (best !== null && length <= best.end - best.start) continue;

    best = { start: gapStart, end: gapEnd };
  }

  return best;
}

interface Row {
  period: number;
  startMin: number;
  endMin: number;
}

/** 읽을 수 있는 줄만, 교시 순으로. 못 읽는 줄은 없는 셈 친다. */
function sortable(times: PeriodTime[]): Row[] {
  const rows: Row[] = [];

  for (const time of times) {
    const startMin = minutesOf(time.start);
    const endMin = minutesOf(time.end);
    if (startMin === null || endMin === null || endMin <= startMin) continue;
    rows.push({ period: time.period, startMin, endMin });
  }

  return rows.sort((a, b) => a.startMin - b.startMin);
}

export function nowState(times: PeriodTime[], today: TodayPeriod[], now: number): NowState {
  const subjects = new Map(today.map((slot) => [slot.period, slot.subject]));
  // 오늘 채운 교시만 본다. 금요일에 한 교시만 있는 반에게 있지도 않은
  // 2교시를 곧 시작한다고 하면 안 된다.
  const rows = sortable(times).filter((row) => subjects.has(row.period));
  if (rows.length === 0) return { kind: 'no-timetable' };

  for (const row of rows) {
    // 시작하는 순간은 수업 중이고, 끝나는 순간은 이미 쉬는 시간이다.
    if (now >= row.startMin && now < row.endMin) {
      return {
        kind: 'lesson',
        period: row.period,
        subject: subjects.get(row.period) ?? '',
        minutesLeft: row.endMin - now,
      };
    }
  }

  const next = rows.find((row) => row.startMin > now);
  if (next === undefined) return { kind: 'after' };

  /*
   * 점심은 쉬는 시간보다 먼저 본다. 점심때에 "다음 5교시까지 40분"이라고
   * 하면 틀린 말은 아니지만, 그 시각에 선생님이 알고 싶은 것은 급식이다.
   */
  const lunch = lunchGap(times);
  if (lunch !== null && now >= lunch.start && now < lunch.end) return { kind: 'lunch' };

  const first = rows[0];
  if (first !== undefined && now < first.startMin) {
    return {
      kind: 'before',
      period: next.period,
      subject: subjects.get(next.period) ?? '',
      startsAt: hmOf(next.startMin),
      minutesUntil: next.startMin - now,
    };
  }

  return {
    kind: 'break',
    period: next.period,
    subject: subjects.get(next.period) ?? '',
    minutesUntil: next.startMin - now,
  };
}

/** 540 → `"09:00"`. */
function hmOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
```

- [ ] **Step 4: 돌려서 통과를 본다**

`npx vitest run tests/now/nowCore.test.ts` → 전부 통과.

- [ ] **Step 5: 변이로 이를 확인한다**

아래 셋을 하나씩 넣고 **각각 시험이 실패하는지** 본다. 실패 안 하면 그 시험이 무른 것이므로 브리핑에 적어 보고한다.

| 변이 | 실패해야 하는 시험 |
|---|---|
| `now < row.endMin` → `now <= row.endMin` | 끝나는 순간은 이미 쉬는 시간이다 |
| `filter((row) => subjects.has(row.period))` 제거 | 오늘 없는 교시의 시각은 셈에 안 넣는다 |
| `lunchGap` 검사를 `break` 뒤로 옮김 | 점심때는 점심이라고 한다 |

- [ ] **Step 6: 커밋**

```bash
git add -A && git commit -m "feat: 지금이 어떤 때인지 가리는 순수 판단"
```

---

### Task 3: 1분마다 깨는 갈고리

**Files:**
- Create: `src/shared/state/useNow.ts`
- Test: `tests/state/useNow.test.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: `useNow(): number` — 자정부터 지금까지의 분

- [ ] **Step 1: 실패하는 시험**

`tests/state/useNow.test.tsx`

```tsx
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNow } from '../../src/shared/state/useNow';

function Probe() {
  return <span data-testid="now">{useNow()}</span>;
}

function shown(): string {
  return document.querySelector('[data-testid="now"]')?.textContent ?? '';
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useNow', () => {
  it('자정부터 지금까지의 분을 준다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 9, 30, 0));

    render(<Probe />);

    expect(shown()).toBe('570');
  });

  it('1분이 지나면 바뀐다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 9, 30, 0));
    render(<Probe />);

    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });

    expect(shown()).toBe('571');
  });

  it('같은 분 안에서는 다시 그리지 않는다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 9, 30, 0));
    render(<Probe />);

    act(() => {
      vi.advanceTimersByTime(30 * 1000);
    });

    // 초마다 깨우면 하루 종일 켜 두는 프로그램에서 그 자체로 비용이다.
    expect(shown()).toBe('570');
  });

  it('자정을 넘기면 0으로 돌아온다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 23, 59, 0));
    render(<Probe />);

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    expect(shown()).toBe('1');
  });

  it('화면을 떠나면 타이머를 남기지 않는다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 9, 0, 0));
    const view = render(<Probe />);

    view.unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
```

- [ ] **Step 2: 돌려서 실패를 본다**

- [ ] **Step 3: 구현한다**

`src/shared/state/useNow.ts`

```ts
import { useEffect, useState } from 'react';

/** 자정부터 지금까지의 분. */
function minutesNow(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** 다음 분이 될 때까지 남은 밀리초. 1초를 더해 경계에 아슬아슬하게 걸치지 않게 한다. */
function untilNextMinute(now: Date): number {
  return (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 1000;
}

/**
 * 지금 몇 분인가. 1분마다 저절로 바뀐다.
 *
 * `useToday`가 자정에 한 번 깨는 것과 다르다. '지금' 카드는 '12분 남음'을
 * 말하므로 분 단위로 깨야 한다.
 *
 * **초마다 깨우지 않는다.** 하루 종일 켜 두는 프로그램에서 1초짜리 타이머는
 * 그 자체로 비용이고, 화면에 초가 나오지도 않는다. 다음 분이 될 때까지만
 * 재웠다가 깨우면 하루에 1,440번이면 된다.
 */
export function useNow(): number {
  const [minutes, setMinutes] = useState(() => minutesNow(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = (): void => {
      timer = setTimeout(() => {
        // 잰 값을 더하지 않고 시계를 다시 본다. 컴퓨터가 자다 깨면
        // 타이머는 늦게 오는데, 맞는 값은 지금 시계에만 있다.
        setMinutes(minutesNow(new Date()));
        schedule();
      }, untilNextMinute(new Date()));
    };

    schedule();
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return minutes;
}
```

- [ ] **Step 4: 통과를 본다**

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: 1분마다 깨는 시계 갈고리"
```

---

### Task 4: 도구를 바깥에서 연다

**Files:**
- Create: `src/features/tools/ToolsContext.tsx`
- Modify: `src/features/tools/ToolsBar.tsx`
- Modify: `src/app/AppShell.tsx`
- Test: `tests/tools/ToolsContext.test.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: `ToolsProvider`, `useTools(): { open(tool): void }`

- [ ] **Step 1: 실패하는 시험**

`tests/tools/ToolsContext.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ToolsBar } from '../../src/features/tools/ToolsBar';
import { ToolsProvider, useTools } from '../../src/features/tools/ToolsContext';

/*
 * 타이머도 화면 가리개도 이미 있다. 이번 판이 할 일은 **그것들을 '지금'
 * 카드 자리에서 여는 것**뿐이다. 그런데 ToolsBar가 여는 상태를 자기 안에
 * 들고 있어 바깥에서 열 길이 없었다. 그 길이 정말 이어졌는지만 본다.
 */
function Far() {
  const { open } = useTools();
  return (
    <button type="button" onClick={() => open('timer')}>
      멀리서 타이머 열기
    </button>
  );
}

function show() {
  return render(
    <ToolsProvider>
      <Far />
      <ToolsBar />
    </ToolsProvider>,
  );
}

describe('바깥에서 도구 열기', () => {
  it('멀리 있는 단추로 타이머가 열린다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: '멀리서 타이머 열기' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('툴바의 제 단추도 그대로 연다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: '타이머' }));

    // 있던 길을 끊고 새 길을 내면 안 된다. 둘 다 열려야 한다.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('provider 밖에서 쓰면 알려 준다', () => {
    // 조용히 아무 일도 안 일어나면 왜 안 열리는지 알 길이 없다.
    expect(() => render(<Far />)).toThrow(/ToolsProvider/);
  });
});
```

- [ ] **Step 2: 돌려서 실패를 본다**

- [ ] **Step 3: 구현한다**

`src/features/tools/ToolsContext.tsx`

```tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type ToolName = 'timer' | 'curtain' | 'notice';

interface ToolsValue {
  /** 지금 열려 있는 것. 없으면 null. */
  openTool: ToolName | null;
  open: (tool: ToolName) => void;
  close: () => void;
}

const ToolsContext = createContext<ToolsValue | null>(null);

/**
 * 도구를 여는 상태를 `ToolsBar` 바깥으로 올린다.
 *
 * '지금' 카드가 수업 중에 [타이머]·[화면 가리기]를 내미는데, 그 상태가
 * `ToolsBar` 안에 갇혀 있으면 카드가 열 길이 없다.
 *
 * `CustomEvent`를 안 쓴다. 그건 React 나무가 안 이어진 자리(저장 계층 →
 * 화면)를 잇는 수단이고, 홈과 툴바는 둘 다 `AppShell` 아래라 이어져 있다.
 * 이어진 곳을 이벤트로 잇면 누가 듣는지 추적할 수 없어진다.
 */
export function ToolsProvider({ children }: { children: ReactNode }) {
  const [openTool, setOpenTool] = useState<ToolName | null>(null);

  const value = useMemo<ToolsValue>(
    () => ({
      openTool,
      open: (tool) => setOpenTool(tool),
      close: () => setOpenTool(null),
    }),
    [openTool],
  );

  return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>;
}

export function useTools(): ToolsValue {
  const value = useContext(ToolsContext);
  if (value === null) throw new Error('useTools는 ToolsProvider 안에서만 쓸 수 있습니다.');
  return value;
}
```

`ToolsBar.tsx`에서 제 상태를 걷어 낸다.

```tsx
export function ToolsBar() {
  const { openTool, open, close } = useTools();
  // 아래는 setOpen(...) → open(...) / setOpen(null) → close() 로만 바꾼다.
  // open === 'timer' 를 보던 자리는 openTool === 'timer' 가 된다.
```

`AppShell.tsx`에서 `<ToolsBar />`를 포함한 바깥을 `<ToolsProvider>`로 감싼다. **홈도 그 안에 들어야 한다.**

- [ ] **Step 4: 통과를 본다**

- [ ] **Step 5: `npm run verify`** → exit 0

- [ ] **Step 6: 커밋**

```bash
git add -A && git commit -m "refactor: 도구 여는 상태를 툴바 밖으로 올린다"
```

---

### Task 5: 교시 시각 설정 화면

**Files:**
- Create: `src/features/timetable/PeriodTimeTab.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`
- Test: `tests/timetable/PeriodTimeTab.test.tsx`

**Interfaces:**
- Consumes: `PeriodTime` (Task 1)
- Produces: `PeriodTimeTab`

- [ ] **Step 1: 실패하는 시험**

`tests/timetable/PeriodTimeTab.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createEmptySuiteData } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { PeriodTimeTab } from '../../src/features/timetable/PeriodTimeTab';
import { SuiteDataProvider, useSuite } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

function Probe() {
  const { data } = useSuite();
  return <span data-testid="saved">{JSON.stringify(data.periodTimes)}</span>;
}

function show(data: SuiteData = createEmptySuiteData()) {
  return render(
    <ToastProvider>
      <SuiteDataProvider
        adapter={stubAdapter({ load: async () => ({ data, repairs: [], isFirstRun: false }) })}
      >
        <PeriodTimeTab />
        <Probe />
      </SuiteDataProvider>
    </ToastProvider>,
  );
}

function saved(): { period: number; start: string; end: string }[] {
  return JSON.parse(screen.getByTestId('saved').textContent ?? '[]') as never;
}

describe('교시 시각', () => {
  it('일곱 줄이 채워진 채로 열린다', async () => {
    show();

    // 빈 채로 두면 '지금' 카드가 처음부터 안 뜬다.
    expect(await screen.findByLabelText('1교시 시작')).toHaveValue('09:00');
    expect(screen.getByLabelText('7교시 끝')).toHaveValue('15:30');
  });

  it('고치면 저장된다', async () => {
    const user = userEvent.setup();
    show();

    const input = await screen.findByLabelText('1교시 시작');
    await user.clear(input);
    await user.type(input, '08:40');

    expect(saved()[0]?.start).toBe('08:40');
  });

  it('끝이 시작보다 이르면 알려 주고 저장하지 않는다', async () => {
    const user = userEvent.setup();
    show();

    const input = await screen.findByLabelText('1교시 끝');
    await user.clear(input);
    await user.type(input, '08:00');

    /*
     * 거꾸로 된 줄이 들어가면 '지금' 카드가 그 교시를 통째로 건너뛴다.
     * 조용히 사라지는 쪽이라 그 자리에서 막는다.
     */
    expect(await screen.findByRole('status')).toHaveTextContent('끝이 시작보다');
    expect(saved()[0]?.end).toBe('09:40');
  });

  it('기본 일과로 되돌릴 수 있다', async () => {
    const user = userEvent.setup();
    const data = createEmptySuiteData();
    data.periodTimes = data.periodTimes.map((time) =>
      time.period === 1 ? { ...time, start: '07:00', end: '07:40' } : time,
    );
    show(data);

    await user.click(await screen.findByRole('button', { name: '기본 일과로' }));
    await user.click(screen.getByRole('button', { name: '되돌리기' }));

    expect(saved()[0]?.start).toBe('09:00');
  });
});
```

- [ ] **Step 2: 돌려서 실패를 본다**

- [ ] **Step 3: 구현한다**

`<input type="time">`을 쓴다. 브라우저가 형식을 지켜 주고 낭독기도 안다. 라벨은 `1교시 시작` / `1교시 끝`.

되돌리기는 `ConfirmDialog`로 확인을 받는다(`confirmLabel="되돌리기"`).

잘못된 값은 `role="status"` 한 줄로 알리고 저장하지 않는다. `TimetableTab`의 `note`와 같은 관례다.

설정 화면에는 **시간표 탭 안에** 둔다. 탭을 새로 만들지 않는다 — 시간표를 짜러 온 김에 일과도 맞추는 것이 자연스럽고, 탭이 여덟 개가 되면 고르기가 어려워진다. `TimetableTab` 아래에 `PeriodTimeTab`을 이어 그린다.

- [ ] **Step 4: 통과를 본다**

- [ ] **Step 5: `npm run verify`** → exit 0

- [ ] **Step 6: 커밋**

```bash
git add -A && git commit -m "feat: 교시 시각을 설정에서 고친다"
```

---

### Task 6: '지금' 카드

**Files:**
- Create: `src/features/home/NowCard.tsx`
- Test: `tests/home/NowCard.test.tsx`

**Interfaces:**
- Consumes: `NowState` (Task 2), `useTools` (Task 4)
- Produces: `NowCard`

- [ ] **Step 1: 실패하는 시험**

`tests/home/NowCard.test.tsx` — 갈래 여섯을 각각 그리고, 수업 중에만 도구 단추가 나오는지 본다.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { NowCard } from '../../src/features/home/NowCard';
import { ToolsProvider } from '../../src/features/tools/ToolsContext';
import type { NowState } from '../../src/features/now/nowCore';

function show(state: NowState, onOpenBoard = vi.fn()) {
  return render(
    <MemoryRouter>
      <ToolsProvider>
        <NowCard state={state} onOpenBoard={onOpenBoard} />
      </ToolsProvider>
    </MemoryRouter>,
  );
}

describe('지금 카드', () => {
  it('시간표가 없으면 짜라고 한다', () => {
    show({ kind: 'no-timetable' });

    expect(screen.getByRole('link', { name: '시간표 짜기' })).toBeInTheDocument();
  });

  it('등교 전에는 곧 시작할 교시를 한 줄로 짚는다', () => {
    show({ kind: 'before', period: 1, subject: '국어', startsAt: '09:00', minutesUntil: 30 });

    expect(screen.getByText(/1교시 국어/)).toBeInTheDocument();
    expect(screen.getByText(/09:00/)).toBeInTheDocument();
  });

  it('수업 중에는 교시·과목·남은 시간을 말한다', () => {
    show({ kind: 'lesson', period: 3, subject: '수학', minutesLeft: 12 });

    expect(screen.getByText(/3교시 수학/)).toBeInTheDocument();
    expect(screen.getByText(/12분 남음/)).toBeInTheDocument();
  });

  it('수업 중에만 도구가 손에 닿는다', () => {
    show({ kind: 'lesson', period: 3, subject: '수학', minutesLeft: 12 });

    expect(screen.getByRole('button', { name: '타이머' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '화면 가리기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전자칠판' })).toBeInTheDocument();
  });

  it('쉬는 시간에는 도구를 안 내민다', () => {
    show({ kind: 'break', period: 4, subject: '사회', minutesUntil: 7 });

    // 쉬는 시간에 타이머를 내밀면 자리만 차지한다. 다음 교시가 궁금할 때다.
    expect(screen.getByText(/다음 4교시 사회/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '타이머' })).not.toBeInTheDocument();
  });

  it('점심때는 급식을 보라고 한다', () => {
    show({ kind: 'lunch' });

    expect(screen.getByText(/점심/)).toBeInTheDocument();
  });

  it('하교 후에는 끝났다고 한다', () => {
    show({ kind: 'after' });

    expect(screen.getByText(/오늘 수업이 끝났습니다/)).toBeInTheDocument();
  });

  it('타이머 단추가 진짜로 도구를 연다', async () => {
    const user = userEvent.setup();
    show({ kind: 'lesson', period: 3, subject: '수학', minutesLeft: 12 });

    await user.click(screen.getByRole('button', { name: '타이머' }));

    // 그리기만 하고 안 이어져 있으면 선생님은 앱이 고장 났다고 여긴다.
    // ToolsProvider가 열렸는지는 ToolsBar 없이도 상태로 확인한다.
    expect(screen.getByRole('button', { name: '타이머' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('전자칠판은 넘겨받은 것을 부른다', async () => {
    const user = userEvent.setup();
    const onOpenBoard = vi.fn();
    show({ kind: 'lesson', period: 3, subject: '수학', minutesLeft: 12 }, onOpenBoard);

    await user.click(screen.getByRole('button', { name: '전자칠판' }));

    expect(onOpenBoard).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 돌려서 실패를 본다**

- [ ] **Step 3: 구현한다**

`NowCard`는 `state`와 `onOpenBoard`를 받는 **그리기 전용**이다. 시계도 자료도 안 본다 — 갈래 여덟을 다 확인할 수 있어야 하기 때문이다.

전자칠판은 이미 `openBoard.ts`가 있고 홈이 그것을 안다. 카드는 넘겨받은 것을 부르기만 한다.

- [ ] **Step 4: 통과를 본다**

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: 지금 카드"
```

---

### Task 7: 홈에 붙이고 배선을 시험한다

**Files:**
- Modify: `src/features/home/HomePage.tsx`
- Test: `tests/home/nowWiring.test.tsx`

**Interfaces:**
- Consumes: 앞 여섯 과제 전부
- Produces: 홈 화면의 '지금' 카드

- [ ] **Step 1: 배선 시험을 먼저 쓴다**

이 판에서 세 번 겪은 것이다 — **층마다 시험이 있어도 잇는 자리는 아무도 안 본다.** `useNow`를 얼려도, `periodTimes` 대신 빈 배열을 넘겨도 앞의 시험들은 전부 통과한다.

`tests/home/nowWiring.test.tsx`는 `HomePage`(또는 `TodayNow`)를 실제로 그려서 본다.

```tsx
// 요지만 적는다. seeded()는 시간표와 교시 시각을 함께 채운다.
describe('지금 카드 배선', () => {
  it('시계가 가리키는 교시가 화면에 뜬다', async () => {
    vi.setSystemTime(new Date(2026, 7, 24, 10, 58, 0)); // 월요일 3교시
    show(seededWithTimetable());

    expect(await screen.findByText(/3교시 사회/)).toBeInTheDocument();
  });

  it('1분이 지나면 남은 시간이 준다', async () => {
    vi.setSystemTime(new Date(2026, 7, 24, 10, 58, 0));
    show(seededWithTimetable());
    await screen.findByText(/22분 남음/);

    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });

    // useNow를 얼려 두어도 앞의 시험은 전부 통과한다. 여기서만 걸린다.
    expect(screen.getByText(/21분 남음/)).toBeInTheDocument();
  });

  it('교시 시각을 고치면 카드가 따라간다', async () => {
    // 08:40 시작으로 고친 학교에서 09:00은 이미 1교시 중이다.
    ...
  });

  it('주말에는 시간표가 없다고 하지 않는다', async () => {
    // 토요일에 '시간표 짜기'를 권하면 이미 짜 둔 선생님이 헷갈린다.
    ...
  });
});
```

- [ ] **Step 2: 돌려서 실패를 본다**

- [ ] **Step 3: 붙인다**

`HomePage`에 `TodayNow`를 만든다. `useNow()`와 `useToday()`를 부르고, `timetableCore.todayPeriods`로 오늘 줄을 얻어 `nowState`에 넘긴다. 자리는 설계 그림대로 오른쪽 위, `DutySummary` 앞이다.

- [ ] **Step 4: 통과를 본다**

- [ ] **Step 5: 변이로 확인한다**

| 변이 | 실패해야 하는 시험 |
|---|---|
| `useNow()` → `useState(useNow())[0]` | 1분이 지나면 남은 시간이 준다 |
| `data.periodTimes` → `[]` | 시계가 가리키는 교시가 화면에 뜬다 |

- [ ] **Step 6: `npm run verify`** → exit 0, 묶음 검사 둘 다 통과

- [ ] **Step 7: 커밋**

```bash
git add -A && git commit -m "feat: 홈에 지금 카드를 붙인다"
```

---

## Self-Review

**1. 설계 덮기**
- 교시 시각 일곱 줄 → Task 1, 5 ✓
- 점심은 가장 긴 틈 → Task 2 (`lunchGap`) ✓
- 다섯 때(등교 전·수업 중·쉬는 시간·점심·하교 후) → Task 2, 6 ✓
- 도구는 있는 것을 연다 → Task 4, 6 ✓
- 1분마다 다시 그린다 → Task 3 ✓
- 위치 고정, 내용만 바뀜 → Task 7 (한 자리) ✓

**2. 빈칸 없음** — 모든 코드 단계에 실제 코드가 있다. Task 6·7만 요지로 적었는데, 앞 과제의 타입이 정해져 있어 구현자가 채울 수 있는 자리다.

**3. 이름 일치** — `nowState`/`NowState`/`minutesOf`/`lunchGap`/`useNow`/`useTools`/`PeriodTime`/`createDefaultPeriodTimes`가 과제 사이에서 같은 철자로 쓰인다. `TodayPeriod`는 `timetableCore.todayPeriods`가 주는 모양과 맞춘다 — Task 7 구현자가 확인할 것.
