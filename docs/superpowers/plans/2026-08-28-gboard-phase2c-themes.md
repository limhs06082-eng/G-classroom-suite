# 테마 넷 구현 계획 (2-다)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교실 상황에 맞춰 고르는 테마 넷(밝게·포근하게·어둡게·또렷하게)을 넣는다. 화면 코드의 색은 거의 손대지 않는다.

**Architecture:** Tailwind 4가 색을 값이 아니라 `var(--color-*)`로 내보낸다는 것을 확인했다. 그래서 테마 하나가 CSS 한 덩어리로 끝난다. 다만 **한 변수가 서로 반대인 두 뜻으로 쓰이는 자리 둘**을 먼저 갈라야 한다(아래). 고른 테마는 그 컴퓨터의 취향이지 학급 자료가 아니므로 `SuiteData`에 넣지 않는다.

**Tech Stack:** Tailwind 4 (`@theme`) · React 19 · TypeScript 5.8 (`strict`, `noUncheckedIndexedAccess`) · Vitest

## Global Constraints

- **`isDesktop()` 분기를 두지 않는다.** 테마는 바깥 통신이 없어 웹에서도 설치형에서도 똑같이 돈다.
- **기능 코드는 `localStorage`를 직접 부르지 않는다** — 단, 테마는 예외다. Task 4가 그 이유와 유일한 예외 지점을 정한다.
- **고른 테마는 백업 파일에 안 들어간다.** 학급 자료가 아니라 그 컴퓨터의 취향이다.
- 주석은 한국어로, **무엇이 아니라 왜**를 적는다.
- TypeScript `strict` + `noUncheckedIndexedAccess`. `any` 금지.
- **`npm run lint`는 `tests/`도 검사한다** (`noUnusedParameters: true`).
- 각 과제는 `npm run verify`가 exit 0이어야 커밋한다.

## 먼저 확인해 둔 사실

빌드된 CSS에서 직접 확인했다.

```css
.text-slate-500 { color: var(--color-slate-500) }
.bg-white       { background-color: var(--color-white) }
--color-slate-500: oklch(55.4% .046 257.417)   /* :root에 선언되어 있다 */
```

쓰이는 자리를 센 결과다.

| | 개수 | |
|---|---|---|
| `text-slate-*` 전체 | 542 | 변수만 덮으면 된다 |
| `bg-white` | 43 | **갈라야 한다** — 아래 |
| `text-white` | 31 | 색깔 단추 위 글자. 흰색이어야 한다 |
| `bg-slate-700/800/900` | 10 | **갈라야 한다** — 일부러 어두운 면 |
| `text-slate-50/100/200` | 0 | 밝은 끝을 글자로 쓰는 곳은 없다 |

## 갈라야 하는 두 자리

**1. `--color-white`가 표면과 글자 두 뜻으로 쓰인다.**
어두운 테마에서 이 변수를 남색으로 덮으면 `bg-brand-600 text-white` 단추의 글자까지 남색이 된다. `--color-surface`를 새로 두고 `bg-white` 43곳을 옮긴다.

**2. `--color-slate-900`이 본문 글자와 어두운 면 두 뜻으로 쓰인다.**
중립 눈금을 뒤집어야 어두운 테마에서 글자가 읽히는데, 뒤집으면 전자칠판·잠금화면이 하얘진다. 그 여섯 뿌리에 `.ink` 한 자리를 붙여 **그 안에서만 어두운 팔레트를 고정**한다.

---

## File Structure

| 파일 | 맡는 일 |
|---|---|
| `src/index.css` | `--color-surface`, `.ink`, 테마 넷의 변수 덮어쓰기 |
| `src/features/**/*.tsx` (30개) | `bg-white` → `bg-surface` (기계적) |
| `src/shared/theme/themes.ts` | 테마 목록과 이름. 순수 자료 |
| `src/shared/theme/useTheme.ts` | 고른 테마를 읽고 쓰고 `<html>`에 붙인다 |
| `src/features/settings/ThemeTab.tsx` | 고르는 화면 |
| `scripts/check-theme-tokens.mjs` | 네 테마가 같은 변수 집합을 덮는지 검사 |

