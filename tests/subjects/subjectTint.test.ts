import { describe, expect, it } from 'vitest';

import { SUBJECT_TINT_COUNT, subjectTint, subjectsForGrade } from '../../src/shared/subjects';

/*
 * 색은 꾸미려고 두는 것이 아니라 **같은 과목을 눈으로 훑어 찾으라고** 두는
 * 것이다. 그러니 한 표 안에 함께 놓이는 과목끼리 색이 겹치면 그 자리에서
 * 쓸모가 사라진다. 겹치는지는 눈으로는 못 세고 여기서 센다.
 */
describe('과목 색', () => {
  it('한 학년 안에서는 어느 둘도 색이 겹치지 않는다', () => {
    for (const grade of [1, 2, 3, 4, 5, 6, undefined]) {
      const subjects = subjectsForGrade(grade);
      const tints = subjects.map(subjectTint);

      expect(new Set(tints).size, `${String(grade)}학년: ${subjects.join(' ')}`).toBe(
        subjects.length,
      );
    }
  });

  it('늘 눈금 안에 든다', () => {
    for (const subject of ['국어', '스포츠클럽', '원어민 영어', 'a', '가', '']) {
      const tint = subjectTint(subject);
      // 눈금 밖이면 화면에서 색이 그냥 안 먹는다. 조용히 틀리는 쪽이다.
      expect(tint).toBeGreaterThanOrEqual(1);
      expect(tint).toBeLessThanOrEqual(SUBJECT_TINT_COUNT);
    }
  });

  it('같은 과목은 늘 같은 색이다', () => {
    // 앱을 껐다 켤 때마다 색이 바뀌면 색으로 찾는다는 것 자체가 무너진다.
    expect(subjectTint('스포츠클럽')).toBe(subjectTint('스포츠클럽'));
    expect(subjectTint('국어')).toBe(subjectTint('국어'));
  });

  it('저학년과 고학년은 색을 나눠 써도 된다', () => {
    // 한 표에 같이 놓일 일이 없어서다. 그렇게 아껴야 열둘로 열넷을 덮는다.
    expect(subjectTint('바른생활')).toBe(subjectTint('도덕'));
    expect(subjectsForGrade(1)).not.toContain('도덕');
    expect(subjectsForGrade(4)).not.toContain('바른생활');
  });
});
