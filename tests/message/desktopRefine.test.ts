import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/*
 * 설치형에는 `/api/refine`이 없다. 그건 웹 배포본에만 있는 서버 함수라,
 * 설치형에서 [AI로 다듬기]를 누르면 무엇을 해도 실패한다. 그런데 실패하기
 * 전에 선생님은 [AI 다듬기 켜기]를 눌러 설정으로 가서 Gemini 키를 붙여
 * 넣게 된다 — 쓰이지도 않을 열쇠를 받아 두는 셈이다.
 *
 * 화면으로 시험하지 않고 소스를 읽는다. `isDesktop()`은 빌드 시각 상수라
 * 시험 환경에서는 늘 거짓이고, 그러면 이 갈래를 아예 못 밟는다.
 */
describe('설치형에서는 AI 다듬기를 안 내민다', () => {
  const source = readFileSync('src/features/message/MessagePage.tsx', 'utf8');

  it('isDesktop으로 가린다', () => {
    expect(source).toContain('const canRefine = !isDesktop();');
  });

  it('두 단추가 다 그 판단을 거친다', () => {
    // 하나만 가리면 나머지 하나로 같은 자리에 닿는다.
    expect(source).toContain('canRefine ? (');
    expect(source).toMatch(/if \(!canRefine\) return false;/);
  });
});
