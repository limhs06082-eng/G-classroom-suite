# 0.14.0 — 홈 카드 드래그·크기, 알림장 인쇄 일정, 출결 사유 열, 노트 줄끝 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 0.13.1의 "다음 판 후보" 세 가지(웹 퀴즈 제외)와 홈 카드 드래그 이동·크기 조절을 붙여 0.14.0으로 낸다.

**Architecture:** 홈 배치는 기존 `homeLayout.ts`(순수 함수 + localStorage)를 `sizes`로 넓히고, 드래그는 라이브러리 없이 HTML5 drag 이벤트로 — 손잡이(grip)에서만 시작하고, 떨어뜨린 카드 자리로 옮긴다. 위·아래 단추는 그대로 남긴다(터치·키보드용). 출결 사유는 `attendanceCore.notesInRange` 순수 함수로 모아 학기 모드에서만 열을 더한다. 알림장 인쇄는 이미 있는 `eventPhrases`를 그대로 찍는다.

**Tech Stack:** React 19 · TS · Tailwind 4 · vitest/Testing Library(`fireEvent.dragStart/drop`에 `dataTransfer` 넘김) · Tauri 2.

**Spec:** 2026-09-05 사용자 요청 — "웹퀴즈를 제외하고 나머지(알림장 인쇄에 학급 일정, 출결 학기 집계에 사유 메모 열, 노트 파일 LF 고정) + 홈 화면 카드 드래그로 옮기기, 크기 키웠다 줄이기".

## Global Constraints

- 새 의존성 없음. 드래그는 `draggable`/`onDragStart`/`onDragOver`/`onDrop`만.
- 홈 그리드는 `grid gap-3 sm:grid-cols-2 lg:grid-cols-3`. 카드 폭은 1·2·3칸이며 Tailwind 클래스는 리터럴로 (`'sm:col-span-2'`, `'sm:col-span-2 lg:col-span-3'`).
- 배치는 기기 취향이라 localStorage `gboard:home-layout`에 — 백업에 안 들어간다. 모르는 값은 조용히 버린다.
- 날짜 문자열 비교는 사전순. `new Date('YYYY-MM-DD')` 금지.
- 판 번호 네 곳 + `docs/releases/v0.14.0.md`(1행 별명) 없으면 `check:release`가 막는다.
- 커밋 꼬리: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: 홈 배치 순수 함수 — `sizes`·`resize`·`moveCardTo`

**Files:** Modify `src/features/home/homeLayout.ts`; Test `tests/home/homeLayout.test.ts`

**Interfaces (Produces):**
- `type HomeCardSize = 1 | 2 | 3`
- `interface HomeLayout { order: string[]; hidden: string[]; sizes: Record<string, HomeCardSize> }` — `EMPTY_LAYOUT.sizes = {}`
- `sizeOf(layout, id): HomeCardSize` (없으면 1)
- `resize(layout, id, delta: -1 | 1): HomeLayout` — 1~3으로 잘라내고, 1이면 키를 지운다. 변화 없으면 같은 객체.
- `moveCardTo(defaults, layout, id, targetId): HomeLayout` — `id`를 빼고, 원래 `id`가 `targetId`보다 앞이었으면 target **뒤**에, 뒤였으면 target **앞**에 끼운다(정렬 목록의 흔한 규칙). 같은 카드·모르는 카드면 같은 객체.
- `loadLayout`은 `sizes`의 값이 1·2·3인 것만 읽는다.