---

### Task 1: 표면색을 흰색에서 떼어 낸다

**Files:**
- Modify: `src/index.css`
- Modify: `bg-white`를 쓰는 `.tsx` 30개
- Test: `tests/theme/surfaceToken.test.ts`

- [ ] **Step 1: 토큰을 더한다**

`index.css`의 `@theme` 안, `--color-brand-*` 위에 넣는다.

```css
  /*
   * 표면색.
   *
   * `bg-white`가 아니라 이것을 쓴다. `--color-white`는 색깔 단추 위의
   * 글자(`text-white`, 31곳)가 함께 쓰고 있어서, 어두운 테마에서 그
   * 변수를 남색으로 덮으면 읽을 수 없는 단추가 서른한 개 생긴다.
   * 표면과 글자는 어두운 테마에서 정반대로 가야 하므로 이름을 가른다.
   */
  --color-surface: oklch(1 0 0);
```

- [ ] **Step 2: `bg-white`를 옮긴다**

`src/` 아래 `.tsx`에서 `bg-white`를 `bg-surface`로 바꾼다. **`src/shared/lock/LockScreen.tsx`의 `'border-white bg-white'`는 빼라** — 어두운 잠금화면 위의 PIN 점이라 어느 테마에서나 흰색이어야 한다.

```bash
grep -rln '\bbg-white\b' src --include=*.tsx
```

옮긴 뒤 남은 `bg-white`가 그 한 곳뿐인지 확인한다.

- [ ] **Step 3: 시험을 쓴다**

`tests/theme/surfaceToken.test.ts`

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/*
 * 이 시험은 화면이 아니라 **소스 글자**를 본다.
 *
 * 새로 짜는 사람이 무심코 `bg-white`를 쓰면 그 카드만 어두운 테마에서
 * 하얗게 남는다. 화면 시험으로는 못 잡는다 — 색이 CSS 변수라 jsdom에서는
 * 계산된 값이 안 나오고, 눈으로 보기 전에는 아무도 모른다.
 */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return name.endsWith('.tsx') ? [full] : [];
  });
}

describe('표면색', () => {
  it('bg-white는 잠금화면의 PIN 점 하나뿐이다', () => {
    const offenders = tsxFiles('src').filter((file) => {
      if (file.includes('LockScreen')) return false;
      return /\bbg-white\b/.test(readFileSync(file, 'utf8'));
    });

    /*
     * 잠금화면의 점은 어두운 화면 위에 있어 어느 테마에서나 흰색이어야 한다.
     * 나머지는 전부 표면이라 테마를 따라가야 한다.
     */
    expect(offenders).toEqual([]);
  });

  it('surface 토큰이 선언되어 있다', () => {
    expect(readFileSync('src/index.css', 'utf8')).toContain('--color-surface:');
  });
});
```

- [ ] **Step 4: 돌린다**

`npx vitest run tests/theme/surfaceToken.test.ts` → 통과.
`npm run verify` → exit 0. **웹 화면이 바뀌면 안 된다** — `--color-surface`가 지금은 흰색이라 보이는 것은 그대로다.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "refactor: 표면색을 흰색 토큰에서 떼어 낸다"
```

---

### Task 2: 어두운 섬을 가둔다

