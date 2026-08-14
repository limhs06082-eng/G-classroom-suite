# 디자인 기본기 다듬기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 두 웹앱의 글자체·타이포·여백·표면·움직임을 일관되게 다듬어 "덜 만든 것 같다"는 인상을 없앤다.

**Architecture:** 화면을 갈아엎지 않는다. `@theme` 토큰의 **값**을 고쳐 246곳의 본문이 한 번에 좋아지게 하고, 어긋난 소수(제목 31곳·간격 15곳·높이 2곳)만 손으로 정리한다. 공통 컴포넌트에 그림자와 전환을 넣어 화면들이 저절로 따라오게 한다.

**Tech Stack:** Tailwind 4 `@theme`, Pretendard 동적 서브셋, React 19, Vite 6

**설계 문서:** [`../specs/2026-08-14-design-system-polish-design.md`](../specs/2026-08-14-design-system-polish-design.md)

## Global Constraints

- **하드코딩 색상 금지.** 반드시 `@theme` 토큰을 경유한다.
- **화면 구조를 바꾸지 않는다.** 레이아웃·기능·문구는 그대로 둔다.
- `prefers-reduced-motion`으로 끌 수 있도록 `transition`·`animation`만 쓴다. JS 애니메이션 금지.
- 새 의존성은 `pretendard` 하나뿐이다.
- 각 태스크는 해당 저장소에서 `npm run verify`를 통과해야 커밋한다.
- `G-classroom-suite`에서 만들어 확인한 뒤 `G-teacher-toolkit`으로 옮긴다.
- **범위 밖:** 테마 프리셋 · 다크모드 · 사용자 색상 지정 · 홈 레이아웃 재구성.

## File Structure

| 파일 | 이번에 맡는 일 |
|---|---|
| `src/index.css` | 폰트 로드, 크기·그림자·전환 토큰 (양쪽 저장소) |
| `src/shared/ui/Card.tsx` | 카드 그림자 |
| `src/shared/ui/Button.tsx` | 누름 반응, 전환 |
| `src/shared/ui/Modal.tsx` · `Toast.tsx` | 등장 전환, `shadow-raised` |
| `src/shared/ui/Table.tsx` | 숫자 `tabular-nums` |
| 각 화면 `.tsx` | 어긋난 제목·간격·높이만 교체 |

---

## Task 1: suite — Pretendard를 실제로 탑재

**Files:**
- Modify: `package.json`, `src/index.css`

**Interfaces:**
- Produces: 앱 전역에 Pretendard 적용. 이후 태스크는 이것을 전제한다.

- [ ] **Step 1: 설치하고 진입 경로를 확인한다**

```bash
npm install pretendard
ls node_modules/pretendard/dist/web/variable/
```

Expected: `pretendardvariable-dynamic-subset.css`가 보인다.
없으면 `ls node_modules/pretendard/dist/web/` 아래에서 `dynamic-subset`이 붙은 CSS를 찾아 그 경로를 쓴다.

- [ ] **Step 2: 최상단에서 불러온다**

`src/index.css` 첫 줄 위에 넣는다. Tailwind보다 **먼저** 와야 `@theme`의 폰트 스택이 이미 로드된 폰트를 가리킨다.

```css
/*
 * Pretendard 동적 서브셋.
 * 실제로 쓰는 글자만 내려받아 한글 UI에서 60~100KB면 된다.
 *
 * CDN을 쓰지 않는다. 학교 네트워크가 외부 CDN을 막는 일이 잦고,
 * index.html의 CSP에 외부 호스트를 열어야 한다.
 * 번들에 넣으면 오프라인에서도 뜨고 fork 직후 설정 없이 동작한다.
 */
@import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
@import 'tailwindcss';
```

- [ ] **Step 3: 실제로 로드되는지 확인한다**

```bash
npm run build
```

Then `npm run dev`, 브라우저에서:

```js
JSON.stringify({
  로드된_폰트수: document.fonts.size,
  Pretendard: document.fonts.check('16px "Pretendard Variable"'),
  굵은글씨: document.fonts.check('800 16px "Pretendard Variable"'),
})
```

Expected: `로드된_폰트수`가 0이 아니고 두 `check` 모두 `true`.
0이면 import 경로가 틀렸다. Step 1로 돌아간다.

- [ ] **Step 4: 검증**

