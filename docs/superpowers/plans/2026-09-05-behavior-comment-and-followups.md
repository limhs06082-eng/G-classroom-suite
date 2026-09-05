# 0.16.0 — 행동특성 및 종합의견 초안·분류별 합계·자리표 모둠 색·가져오기 미리보기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생별로 쌓인 기록(관찰·칭찬·당번·과제·출결)에서 나이스 '행동특성 및 종합의견' 초안을 만들어 고치고 복사할 수 있게 하고, 0.15.0의 나머지 후보 셋을 붙여 0.16.0으로 낸다.

**Architecture:** 초안은 규칙 기반 순수 함수 `draftBehaviorComment(data, studentId, range)` — AI 없음, 시계 없음. 교사가 고친 글은 새 엔티티 `BehaviorComment {id, classId, studentId, text, updatedAt}`(학급·학생마다 하나; 학급이 곧 학기라 termId 불필요)에 저장한다 — 4관문(types·schema·invariants·classOps) + factory, 스키마 판 4. 화면은 학생 한눈에(StudentDetailPage)에 카드 하나: 글상자(blur 저장)·글자 수(500자 기준)·[초안 넣기]·[복사하기].

**Tech Stack:** React 19 · TS · vitest/Testing Library · `navigator.clipboard`.

**Spec:** 2026-09-05 요청 — "여기에서 정리한 내용이 쌓이면 학생별로 기록으로 남고, 그 결과를 '행동특성및종합의견'으로 나이스에 그대로 옮길 수 있었으면" + 0.15.0 후보(분류별 합계 열, 자리표 모둠 색, 가져오기 미리보기 '홈 배치 포함').

## Global Constraints

- 초안 문장은 나이스 문체("-함.")를 흉내 내되 관찰 기록은 교사의 글이니 손대지 않고 끝맺음만 맞춘다. 지도(음수) 기록은 초안에 넣지 않는다 — 넣을지는 교사가 정한다.
- 글자 수 기준 `NEIS_COMMENT_LIMIT = 500`. 넘어도 막지 않고 붉게 알린다.
- 클래스 범위 엔티티 4관문 + `createEmptySuiteData` + `tests/roster/classOps.test.ts`의 24개 목록.
- 복사 실패는 토스트로 알린다(MessagePage와 같은 문구).
- 판 번호 네 곳 + `docs/releases/v0.16.0.md`. 서명 빌드 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""`.

---

### Task 1: `BehaviorComment` 엔티티 + 초안 함수

**Files:** Modify `src/shared/domain/types.ts`(타입·`SuiteData.behaviorComments`·판 4), `src/shared/storage/schema.ts`(`parseBehaviorComment`, 루트), `src/shared/domain/invariants.ts`(8-5에 학생 따라 옮기기), `src/shared/roster/classOps.ts`(count·delete), `src/shared/domain/factories.ts`; Create `src/shared/roster/behaviorCommentCore.ts`. Tests: `tests/roster/behaviorCommentCore.test.ts`(new), `tests/storage/behaviorCommentSchema.test.ts`(new), `tests/roster/classOps.test.ts`(24개).

**Interfaces (Produces):**
- `NEIS_COMMENT_LIMIT = 500`
- `commentOf(comments, classId, studentId): string`
- `upsertBehaviorComment(comments, {classId, studentId, text}, now): BehaviorComment[]` — 빈 글이면 항목을 지운다.
- `draftBehaviorComment(data, studentId, range?): string` — 문장 순서: 개근(결석·지각·조퇴 0이면) → 칭찬 상위 항목(양수 기록을 reason별로 세어 상위 3개, "…등으로 칭찬받은 일이 n회임.") → 당번("당번 활동을 n회 맡아 수행함.") → 과제(total>0: "과제 t건 중 s건을 제출함." 제출률 90%↑면 "과제를 빠짐없이 성실히 제출함(s/t).") → 관찰 기록(날짜순, 끝에 마침표 보정). 아무것도 없으면 빈 문자열.

### Task 2: 학생 한눈에 카드

**Files:** Modify `src/shared/roster/StudentDetailPage.tsx`; Test `tests/roster/BehaviorCommentCard.test.tsx`(new).
- 카드 "행동특성 및 종합의견" (2열 그리드 아래, 전체 폭). 글상자(rows 6, `aria-label="{이름} 행동특성 및 종합의견"`), 글자 수 `n / 500자`(넘으면 `text-danger-700`), [초안 넣기](글이 있으면 ConfirmDialog "지금 적힌 글을 초안으로 바꿉니다"), [복사하기]. 저장은 onBlur + 단추 누를 때.
- 시험: 관찰 기록·칭찬이 있는 학생 → [초안 넣기] → 글상자에 관찰 문장이 들어가고 글자 수가 뜬다 → 글을 고치고 blur → 자료에 남는다(다시 렌더해도 같은 글). [복사하기] → `navigator.clipboard.writeText` 스텁이 그 글로 불린다.

### Task 3: 출결 학기 표 분류별 합계

**Files:** Modify `src/features/attendance/attendanceCore.ts`(`reasonCounts`), `AttendancePage.tsx`(학기 모드 칸 아래 작은 줄 "질병 1 · 기타 1"); Tests: `tests/attendance/attendanceCore.test.ts`, `MonthlyTab.test.tsx`.
- `reasonCounts(records, classId, from, to): Map<studentId, Record<AttendanceStatus, Partial<Record<AttendanceReason, number>>>>` — 분류 없는 항목은 세지 않는다(합계는 rangeCounts가 이미 센다).

### Task 4: 자리표 미리보기 모둠 색 · 가져오기 미리보기

- `SeatingPreview.tsx`: `useSuite().data.groups`에서 이 학급 모둠 → 학생→색; 칸에 `groupColorStyle(color).card`. 시험: seatingPreviewWiring에 모둠 하나 → 칸 class에 `bg-sky-50`.
- `SettingsPage.handlePickImport`: `summary`에 `isEmptyLayout(parsed.homeLayout)`이 아니면 ` · 홈 배치 포함`. 시험은 파일 선택 흐름이 무거워 생략(수동 확인목록).

### Task 5: 0.16.0 판 내기
- `docs/releases/v0.16.0.md`(1행 `행동특성 및 종합의견 초안 판`), 판 번호 네 곳, verify·check:release, 리뷰, 서명 빌드 → `../G-board/`, `확인목록.md`, push·태그.
