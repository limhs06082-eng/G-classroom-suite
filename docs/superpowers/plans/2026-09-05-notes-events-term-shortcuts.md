# 0.13.1 — 릴리스 노트 파일·일정 문구·학기 집계·단축키 도움 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 0.13.0 뒤에 남겨 둔 네 가지 개선을 붙이고 0.13.1로 내어, 자동 갱신이 실제로 도는지까지 확인한다.

**Architecture:** 순수 함수는 `*Core.ts`에 두고 vitest로 먼저 못 박은 뒤 화면에 붙인다(기존 "기록만 남기고 상태는 계산" 원칙). 릴리스 노트는 `docs/releases/vX.Y.Z.md` 한 파일이 GitHub 릴리스 본문·앱 갱신 알림·판 검사의 단일 출처가 된다. 단축키 도움은 `shared/ui`의 모달 하나를 앱 셸과 칠판 프레임이 같이 쓴다.

**Tech Stack:** React 19 · TypeScript · Tailwind 4 · vitest + Testing Library · Tauri 2(updater) · GitHub Actions(tauri-action).

**Spec:** 이 문서 자체가 사양이다 — 2026-09-05 대화에서 제안한 "다음 판 후보" 네 가지(릴리스 노트 파일, 학급 일정→알림장 문구, 출결 월별 인쇄 학기 필터, 단축키 도움 화면). 웹 퀴즈 Firebase 중계는 Firebase 프로젝트가 필요해 이 판에서 뺀다.

## Global Constraints

- 새 색·의존성을 더하지 않는다. 기존 `Modal`·`Button`·`Badge`·`Card`·`PrintLayout`만 쓴다.
- 날짜는 `YYYY-MM-DD` 문자열, 비교는 사전순. `new Date('YYYY-MM-DD')`(UTC) 금지 — `eventsCore.localDate` 패턴을 따른다.
- 입력칸에서의 Enter는 `!event.nativeEvent.isComposing` 가드가 있어야 한다(IME).
- 커밋 메시지는 한국어 요약 + `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- 판 번호는 `package.json`·`src-tauri/tauri.conf.json`·`src-tauri/Cargo.toml`·`src-tauri/Cargo.lock` 네 곳을 같이 올린다.
- 서명 개인키(`~/.tauri/gboard.key`)와 비밀값은 커밋하지 않는다.
- 웹 청크 한도 400KB(현재 399.2KB). NoticePage·AttendancePage는 lazy 청크라 본문이 커져도 메인 청크에 안 들어간다.

---

### Task 1: 릴리스 노트 파일 — `docs/releases/vX.Y.Z.md` 한 곳에서 릴리스 본문·앱 알림·검사

**Files:**
- Create: `docs/releases/v0.13.0.md` (이미 공개된 본문을 그대로 보관)
- Modify: `scripts/check-release.mjs` (판 번호 검사 뒤에 노트 파일 검사 추가)
- Modify: `.github/workflows/release.yml:67-90` (노트 파일을 읽어 제목·본문으로)
- Modify: `src/app/AppShell.tsx` UpdateChecker, `src/features/settings/SettingsPage.tsx` VersionCard (알림 문구에 첫 줄 별명)
- Modify: `docs/gboard-release.md:28-40` (절차에 노트 파일 단계)

**Interfaces:**
- Produces: 노트 파일 규칙 — **1행 = 한 줄 별명(마크다운 기호 없이), 2행 빈 줄, 3행부터 본문(마크다운)**. `releaseName`은 `G-board vX.Y.Z — {1행}`, `releaseBody`는 파일 전체. 앱은 `update.notes`의 첫 줄을 알림 문구에 붙인다.

- [ ] **Step 1: `docs/releases/v0.13.0.md`를 만든다** (지금 공개된 릴리스 본문과 같게)

```markdown
자동 갱신 판

**이번 한 번은 손으로 설치해 주세요.** 0.12.0까지는 갱신 기능이 없어서, 이 판은 받아서 덮어씌워야 합니다. 이 판부터는 새 판이 나오면 앱이 알려 줍니다.

## 새로 된 것

- **자동 갱신** — 앱을 켜면 8초 뒤 새 판이 있는지 확인하고, 있으면 "새 판 X.Y.Z이 있습니다" 알림과 [지금 설치] 단추가 뜹니다. 누르면 받아 설치하고 앱이 다시 켜집니다. 서명이 맞는 갱신 파일만 설치합니다.
- **설정 → 백업·복원 맨 위의 '판' 칸** — 지금 쓰는 판을 보여 주고, [새 판 확인]으로 바로 확인할 수 있습니다.

## 고친 것

- 시간표의 교시 시각 한 줄이 잘못 적혀 있어도 '지금' 카드가 아침을 "점심"으로 잘못 말하지 않습니다.

## 설치

설치 파일(`G-board_0.13.0_x64-setup.exe`)을 받아 더블클릭하시면 됩니다. 계정도 설정값도 없습니다.

