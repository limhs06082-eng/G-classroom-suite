import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { slashed, sourceFiles } from './sourceFiles';

/*
 * 어두운 섬(`.ink`)이 제자리에 붙어 있는지, 그 안의 팔레트가 온전한지 본다.
 *
 * 이것도 소스 글자를 읽는 시험이다. 색이 CSS 변수라 jsdom에서는 계산된
 * 값이 안 나오고, 이 흠은 어두운 테마를 켠 뒤에야 — 그것도 교실 앞
 * 대형 화면에서 — 드러난다. 그때 알면 늦다.
 */

/** 일부러 어두운 면. 이 셋이 섬의 표시다. */
const DARK_BG = /\bbg-slate-(?:700|800|900)\b/;

/** 클래스 이름 하나로서의 `ink`. `link`·`thinking` 같은 말에는 안 걸린다. */
const INK_CLASS = /(?:^|\s)ink(?:\s|$)/;

/**
 * 한 줄에서 따옴표 안 글자만 뽑는다.
 *
 * 클래스는 반드시 따옴표 안에 있다. 주석에 적은 'ink'나 옆 속성에 적은
 * 글자가 같은 줄에 있다고 통과하면, 정작 클래스는 안 붙은 채로 시험만
 * 초록이 된다.
 */
function quotedParts(line: string): string[] {
  return [...line.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
    (match) => match[1] ?? match[2] ?? match[3] ?? '',
  );
}

/** `.ink { ... }` 덩어리. 주석은 걷어 낸다 — 주석 처리도 지운 것과 같다. */
function inkBlock(css: string): string {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const opened = bare.indexOf('.ink {');
  if (opened === -1) return '';
  const closed = bare.indexOf('}', opened);
  return closed === -1 ? '' : bare.slice(opened, closed);
}

/**
 * `oklch(...)`의 밝기. `98.4%`도 `0.984`도 같은 값으로 읽는다.
 *
 * 값이 아니라 **밝기의 차례**를 보려는 것이다. 이름과 뜻이 어긋난
 * 팔레트를 붙여 넣어도 변수 이름은 다 살아 있어서, 이름만 세는 검사는
 * 그대로 통과한다.
 */
function lightness(declaration: string): number {
  const found = /oklch\(\s*([0-9.]+)(%?)/.exec(declaration);
  if (found === null) return Number.NaN;
  const raw = Number(found[1]);
  return found[2] === '%' ? raw / 100 : raw;
}

const CSS_PATH = 'src/index.css';

describe('어두운 섬', () => {
  it('일부러 어두운 면을 쓰는 파일마다 그 면 자체에 ink가 붙어 있다', () => {
    const dark = sourceFiles('src').filter((file) => DARK_BG.test(readFileSync(file, 'utf8')));

    /*
     * 훑을 대상이 사라지면 아래 검사는 빈 배열끼리 견주며 조용히 통과한다.
     * 규칙이 무의미해진 것을 규칙이 알려 줘야 한다.
     */
    expect(dark.length).toBeGreaterThan(0);

    /*
     * 파일 어딘가에 `ink`가 있는지만 보면 모자란다. 다른 요소에 옮겨
     * 붙여도 통과하기 때문이다. 어두운 배경과 `ink`가 **같은 클래스
     * 글자 안에** 있는지까지 본다 — 그래야 그 면이 정말 섬의 뿌리다.
     *
     * 뿌리 안쪽(예: 잠금화면 PIN 자판)은 뿌리에서 물려받으므로 저마다
     * 붙일 필요가 없다. 그래서 '파일마다 한 줄 이상'으로 본다.
     */
    const unrooted = dark
      .filter(
        (file) =>
          !readFileSync(file, 'utf8')
            .split('\n')
            .some((line) =>
              quotedParts(line).some((part) => DARK_BG.test(part) && INK_CLASS.test(part)),
            ),
      )
      .map(slashed);

    expect(unrooted).toEqual([]);
  });

  it('ink는 쓰이는 slate 눈금을 하나도 빠짐없이 못 박는다', () => {
    const block = inkBlock(readFileSync(CSS_PATH, 'utf8'));

    /*
     * 앱이 실제로 쓰는 단계만 본다. 한 단계라도 빠지면 그 단계만 테마를
     * 따라가서, 잠금화면은 어두운데 PIN 자판만 밝은 반쪽짜리 섬이 된다.
     * 나중에 slate-950을 쓰기 시작해도 이 시험이 알아서 걸어 잠근다.
     */
    const used = new Set(
      sourceFiles('src').flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(/\bslate-(\d+)\b/g)].map((match) => match[1] ?? ''),
      ),
    );

    const missing = [...used].sort().filter((step) => !block.includes(`--color-slate-${step}:`));

    expect(missing).toEqual([]);

    /*
     * 표면도 함께 못 박는다. 화면 커튼의 '화면 다시 보기' 단추가
     * secondary(`bg-surface text-slate-700`)라, 표면만 테마를 따라가면
     * 어두운 바탕에 어두운 글자가 된다.
     */
    expect(block).toContain('--color-surface:');
  });

  it('ink의 눈금은 뒤집혀 있지 않다', () => {
    const block = inkBlock(readFileSync(CSS_PATH, 'utf8'));

    const steps = [...block.matchAll(/--color-slate-(\d+):([^;]+);/g)].map((match) => ({
      step: Number(match[1]),
      light: lightness(match[2] ?? ''),
    }));

    expect(steps.length).toBeGreaterThan(0);

    /*
     * 섬 안은 '어두운 바탕에 밝은 글자'로 짜여 있다 —
     * `bg-slate-900` + `text-white` + `text-slate-300`.
     *
     * 여기에 어두운 테마용 뒤집힌 눈금(50이 가장 어둡고 900이 가장 밝은)을
     * 붙여 넣으면 변수 이름은 다 살아 있는데 잠금화면과 화면 커튼이
     * 하얘지고 그 위 흰 글자가 사라진다. 그래서 값이 아니라 차례를 지킨다:
     * 번호가 커질수록 어두워야 한다.
     */
    const ascending = [...steps].sort((a, b) => a.step - b.step);
    const wrongOrder = ascending
      .slice(1)
      .filter((entry, index) => !(entry.light < (ascending[index]?.light ?? Number.NaN)))
      .map((entry) => `slate-${entry.step}`);

    expect(wrongOrder).toEqual([]);

    /*
     * 표면은 밝아야 한다. 섬 위에 놓인 흰 단추와 PIN 점은 섬이 어두워도
     * 흰색 그대로여야 눈에 띈다.
     */
    const surface = /--color-surface:([^;]+);/.exec(block);
    expect(surface).not.toBeNull();
    expect(lightness(surface?.[1] ?? '')).toBeGreaterThan(0.9);
  });

  it('ink는 @theme 밖에 있다', () => {
    const css = readFileSync(CSS_PATH, 'utf8');

    /*
     * `@theme` 안으로 들어가면 이 값이 앱 전체의 팔레트가 되어 테마 넷이
     * 아무 일도 못 한다. 섬 하나 지키려다 테마를 통째로 잠그는 셈이다.
     */
    const themeOpened = css.indexOf('@theme {');
    const themeClosed = css.indexOf('\n}', themeOpened);
    const inkAt = css.indexOf('.ink {');

    expect(inkAt).toBeGreaterThan(-1);
    expect(inkAt > themeClosed).toBe(true);
  });
});
