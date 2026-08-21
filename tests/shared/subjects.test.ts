import { describe, expect, it } from 'vitest';

import { COMMON_SUBJECTS, MAX_SUBJECT_LENGTH, normalizeSubject } from '../../src/shared/subjects';

describe('normalizeSubject', () => {
  it('앞뒤 공백을 다듬는다', () => {
    expect(normalizeSubject('  수학  ')).toBe('수학');
  });

  it('빈 값은 빈 값으로 둔다', () => {
    // 과목이 없는 수업 흐름(학급 회의, 상담 주간)이 정상이다.
    expect(normalizeSubject('')).toBe('');
    expect(normalizeSubject('    ')).toBe('');
  });

  it('너무 길면 자른다', () => {
    const long = '가'.repeat(50);

    expect(normalizeSubject(long)).toHaveLength(MAX_SUBJECT_LENGTH);
  });

  it('목록에 없는 과목도 그대로 받는다', () => {
    // 목록은 고르기를 돕는 것이지 가두는 것이 아니다.
    expect(normalizeSubject('방과후 바둑')).toBe('방과후 바둑');
  });
});

describe('COMMON_SUBJECTS', () => {
  it('초등 교과가 들어 있다', () => {
    expect(COMMON_SUBJECTS).toContain('국어');
    expect(COMMON_SUBJECTS).toContain('수학');
    expect(COMMON_SUBJECTS).toContain('창체');
  });

  it('겹치는 항목이 없다', () => {
    expect(new Set(COMMON_SUBJECTS).size).toBe(COMMON_SUBJECTS.length);
  });

  it('모두 최대 길이 안에 든다', () => {
    for (const subject of COMMON_SUBJECTS) {
      expect(normalizeSubject(subject)).toBe(subject);
    }
  });
});