**Files:**
- Modify: `src/index.css`
- Modify: `LessonBoard.tsx`, `QuizBoard.tsx`, `ClassroomGrid.tsx`, `ToolsBar.tsx`, `LockScreen.tsx`, `Modal.tsx`
- Test: `tests/theme/inkScope.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `.ink` 클래스

- [ ] **Step 1: `.ink`를 만든다**

`index.css`의 `@theme` **바깥**(유틸리티 자리)에 둔다.

```css
/*
 * 어느 테마에서나 어두워야 하는 섬.
 *
 * 전자칠판, 잠금화면, 화면 커튼, 모달 뒤배경. 이것들은 '중립 눈금의
 * 어두운 끝'이 아니라 **일부러 어두운 면**이다. 어두운 테마가 눈금을
 * 뒤집으면 이 섬들이 하얘지는데, 교실 앞 대형 화면이 하얘지는 것은
 * 테마를 고른 대가로 치를 일이 아니다.
 *
 * 안에 든 색을 하나씩 고치지 않는다. 뿌리에서 팔레트를 고정하면
 * `bg-slate-900`도 `text-slate-300`도 뜻 그대로 돈다.
 */
.ink {
  --color-surface: oklch(0.22 0.03 260);
  --color-slate-50: oklch(0.18 0.03 260);
  --color-slate-100: oklch(0.24 0.03 260);
  --color-slate-200: oklch(0.3 0.03 260);
  --color-slate-300: oklch(0.42 0.03 260);
  --color-slate-400: oklch(0.55 0.03 258);
  --color-slate-500: oklch(0.68 0.025 258);
  --color-slate-600: oklch(0.78 0.02 256);
  --color-slate-700: oklch(0.86 0.015 256);
  --color-slate-800: oklch(0.92 0.01 256);
  --color-slate-900: oklch(0.97 0.005 256);
}
```

> **뒤집힌 눈금이다.** 50이 가장 어둡고 900이 가장 밝다. 이름과 뜻이 어긋나지만, 이 안에서 `text-slate-900`은 '가장 진한 글자'라는 뜻으로 계속 옳게 돈다.

- [ ] **Step 2: 여섯 뿌리에 붙인다**

각 파일에서 `bg-slate-900`/`bg-slate-800`을 쓰는 **가장 바깥 요소**에 `ink` 클래스를 더한다. 안쪽 색은 **하나도 안 고친다.**

붙일 자리를 찾는 법:

```bash
grep -rn 'bg-slate-\(700\|800\|900\)' src --include=*.tsx
```

각 자리에서 그 요소가 섬의 뿌리인지(그 안에 다른 색들이 들어 있는지) 보고 판단해라. `Modal.tsx`의 뒤배경처럼 그 자체가 한 겹인 것은 붙일 필요가 없을 수도 있다 — **판단해서 보고서에 적어라.**

- [ ] **Step 3: 시험을 쓴다**

`tests/theme/inkScope.test.ts` — 소스를 읽어, 어두운 배경을 쓰는 파일이 전부 `ink`를 갖고 있는지 본다. Task 1의 `tsxFiles` 도우미를 옮겨 쓰거나 같은 꼴로 다시 쓴다.

```ts
it('어두운 배경을 쓰는 화면은 ink 안에 있다', () => {
  const dark = tsxFiles('src').filter((file) =>
    /\bbg-slate-(700|800|900)\b/.test(readFileSync(file, 'utf8')),
  );

  for (const file of dark) {
    const source = readFileSync(file, 'utf8');
    /*
     * ink 없이 어두운 배경만 쓰면, 어두운 테마에서 눈금이 뒤집혀
     * 그 면이 하얘진다. 교실 앞 대형 화면이라 눈에 띄게 망가진다.
     */
    expect(source, file).toMatch(/\bink\b/);
  }
});
```

- [ ] **Step 4: 돌린다** — `npm run verify` exit 0. 화면은 아직 안 바뀐다.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "refactor: 어느 테마에서나 어두워야 할 섬을 가둔다"
```

---

### Task 3: 테마 넷

**Files:**
- Modify: `src/index.css`
- Create: `src/shared/theme/themes.ts`
- Create: `scripts/check-theme-tokens.mjs`
- Modify: `package.json` (`verify`에 검사 추가)
- Test: `tests/theme/themes.test.ts`

**Interfaces:**
- Produces: `THEMES`, `ThemeId`, `DEFAULT_THEME`

- [ ] **Step 1: 목록을 만든다**

`src/shared/theme/themes.ts`