처음 실행할 때 Windows가 "PC 보호" 창을 띄웁니다. **추가 정보 → 실행**을 누르시면 됩니다. 서명 인증서가 없어서 나오는 창이고, 앱에 문제가 있다는 뜻은 아닙니다.

`.sig`와 `latest.json`은 앱의 자동 갱신이 쓰는 파일이라 직접 받을 필요는 없습니다.
```

- [ ] **Step 2: `scripts/check-release.mjs`에 검사를 넣는다** — 태그 검사(`:113-116`) 바로 뒤.

```js
/*
 * 릴리스 노트. `docs/releases/v<판>.md` 한 파일이 GitHub 릴리스 본문과
 * 앱의 "새 판" 알림 문구가 된다. 1행은 한 줄 별명(마크다운 기호 없이),
 * 2행은 빈 줄, 3행부터 본문. 파일이 없으면 태그를 밀어도 빈 릴리스가
 * 나가므로 여기서 막는다.
 */
const notesPath = `docs/releases/v${String(conf.version)}.md`;
let notes = '';
try {
  notes = readFileSync(notesPath, 'utf8');
} catch {
  fail('릴리스 노트가 없다', `  ${notesPath}를 쓰고 나서 판을 낸다. 1행 별명, 2행 빈 줄, 3행부터 본문.`);
}
if (notes !== '') {
  const [summary = '', blank = '', ...body] = notes.split(/\r?\n/);
  if (summary.trim() === '' || summary.startsWith('#')) {
    fail('릴리스 노트 1행이 별명이 아니다', `  ${notesPath}: 1행은 "자동 갱신 판"처럼 기호 없는 한 줄이어야 한다.`);
  }
  if (blank.trim() !== '' || body.join('').trim() === '') {
    fail('릴리스 노트 본문이 없다', `  ${notesPath}: 2행은 빈 줄, 3행부터 본문(마크다운).`);
  }
}
```

- [ ] **Step 3: 검사가 지금 통과하는지 본다** — `node scripts/check-release.mjs` → 문제 0. `docs/releases/v0.13.0.md`를 잠시 지우고 돌리면 "릴리스 노트가 없다"로 실패해야 한다(확인 뒤 되돌린다).

- [ ] **Step 4: `release.yml`의 tauri-action 앞에 노트 읽기 단계를 넣고 제목·본문을 바꾼다**

```yaml
      # 릴리스 노트. docs/releases/v<판>.md 1행이 별명, 파일 전체가 본문.
      # 같은 글이 latest.json의 notes로도 들어가 앱의 "새 판" 알림에 쓰인다.
      - id: notes
        shell: bash
        run: |
          file="docs/releases/${{ github.ref_name }}.md"
          echo "summary=$(head -n 1 "$file")" >> "$GITHUB_OUTPUT"
          {
            echo 'body<<GBOARD_NOTES_EOF'
            cat "$file"
            echo
            echo 'GBOARD_NOTES_EOF'
          } >> "$GITHUB_OUTPUT"

      - uses: tauri-apps/tauri-action@v0
        env: (그대로)
        with:
          tagName: ${{ github.ref_name }}
          releaseName: G-board ${{ github.ref_name }} — ${{ steps.notes.outputs.summary }}
          releaseBody: ${{ steps.notes.outputs.body }}
          releaseDraft: true
          prerelease: false
