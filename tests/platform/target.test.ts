import { describe, expect, it } from 'vitest';

import { isDesktop, TARGET } from '../../src/shared/platform/target';

describe('빌드 대상 판단', () => {
  it('VITE_TARGET이 없으면 웹이다', () => {
    // 아무 설정 없이 fork해 배포해도 웹으로 도는 것이 기본값이다.
    expect(TARGET).toBe('web');
    expect(isDesktop()).toBe(false);
  });

  it('둘은 항상 같은 답을 준다', () => {
    expect(isDesktop()).toBe(TARGET === 'desktop');
  });
});