```ts
export type ThemeId = 'light' | 'warm' | 'dark' | 'contrast';

export interface Theme {
  id: ThemeId;
  /** 고를 때 보이는 이름 */
  name: string;
  /** 언제 쓰는 것인지 한 줄로 */
  when: string;
}

/**
 * 테마 넷.
 *
 * 스무 가지를 취향으로 늘어놓지 않는다. **상황으로 넷**이다 — 교실
 * 컴퓨터는 하루에도 조명이 바뀌고, 같은 화면이 프로젝터로도 나간다.
 * 고르는 가짓수가 많아지면 고르는 일 자체가 일이 된다.
 */
export const THEMES: readonly Theme[] = [
  { id: 'light', name: '밝게', when: '교실 불을 켜 둔 보통 때' },
  { id: 'warm', name: '포근하게', when: '종일 켜 두는 화면. 눈이 덜 시립니다' },
  { id: 'dark', name: '어둡게', when: '불 끄고 영상 볼 때, 이른 아침' },
  { id: 'contrast', name: '또렷하게', when: '프로젝터·전자칠판. 대비를 최대로' },
] as const;

export const DEFAULT_THEME: ThemeId = 'light';

/** 모르는 값이 오면 기본으로. 저장된 글자는 밖에서 온 값이다. */
export function asThemeId(value: string | null): ThemeId {
  return THEMES.some((theme) => theme.id === value) ? (value as ThemeId) : DEFAULT_THEME;
}
```

- [ ] **Step 2: CSS를 쓴다**

`index.css`의 `.ink` 아래에 넷을 둔다. `light`는 `:root`의 기본값이 그대로이므로 **블록을 안 만든다** — 만들면 기본값과 두 벌이 되어 갈라진다.

각 블록이 덮어야 하는 것:

```
--color-surface
--color-slate-50 ~ --color-slate-900   (열 단계 전부)
--color-subject-1 ~ --color-subject-12 (과목 색. 명도만)
--color-brand-50, --color-brand-600, --color-brand-700
--color-duty-50, --color-reward-50, --color-seating-50,
--color-assignment-50, --color-task-50, --color-lesson-50,
--color-message-50, --color-quiz-50
--color-danger-50, --color-success-50, --color-warning-50, --color-info-50
```

> **색상각(hue)은 고정이다.** 당번은 어느 테마에서나 초록, 자리는 파랑이다. 선생님이 색으로 기능을 익힌 뒤에 테마를 바꿨다고 그 익힘이 무너지면 안 된다. 바꾸는 것은 **명도와 채도**뿐이다.

`포근하게`는 바탕을 크림빛으로(`oklch(0.98 0.012 85)` 근처), 중립을 살짝 따뜻하게. 눈금 방향은 안 뒤집는다.

`어둡게`는 중립을 뒤집는다(50이 가장 어둡고 900이 가장 밝다). `.ink`와 같은 꼴이다. 기능 색 `-50`은 밝은 카드가 되지 않도록 명도를 0.25 근처로 낮춘다.

`또렷하게`는 흰 바탕에 글자를 최대로 진하게. 중간 눈금(400~600)을 평소보다 어둡게 당겨 흐린 글자를 없앤다. 과목 색은 **채도를 올린다**(0.035 → 0.06) — 프로젝터에서 0.035는 전부 흰색으로 보인다.

- [ ] **Step 3: 검사기를 만든다**

`scripts/check-theme-tokens.mjs`

네 테마가 **같은 변수 집합**을 덮는지 본다. 하나가 `--color-slate-400`을 빠뜨리면 그 테마에서만 그 눈금이 기본값으로 남는데, 색 하나가 어긋나는 것이라 눈으로는 못 찾는다.

```js
// 요지: index.css를 읽어 :root[data-theme='...'] 블록마다 --color-* 이름을
// 모으고, 세 집합이 서로 같은지 본다. 다르면 어느 테마에 무엇이 빠졌는지
// 이름을 찍고 exit 1.
```

