import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { asThemeId, DEFAULT_THEME, THEMES } from '../../src/shared/theme/themes';

/*
 * 이 시험도 화면이 아니라 **소스 글자**를 본다. 색이 CSS 변수라 jsdom에서는
 * 계산된 값이 안 나오고, 테마의 흠은 테마를 켠 뒤에야 드러난다.
 *
 * 값이 읽히는지(명도 대비)는 여기서 안 본다 — 그건 계산해서 보고서에 적었다.
 * 여기서 지키는 것은 **규칙**이다: 색상각은 안 움직인다, 과목 열둘은 서로
 * 같다, 목록과 CSS가 어긋나지 않는다.
 */

const CSS_PATH = 'src/index.css';

/** 주석은 걷어 낸다. 주석 처리한 선언은 지운 것과 같다. */
function bareCss(): string {
  return readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** 여는 글자 다음부터 첫 `}` 앞까지. 테마 블록 안에는 중첩 규칙이 없다. */
function blockAfter(css: string, opener: string): string {
  const opened = css.indexOf(opener);
  if (opened === -1) return '';
  const closed = css.indexOf('}', opened);
  return closed === -1 ? '' : css.slice(opened + opener.length, closed);
}

interface Oklch {
  light: number;
  chroma: number;
  hue: number;
}

/** 한 덩어리의 `--color-*: oklch(...)` 선언을 이름별로 모은다. */
function colors(block: string): Map<string, Oklch> {
  const found = block.matchAll(
    /(--color-[a-z0-9-]+)\s*:\s*oklch\(\s*([0-9.]+)(%?)\s+([0-9.]+)\s+([0-9.]+)/g,
  );
  return new Map(
    [...found].map((match) => {
      const raw = Number(match[2]);
      return [
        match[1] ?? '',
        {
          light: match[3] === '%' ? raw / 100 : raw,
          chroma: Number(match[4]),
          hue: Number(match[5]),
        },
      ];
    }),
  );
}

/**
 * 색상각 규칙에서 빼는 이름.
 *
 * 중립(`slate`)과 표면은 **일부러** 색상각을 옮긴다 — 포근하게는 따뜻한 쪽
 * 85로, 또렷하게는 채도를 0으로 뺀다. 규칙이 지키려는 것은 '기능을 알아보는
 * 색'이지 회색의 기운이 아니다.
 */
const NEUTRAL = /^--color-(slate-|surface$)/;

const CSS_THEMES = ['warm', 'dark', 'contrast'] as const;

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
    const css = readFileSync(CSS_PATH, 'utf8');
    for (const id of CSS_THEMES) {
      expect(css, id).toContain(`[data-theme='${id}']`);
    }
    expect(css).not.toContain(`[data-theme='light']`);
  });

  it('목록의 테마와 CSS의 블록이 어긋나지 않는다', () => {
    /*
     * 위 시험은 셋의 이름을 손으로 적어 두고 본다. 그래서 목록에 다섯째를
     * 더하면서 CSS를 안 쓰면 아무것도 안 걸린다 — 고를 수는 있는데 골라도
     * 아무 일이 안 일어나는 테마가 생긴다. 목록 쪽에서 거꾸로 본다.
     */
    const css = readFileSync(CSS_PATH, 'utf8');
    const needCss = THEMES.map((theme) => theme.id).filter((id) => id !== DEFAULT_THEME);

    expect([...needCss].sort()).toEqual([...CSS_THEMES].sort());
    for (const id of needCss) {
      expect(css, id).toContain(`[data-theme='${id}']`);
    }
  });
});

describe('테마의 색', () => {
  it('기능 색의 색상각은 어느 테마에서도 안 움직인다', () => {
    /*
     * 이 판의 설계에서 가장 중요한 규칙이다. 당번은 어느 테마에서나 초록,
     * 자리·모둠은 파랑, 보상은 노랑이어야 한다 — 색으로 기능을 익힌 선생님이
     * 테마를 바꿨다고 그 익힘을 다시 해야 한다면 테마가 손해다.
     *
     * 명도와 채도만 견주는 시험으로는 이걸 못 잡는다. 색상각 숫자를 하나만
     * 잘못 옮겨 적어도 검사기도 통과하고 화면도 그럴듯하게 뜬다.
     *
     * 채도가 0이면 색상각은 아무 뜻이 없으므로 견주지 않는다.
     */
    const css = bareCss();
    const base = colors(blockAfter(css, '@theme {'));
    expect(base.size).toBeGreaterThan(0);

    const drifted: string[] = [];
    for (const id of CSS_THEMES) {
      const block = colors(blockAfter(css, `[data-theme='${id}'] {`));
      expect(block.size, id).toBeGreaterThan(0);

      for (const [name, value] of block) {
        if (NEUTRAL.test(name)) continue;
        const want = base.get(name);
        if (want === undefined || want.chroma === 0 || value.chroma === 0) continue;
        if (want.hue !== value.hue) drifted.push(`${id} ${name}: ${want.hue} → ${value.hue}`);
      }
    }

    expect(drifted).toEqual([]);
  });

  it('한 테마 안에서 과목 색 열둘은 밝기와 채도가 같다', () => {
    /*
     * `src/shared/subjects.ts`가 적어 둔 규칙이다. 시간표에서 같은 과목을
     * 눈으로 훑어 찾으라고 두는 색이지 꾸미려는 게 아니라서, 하나가 다른
     * 것보다 밝거나 진하면 그 과목만 소리치게 된다. 테마 안에서도 지킨다.
     */
    const css = bareCss();
    const uneven: string[] = [];

    for (const id of CSS_THEMES) {
      const block = colors(blockAfter(css, `[data-theme='${id}'] {`));
      const subjects = [...block].filter(([name]) => /^--color-subject-\d+$/.test(name));

      expect(subjects, id).toHaveLength(12);

      const first = subjects[0]?.[1];
      if (first === undefined) continue;
      for (const [name, value] of subjects) {
        if (value.light !== first.light || value.chroma !== first.chroma) {
          uneven.push(`${id} ${name}: ${value.light} ${value.chroma}`);
        }
      }
    }

    expect(uneven).toEqual([]);
  });
});
