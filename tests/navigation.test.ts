import { describe, expect, it } from 'vitest';

import { FEATURE_NAV, findFeature } from '../src/app/navigation';

/*
 * FEATURE_NAV는 라우터·네비게이션·색상 토큰·전자칠판 라우트가 모두 참조하는
 * 단일 목록이다. 여기가 어긋나면 링크가 조용히 죽거나 색이 빠지므로 고정해 둔다.
 */
describe('FEATURE_NAV', () => {
  it('기능 id가 중복되지 않는다', () => {
    const ids = FEATURE_NAV.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('라우트 경로가 중복되지 않는다', () => {
    const paths = FEATURE_NAV.map((item) => item.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('홈이 첫 항목이고 루트 경로를 가진다', () => {
    expect(FEATURE_NAV[0]?.id).toBe('home');
    expect(FEATURE_NAV[0]?.path).toBe('/');
  });

  it('홈을 제외한 모든 기능은 /로 시작하는 하위 경로를 가진다', () => {
    for (const item of FEATURE_NAV.filter((f) => f.id !== 'home')) {
      expect(item.path).toBe(`/${item.id}`);
    }
  });

  /*
   * 합치기 전에는 '홈 말고는 전부 전자칠판을 지원한다'가 참이었다.
   * 도구함에서 업무 체크·문구 템플릿이 들어오면서 더 이상 아니다.
   * 그 둘은 교사가 혼자 보는 화면이라 학생에게 띄울 것이 없다.
   */
  it('전자칠판은 학생에게 보여 줄 것이 있는 기능만 지원한다', () => {
    const withBoard = FEATURE_NAV.filter((f) => f.hasBoardView).map((f) => f.id);

    expect(withBoard).toEqual(['seating', 'duty', 'reward', 'assignment', 'notice', 'lesson', 'quiz']);
  });

  it('홈은 전자칠판을 갖지 않는다', () => {
    expect(FEATURE_NAV.find((f) => f.id === 'home')?.hasBoardView).toBe(false);
  });

  it('findFeature가 존재하는 id를 찾고 없는 id에는 undefined를 준다', () => {
    expect(findFeature('duty')?.label).toBe('역할·당번');
    expect(findFeature('nope')).toBeUndefined();
  });
});
