import { describe, expect, it } from 'vitest';

import { hasSchool } from '../../src/shared/domain/school';

/*
 * 이 판단이 한 자리에 있어야 하는 이유가 있다. officeCode와 schoolCode는
 * 서로 따로인 선택 항목이라 한쪽만 채워진 설정이 저장될 수 있다. 화면마다
 * 기준이 다르면 설정 화면은 "정해졌습니다"라 하고 홈은 "학교를 정하세요"라
 * 한다. 둘을 같이 본 교사는 어느 쪽도 믿을 수 없다.
 */
describe('hasSchool', () => {
  it('둘 다 있어야 정해진 것이다', () => {
    expect(hasSchool('J10', '7551281')).toBe(true);
  });

  it('시도코드만 있으면 아직이다', () => {
    expect(hasSchool('J10', '')).toBe(false);
    expect(hasSchool('J10', undefined)).toBe(false);
  });

  it('학교코드만 있으면 아직이다', () => {
    // 코드를 손으로 넣던 옛 화면을 쓰던 교사가 이 상태로 넘어온다.
    expect(hasSchool('', '7551281')).toBe(false);
    expect(hasSchool(undefined, '7551281')).toBe(false);
  });

  it('둘 다 없으면 아직이다', () => {
    expect(hasSchool(undefined, undefined)).toBe(false);
  });
});