Run: `npm run verify`
Expected: 타입 0, 테스트 320개 통과, 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add package.json package-lock.json src/index.css
git commit -m "fix(design): Pretendard를 실제로 탑재"
```

---

## Task 2: suite — 토큰 값 정리

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: Task 1의 폰트
- Produces: `--text-xs/sm/base` 재정의, `--shadow-card`, `--shadow-raised`, `--duration-fast`, `--ease-out-soft`

- [ ] **Step 1: 크기 값을 한글에 맞게 재정의한다**

`src/index.css`의 `@theme` 블록 안, `/* ── 타이포 ── */` 구역에 넣는다.

```css
  /*
   * 한글은 라틴보다 x-height가 커서 같은 px에서 더 빽빽해 보인다.
   * 본문(text-sm)이 246곳으로 이미 일관되므로 클래스를 갈아엎지 않고
   * 값만 한 단계 키운다.
   */
  --text-xs: 0.8125rem;
  --text-xs--line-height: 1.55;
  --text-sm: 0.9375rem;
  --text-sm--line-height: 1.6;
  --text-base: 1rem;
  --text-base--line-height: 1.6;
```

- [ ] **Step 2: 그림자와 전환 토큰을 더한다**

같은 `@theme` 블록의 `/* ── 모양 ── */` 구역에 넣는다.

```css
  /*
   * 그림자는 두 단계뿐이다. 교사용 도구는 수업 중에 켜 놓는 물건이라 조용해야 한다.
   * 테두리는 이미 slate-300이 84곳으로 충분히 진하다. 둘 다 올리면 과해진다.
   */
  --shadow-card: 0 1px 2px oklch(0.2 0.02 250 / 0.04), 0 1px 3px oklch(0.2 0.02 250 / 0.06);
  --shadow-raised: 0 4px 6px oklch(0.2 0.02 250 / 0.05), 0 10px 20px oklch(0.2 0.02 250 / 0.08);

  /*
   * 움직임은 짧고 한 종류만. 수업을 방해하면 안 된다.
   *
   * --ease-* 는 Tailwind가 유틸리티를 만들어 주는 이름공간이라 ease-out-soft로 쓸 수 있다.
   * --duration-* 은 그 목록에 없다. 정의해도 duration-fast 클래스는 생기지 않고
   * 조용히 아무 효과 없이 지나간다. 그래서 시간은 클래스에 직접 적는다.
   */
  --ease-out-soft: cubic-bezier(0.2, 0, 0, 1);
```

전환 시간은 **`duration-[120ms]`** 로 쓴다. Tailwind가 만들어 주지 않는 이름을 토큰처럼
적어 두면, 빌드도 타입 검사도 통과하는데 화면만 안 바뀐다.

키프레임에서 쓸 값은 `:root`에 따로 둔다(`@theme`이 아니다).

```css
:root {
  --duration-fast: 120ms;
}
```

- [ ] **Step 3: 본문 자간과 숫자 규칙을 넣는다**

`body` 규칙 아래에 추가한다.

```css
/* 한글은 라틴용 기본 자간에서 벌어져 보인다. */
body {
  letter-spacing: -0.01em;
}

/*
 * 바뀌는 숫자는 폭이 고정돼야 한다.
 * 지금은 모둠 점수가 0점 → 10점이 되면 버튼 너비가 튄다.
 */