- [ ] Step 1 시험 추가 (기존 `{order, hidden}` 리터럴에 `sizes: {}` 보강):
```ts
it('크기는 1~3칸이고 1이면 저장하지 않는다', () => {
  const wide = resize(EMPTY_LAYOUT, 'now', 1);
  expect(sizeOf(wide, 'now')).toBe(2);
  expect(sizeOf(resize(resize(wide, 'now', 1), 'now', 1), 'now')).toBe(3); // 3에서 더 못 넓힌다
  expect(resize(EMPTY_LAYOUT, 'now', -1)).toBe(EMPTY_LAYOUT);
  expect(resize(wide, 'now', -1).sizes).toEqual({});
});
it('떨어뜨린 자리로 옮긴다 — 앞으로 끌면 그 앞에, 뒤로 끌면 그 뒤에', () => {
  expect(resolveOrder(DEFAULTS, moveCardTo(DEFAULTS, EMPTY_LAYOUT, 'seating', 'attendance'))).toEqual(['now', 'seating', 'attendance', 'duty']);
  expect(resolveOrder(DEFAULTS, moveCardTo(DEFAULTS, EMPTY_LAYOUT, 'now', 'duty'))).toEqual(['attendance', 'duty', 'now', 'seating']);
  expect(moveCardTo(DEFAULTS, EMPTY_LAYOUT, 'now', 'now')).toBe(EMPTY_LAYOUT);
  expect(moveCardTo(DEFAULTS, EMPTY_LAYOUT, 'ghost', 'now')).toBe(EMPTY_LAYOUT);
});
it('크기도 localStorage에 남고, 엉뚱한 값은 버린다', () => {
  saveLayout({ order: [], hidden: [], sizes: { now: 2 } });
  expect(loadLayout().sizes).toEqual({ now: 2 });
  window.localStorage.setItem('gboard:home-layout', JSON.stringify({ sizes: { now: 7, duty: 'x', meal: 3 } }));
  expect(loadLayout().sizes).toEqual({ meal: 3 });
});
```
- [ ] Step 2 실패 확인 → Step 3 구현 → Step 4 통과 → Step 5 커밋 `feat: 홈 배치에 카드 크기와 자리 옮기기`

### Task 2: 홈 화면 — 손잡이 드래그·넓히기/좁히기

**Files:** Modify `src/features/home/HomePage.tsx` (`slot()`, 그리드, `HomeSlot`); Test `tests/home/homeLayoutWiring.test.tsx`

**Interfaces:** Consumes Task 1. `HomeSlot` props 추가: `size: HomeCardSize`, `onResize(delta)`, `onDragStart()`, `onDropOn()`, `dragging: boolean`(끌리는 중인 카드), `dropTarget: boolean`(위에 떠 있는 자리). HomePage 상태 `draggingId: string | null`, `overId: string | null`.

- [ ] Step 1 시험 (`homeTimetableWiring.test.tsx`의 렌더 도우미를 복사):
```tsx
it('손잡이를 끌어 다른 카드에 놓으면 그 자리로 가고 localStorage에 남는다', async () => { ... fireEvent.dragStart(handle('출결'), { dataTransfer }); fireEvent.dragOver(slot('지금'), { dataTransfer }); fireEvent.drop(slot('지금'), { dataTransfer }); expect(JSON.parse(localStorage.getItem('gboard:home-layout')).order[0]).toBe('attendance'); });
it('넓히기를 누르면 두 칸이 되고 좁히기로 돌아온다', ...) // slot('출결')이 'sm:col-span-2' 클래스를 가진다
```
`dataTransfer = { setData: vi.fn(), getData: () => 'attendance', effectAllowed: '', dropEffect: '', setDragImage: vi.fn() }`. 자리 찾기: `screen.getByLabelText('출결 카드 자리')` → HomeSlot 바깥 div에 `aria-label={`${label} 카드 자리`}` (role 없이 라벨만 — `getByLabelText`는 aria-label 붙은 div도 찾는다).
- [ ] Step 2 구현:
  - `slot(id)`에 `size: sizeOf(layout, id)`, `onResize`, `onDragStart: () => setDraggingId(id)`, `onDragEnd: () => { setDraggingId(null); setOverId(null); }`, `onDragOver: () => setOverId(id)`, `onDropOn: () => { if (draggingId && draggingId !== id) applyLayout(moveCardTo(HOME_CARD_IDS, layout, draggingId, id)); setDraggingId(null); setOverId(null); }`, `dragging: draggingId === id`, `dropTarget: overId === id && draggingId !== null && draggingId !== id`.
  - `HomeSlot`: 바깥 div에 `aria-label`, `onDragOver={(e) => { e.preventDefault(); onDragOver(); }}`, `onDrop={(e) => { e.preventDefault(); onDropOn(); }}`, `className={cx('group/slot relative', SIZE_CLASS[size], dragging && 'opacity-50', dropTarget && 'ring-2 ring-brand-300 rounded-card')}`. 조작 묶음 맨 앞에 손잡이 `<button draggable aria-label={`${label} 카드 끌기`} title="끌어서 옮기기" onDragStart={(e) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; onDragStart(); }} onDragEnd={onDragEnd} className="cursor-grab active:cursor-grabbing ..."><GripVertical/></button>`, 그리고 `Minimize2`(좁히기, size===1이면 disabled)·`Maximize2`(넓히기, size===3이면 disabled).
  - `const SIZE_CLASS: Record<HomeCardSize, string> = { 1: '', 2: 'sm:col-span-2', 3: 'sm:col-span-2 lg:col-span-3' };`