`package.json`의 `verify`에 `node scripts/check-theme-tokens.mjs`를 더한다. **`lint` 다음, `test` 앞**에 둔다 — 값싼 검사가 먼저다.

- [ ] **Step 4: 시험을 쓴다**

`tests/theme/themes.test.ts`

```ts
describe('테마 목록', () => {
  it('넷이다', () => {
    // 스무 가지로 늘어나기 시작하면 고르는 일 자체가 일이 된다.
    expect(THEMES).toHaveLength(4);
  });

  it('모르는 값은 기본으로 돌린다', () => {
    expect(asThemeId('없는테마')).toBe(DEFAULT_THEME);
    expect(asThemeId(null)).toBe(DEFAULT_THEME);
  });

  it('아는 값은 그대로 둔다', () => {
    expect(asThemeId('dark')).toBe('dark');
  });

  it('CSS에 셋의 블록이 있다', () => {
    // light는 :root의 기본값이라 블록이 없다. 만들면 두 벌이 되어 갈라진다.
    const css = readFileSync('src/index.css', 'utf8');
    for (const id of ['warm', 'dark', 'contrast']) {
      expect(css, id).toContain(`[data-theme='${id}']`);
    }
    expect(css).not.toContain(`[data-theme='light']`);
  });
});
```

- [ ] **Step 5: 돌린다** — `npm run verify` exit 0. 검사기도 통과해야 한다.

- [ ] **Step 6: 커밋**

```bash
git add -A && git commit -m "feat: 테마 넷의 색을 정한다"
```

---

### Task 4: 고른 테마를 기억한다

**Files:**
- Create: `src/shared/theme/useTheme.ts`
- Modify: `src/app/AppShell.tsx` (또는 `main.tsx` — 판단해서 보고서에)
- Test: `tests/theme/useTheme.test.tsx`

**Interfaces:**
- Consumes: `ThemeId`, `asThemeId` (Task 3)
- Produces: `useTheme(): { theme: ThemeId; setTheme(id: ThemeId): void }`

- [ ] **Step 1: 어디에 담을지**

**`SuiteData`에 안 넣는다.** 고른 테마는 그 컴퓨터의 취향이지 학급 자료가 아니다. 백업 파일에 들어가면, 교실 컴퓨터에서 만든 백업을 집 노트북에 복원했을 때 화면이 통째로 바뀐다.

`localStorage`에 담는다. **이 저장소에서 기능 코드가 `localStorage`를 직접 부르는 유일한 예외**이므로, 그 까닭을 파일 머리말에 적어라.

키: `gboard:theme`

- [ ] **Step 2: 갈고리를 쓴다**

```ts
const STORAGE_KEY = 'gboard:theme';

/**
 * 고른 테마.
 *
 * **`SuiteData`에 안 담는다.** 테마는 그 컴퓨터의 취향이지 학급 자료가
 * 아니다. 백업에 들어가면 교실 컴퓨터에서 만든 백업을 집 노트북에
 * 복원했을 때 화면이 통째로 바뀐다 — 자기가 안 건드린 것이 바뀌는 셈이다.
 *
 * 그래서 이 저장소에서 기능 코드가 `localStorage`를 직접 부르는 **유일한
 * 예외**다. 학급 자료는 어댑터를 거치는 규칙이 그대로 살아 있고, 이것만
 * 학급 자료가 아니라서 빠진다.
 *
 * 읽기가 실패할 수 있다(사생활 보호 창, 저장소 꺼짐). 그때는 기본 테마로
 * 돈다 — 테마를 못 읽었다고 앱이 안 뜨면 안 된다.
 */
export function useTheme(): { theme: ThemeId; setTheme: (id: ThemeId) => void }
```

`<html>`의 `data-theme`을 붙이는 것은 `useEffect`에서 한다. `light`일 때는 **속성을 지운다** — `:root`의 기본값이 곧 밝은 테마이고, 속성이 붙어 있으면 CSS에서 두 벌을 관리하게 된다.

- [ ] **Step 3: 시험을 쓴다**

