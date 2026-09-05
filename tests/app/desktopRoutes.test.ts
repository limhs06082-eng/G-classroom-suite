import { describe, expect, it } from 'vitest';

import { router } from '../../src/app/router';

/** flatten이 실제로 필요로 하는 부분만 뽑은 라우트 모양. */
interface MinimalRoute {
  path?: string;
  children?: readonly MinimalRoute[];
}

/** 라우트 트리를 납작하게 편다. children이 있으면 부모 경로를 앞에 붙인다. */
function flatten(routes: readonly MinimalRoute[], prefix = ''): string[] {
  const out: string[] = [];
  for (const route of routes) {
    const here = route.path === undefined ? prefix : `${prefix}${route.path}`;
    if (route.path !== undefined) out.push(here);
    if (route.children !== undefined) {
      out.push(...flatten(route.children, here === '' ? '' : `${here}/`));
    }
  }
  return out;
}

/*
 * 상수 목록이 아니라 실제 라우터를 훑는다.
 *
 * 앞선 판에서는 desktopHiddenPaths라는 배열을 단언했는데, 라우터는 그
 * 배열을 읽지 않았다 — router.tsx의 quiz·join/:code는 각자 자리에서
 * import.meta.env.VITE_TARGET을 직접 비교해서 갈릴 뿐이다. 조건을
 * 되돌려도 이 시험은 통과했다 — 코드가 아니라 코드 옆에 놓인 목록을
 * 지키고 있었던 셈이다. router가 실제로 등록한 경로를 훑어야 그
 * 조건이 실제 라우터와 이어져 있는지가 드러난다.
 */
describe('라우터가 실제로 등록하는 경로', () => {
  const paths = flatten(router.routes);

  it('웹에서는 형성평가와 학생 참여 화면이 있다', () => {
    // 시험은 늘 웹 대상으로 돈다(VITE_TARGET을 안 준 채로). 설치형에서
    // 빠지는지는 코드가 아니라 결과물을 직접 여는 번들 검사가 본다.
    expect(paths).toContain('quiz');
    expect(paths).toContain('join/:code');
    // 학급 게시판 학생 화면도 같은 결이다. 교사 화면은 어느 쪽에나 있다.
    expect(paths).toContain('classboard/join/:code');
    expect(paths).toContain('classboard');
  });

  it('전자칠판은 어느 쪽에서도 감추지 않는다', () => {
    /*
     * board/:feature 하나로 여섯 기능의 칠판을 다 그린다. 이걸 감추면
     * 자리·당번·보상·과제·수업 칠판이 함께 죽는다.
     */
    expect(paths).toContain('board/:feature');
  });

  it('학급 운영 기능이 모두 등록된다', () => {
    for (const path of ['seating', 'duty', 'reward', 'assignment', 'lesson', 'task', 'message']) {
      expect(paths).toContain(path);
    }
  });
});
