import { describe, expect, it } from 'vitest';

import { desktopHiddenPaths } from '../../src/app/router';

describe('설치형에서 감추는 라우트', () => {
  it('형성평가와 학생 참여 화면을 감춘다', () => {
    // 설치형에는 서버가 없어 학생 폰이 들어올 길이 없다.
    expect(desktopHiddenPaths).toContain('quiz');
    expect(desktopHiddenPaths).toContain('join/:code');
  });

  it('전자칠판 라우트는 감추지 않는다', () => {
    /*
     * 전자칠판은 board/:feature 하나뿐이고 무엇을 그릴지는 BoardPage가
     * 정한다. 이걸 감추면 자리·당번·보상까지 함께 죽는다.
     */
    expect(desktopHiddenPaths).not.toContain('board/:feature');
  });

  it('학급 운영 기능은 감추지 않는다', () => {
    for (const path of ['seating', 'duty', 'reward', 'assignment', 'lesson', 'task', 'message']) {
      expect(desktopHiddenPaths).not.toContain(path);
    }
  });
});