담을 것:
- 저장된 값이 없으면 기본 테마
- 저장된 값이 있으면 그것
- **저장된 값이 모르는 글자면 기본 테마** (밖에서 온 값이다)
- `setTheme`이 `<html>`에 `data-theme`을 붙인다
- `light`로 되돌리면 속성이 **사라진다**
- `localStorage`가 던져도 앱이 안 죽는다 (`getItem`이 던지게 만들어 확인)

- [ ] **Step 4: 붙인다**

앱이 뜨는 자리에서 한 번 부른다. 어디가 맞는지(`main.tsx` vs `AppShell`) 판단해서 보고서에 적어라. **전자칠판 창(`/board/*`)도 테마를 따라야 한다** — 그게 `또렷하게`의 존재 이유다.

- [ ] **Step 5: 돌린다** — `npm run verify` exit 0

- [ ] **Step 6: 커밋**

```bash
git add -A && git commit -m "feat: 고른 테마를 이 컴퓨터에 기억한다"
```

---

### Task 5: 고르는 화면

**Files:**
- Create: `src/features/settings/ThemeTab.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`
- Test: `tests/settings/ThemeTab.test.tsx`

- [ ] **Step 1: 화면**

설정에 **'화면' 탭**을 새로 만든다. 시간표 탭에 얹지 않는다 — 시간표와 아무 상관이 없고, 이 탭은 나중에 글자 크기 같은 것이 붙을 자리다.

네 개를 나란히 두고, 각각 **이름 + 언제 쓰는지 한 줄 + 미리보기**를 보인다. 미리보기는 그 테마의 변수를 그 조각에만 걸어(`data-theme` 속성을 그 요소에 붙인다) 실제 색으로 보여 준다. 고르기 전에 보이는 것이 이 화면의 값어치다.

지금 고른 것에 `aria-pressed`를 준다.

- [ ] **Step 2: 시험**

- 넷이 다 보인다
- 누르면 `<html>`의 `data-theme`이 바뀐다
- 지금 고른 것이 눌린 상태로 보인다
- **미리보기가 제 테마 색을 쓴다** (`data-theme` 속성이 그 조각에 붙어 있는지)

- [ ] **Step 3: 설정 화면에 붙인다**

`SettingsPage`의 탭 목록과 그리는 곳 **둘 다** 고쳐야 한다. 이 저장소에서 세 번 겪은 함정이다 — 목록에만 더하면 눌러도 빈 화면이고, 그리는 줄만 더하면 누를 데가 없다. **탭을 눌러 화면이 나오는지 보는 시험**을 반드시 넣어라.

`?tab=theme`으로 바로 열리는 것도 확인한다.

- [ ] **Step 4: 돌린다** — `npm run verify` exit 0

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: 테마를 고르는 화면"
```

---

## Self-Review

**1. 설계 덮기**
- 테마 넷, 상황으로 나눔 → Task 3 ✓
- 기능 색은 색상각 고정, 명도만 → Task 3 Step 2 ✓
- 테마는 자료가 아니다(백업에 안 들어감) → Task 4 ✓
- 또렷하게가 전자칠판용 → Task 3 + Task 4 Step 4 ✓
- 화면 코드를 거의 안 건드림 → Task 1(43곳) + Task 2(6곳)뿐 ✓

**2. 빈칸 없음** — Task 3 Step 2와 Task 5는 값·배치를 구현자가 정한다. 정할 것을 명시했고 보고하라고 적었다.

**3. 이름 일치** — `ThemeId`/`THEMES`/`DEFAULT_THEME`/`asThemeId`/`useTheme`/`--color-surface`/`.ink`가 과제 사이에서 같은 철자로 쓰인다.

**4. 이 계획이 못 잡는 것** — 색이 실제로 보기 좋은지, 대비가 충분한지는 **눈으로 봐야 안다.** 시험은 "변수가 빠지지 않았다"까지만 본다. 그래서 마지막에 설치본을 만들어 사람이 확인한다.