```

파일 머리 주석(`:9-12`) 아래에 "노트는 `docs/releases/v<판>.md`에서 읽는다 — 없으면 check:release가 막는다" 한 줄을 더한다.

- [ ] **Step 5: 앱 알림에 별명을 붙인다** — `AppShell.tsx` UpdateChecker와 `SettingsPage.tsx` VersionCard의 `toast.info(\`새 판 ${update.version}이 있습니다.\`` 두 곳을 다음으로:

```ts
const summary = update.notes.split('\n')[0]?.trim() ?? '';
toast.info(summary === '' ? `새 판 ${update.version}이 있습니다.` : `새 판 ${update.version} — ${summary}`, {
```

- [ ] **Step 6: `docs/gboard-release.md` "새 판을 낼 때마다"에 0단계를 넣는다** — "### 1. 판 번호를…" 앞에:

```markdown
### 0. 릴리스 노트를 쓴다

`docs/releases/v0.13.1.md` 한 파일이 GitHub 릴리스 본문이 되고, 앱의 "새 판이 있습니다" 알림에도 첫 줄이 붙는다.

- 1행: 한 줄 별명 (`자동 갱신 판`처럼, `#` 없이)
- 2행: 빈 줄
- 3행부터: 본문 — 새로 된 것 / 고친 것 / 설치

없으면 `npm run check:release`가 막는다. 공개한 뒤에 본문을 고쳐도 앱 알림에는 반영되지 않는다(빌드 때 굳는다).
```
그리고 `check:release`가 보는 것 표에 `| 릴리스 노트 | docs/releases/v<판>.md가 있고 1행 별명·본문이 있는가 |` 행을 더한다.

- [ ] **Step 7: 검사·타입 확인 후 커밋**

```bash
node scripts/check-release.mjs && npx tsc --noEmit -p tsconfig.app.json
git add docs/releases scripts/check-release.mjs .github/workflows/release.yml src/app/AppShell.tsx src/features/settings/SettingsPage.tsx docs/gboard-release.md
git commit -m "feat: 릴리스 노트는 docs/releases/v판.md 한 파일 — 릴리스 본문·앱 알림·검사가 같이 읽는다"
```

---

### Task 2: 학급 일정 → 알림장 문구

**Files:**
- Modify: `src/features/notice/eventsCore.ts` (`shortDate`, `eventsSoon`, `eventPhrase` 추가)
- Modify: `src/features/notice/NoticePage.tsx:65-88, 190-212` (`appendItem` 추출, '다가오는 일정' 칩 줄)
- Modify: `src/features/board/TodayBoard.tsx:171-174` (`eventsSoon`으로 접기)
- Test: `tests/notice/eventsCore.test.ts`, Create: `tests/notice/NoticePage.test.tsx`

**Interfaces:**
- Produces:
  - `shortDate(date: string): string` → `"9/1(화)"`
  - `eventsSoon(events: readonly ClassEvent[], classId: string, today: string, withinDays: number): ClassEvent[]` — 오늘 포함, `daysUntil <= withinDays`, 가까운 순
  - `eventPhrase(today: string, event: ClassEvent): string` → `"내일 현장학습 — 도시락"` (0일 `오늘`, 1일 `내일`, 그 뒤 `M/D(요일)`; note 비면 대시 없음)

- [ ] **Step 1: 실패하는 시험을 쓴다** — `tests/notice/eventsCore.test.ts` 끝에 추가 (기존 fixture `EVENTS`, `TODAY='2026-08-29'`, `CLASS` 그대로 사용; 파일 상단 import에 `eventPhrase, eventsSoon, shortDate` 추가)

```ts
describe('shortDate · eventsSoon · eventPhrase — 알림장에 넣을 한 줄', () => {
  it('짧은 날짜는 M/D(요일)이다', () => {
    expect(shortDate('2026-09-01')).toBe('9/1(화)');
    expect(shortDate('2026-08-29')).toBe('8/29(토)');
  });

  it('며칠 안 일정만 가까운 순으로 꼽는다', () => {
    expect(eventsSoon(EVENTS, CLASS, TODAY, 3).map((e) => e.id)).toEqual(['e-today', 'e-soon']);
    expect(eventsSoon(EVENTS, CLASS, TODAY, 0).map((e) => e.id)).toEqual(['e-today']);
  });

  it('오늘·내일은 말로, 그 뒤는 날짜로 시작하고 메모는 대시 뒤에 붙는다', () => {
    const base = { classId: CLASS, title: '현장학습' };
    expect(eventPhrase(TODAY, createClassEvent({ ...base, date: '2026-08-29' }, NOW))).toBe('오늘 현장학습');
    expect(eventPhrase(TODAY, createClassEvent({ ...base, date: '2026-08-30', note: '도시락' }, NOW))).toBe(
      '내일 현장학습 — 도시락',
    );
    expect(eventPhrase(TODAY, createClassEvent({ ...base, date: '2026-09-01', note: '  ' }, NOW))).toBe(
      '9/1(화) 현장학습',
    );
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/notice/eventsCore.test.ts` → "shortDate is not a function"류로 FAIL.

- [ ] **Step 3: 구현** — `eventsCore.ts` 끝에:

```ts
const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** `"2026-09-01"` → `"9/1(화)"`. 알림장 한 줄에 들어가는 짧은 날짜. */
export function shortDate(date: string): string {
  const day = localDate(date);
  return `${day.getMonth() + 1}/${day.getDate()}(${WEEKDAY_SHORT[day.getDay()] ?? ''})`;
}

/** 오늘부터 withinDays일 안(오늘 포함)의 일정, 가까운 순. 칠판은 3일, 알림장은 7일을 본다. */
export function eventsSoon(
  events: readonly ClassEvent[],
  classId: string,
  today: string,
  withinDays: number,
): ClassEvent[] {
  return upcomingEvents(events, classId, today).filter(
    (event) => daysUntil(today, event.date) <= withinDays,
  );
}

/**
 * 알림장에 그대로 넣을 한 줄. "내일 현장학습 — 도시락"
 *
 * 종례에서 읽어 주는 글이라 D-3보다 '내일'이 낫고, 그 뒤는 날짜가 낫다.
 */
export function eventPhrase(today: string, event: ClassEvent): string {
  const days = daysUntil(today, event.date);
  const when = days === 0 ? '오늘' : days === 1 ? '내일' : shortDate(event.date);
  const note = event.note.trim();
  return note === '' ? `${when} ${event.title}` : `${when} ${event.title} — ${note}`;
}
```

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS.

- [ ] **Step 5: NoticePage 화면 시험을 쓴다** — Create `tests/notice/NoticePage.test.tsx`

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import NoticePage from '../../src/features/notice/NoticePage';
import {
  createClassEvent,
  createClassRoom,
  createEmptySuiteData,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

const NOW = '2026-03-02T09:00:00.000Z';

/** 화면은 진짜 오늘을 쓰므로, 내일 일정은 실행 시각 기준으로 만든다. */
function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seeded(): SuiteData {
  const term = createTerm({ schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' }, NOW);
  const room = createClassRoom({ id: 'class-1', termId: term.id, name: '우리 반' }, NOW);
  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room],
    classEvents: [createClassEvent({ classId: room.id, date: tomorrowIso(), title: '현장학습', note: '도시락' }, NOW)],
    activeTermId: term.id,
    activeClassId: room.id,
  };
}

async function renderPage(): Promise<void> {
  render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider adapter={stubAdapter({ load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }) })}>
          <NoticePage />
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
  await screen.findByText('다가오는 일정');
}

describe('알림장 — 학급 일정 문구', () => {
  it('내일 일정이 칩으로 뜨고, 누르면 알림장 한 줄이 되며 칩은 사라진다', async () => {
    const user = userEvent.setup();
    await renderPage();

    const chip = screen.getByRole('button', { name: '+ 내일 현장학습 — 도시락' });
    await user.click(chip);

    expect(within(screen.getByRole('list', { name: '알림장 항목' })).getByText('내일 현장학습 — 도시락')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ 내일 현장학습 — 도시락' })).not.toBeInTheDocument();
  });
});
```

> 항목 목록 `<ul>`에 `aria-label="알림장 항목"`이 없다면 Step 7에서 붙인다(NoticePage의 항목 `<ul>`, 현재 `:215` 근처).

- [ ] **Step 6: 실패 확인** — `npx vitest run tests/notice/NoticePage.test.tsx` → '다가오는 일정' 없음으로 FAIL.

- [ ] **Step 7: NoticePage 구현**
  1. import에 `eventPhrase, eventsSoon` 추가.
  2. `:65-71` 파생값 아래:
  ```ts
  // 이레 안 학급 일정. 종례에서 "내일 현장학습, 도시락"을 빠뜨리지 않게 칩으로 내민다.
  const eventPhrases = eventsSoon(data.classEvents, classId, date, 7)
    .map((event) => ({ id: event.id, text: eventPhrase(date, event) }))
    .filter(({ text }) => !items.some((item) => item.text === text));
  ```
  3. `replaceItems` 아래에 `appendItem` 추가, `addItem`과 자주 쓰는 문구 칩의 인라인 updater를 `appendItem(...)`으로 교체:
  ```ts
  /** 한 줄 덧붙이기. 목록은 suite에서 다시 읽는다 — 칩을 연달아 눌러도 한 줄이 안 사라진다. */
  const appendItem = (value: string): void => {
    update((suite) => ({
      ...suite,
      notices: setItems(suite.notices, classId, date, [
        ...itemsFor(suite.notices, classId, date),
        { id: createId(), text: value },
      ]),
    }));
  };
  ```
  4. 자주 쓰는 문구 줄 **앞**에:
  ```tsx
  {eventPhrases.length > 0 ? (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      <span className="text-xs text-slate-500">다가오는 일정</span>
      {eventPhrases.map(({ id, text }) => (
        <button key={id} type="button" onClick={() => appendItem(text)}>
          <Badge tone="info">+ {text}</Badge>
        </button>
      ))}
    </div>
  ) : null}
  ```
  5. 항목 `<ul>`에 `aria-label="알림장 항목"`.
- [ ] **Step 8: TodayBoard** — `:171-174`를 `const soon = eventsSoon(data.classEvents, classId, date, 3);`로, import에서 `daysUntil, upcomingEvents` 중 안 쓰는 것 제거.
- [ ] **Step 9: 통과 확인** — `npx vitest run tests/notice` → PASS. `npx tsc --noEmit -p tsconfig.app.json`.
- [ ] **Step 10: 커밋** — `git commit -m "feat: 학급 일정이 알림장 칩으로 — '내일 현장학습 — 도시락'을 한 번에 넣는다"`

---

### Task 3: 출결 집계 인쇄 — 달 말고 학기 전체

**Files:**
- Modify: `src/features/attendance/attendanceCore.ts:221-244` (`rangeCounts` 추가, `monthlyCounts`는 위임)
- Modify: `src/features/attendance/AttendancePage.tsx` MonthlyTab `:359-433`
- Test: `tests/attendance/attendanceCore.test.ts`

**Interfaces:**
- Produces: `rangeCounts(records, classId, from: string, to: string): Map<string, Record<AttendanceStatus, number>>` — `from`·`to` 포함, 사전순 비교. `monthlyCounts(records, classId, month)` = `rangeCounts(records, classId, \`${month}-01\`, \`${month}-31\`)`.
- Consumes: `useActiveTerm()` (`shared/roster/SuiteDataProvider`), `Term.startDate/endDate`(빈 문자열일 수 있음).

- [ ] **Step 1: 시험** — `monthlyCounts` describe 뒤에:

```ts
describe('rangeCounts — 학기 전체 집계', () => {
  it('시작·끝 날짜를 포함해 그 사이 기록만 센다', () => {
    let records: AttendanceRecord[] = [];
    records = setStatus(records, CLASS, '2026-03-02', 'stu-1', 'absent'); // 시작일
    records = setStatus(records, CLASS, '2026-05-10', 'stu-1', 'late');
    records = setStatus(records, CLASS, '2026-07-20', 'stu-2', 'early'); // 끝일
    records = setStatus(records, CLASS, '2026-07-21', 'stu-2', 'absent'); // 방학
    records = setStatus(records, CLASS, '2026-03-01', 'stu-1', 'absent'); // 전날

    const counts = rangeCounts(records, CLASS, '2026-03-02', '2026-07-20');

    expect(counts.get('stu-1')).toEqual({ absent: 1, late: 1, early: 0, fieldTrip: 0 });
    expect(counts.get('stu-2')).toEqual({ absent: 0, late: 0, early: 1, fieldTrip: 0 });
  });
});
```
import에 `rangeCounts` 추가.

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/attendance` → FAIL.
- [ ] **Step 3: 구현** — `attendanceCore.ts`:

```ts
/**
 * 기간 안 학생별 상태 횟수. from·to 포함, ISO 날짜라 글자 비교면 된다.
 *
 * 학기말 생활기록부 출결은 한 학기 전체를 세야 한다 — 달마다 더하게 하지 않는다.
 * 기록이 있는 학생만 담는다.
 */
export function rangeCounts(
  records: readonly AttendanceRecord[],
  classId: string,
  from: string,
  to: string,
): Map<string, Record<AttendanceStatus, number>> {
  const counts = new Map<string, Record<AttendanceStatus, number>>();

  for (const record of records) {
    if (record.classId !== classId || record.date < from || record.date > to) continue;
    for (const entry of record.entries) {
      const bucket =
        counts.get(entry.studentId) ?? { absent: 0, late: 0, early: 0, fieldTrip: 0 };
      bucket[entry.status] += 1;
      counts.set(entry.studentId, bucket);
    }
  }

  return counts;
}

/** 그 달 학생별 상태 횟수. month는 "2026-08" 꼴이다. 나이스 월말 입력 때 옆에 두고 본다. */
export function monthlyCounts(records, classId, month) {
  return rangeCounts(records, classId, `${month}-01`, `${month}-31`);
}
```
- [ ] **Step 4: 통과 확인.**
- [ ] **Step 5: MonthlyTab** —
  1. import: `useActiveTerm` 추가(`../../shared/roster/SuiteDataProvider`), `rangeCounts` 추가.
  2. 상태: `const term = useActiveTerm(); const termRange = term !== null && term.startDate !== '' && term.endDate !== '' ? { from: term.startDate, to: term.endDate, name: term.name } : null; const [scope, setScope] = useState<'month' | 'term'>('month'); const termMode = scope === 'term' && termRange !== null;`
  3. counts:
  ```ts
  const counts = useMemo(
    () =>
      termMode
        ? rangeCounts(data.attendanceRecords, classId, termRange.from, termRange.to)
        : monthlyCounts(data.attendanceRecords, classId, month),
    [data.attendanceRecords, classId, month, termMode, termRange],
  );
  ```
  (`termRange`가 `null`일 때 `termMode`가 false이므로 안전하지만 TS 좁히기를 위해 `termMode && termRange !== null`로 쓴다.)
  4. 머리줄: 달 스테퍼(`이전 달`·년월·`다음 달`)를 `termMode ? null : (...)`로 감싸고, 그 자리에 termMode면 `<p className="text-sm font-semibold text-slate-800">{termRange.name}</p>`. 스테퍼 뒤, 인쇄 단추 앞에 StudentDetailPage의 토글을 복사:
  ```tsx
  {termRange !== null ? (
    <div className="inline-flex gap-0.5 rounded-control border border-slate-200 p-0.5" role="group" aria-label="집계 기간">
      <Button size="sm" variant={termMode ? 'ghost' : 'primary'} aria-pressed={!termMode} onClick={() => setScope('month')}>달</Button>
      <Button size="sm" variant={termMode ? 'primary' : 'ghost'} aria-pressed={termMode} onClick={() => setScope('term')}>학기 전체</Button>
    </div>
  ) : null}
  ```
  5. 안내문: termMode면 `학기말 출결 집계를 낼 때 옆에 두고 보는 표입니다.`, 아니면 기존 문구.
  6. PrintLayout: `title={\`${activeClass?.name ?? ''} ${termMode ? termRange.name : \`${year}년 ${Number(mon)}월\`} 출결\`}`, `subtitle={termMode ? \`${termRange.from} ~ ${termRange.to}\` : undefined}`.
- [ ] **Step 6: 화면 시험** — Create `tests/attendance/MonthlyTab.test.tsx`: seeded 데이터(학기 03-02~07-20, 학생 1명, 기록 03-05 absent·07-21 absent), AttendancePage 렌더 → 탭 `월별 집계`(실제 탭 라벨은 AttendancePage에서 확인해 맞춘다) 클릭 → `학기 전체` 누르면 표의 결석 칸이 1이고 제목에 학기 이름이 있다. 렌더 래퍼는 Task 2 Step 5와 같은 형태(MemoryRouter + ToastProvider + SuiteDataProvider).
- [ ] **Step 7: 통과 확인, tsc, 커밋** — `git commit -m "feat: 출결 집계를 학기 전체로도 — 생활기록부 출결에 달마다 더하지 않는다"`

---

### Task 4: 키보드 단축키 도움 화면 (`?`)

**Files:**
- Create: `src/shared/ui/ShortcutsModal.tsx`
- Create: `src/shared/ui/useHelpKey.ts`
- Modify: `src/shared/ui/index.ts` (두 export, 알파벳 순)
- Modify: `src/app/AppShell.tsx` (헤더 `?` 단추 + 전역 키 + 모달)
- Modify: `src/shared/ui/BoardScreen.tsx` (`?` 키 + 단추 + 모달, scope='board')
- Test: Create `tests/ui/ShortcutsModal.test.tsx`, `tests/ui/BoardScreen.test.tsx`, `tests/app/helpKey.test.tsx`

**Interfaces:**
- Produces:
  - `ShortcutsModal({ open, onClose, scope }: { open: boolean; onClose: () => void; scope: 'app' | 'board' })`
  - `useHelpKey(onOpen: () => void, enabled = true): void` — `?` 키(`event.key === '?'`)에 `onOpen`. 무시: `event.isComposing`, ctrl/meta/alt, 대상이 `input/textarea/select/[contenteditable]`, 이미 `[role="dialog"]`가 열려 있을 때.

- [ ] **Step 1: 시험 셋** —

`tests/ui/ShortcutsModal.test.tsx`
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ShortcutsModal } from '../../src/shared/ui';

describe('ShortcutsModal', () => {
  it('앱 범위에는 칠판·뽑기·입력칸 단축키가 다 나온다', () => {
    render(<ShortcutsModal open onClose={vi.fn()} scope="app" />);
    expect(screen.getByRole('dialog', { name: '키보드 단축키' })).toBeInTheDocument();
    expect(screen.getByText('전체 화면 켜기·끄기')).toBeInTheDocument();
    expect(screen.getByText('한 명 더 뽑기')).toBeInTheDocument();
  });

  it('칠판 범위에는 칠판 것만 나온다', () => {
    render(<ShortcutsModal open onClose={vi.fn()} scope="board" />);
    expect(screen.getByText('전체 화면 켜기·끄기')).toBeInTheDocument();
    expect(screen.queryByText('한 명 더 뽑기')).not.toBeInTheDocument();
  });
});
```

`tests/ui/BoardScreen.test.tsx`
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BoardScreen } from '../../src/shared/ui';

describe('BoardScreen 키보드', () => {
  it('Esc는 닫고, ?는 단축키 도움을 연다', () => {
    const onExit = vi.fn();
    render(<BoardScreen title="오늘" onExit={onExit}><p>본문</p></BoardScreen>);

    fireEvent.keyDown(document, { key: '?' });
    expect(screen.getByRole('dialog', { name: '키보드 단축키' })).toBeInTheDocument();

    // 도움이 열려 있는 동안 Esc는 도움만 닫는다 — 칠판까지 닫히면 안 된다.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onExit).toHaveBeenCalledOnce();
  });
});
```

`tests/app/helpKey.test.tsx` (toolsWiring.test.tsx의 `show()` 래퍼를 그대로 복사, 라우트 화면은 `<input aria-label="메모" />` 하나)
```tsx
describe('단축키 도움 (?)', () => {
  it('?를 누르면 열리고, 입력칸 안에서는 안 열린다', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('button', { name: '키보드 단축키' });

    await user.keyboard('?');
    expect(screen.getByRole('dialog', { name: '키보드 단축키' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('textbox', { name: '메모' }));
    await user.keyboard('?');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '메모' })).toHaveValue('?');
  });

  it('머리띠 단추로도 연다', async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: '키보드 단축키' }));
    expect(screen.getByRole('dialog', { name: '키보드 단축키' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인** — 세 파일 모두 import 오류로 FAIL.
- [ ] **Step 3: `useHelpKey.ts`**

```ts
import { useEffect } from 'react';

/** 글자를 받는 곳이면 `?`는 글자다. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

/**
 * `?`(Shift+/)로 단축키 도움을 연다.
 *
 * 입력칸 안, 한글 조합 중, 다른 대화상자가 열려 있을 때는 아무 일도 안 한다 —
 * 알림장에 "준비물?"을 치다가 도움창이 튀어나오면 안 된다.
 */
export function useHelpKey(onOpen: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key !== '?' || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target) || document.querySelector('[role="dialog"]') !== null) return;
      event.preventDefault();
      onOpen();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onOpen, enabled]);
}
```

- [ ] **Step 4: `ShortcutsModal.tsx`**

```tsx
import { Modal } from './Modal';

type Scope = 'app' | 'board';

interface Shortcut {
  keys: readonly string[];
  what: string;
}

interface Group {
  title: string;
  scope: readonly Scope[];
  items: readonly Shortcut[];
}

/*
 * 앱에 실제로 있는 단축키만 적는다. 여기 적고 코드에 없는 것은 거짓말이고,
 * 코드에 있고 여기 없는 것은 아무도 못 찾는 기능이다 — 둘 다 이 표를 고친다.
 */
const GROUPS: readonly Group[] = [
  {
    title: '어디서나',
    scope: ['app', 'board'],
    items: [
      { keys: ['?'], what: '이 도움 열기' },
      { keys: ['Esc'], what: '대화상자·칠판·가리개 닫기' },
      { keys: ['Tab'], what: '대화상자 안에서 다음 칸으로' },
    ],
  },
  {
    title: '전자칠판 화면',
    scope: ['app', 'board'],
    items: [
      { keys: ['F'], what: '전체 화면 켜기·끄기' },
      { keys: ['Esc'], what: '칠판 닫기' },
    ],
  },
  {
    title: '발표자 뽑기 (결과 화면)',
    scope: ['app'],
    items: [
      { keys: ['Enter', 'Space'], what: '한 명 더 뽑기' },
      { keys: ['Esc'], what: '결과 닫기' },
    ],
  },
  {
    title: '입력칸',
    scope: ['app'],
    items: [
      { keys: ['Enter'], what: '알림장·업무·관찰 기록·과목 한 줄 추가' },
      { keys: ['←', '→'], what: '탭 옮기기 (설정·출결 등)' },
    ],
  },
  {
    title: '잠금 화면',
    scope: ['app'],
    items: [
      { keys: ['0–9'], what: 'PIN 입력' },
      { keys: ['Backspace'], what: '한 자리 지우기' },
    ],
  },
];

/** 키보드 단축키 목록. 앱 셸과 칠판 프레임이 같이 쓴다. */
export function ShortcutsModal({ open, onClose, scope }: { open: boolean; onClose: () => void; scope: Scope }) {
  const groups = GROUPS.filter((group) => group.scope.includes(scope));

  return (
    <Modal open={open} onClose={onClose} title="키보드 단축키" size="sm">
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <section key={group.title}>
            <h3 className="mb-1.5 text-xs font-semibold text-slate-500">{group.title}</h3>
            <dl className="flex flex-col gap-1">
              {group.items.map((item) => (
                <div key={item.what} className="flex items-center gap-3 text-sm">
                  <dt className="flex w-28 shrink-0 flex-wrap gap-1">
                    {item.keys.map((key) => (
                      <kbd
                        key={key}
                        className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-700"
                      >
                        {key}
                      </kbd>
                    ))}
                  </dt>
                  <dd className="text-slate-800">{item.what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
```
`index.ts`: `export { ShortcutsModal } from './ShortcutsModal';` (PrintLayout 뒤), `export { useHelpKey } from './useHelpKey';` (useFullscreen 뒤).

- [ ] **Step 5: AppShell** — import에 `CircleQuestionMark` (lucide), `ShortcutsModal, useHelpKey` (`../shared/ui`). 본문:
```ts
const [helpOpen, setHelpOpen] = useState(false);
const openHelp = useCallback(() => setHelpOpen(true), []);
// 잠금 중에는 도움도 열지 않는다 — 잠금 화면은 아무것도 안 새는 것이 목적이다.
useHelpKey(openHelp, !data.isLocked);
```
헤더 잠금 단추(`:167`)와 설정 링크(`:169`) 사이에:
```tsx
<button type="button" onClick={openHelp} aria-label="키보드 단축키" title="키보드 단축키 (?)"
  className="ml-1 rounded-control p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
  <CircleQuestionMark className="size-4" aria-hidden />
</button>
```
`<LockScreen …>` 줄 근처에 `<ShortcutsModal open={helpOpen} onClose={() => setHelpOpen(false)} scope="app" />`.

- [ ] **Step 6: BoardScreen** — import `CircleQuestionMark`, `useState`, `ShortcutsModal`, `useHelpKey`. `const [helpOpen, setHelpOpen] = useState(false); useHelpKey(() => setHelpOpen(true));` 기존 keydown에서 `Escape`는 `helpOpen`이면 무시하지 않아도 된다(Modal이 캡처 단계에서 `stopPropagation`). 헤더 `actions` 뒤, 전체 화면 단추 앞에 `<Button size="lg" variant="secondary" icon={CircleQuestionMark} iconOnly aria-label="키보드 단축키" onClick={() => setHelpOpen(true)} />`. `</div>` 닫기 전 `<ShortcutsModal open={helpOpen} onClose={() => setHelpOpen(false)} scope="board" />`. 주석 `:35-38`에 "?는 도움" 추가.

- [ ] **Step 7: 통과 확인** — `npx vitest run tests/ui tests/app` → PASS. `tsc`.
- [ ] **Step 8: README** — `:20` 전자칠판 줄 아래에 `- **키보드 단축키**: 어디서나 \`?\`를 누르면 단축키 목록이 뜹니다. 칠판은 \`F\`(전체 화면)·\`Esc\`(닫기).`
- [ ] **Step 9: 커밋** — `git commit -m "feat: 단축키 도움 — ?로 어디서나, 칠판에서도"`

---

### Task 5: 0.13.1 판 내기

**Files:**
- Create: `docs/releases/v0.13.1.md`
- Modify: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` (`0.13.0` → `0.13.1`, Cargo.lock은 `name = "g-board"` 패키지의 version 줄만)
- Create (저장소 밖): `../G-board/G-board_0.13.1_x64-setup.exe`, `../G-board/확인목록.md` 새로 쓰기

- [ ] **Step 1: 노트** — `docs/releases/v0.13.1.md`
```markdown
일정 문구·학기 집계·단축키 도움 판

0.13.0에서 자동 갱신으로 받는 첫 판입니다. 앱을 켜고 8초쯤 뒤 "새 판 0.13.1 — 일정 문구·학기 집계·단축키 도움 판" 알림이 뜨면 [지금 설치]를 누르세요.

## 새로 된 것

- **알림장에 학급 일정 칩** — 이레 안 일정이 "내일 현장학습 — 도시락"처럼 칩으로 뜹니다. 누르면 한 줄로 들어갑니다.
- **출결 집계를 학기 전체로** — 출결 → 월별 집계에서 [학기 전체]를 누르면 이번 학기 결석·지각·조퇴·체험학습 합계가 한 표로 나오고, 그대로 인쇄됩니다.
- **키보드 단축키 도움** — 어디서나 `?`를 누르거나 머리띠의 물음표 단추를 누르면 단축키 목록이 뜹니다. 칠판 화면에서도 됩니다.

## 고친 것

- 릴리스 본문과 앱의 "새 판" 알림 문구가 같은 글에서 나옵니다.

## 설치

새 판 알림의 [지금 설치]를 누르면 됩니다. 손으로 설치하려면 `G-board_0.13.1_x64-setup.exe`를 받아 더블클릭하세요. 처음 실행 때 "PC 보호" 창이 뜨면 **추가 정보 → 실행**.
```
- [ ] **Step 2: 판 번호 네 곳** — `sed -i 's/"version": "0.13.0"/"version": "0.13.1"/' package.json src-tauri/tauri.conf.json`, `sed -i 's/^version = "0.13.0"/version = "0.13.1"/' src-tauri/Cargo.toml`, Cargo.lock은 `g-board` 블록의 `version = "0.13.0"`만 (`awk`로 `name = "g-board"` 다음 version 줄).
- [ ] **Step 3: 전체 검증** — `npm run verify && npm run check:release` → 통과. 시험 수·청크 크기를 기록.
- [ ] **Step 4: 서명 빌드** — `export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/gboard.key)" && npx tauri build` → `src-tauri/target/release/bundle/nsis/G-board_0.13.1_x64-setup.exe`(+`.sig`) → `../G-board/`로 복사.
- [ ] **Step 5: `../G-board/확인목록.md`** 새로 쓰기 — 0.13.1 항목: (1) 0.13.0 앱을 켜고 8초 뒤 알림 → [지금 설치] → 다시 켜지면 설정의 '판'이 0.13.1, (2) 알림장 일정 칩, (3) 출결 학기 전체 표·인쇄, (4) `?` 도움(앱·칠판·입력칸 안에서는 안 뜸·잠금 중 안 뜸), (5) 릴리스 본문이 노트 파일과 같은가.
- [ ] **Step 6: 커밋·푸시·태그** —
```bash
git add -A && git commit -m "chore: 0.13.1 — 일정 문구·학기 집계·단축키 도움 판"
git push origin main && git tag v0.13.1 && git push origin v0.13.1
gh run watch --exit-status   # release · verify
gh release view v0.13.1 --json isDraft,name,assets
```
초안 이름이 `G-board v0.13.1 — 일정 문구·학기 집계·단축키 도움 판`이고 첨부 3개면 성공. **Publish는 사용자가 누른다.**

---

## Self-Review

- 사양 대비: 네 항목 모두 Task 1–4에 있고, 배포는 Task 5. Firebase 중계는 사양에서 제외했다고 명시.
- 자리표시자: 없음. Task 3 Step 6의 탭 라벨만 "실제 라벨 확인"이라 적었다 — 구현 때 `AttendancePage.tsx`의 `Tabs` items에서 읽는다.
- 이름 일치: `eventsSoon/eventPhrase/shortDate`, `rangeCounts`, `ShortcutsModal/useHelpKey`, `appendItem` — 각 Task 안에서 같은 이름을 쓴다.
