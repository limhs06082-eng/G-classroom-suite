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

/*
 * `.tsx`만 보지 않고 `.ts`도 본다.
 *
 * 이 저장소는 Tailwind 클래스 글자를 `.ts`에도 둔다(예: navigation.ts의
 * accentClass). 화면 파일만 훑으면 그런 상수에 박힌 `bg-white`는 그대로
 * 지나간다 — 시험은 초록인데 카드 하나만 하얀, 가장 찾기 힘든 꼴이다.
 *
 * `.css`는 뺐다. `index.css`의 `@media print` 안에는 `bg-white`가 일부러
 * 남아 있다. 종이는 어느 테마에서나 희다.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

/** 윈도우에서도 같은 글자로 견주려고 구분자를 `/`로 맞춘다. */
function slashed(file: string): string {
  return file.split('\\').join('/');
}

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
