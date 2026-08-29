import { describe, expect, it } from 'vitest';

import { effectivePeriods, setOverride } from '../../src/features/timetable/timetableCore';
import type { TimetableEntry, TimetableOverride } from '../../src/shared/domain/types';

const CLASS = 'class-1';
const DATE = '2026-08-31'; // 월요일
const WEEKDAY = 1;

/** 월요일 1~3교시: 국어·수학·체육 */
function weekly(): TimetableEntry[] {
  return [
    { classId: CLASS, weekday: 1, period: 1, subject: '국어' },
    { classId: CLASS, weekday: 1, period: 2, subject: '수학' },
    { classId: CLASS, weekday: 1, period: 3, subject: '체육' },
  ];
}

describe('effectivePeriods', () => {
  it('바꾼 것이 없으면 주간 시간표 그대로다', () => {
    const result = effectivePeriods(weekly(), [], CLASS, DATE, WEEKDAY);

    expect(result).toEqual([
      { period: 1, subject: '국어', overridden: false },
      { period: 2, subject: '수학', overridden: false },
      { period: 3, subject: '체육', overridden: false },
    ]);
  });

  it('그날 항목이 있으면 그 교시만 바뀐다', () => {
    const overrides: TimetableOverride[] = [
      { classId: CLASS, date: DATE, period: 2, subject: '음악' },
    ];

    const result = effectivePeriods(weekly(), overrides, CLASS, DATE, WEEKDAY);

    expect(result[1]).toEqual({ period: 2, subject: '음악', overridden: true });
    expect(result[0]?.overridden).toBe(false);
  });

  it('빈 과목 항목은 그날 그 교시가 없다는 뜻이다', () => {
    const overrides: TimetableOverride[] = [{ classId: CLASS, date: DATE, period: 3, subject: '' }];

    const result = effectivePeriods(weekly(), overrides, CLASS, DATE, WEEKDAY);

    expect(result.map((r) => r.period)).toEqual([1, 2]);
  });

  it('다른 날짜·다른 학급의 항목은 무시한다', () => {
    const overrides: TimetableOverride[] = [
      { classId: CLASS, date: '2026-09-01', period: 1, subject: '음악' },
      { classId: 'class-2', date: DATE, period: 1, subject: '음악' },
    ];

    const result = effectivePeriods(weekly(), overrides, CLASS, DATE, WEEKDAY);

    expect(result[0]?.subject).toBe('국어');
  });

  it('주간에 없는 교시를 그날만 더할 수 있다 (보강)', () => {
    const overrides: TimetableOverride[] = [
      { classId: CLASS, date: DATE, period: 4, subject: '보강' },
    ];

    const result = effectivePeriods(weekly(), overrides, CLASS, DATE, WEEKDAY);

    expect(result[3]).toEqual({ period: 4, subject: '보강', overridden: true });
  });
});

describe('setOverride', () => {
  it('원래 과목과 같은 과목으로 되돌리면 항목이 사라진다', () => {
    const changed = setOverride([], weekly(), CLASS, DATE, WEEKDAY, 2, '음악');
    expect(changed).toHaveLength(1);

    const reverted = setOverride(changed, weekly(), CLASS, DATE, WEEKDAY, 2, '수학');
    expect(reverted).toEqual([]);
  });

  it('같은 교시를 다시 바꾸면 항목이 하나만 남는다', () => {
    const first = setOverride([], weekly(), CLASS, DATE, WEEKDAY, 2, '음악');
    const second = setOverride(first, weekly(), CLASS, DATE, WEEKDAY, 2, '미술');

    expect(second).toEqual([{ classId: CLASS, date: DATE, period: 2, subject: '미술' }]);
  });
});
