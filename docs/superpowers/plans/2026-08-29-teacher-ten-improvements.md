# 교사 개선안 열 가지 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 초중고 교사의 하루 흐름(아침 출결 → 수업 → 종례 알림장)을 채우는 열 가지 개선을 기존 설계 원칙을 지키며 넣는다.

**Architecture:** 모든 새 자료는 기존 패턴을 따른다 — "기록만 저장하고 상태는 계산한다"(보상 방식), classId 스코프 엔티티는 schema.ts 해석 + invariants.ts 정리 + classOps 삭제 연쇄에 함께 등록, 순수 로직은 `*Core.ts`로 떼어 시계·저장소 없이 시험한다.

**Tech Stack:** React 19 + TypeScript + Tailwind 4 + vitest. 기존 의존성만 쓴다(새 패키지 없음).

**Spec:** 이 문서 자체가 스펙이다(사용자 요청: 분석 보고서의 우선순위 높음 1~4 + 중간 5~10 전부).

## Global Constraints

- `npm run verify`가 끝까지 초록이어야 한다 (tsc, check:theme, vitest, 웹·설치형 빌드, 번들 순정성).
- 웹 번들에 Tauri/NEIS 코드가 실리면 안 된다 — 급식·날씨는 `isDesktop()` 뒤에서 동적 import (TodayMeal 패턴 그대로).
- 청크를 가르는 분기는 `import.meta.env.VITE_TARGET` 리터럴, 화면만 가르는 분기는 `isDesktop()`.
- 새 기능 색은 4개 테마 블록 모두에 `--color-{id}-50/-500` 토큰을 넣는다 (check:theme가 강제).
- 복구 원칙: 조용히 고치지 않는다. 단, 날짜가 지난 일회성 자료(시간표 오늘만 바꾸기)는 만료이지 복구가 아니므로 조용히 버린다.
- 학생을 삭제하지 않는다. 새 기록(출결·관찰)도 학생이 살아 있는 한 남긴다.
- 모든 문구는 한국어, 기존 어조(교사에게 말 걸듯)를 따른다.

---

## 설계 결정 (분석 보고서에서 다듬은 것)

1. **출결** — `AttendanceRecord`는 `DutyCompletion`처럼 (classId, date)마다 하나. **기록이 없는 학생이 출석이다** (과제의 "기록 없음 = 미제출"과 같은 원칙). 상태 4종: 결석 `absent` / 지각 `late` / 조퇴 `early` / 체험학습 `fieldTrip`. 전자칠판 보드는 두지 않는다 — 결석자 명단을 학생 화면에 띄우는 것은 프라이버시상 부적절.
2. **알림장** — `DailyNotice`도 (classId, date)마다 하나, 항목은 글줄 목록. 보드(`/board/notice`)가 핵심 화면이고, 내일까지인 과제를 자동으로 함께 보여 준다(복사하지 않고 계산).
3. **뽑기** — 도구 바 네 번째 도구. 저장하지 않는다(수업 한 번의 상태). 오늘 결석 학생은 자동 제외. `rng.ts`의 시드 주입 RNG 재사용.
4. **오늘 보드** — `/board/today`. FEATURE_NAV에 넣지 않고 BoardPage에서 특별 취급(네비에 뜨면 안 되므로). 급식·날씨는 설치형만, 웹은 시간표·당번·알림장만.
5. **알레르기** — 자료는 이미 파싱돼 있다(`MealDish.allergens`). 표시 + 범례만 붙인다.
6. **오늘만 바꾸기** — `TimetableOverride { classId, date, period, subject }`. subject 빈 글자는 "그 교시 없음". 지난 날짜는 불러올 때 조용히 만료. '지금' 카드도 바뀐 시간표를 본다.
7. **수업 종료 예고** — 소리는 넣지 않는다(오디오 기반이 없고, 종이 이미 울리는 학교에서 소리가 겹친다). NowCard가 5분 전부터 시각적으로 강조.
8. **보상 교환** — 벌점(음수 ScoreEntry)과 절대 섞지 않는다. 별도 `RewardItem`(쿠폰 정의) + `Redemption`(사용 기록, revokedAt 되돌리기). 잔액 = 통산 획득 − 사용.
9. **관찰 기록** — `ObservationEntry`(학생별 날짜 있는 메모 타임라인). 명단의 학생 편집 모달에 붙인다.
10. **인쇄** — PrintLayout이 이미 있으나 갤러리에서만 쓰인다. 자리표(SeatingPage)·당번표(DutyPage)·시간표(설정 탭)에 인쇄 단추.

스키마 버전은 1→2로 올린다. 옛 판이 새 백업을 열면 SCHEMA_VERSION_AHEAD 경고가 뜨는 것이 정확한 동작이다.

---

