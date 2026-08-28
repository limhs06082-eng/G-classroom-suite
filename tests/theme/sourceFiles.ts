import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/*
 * 테마 시험은 화면이 아니라 **소스 글자**를 본다.
 *
 * 색이 CSS 변수라 jsdom에서는 계산된 값이 안 나온다. 그래서 `bg-white`가
 * 하나 남았는지, 어두운 섬에 `ink`가 붙었는지는 렌더링으로 못 잡는다.
 * 눈으로 보기 전에는 아무도 모르는 종류의 흠이라 글자로 잡는다.
 *
 * 훑을 파일 목록을 한 곳에 둔다. 시험마다 따로 훑으면 한쪽만 `.ts`를
 * 빼먹는 식으로 어긋나고, 그 틈으로 새는 것은 늘 조용하다.
 */

/*
 * `.tsx`만 보지 않고 `.ts`도 본다.
 *
 * 이 저장소는 Tailwind 클래스 글자를 `.ts`에도 둔다(예: navigation.ts의
 * accentClass). 화면 파일만 훑으면 그런 상수에 박힌 클래스는 그대로
 * 지나간다 — 시험은 초록인데 카드 하나만 하얀, 가장 찾기 힘든 꼴이다.
 *
 * `.css`는 뺐다. `index.css`의 `@media print` 안에는 `bg-white`가 일부러
 * 남아 있고, `.ink` 선언 자체도 여기 걸리면 안 된다. 종이는 어느
 * 테마에서나 희다.
 */
export function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

/** 윈도우에서도 같은 글자로 견주려고 구분자를 `/`로 맞춘다. */
export function slashed(file: string): string {
  return file.split('\\').join('/');
}
