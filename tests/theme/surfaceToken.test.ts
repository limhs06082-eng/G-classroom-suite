import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { slashed, sourceFiles } from './sourceFiles';

/*
 * 이 시험은 화면이 아니라 **소스 글자**를 본다.
 *
 * 새로 짜는 사람이 무심코 `bg-white`를 쓰면 그 카드만 어두운 테마에서
 * 하얗게 남는다. 화면 시험으로는 못 잡는다 — 색이 CSS 변수라 jsdom에서는
 * 계산된 값이 안 나오고, 눈으로 보기 전에는 아무도 모른다.
 *
 * 훑을 파일 목록(`sourceFiles`)은 `./sourceFiles`로 옮겼다. 어두운 섬
 * 시험(`inkScope.test.ts`)이 같은 목록을 봐야 해서다.
 */

describe('표면색', () => {
  it('bg-white는 잠금화면의 PIN 점 하나뿐이다', () => {
    const hits = sourceFiles('src').flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => /\bbg-white\b/.test(line))
        /*
         * 파일 이름만 모으면 잠금화면 파일 안에 표면용 `bg-white`가 하나
         * 더 늘어도 알 수 없다. 그래서 그 한 줄이 정말 PIN 점인지까지 본다.
         */
        .map((line) =>
          /\bborder-white bg-white\b/.test(line)
            ? `${slashed(file)}: PIN 점`
            : `${slashed(file)}: ${line.trim()}`,
        ),
    );

    /*
     * 잠금화면의 점은 어두운 화면 위에 있어 어느 테마에서나 흰색이어야 한다.
     * 나머지는 전부 표면이라 테마를 따라가야 한다.
     */
    expect(hits).toEqual(['src/shared/lock/LockScreen.tsx: PIN 점']);
  });

  it('surface 토큰이 선언되어 있다', () => {
    const css = readFileSync('src/index.css', 'utf8');

    /*
     * `@theme` 안에 있는지까지 본다.
     *
     * Tailwind는 `@theme`의 `--color-*`만 보고 `bg-surface` 유틸리티를
     * 만든다. 선언을 `:root`로 옮기면 변수는 그대로 살아 있어서 파일을
     * 훑는 검사는 통과하지만, 클래스가 사라져 카드 마흔한 곳이 배경 없이
     * 그려진다. 주석 처리도 마찬가지라 주석은 먼저 걷어 낸다.
     */
    const opened = css.indexOf('@theme {');
    const closed = css.indexOf('\n}', opened);
    const theme = opened === -1 || closed === -1 ? '' : css.slice(opened, closed);

    expect(theme.replace(/\/\*[\s\S]*?\*\//g, '')).toContain('--color-surface:');
  });
});

describe('눌림색', () => {
  it('채워진 단추의 hover는 -700을 안 쓴다', () => {
    const hits = sourceFiles('src').flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => /hover:bg-(brand|danger|success|warning|info)-700\b/.test(line))
        .map((line) => `${slashed(file)}: ${line.trim()}`),
    );

    /*
     * `-700`은 강조 글자(`text-brand-700` 등 여든 곳)가 함께 쓴다. 어두운
     * 테마는 그 글자가 읽히도록 -700을 밝게 올리는데, 이쪽은 흰 글자가
     * 얹히는 배경이라 밝아지면 라벨이 사라진다. 마우스를 올린 동안만
     * 글자가 지워지는 단추는 눈으로도 잡기 어렵다.
     */
    expect(hits).toEqual([]);
  });

  it('눌림색이 네 테마에 다 있다', () => {
    const css = readFileSync('src/index.css', 'utf8');

    // 한 테마에서 빠지면 그 테마에서만 hover가 기본값으로 남는다.
    expect((css.match(/--color-brand-press:/g) ?? []).length).toBe(4);
    expect((css.match(/--color-danger-press:/g) ?? []).length).toBe(4);
  });

  it('어두운 테마의 눌림색은 강조 글자보다 어둡다', () => {
    const css = readFileSync('src/index.css', 'utf8');
    const dark = css.slice(css.indexOf("[data-theme='dark']"));

    const text = /--color-brand-700:\s*oklch\(([\d.]+)/.exec(dark)?.[1];
    const press = /--color-brand-press:\s*oklch\(([\d.]+)/.exec(dark)?.[1];

    // 같아지면 이름을 가른 뜻이 사라진다.
    expect(Number(press)).toBeLessThan(Number(text));
  });
})
