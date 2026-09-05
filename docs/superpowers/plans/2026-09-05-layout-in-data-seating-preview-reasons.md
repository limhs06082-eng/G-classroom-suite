# 0.15.0 — 홈 배치를 자료에, 좌석 미리보기, 출결 사유 분류 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 0.14.0의 "다음 판 후보" 중 웹 퀴즈를 뺀 세 가지를 붙여 0.15.0으로 낸다.

**Architecture:** (1) 홈 카드 배치 `HomeLayout`을 `SuiteData.homeLayout`으로 옮긴다 — 백업·다른 기기에 따라간다. 기존 localStorage 배치는 자료가 비어 있을 때 **한 번만** 들여오고 지운다(LocalStorage→저장소 1회 이전 원칙). 스키마 판 2→3. (2) 자리·모둠 카드가 2칸 이상이면 `useSeating()`으로 읽기 전용 미니 자리표를 그린다. (3) `AttendanceEntry.reason?: 'illness'|'unexcused'|'other'|'authorized'`(질병·미인정·기타·인정)를 두고, 사유 메모 줄에 네 칩, 학기 사유 열에 `3/5 결석(질병): 병원`.

**Tech Stack:** React 19 · TS · vitest/Testing Library · Tauri 2.

**Spec:** 2026-09-05 요청 "웹 퀴즈 제외하고 나머지 계획대로" — 후보: 홈 배치를 백업에, 자리·모둠 카드 넓혔을 때 좌석 미리보기, 사유 열 분류 선택지.

## Global Constraints

- 도메인 타입은 `src/shared/domain/types.ts`에만. `features/*`가 도메인을 import하지 그 반대는 없다.
- 새 루트 필드는 조용히 기본값으로 읽는다(repairs에 안 남긴다 — `tests/domain/newEntities.test.ts`가 빈 repairs를 본다).
- 스키마 판을 3으로 올린다. 2판 앱은 3판 백업에 `SCHEMA_VERSION_AHEAD` 경고.
- 알 수 없는 사유 분류는 항목을 버리지 않고 **분류만** 버린다(상태와 달리 없어도 뜻이 남는다).
- 미리보기는 `SummaryCard`(= `<Link>`) 안이라 단추가 없어야 한다.
- 판 번호 네 곳 + `docs/releases/v0.15.0.md`. 서명 빌드는 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""` 필수.

---

### Task 1: 홈 배치를 SuiteData로

**Files:** Modify `src/shared/domain/types.ts`(`HomeCardSize`·`HomeLayout`·`SuiteData.homeLayout`·`CURRENT_SCHEMA_VERSION=3`), `src/shared/storage/schema.ts`(`parseHomeLayout`), `src/shared/domain/factories.ts`, `src/features/home/homeLayout.ts`(타입 re-export, `isEmptyLayout`, `readLegacyLayout`, `clearLegacyLayout`; `loadLayout/saveLayout` 삭제), `src/features/home/HomePage.tsx`(`data.homeLayout` + `update`, 1회 이전 effect). Tests: `tests/home/homeLayout.test.ts`, `tests/storage/homeLayoutSchema.test.ts`(new), `tests/home/homeLayoutWiring.test.tsx`.

**Interfaces (Produces):** `isEmptyLayout(layout): boolean`; `readLegacyLayout(): HomeLayout | null`(localStorage `gboard:home-layout`, 비었거나 깨졌으면 null); `clearLegacyLayout(): void`.

- [ ] 시험: 스키마 왕복(`serializeSuiteData`→`parseSuiteData`)에 `homeLayout` 보존, 필드 없으면 빈 배치·repairs 없음, sizes 엉뚱한 값 버림. 배선: 끌기 뒤 DOM order로 확인(저장소 검사 대신), 레거시 localStorage가 있으면 첫 렌더 뒤 그 순서로 서고 키가 지워진다.
- [ ] 구현 → tsc·시험 → 커밋 `feat: 홈 카드 배치를 학급 자료에 — 백업과 다른 기기에 따라간다`

### Task 2: 자리·모둠 카드 좌석 미리보기

**Files:** Create `src/features/home/SeatingPreview.tsx`; Modify `HomePage.tsx`(seating 슬롯에 `sizeOf(layout,'seating') >= 2`면 렌더). Test `tests/home/seatingPreviewWiring.test.tsx`.

- `SeatingPreview`: `useSeating()` → `positions.length === 0`이면 `아직 자리를 배치하지 않았습니다` 한 줄. 아니면 `▲ 칠판 쪽` + `gridTemplateColumns: repeat(cols, minmax(0,1fr))` 격자, 칸은 `h-7 truncate text-[11px]`, 사용 안 함은 `bg-slate-200`, 빈자리는 점선. 교사 시점이면 칸 순서를 뒤집고 칠판 표시는 아래.
- [ ] 시험: 2×2 자리표에 김하나(r1c1). 기본(1칸)에서는 카드 안에 이름 없음 → [넓히기] → 이름 보임 → [좁히기] → 사라짐.
- [ ] 커밋 `feat: 자리·모둠 카드를 넓히면 자리표 미리보기`

### Task 3: 출결 사유 분류

**Files:** Modify `types.ts`(`ATTENDANCE_REASONS`, `AttendanceReason`, `AttendanceEntry.reason?`), `schema.ts`(reason 파싱), `attendanceCore.ts`(`REASON_LABELS`, `reasonOf`, `setReason`, `setStatus`가 reason 보존, `AttendanceNote.reason?`, `notesInRange`가 사유 있거나 분류 있는 항목), `AttendancePage.tsx`(사유 메모 줄에 칩 4개, 사유 열 문구). Tests: `tests/attendance/attendanceCore.test.ts`, `tests/storage/attendanceReasonSchema.test.ts`(new), `tests/attendance/ReasonChips.test.tsx`(new), `MonthlyTab.test.tsx`.

- 줄 문구: 분류·메모 둘 다 → `3/5 결석(질병): 병원`, 분류만 → `3/5 결석(질병)`, 메모만 → `3/5 결석: 병원`.
- [ ] 커밋 `feat: 출결 사유 분류 — 질병·미인정·기타·인정을 생활기록부 양식대로`

### Task 4: 0.15.0 판 내기

- [ ] `docs/releases/v0.15.0.md`(1행 `자료에 남는 홈 배치·좌석 미리보기·사유 분류 판`), 판 번호 네 곳, `npm run verify && npm run check:release`, 리뷰 에이전트, 서명 빌드 → `../G-board/`, `확인목록.md`, push·태그 `v0.15.0`, 초안 확인. Publish는 사용자.
