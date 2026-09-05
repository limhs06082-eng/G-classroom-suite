# 0.17.0 — 학급 전체 행동특성 및 종합의견 + 개인 API 키로 AI 작성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학급 전체 학생의 행동특성 및 종합의견을 한 화면에서 쓰고, 교사 개인의 Gemini/OpenAI/Anthropic API 키로 AI가 초안을 써 주게 한다.

**Architecture:** (1) `src/shared/ai/` — 설정(`aiSettings.ts`: 기기 localStorage에만, 백업 제외), 순수 함수(`commentPrompt.ts`: 익명화된 사실 → 프롬프트; `providers.ts`: 회사별 요청 모양·응답 파싱), 전송(`transport.ts`: 설치형은 `@tauri-apps/plugin-http`를 동적 import, 웹은 `fetch`). (2) `src/shared/roster/CommentsPage.tsx` 라우트 `/roster/comments` — 학생별 글상자·글자 수·[초안]·[AI]·[복사], [모두 초안]·[AI로 모두 작성](빈 학생만, 차례로, 진행 표시·중단), AI 설정 카드. (3) 설치형 허용 주소 셋 추가(capabilities + check:release). 학생 **이름은 보내지 않는다.**

**Tech Stack:** React 19 · TS · vitest(모듈 mock) · Tauri http plugin.

**Spec:** 2026-09-05 요청 1번. 2번(연수 시연 개선안)은 구현 뒤 별도 제안.

## Global Constraints

- 프롬프트에 학생 이름·번호를 넣지 않는다. 관찰 기록 원문과 숫자 요약만. 화면에 이 사실과 "키는 이 컴퓨터에만"을 적는다.
- API 키·모델·회사는 `classroom-suite:v1:ai-config`(localStorage). SuiteData·백업에 절대 안 들어간다.
- 설치형: `capabilities/default.json`에 `https://generativelanguage.googleapis.com/*`, `https://api.openai.com/*`, `https://api.anthropic.com/*` 추가, `check-release.mjs` EXPECTED_HOSTS 동일하게. CSP는 그대로(플러그인은 IPC).
- `@tauri-apps/plugin-http`는 동적 import만(웹 번들 순수성).
- 규칙 초안의 원칙(지도 기록 제외, 500자 기준)은 AI 프롬프트에도 그대로.
- 기본 모델: gemini `gemini-2.5-flash`, openai `gpt-4o-mini`, anthropic `claude-sonnet-5`. 모델명은 설정에서 고칠 수 있고 [연결 확인]으로 바로 검사한다.

---

### Task 1: AI 모듈 (설정·프롬프트·회사별 요청·전송)

**Files:** Create `src/shared/ai/aiSettings.ts`, `src/shared/ai/commentPrompt.ts`, `src/shared/ai/providers.ts`, `src/shared/ai/transport.ts`, `src/shared/ai/writeComment.ts`. Tests: `tests/ai/commentPrompt.test.ts`, `tests/ai/providers.test.ts`, `tests/ai/aiSettings.test.ts`.

**Interfaces (Produces):**
- `type AiProvider = 'gemini' | 'openai' | 'anthropic'`; `AI_PROVIDERS: {id, label, defaultModel, keyHint}[]`
- `AiConfig { provider; apiKey; model }`; `readAiConfig(): AiConfig | null`(키 없으면 null); `saveAiConfig(config)`; `clearAiConfig()`
- `CommentFacts { attendance: 'perfect'|'absent'|'unknown'; absentDays; lateDays; praise: {reason, count}[]; dutyCount; assignments: {total, submitted}; observations: {date, text}[] }`; `collectCommentFacts(data, studentId, range?): CommentFacts` (behaviorCommentCore의 규칙 재사용, 이름 없음)
- `buildCommentPrompt(facts): { system: string; user: string }`
- `requestFor(provider, config, prompt): { url; headers; body }`; `textFrom(provider, json): string | null`
- `postJson(url, headers, body): Promise<{ status: number; json: unknown }>`
- `writeCommentWithAi(facts, config): Promise<{ ok: true; text: string } | { ok: false; error: string }>` — 응답을 trim, 따옴표·머리말 제거, 500자 넘으면 그대로 두고 화면이 알린다.

### Task 2: 학급 전체 화면

**Files:** Create `src/shared/roster/CommentsPage.tsx`; Modify `src/app/router.tsx`(`roster/comments`), `src/shared/roster/RosterPage.tsx`(머리에 [행동특성 한 번에] 링크), `src/shared/roster/BehaviorCommentCard.tsx`([AI로 작성] 단추, 키 있을 때만). Test `tests/roster/CommentsPage.test.tsx`(transport mock).

### Task 3: 설치형 허용 주소 + 0.17.0 판

- capabilities·check-release EXPECTED_HOSTS, `docs/releases/v0.17.0.md`, 판 번호, verify·리뷰·빌드·태그.
