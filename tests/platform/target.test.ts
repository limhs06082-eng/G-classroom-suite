import { describe, expect, it } from 'vitest';

import { isDesktop, resolveTarget, TARGET } from '../../src/shared/platform/target';

describe('빌드 대상 옮기기', () => {
  it("'desktop'이면 설치형이다", () => {
    expect(resolveTarget('desktop')).toBe('desktop');
  });

  it('값이 없으면 웹이다', () => {
    // 아무 설정 없이 fork해 배포해도 웹으로 도는 것이 기본값이다.
    expect(resolveTarget(undefined)).toBe('web');
  });

  it('모르는 값이면 웹이다', () => {
    // 오타 하나로 앱이 이상한 모드로 뜨는 것보다 웹으로 도는 편이 낫다.
    expect(resolveTarget('desktopp')).toBe('web');
    expect(resolveTarget('')).toBe('web');
  });
});

describe('이 빌드의 대상', () => {
  it('시험에서는 웹이다', () => {
    // VITE_TARGET을 안 준 채로 도므로 웹이어야 한다.
    expect(TARGET).toBe('web');
    expect(isDesktop()).toBe(false);
  });
});
