import { beforeEach, describe, expect, it } from 'vitest';

import {
  isPeriodChimeOn,
  PERIOD_CHIME_KEY,
  setPeriodChimeOn,
  shouldChime,
} from '../../src/shared/fx/periodChime';

const lesson = (period: number, minutesLeft: number) =>
  ({ kind: 'lesson', period, subject: '국어', minutesLeft }) as const;

beforeEach(() => {
  window.localStorage.removeItem(PERIOD_CHIME_KEY);
});

/*
 * 학교 종이 이미 울리는 교실에서 소리가 겹치면 잡음이다. 그래서 기본은
 * 꺼짐이고, 켜도 같은 교시에 한 번만 — 홈과 오늘 보드가 같이 떠 있어도.
 */
describe('교시 끝 알림음', () => {
  it('기본은 꺼짐이고, 켜면 이 기기에 남는다', () => {
    expect(isPeriodChimeOn()).toBe(false);
    setPeriodChimeOn(true);
    expect(isPeriodChimeOn()).toBe(true);
    expect(window.localStorage.getItem(PERIOD_CHIME_KEY)).toBe('1');
    setPeriodChimeOn(false);
    expect(isPeriodChimeOn()).toBe(false);
  });

  it('수업 중 5분 남았을 때 처음 한 번 울리고, 같은 교시에는 다시 안 울린다', () => {
    const today = '2026-09-07';
    expect(shouldChime(lesson(2, 6), today, null)).toBeNull();

    const mark = shouldChime(lesson(2, 5), today, null);
    expect(mark).toEqual({ date: today, period: 2 });

    expect(shouldChime(lesson(2, 4), today, mark)).toBeNull();
    expect(shouldChime(lesson(2, 1), today, mark)).toBeNull();
    // 다음 교시는 다시 울린다.
    expect(shouldChime(lesson(3, 5), today, mark)).toEqual({ date: today, period: 3 });
    // 다른 날의 같은 교시도 다시.
    expect(shouldChime(lesson(2, 3), '2026-09-08', mark)).toEqual({ date: '2026-09-08', period: 2 });
  });

  it('수업 중이 아니면 울리지 않는다', () => {
    expect(shouldChime({ kind: 'break', period: 3, subject: '수학', minutesUntil: 5 }, '2026-09-07', null)).toBeNull();
    expect(shouldChime({ kind: 'lunch' }, '2026-09-07', null)).toBeNull();
    expect(shouldChime({ kind: 'after' }, '2026-09-07', null)).toBeNull();
  });
});