- [ ] Step 3 통과·tsc → 커밋 `feat: 홈 카드를 끌어서 옮기고 넓혔다 좁힌다`

### Task 3: 출결 학기 집계 — 사유 열

**Files:** Modify `src/features/attendance/attendanceCore.ts`, `AttendancePage.tsx`(MonthlyTab 인쇄 표·화면 표); Test `tests/attendance/attendanceCore.test.ts`, `tests/attendance/MonthlyTab.test.tsx`

**Interfaces (Produces):** `interface AttendanceNote { date: string; status: AttendanceStatus; note: string }`; `notesInRange(records, classId, from, to): Map<string, AttendanceNote[]>` — 사유가 비어 있지 않은 항목만, 날짜순. `monthDay('2026-03-05') → '3/5'`.

- [ ] 시험: 3월 5일 결석 "병원", 3월 6일 지각(사유 없음), 7월 21일 결석 "방학" → `notesInRange(..., '2026-03-02','2026-07-20').get('stu-1')` = `[{date:'2026-03-05',status:'absent',note:'병원'}]`.
- [ ] 구현. MonthlyTab: `const notes = useMemo(() => termMode && term !== null ? notesInRange(records, classId, term.startDate, term.endDate) : new Map(), [...])`. 학기 모드일 때만 인쇄 표에 `<th>사유</th>` + `<td>` 안에 `<ul>`로 `3/5 결석: 병원` 줄들, 화면 `Table`에도 같은 열(`key: 'notes', header: '사유', hideOnNarrow: true`).
- [ ] MonthlyTab.test: 3월 5일 결석에 `setNote(..., '병원')` → 학기 전체에서 `3/5 결석: 병원`이 보인다. 달 모드에서는 '사유' 머리글이 없다.
- [ ] 커밋 `feat: 출결 학기 집계에 사유 열 — 생활기록부에 적을 병결·미인정을 한 표에서`

### Task 4: 알림장 인쇄에 다가오는 일정

**Files:** Modify `src/features/notice/NoticePage.tsx`(PrintLayout); Test `tests/notice/NoticePage.test.tsx`

- [ ] 시험: 렌더 직후 `document.getElementById('print-root')` 안에 '다가오는 일정'과 '내일 현장학습 — 도시락'이 있고, 칩을 눌러 항목이 되면 인쇄의 일정 묶음에서는 빠진다(항목으로 이미 찍히므로).
- [ ] 구현: `</ol>` 뒤에
```tsx
{eventPhrases.length > 0 ? (
  <section className="print-keep mt-4">
    <h2 className="mb-1 text-sm font-semibold">다가오는 일정</h2>
    <ul className="flex flex-col gap-1 text-base">
      {eventPhrases.map(({ id, text: phrase }) => <li key={id}>· {phrase}</li>)}
    </ul>
  </section>
) : null}
```
- [ ] 커밋 `feat: 알림장 인쇄에 다가오는 일정을 같이 찍는다`

### Task 5: 릴리스 노트 줄끝 LF 고정

**Files:** Create `.gitattributes` — `docs/releases/*.md text eol=lf`; `git add --renormalize docs/releases`.
- [ ] 커밋 `chore: 릴리스 노트는 LF — 앱 알림 문구에 \r이 안 섞이게`

### Task 6: 0.14.0 판 내기

- [ ] `docs/releases/v0.14.0.md`(1행 `홈 카드 끌기·크기 판`), 판 번호 네 곳, `npm run verify && npm run check:release`, 리뷰 에이전트, 서명 빌드(`TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""` 필수) → `../G-board/`, `확인목록.md` 새로 쓰기, main 합치고 push, `v0.14.0` 태그, Actions 초안 확인. Publish는 사용자.