table,
[data-numeric] {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 4: 검증**

Run: `npm run verify`
Expected: 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add src/index.css
git commit -m "feat(design): 한글 타이포·그림자·전환 토큰"
```

---

## Task 3: suite — 공통 컴포넌트 마무리

**Files:**
- Modify: `src/shared/ui/Card.tsx`, `Button.tsx`, `Modal.tsx`, `Toast.tsx`, `Tabs.tsx`

**Interfaces:**
- Consumes: Task 2의 `shadow-card` · `shadow-raised` · `duration-fast` · `ease-out-soft`
- Produces: 화면들이 저절로 따라오는 표면·반응 규칙

- [ ] **Step 1: 카드에 그림자를 넣고 안쪽 여백을 고정한다**

`src/shared/ui/Card.tsx`의 바깥 컨테이너 클래스에 `shadow-card`를 더한다.
테두리 값은 **건드리지 않는다.** 카드 본문은 이미 `p-4`로 고정돼 있으니 그대로 둔다.

`src/shared/ui/Modal.tsx`와 `src/shared/ui/EmptyState.tsx`의 안쪽 여백도 `p-4`로 맞춘다.
화면이 개별로 덮어쓰지 못하게, 이 값을 props로 열지 않는다.

지금 화면들이 모달·빈 상태 바깥에서 여백을 또 주고 있으면 그 바깥 여백을 뺀다.

```bash
grep -rn "EmptyState\|<Modal" src --include=*.tsx | head -20
```

- [ ] **Step 2: 버튼에 누름 반응을 넣는다**

`src/shared/ui/Button.tsx`의 공통 클래스 문자열에 더한다.

```
transition-[background-color,box-shadow,transform] duration-[120ms] ease-out-soft
active:scale-[0.98]
```

`h-12`를 쓰는 곳이 있으면 `h-11`로 바꾼다. 높이는 `h-10`(기본)과 `h-11`(터치·칠판) 둘만 남긴다.

- [ ] **Step 3: 모달과 토스트에 등장 전환을 넣는다**

두 파일에서 `shadow-lg`·`shadow-xl`을 `shadow-raised`로 바꾸고,
패널에 짧은 페이드 + 4px 올라오기를 넣는다.

`src/index.css`에 키프레임을 추가한다.

```css
@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.animate-rise-in {
  animation: rise-in var(--duration-fast) var(--ease-out-soft);
}
```

모달 패널과 토스트 항목에 `animate-rise-in`을 붙인다.
`prefers-reduced-motion` 규칙이 이미 `animation-duration`을 0으로 만들므로 따로 처리하지 않는다.

- [ ] **Step 4: 탭 밑줄에 전환을 넣는다**

`src/shared/ui/Tabs.tsx`의 탭 버튼에 `transition-colors duration-[120ms] ease-out-soft`를 더한다.

- [ ] **Step 5: 검증**

Run: `npm run verify`
Expected: 전부 통과

컴포넌트 테스트가 클래스 문자열을 보고 있으면 그 테스트를 고치지 말고
**왜 보고 있는지** 먼저 확인한다. 대개는 `toHaveClass`가 아니라 역할·문구로 찾고 있을 것이다.

- [ ] **Step 6: 커밋**

```bash
git add src/shared/ui src/index.css
git commit -m "feat(design): 공통 컴포넌트에 표면과 반응 규칙"
```

---

## Task 4: suite — 어긋난 값만 정리

**Files:**
- Modify: 아래 검색으로 나오는 화면 파일들

**Interfaces:**
- Consumes: Task 2·3
- Produces: 없음 (정리만)

- [ ] **Step 1: 제목 크기를 두 가지로 모은다**

```bash
grep -rn "text-lg\|text-xl\|text-2xl\|text-3xl" src --include=*.tsx
```

규칙에 맞춘다.

| 쓰임 | 클래스 |
|---|---|
| 화면 제목 (페이지마다 하나) | `text-xl font-bold` |
| 카드·구역 제목 | `text-base font-semibold` |
| 수치를 크게 보이는 자리 (홈 요약 숫자 등) | `text-2xl` 유지 |

카드 제목은 본문(15px)과 1px 차이라 **위계를 크기가 아니라 굵기로 만든다.**
빽빽한 업무 화면에서 제목마다 크기를 키우면 화면이 시끄러워진다.

`board-*` 스케일(전자칠판)은 **손대지 않는다.** 다른 축이다.

- [ ] **Step 2: 어긋난 간격 15곳을 정리한다**

```bash
grep -rn "gap-5\|gap-6\|gap-8\|gap-0\b" src --include=*.tsx
```

`gap-5`·`gap-6`·`gap-8` → `gap-4`, `gap-0` → 뺀다.
`gap-1`(61곳)은 뱃지·아이콘처럼 한 덩어리 안에서 쓰는 정당한 값이므로 **남긴다.**

- [ ] **Step 3: 남은 그림자를 토큰으로 옮긴다**

```bash
grep -rn "shadow-sm\|shadow-lg\|shadow-xl" src --include=*.tsx
```

`shadow-sm` → `shadow-card`, `shadow-lg`·`shadow-xl` → `shadow-raised`.

- [ ] **Step 4: 바뀌는 숫자에 표시를 단다**

점수·개수처럼 값이 바뀌면서 폭이 흔들리는 자리에 `data-numeric`을 단다.
Task 2 Step 3의 CSS가 그것을 잡는다.

최소한 다음은 확인한다: 홈 요약 카드의 수치, 활동·보상 점수, 과제 제출 수.

- [ ] **Step 5: 남은 것이 의도한 자리뿐인지 확인한다**

```bash
grep -rn "text-3xl\|h-12\|shadow-sm\|shadow-lg\|shadow-xl\|gap-5\|gap-6\|gap-8" src --include=*.tsx
```

Expected: 결과가 없거나, 남은 것마다 왜 남았는지 설명할 수 있다.

- [ ] **Step 6: 검증**

Run: `npm run verify`
Expected: 전부 통과

- [ ] **Step 7: 커밋**

```bash
git add src
git commit -m "refactor(design): 어긋난 제목·간격·그림자 정리"
```

---

## Task 5: 임한솔 확인 — suite

**이 태스크는 코드를 바꾸지 않는다.** 넘어가지 말고 반드시 멈춘다.

- [ ] **Step 1: 개발 서버를 띄우고 확인을 요청한다**

```bash
npm run dev
```

임한솔에게 다음을 봐 달라고 요청한다.

- 글씨가 Pretendard로 바뀌었는가
- 카드가 배경에서 떠 보이는가 (과하지 않은가)
- 버튼을 누를 때 반응이 있는가
- 모달·알림이 튀어나오지 않고 부드럽게 뜨는가
- 어색하거나 과한 곳이 있는가

**이 환경에서는 스크린샷이 찍히지 않는다.** "실제로 나아 보이는가"는 대신 확인할 수 없다.

- [ ] **Step 2: 받은 지적을 고친다**

지적이 있으면 고치고 `npm run verify` 후 커밋한다.
지적이 없으면 다음 태스크로 넘어간다.

**여기서 확정된 모양이 toolkit으로 옮겨간다.** 확인 없이 옮기면 잘못된 것을 두 번 만든다.

---

## Task 6: toolkit — 이식과 색 토큰 이름 정정

**저장소를 `G-teacher-toolkit`으로 옮겨 진행한다.**

**Files:**
- Modify: `package.json`, `src/index.css`, `src/shared/ui/*`, `src/app/navigation.ts`, 화면 `.tsx`

**Interfaces:**
- Consumes: Task 1~4에서 확정된 토큰과 컴포넌트 규칙

- [ ] **Step 1: 폰트와 토큰을 옮긴다**

```bash
npm install pretendard
```

`src/index.css`에 Task 1 Step 2의 `@import` 두 줄, Task 2의 토큰 세 묶음,
Task 3 Step 3의 `rise-in` 키프레임을 그대로 넣는다.

`shared/ui`는 복사본이므로 suite의 `Card.tsx`·`Button.tsx`·`Modal.tsx`·`Toast.tsx`·`Tabs.tsx`
변경을 같은 방식으로 반영한다. **파일을 통째로 덮어쓰지 않는다** — toolkit에는
`BoardScreen.tsx`처럼 다른 파일이 있고, 공통 파일도 소소한 차이가 있을 수 있다.

- [ ] **Step 2: 기능색 토큰 이름을 바로잡는다**

toolkit의 `navigation.ts`가 수업 진행에 `seating` 색, 형성평가에 `duty` 색,
업무에 `assignment` 색, 문구에 `reward` 색을 쓴다.
1단계 저장소에서 복사하며 토큰 이름만 남은 것이다.

바꾸기 **전에** 개수를 센다.

```bash
grep -rho "\(seating\|duty\|reward\|assignment\)-[0-9]*" src | sort | uniq -c
```

`src/index.css`의 토큰 이름과 `src/app/navigation.ts`의 클래스를 함께 바꾼다.
색 값(oklch)은 **그대로 둔다.** 화면은 바뀌지 않고 이름만 맞아진다.

| 지금 | 바꿀 이름 |
|---|---|
| `seating` | `lesson` |
| `duty` | `quiz` |
| `assignment` | `task` |
| `reward` | `message` |

바꾼 뒤 같은 개수가 나오는지 확인한다.

```bash
grep -rho "\(lesson\|quiz\|task\|message\)-[0-9]*" src | sort | uniq -c
grep -rn "seating\|duty\|reward\|assignment" src
```

Expected: 첫 명령의 합이 바꾸기 전과 같고, 둘째 명령의 결과가 없다.

- [ ] **Step 3: 어긋난 값을 정리한다**

Task 4의 다섯 단계를 toolkit에서 같은 방식으로 한다.
`board-*` 스케일은 손대지 않는다.

- [ ] **Step 4: 폰트가 로드되는지 확인한다**

`npm run dev` 후 브라우저에서:

```js
JSON.stringify({ 폰트수: document.fonts.size, Pretendard: document.fonts.check('16px "Pretendard Variable"') })
```

Expected: 폰트 수가 0이 아니고 `Pretendard`가 `true`.

- [ ] **Step 5: 검증**

Run: `npm run verify`
Expected: 타입 0, 테스트 185개 통과, 빌드 성공

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat(design): 디자인 기본기 이식과 기능색 이름 정정"
```

---

## Task 7: 임한솔 확인 — toolkit

**이 태스크는 코드를 바꾸지 않는다.**

- [ ] **Step 1: 확인을 요청한다**

`npm run dev` 후 다음을 봐 달라고 요청한다.

- suite와 같은 느낌인가 (두 앱이 한 벌로 보이는가)
- 전자칠판(`/board/quiz`)이 여전히 뒷자리에서 읽힐 크기인가
- 학생 화면(`/join/:code`)이 폰 화면에서 어색하지 않은가

- [ ] **Step 2: 받은 지적을 고치고 두 저장소를 push한다**

---

## 완료 확인

- [ ] 두 저장소 각각 `npm run verify` 통과
- [ ] 두 저장소 각각 `document.fonts.size !== 0`
- [ ] `grep`으로 남은 어긋난 값이 없음
- [ ] 임한솔이 두 앱을 직접 보고 확인
- [ ] push
