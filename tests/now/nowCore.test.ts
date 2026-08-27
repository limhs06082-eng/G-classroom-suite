import { describe, expect, it } from 'vitest';

import { createDefaultPeriodTimes } from '../../src/shared/domain/factories';
import type { PeriodTime } from '../../src/shared/domain/types';
import { lunchGap, minutesOf, nowState } from '../../src/features/now/nowCore';

const TIMES: PeriodTime[] = createDefaultPeriodTimes();

/** 오늘 채워진 교시. nowState는 이 목록만 보고 판단한다. */
const TODAY = [
  { period: 1, subject: '국어' },
  { period: 2, subject: '수학' },
  { period: 3, subject: '사회' },
  { period: 4, subject: '과학' },
  { period: 5, subject: '체육' },
];

/** `"09:20"` → 그날의 분. 시험을 읽기 쉽게 하려고 둔다. */
function at(hm: string): number {
  return minutesOf(hm) ?? 0;
}

describe('minutesOf', () => {
  it('시각을 분으로 바꾼다', () => {
    expect(minutesOf('09:00')).toBe(540);
    expect(minutesOf('00:00')).toBe(0);
  });

  it('못 읽으면 null이다', () => {
    // 던지지 않는다. 한 줄이 깨졌다고 카드가 사라지면 안 된다.
    expect(minutesOf('아홉시')).toBeNull();
    expect(minutesOf('')).toBeNull();
  });
});

describe('점심은 가장 긴 틈이다', () => {
  it('4교시 끝과 5교시 시작 사이를 찾는다', () => {
    const gap = lunchGap(TIMES);

    // 따로 묻지 않는다. 자료가 이미 말하고 있다.
    expect(gap?.start).toBe(at('12:10'));
    expect(gap?.end).toBe(at('13:10'));
  });

  it('틈이 다 같으면 점심이 없다고 본다', () => {
    const even = TIMES.map((_, index) => ({
      period: index + 1,
      start: `${String(9 + index).padStart(2, '0')}:00`,
      end: `${String(9 + index).padStart(2, '0')}:40`,
    }));

    // 쉬는 시간과 구별이 안 되면 점심이라고 우기지 않는다.
    expect(lunchGap(even)).toBeNull();
  });
});

describe('nowState', () => {
  it('시간표가 비면 아무 말도 못 한다', () => {
    expect(nowState(TIMES, [], at('10:00')).kind).toBe('no-timetable');
  });

  it('1교시 전에는 곧 시작한다고 한다', () => {
    const state = nowState(TIMES, TODAY, at('08:30'));

    expect(state).toEqual({
      kind: 'before',
      period: 1,
      subject: '국어',
      startsAt: '09:00',
      minutesUntil: 30,
    });
  });

  it('수업 중에는 지금 교시와 남은 시간을 말한다', () => {
    const state = nowState(TIMES, TODAY, at('10:58'));

    // 10:40~11:20이 3교시다.
    expect(state).toEqual({
      kind: 'lesson',
      period: 3,
      subject: '사회',
      minutesLeft: 22,
    });
  });

  it('시작하는 순간은 수업 중이다', () => {
    expect(nowState(TIMES, TODAY, at('09:00')).kind).toBe('lesson');
  });

  it('끝나는 순간은 이미 쉬는 시간이다', () => {
    /*
     * 09:40은 1교시 끝이자 쉬는 시간 시작이다. 둘 다 참이면 '남은 시간 0분'이
     * 되어 선생님이 아직 수업 중이라고 읽는다. 끝은 끝이다.
     */
    expect(nowState(TIMES, TODAY, at('09:40')).kind).toBe('break');
  });

  it('쉬는 시간에는 다음 교시를 말한다', () => {
    const state = nowState(TIMES, TODAY, at('09:45'));

    expect(state).toEqual({
      kind: 'break',
      period: 2,
      subject: '수학',
      minutesUntil: 5,
    });
  });

  it('점심때는 점심이라고 한다', () => {
    // 12:10~13:10은 가장 긴 틈이다. 쉬는 시간이 아니다.
    expect(nowState(TIMES, TODAY, at('12:30')).kind).toBe('lunch');
  });

  it('오늘 마지막 교시가 끝나면 하교 후다', () => {
    // 오늘은 5교시까지다. 5교시는 13:10~13:50.
    expect(nowState(TIMES, TODAY, at('14:00')).kind).toBe('after');
  });

  it('오늘 없는 교시의 시각은 셈에 안 넣는다', () => {
    const short = [{ period: 1, subject: '국어' }];

    /*
     * 금요일에 한 교시만 채운 반이 있다. 09:50이면 시간표상 2교시지만
     * 오늘 2교시는 없다. 있지도 않은 수업을 곧 시작한다고 하면 안 된다.
     */
    expect(nowState(TIMES, short, at('09:50')).kind).toBe('after');
  });

  it('중간이 빈 시간표도 다음 것을 옳게 찾는다', () => {
    const holed = [
      { period: 1, subject: '국어' },
      { period: 4, subject: '과학' },
    ];

    const state = nowState(TIMES, holed, at('09:45'));

    // 2·3교시가 없으니 다음은 4교시(11:30)다.
    expect(state).toEqual({
      kind: 'break',
      period: 4,
      subject: '과학',
      minutesUntil: 105,
    });
  });

  it('교시 시각이 깨져 있으면 아무 말도 안 한다', () => {
    const broken = TIMES.map((time) => ({ ...time, start: 'x', end: 'y' }));

    // 던지지 않는다. 홈 화면 전체가 사라지면 안 된다.
    expect(nowState(broken, TODAY, at('10:00')).kind).toBe('no-timetable');
  });
});

describe('점심이 둘로 보이면 우기지 않는다', () => {
  it('가장 긴 틈이 둘이면 점심이 없다고 본다', () => {
    /*
     * 못 읽는 줄이 하나 버려지면 그 자리에 앞뒤 교시를 잇는 긴 틈이 생기고,
     * 그것이 진짜 점심과 길이가 같아진다. 앞엣것을 고르면 09:55에 "점심"이
     * 뜬다. 실제로 그렇게 되는 것을 확인하고 이 갈래를 넣었다.
     */
    const twoGaps: PeriodTime[] = [
      { period: 1, start: '09:00', end: '09:40' },
      { period: 2, start: '10:40', end: '11:20' },
      { period: 3, start: '11:30', end: '12:10' },
      { period: 4, start: '13:10', end: '13:50' },
    ];

    // 09:40~10:40과 12:10~13:10이 똑같이 60분이다.
    expect(lunchGap(twoGaps)).toBeNull();
  });

  it('한쪽이 더 길면 그쪽이 점심이다', () => {
    const uneven: PeriodTime[] = [
      { period: 1, start: '09:00', end: '09:40' },
      { period: 2, start: '10:10', end: '10:50' },
      { period: 3, start: '12:00', end: '12:40' },
    ];

    // 09:40~10:10은 30분, 10:50~12:00은 70분이다.
    expect(lunchGap(uneven)).toEqual({ start: 650, end: 720 });
  });
});