### Task 1: 도메인 확장 — 타입·팩토리·스키마·불변조건·삭제 연쇄

**Files:**
- Modify: `src/shared/domain/types.ts` (새 엔티티 6종 + SuiteData 필드 6개, CURRENT_SCHEMA_VERSION = 2)
- Modify: `src/shared/domain/factories.ts` (create 함수들 + createEmptySuiteData + STARTER_REWARD_ITEMS)
- Modify: `src/shared/storage/schema.ts` (parse 함수 6종 + 만료 정리)
- Modify: `src/shared/domain/invariants.ts` (ORPHAN_CLASS_RECORD 정리)
- Modify: `src/shared/roster/classOps.ts` (countClassData·deleteClassRoom에 6종 추가)
- Test: `tests/domain/newEntities.test.ts`, 기존 schema/invariants 테스트 통과 유지

**Interfaces (Produces):**
```ts
type AttendanceStatus = 'absent' | 'late' | 'early' | 'fieldTrip';
interface AttendanceEntry { studentId: string; status: AttendanceStatus; note: string }
interface AttendanceRecord { classId: string; date: string; entries: AttendanceEntry[] }
interface NoticeItem { id: string; text: string }
interface DailyNotice { classId: string; date: string; items: NoticeItem[] }
interface TimetableOverride { classId: string; date: string; period: number; subject: string }
interface RewardItem { id: string; classId: string; name: string; cost: number; isActive: boolean; order: number; createdAt: string }
interface Redemption { id: string; classId: string; occurredAt: string; targetUnit: 'student'|'group'; targetId: string; itemName: string; cost: number; revokedAt?: string }
interface ObservationEntry { id: string; classId: string; studentId: string; date: string; text: string; createdAt: string }
// SuiteData에: attendanceRecords, notices, timetableOverrides, rewardItems, redemptions, observations
```

- [x] 타입·팩토리 추가 → 스키마 해석(없으면 빈 배열, 지난 override는 조용히 버림) → invariants 정리(없는 학급·학생 참조) → classOps 연쇄 → 테스트 → 커밋

### Task 2: 테마 토큰 — attendance·notice 색

**Files:** Modify: `src/index.css` (4개 테마 블록에 `--color-attendance-50/-500`, `--color-notice-50/-500`)

- [x] attendance는 청록 계열(hue 190), notice는 주황 계열(hue 60)로 4테마 정의 → `npm run check:theme` → 커밋

### Task 3: 출결 기능

**Files:**
- Create: `src/features/attendance/attendanceCore.ts`, `AttendancePage.tsx`, `AttendanceSummary.tsx`
- Modify: `src/app/navigation.ts`(FeatureId + 항목), `src/app/router.tsx`(라우트), `src/features/home/HomePage.tsx`(카드)
- Test: `tests/attendance/attendanceCore.test.ts`

**Interfaces (Produces):**
```ts
// attendanceCore.ts — 순수 함수만
function statusOf(records, classId, date, studentId): AttendanceStatus | null  // null = 출석
function setStatus(records, classId, date, studentId, status | null, note?): AttendanceRecord[]
function summarize(records, classId, date, roster): { present: number; byStatus: Record<AttendanceStatus, number> }
function absentToday(records, classId, date): string[]  // 뽑기·당번 대체 제안이 쓴다
function monthlyCounts(records, classId, month /*YYYY-MM*/): Map<studentId, Record<AttendanceStatus, number>>
```

- [x] 코어 TDD → 페이지(오늘 탭: 명단 그리드에서 탭-탭 상태 순환 출석→결석→지각→조퇴→체험학습→출석, 사유 메모 / 월별 탭: 통계표) → 홈 카드(오늘 요약) → 커밋

### Task 4: 출결 연동 — 당번 대체 제안

**Files:** Modify: `src/features/duty/DutyPage.tsx` (오늘 당번 중 결석자에게 배지 + 대체 안내)
- [x] 오늘의 당번 탭에서 결석 학생에 `결석` 배지를 붙이고 대체 지정 흐름으로 안내 → 커밋

### Task 5: 알림장 기능 + 보드

**Files:**
- Create: `src/features/notice/noticeCore.ts`, `NoticePage.tsx`, `NoticeBoard.tsx`
- Modify: `navigation.ts`, `router.tsx`, `BoardPage.tsx`
- Test: `tests/notice/noticeCore.test.ts`

**Interfaces (Produces):**
```ts
function noticeFor(notices, classId, date): DailyNotice | null
function setItems(notices, classId, date, items: NoticeItem[]): DailyNotice[]
function assignmentsDueSoon(assignments, todayDate): Assignment[]  // 오늘·내일 마감, active만
```
- [x] 코어 TDD → 페이지(오늘 항목 편집, Enter 연속 추가 — TaskStep 패턴) → 보드(큰 글씨 목록 + "내일까지" 과제 자동 절) → 커밋

### Task 6: 랜덤 뽑기 (도구 바)

**Files:**
- Create: `src/features/tools/pickerCore.ts`, `PickerModal.tsx`
- Modify: `ToolsContext.tsx`(ToolName에 'picker'), `ToolsBar.tsx`
- Test: `tests/tools/pickerCore.test.ts`

**Interfaces:**
```ts
function drawOne(pool: Student[], rng: () => number): Student | null
function remainingPool(roster, absentIds, pickedIds, excludePicked): Student[]
```
- [x] 코어 TDD(결석 제외·중복 제외·빈 풀) → 모달(크게 이름 공개, '한 명 더'·'처음부터', "뽑힌 학생 제외" 토글, 전체 화면 공개 연출) → 커밋

### Task 7: 시간표 오늘만 바꾸기

**Files:**
- Modify: `src/features/timetable/timetableCore.ts` (`effectivePeriods` 추가), `src/features/home/TimetableCard.tsx`(오늘만 바꾸기 모달 + 바뀐 칸 표시), `HomePage.tsx`(TodayNow가 effectivePeriods 사용)
- Test: `tests/timetable/override.test.ts`

**Interfaces:**
```ts
function effectivePeriods(entries, overrides, classId, date, weekday): { period; subject; overridden: boolean }[]
function setOverride(overrides, classId, date, period, subject): TimetableOverride[]  // 원래 과목과 같아지면 항목 제거
```
- [x] 코어 TDD(과목 교체·교시 삭제·복원) → 모달 UI → NowCard 연결 → 커밋

### Task 8: 수업 종료 예고 (NowCard)

**Files:** Modify: `src/features/home/NowCard.tsx`
- [x] `kind === 'lesson' && minutesLeft <= 5`일 때 카드 테두리 강조 + "곧 쉬는 시간입니다" 문구 → 렌더 테스트 → 커밋

### Task 9: 급식 알레르기 표시

**Files:** Modify: `src/features/home/MealCard.tsx`; Create: `src/shared/external/allergens.ts`(1~19 명칭표)
- [x] 반찬 옆에 번호를 작게 표시 + '알레르기 번호란?' 접이식 범례 → 렌더 테스트 → 커밋

### Task 10: 보상 사용(쿠폰) 탭

**Files:**
- Create: `src/features/reward/redemptionCore.ts`
- Modify: `src/features/reward/RewardPage.tsx`(4번째 탭 '쿠폰')
- Test: `tests/reward/redemptionCore.test.ts`

**Interfaces:**
```ts
function lifetimeEarned(entries, unit, targetId): number     // revoked 제외 통산 합
function totalRedeemed(redemptions, unit, targetId): number  // revoked 제외
function balance(entries, redemptions, unit, targetId): number
function redeem(...): { ok: true; redemptions } | { ok: false; reason: 'insufficient' }
```
- [x] 코어 TDD(잔액 부족 거부·되돌리기) → 탭 UI(쿠폰 정의 관리 + 학생/모둠 잔액 목록 + 사용·되돌리기) → 커밋

### Task 11: 관찰 기록 (명단 모달)

**Files:**
- Create: `src/shared/roster/observationCore.ts`
- Modify: 명단의 학생 편집 모달 (`src/shared/roster/` 안 — 구현 시 파일 확인)
- Test: `tests/roster/observationCore.test.ts`
- [x] 코어(추가·삭제·학생별 시간순) TDD → 모달에 타임라인 절 추가 → 커밋

### Task 12: 오늘 종합 보드 `/board/today`

**Files:**
- Create: `src/features/board/TodayBoard.tsx`
- Modify: `BoardPage.tsx`(feature==='today' 특별 취급), `HomePage.tsx`(여는 단추), `src/features/home/todayMeal.ts` 재사용
- [x] 날짜·요일 + (설치형) 급식·날씨 + 시간표 + 오늘의 당번 + 알림장을 한 화면에, `text-board-*` 체계 → 커밋

### Task 13: 인쇄 셋

**Files:** Modify: `SeatingPage.tsx`(자리표 인쇄), `DutyPage.tsx`(당번표 인쇄), 설정 시간표 탭(시간표 인쇄) — 모두 `PrintLayout` + `usePrint()`
- [x] 세 화면에 인쇄 단추 + 인쇄 전용 표 → 커밋

### Task 14: 마무리 검증

- [x] `npm run verify` 전체 초록 확인
- [x] 버전 0.7.0으로 올림 (package.json, tauri.conf.json)
- [x] `../G-board/확인목록.md`를 새 판 기준으로 다시 작성 (사람이 확인할 것 목록)
- [x] 커밋
