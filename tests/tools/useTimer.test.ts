import { describe, expect, it } from 'vitest';

import { formatDuration } from '../../src/features/tools/useTimer';

describe('formatDuration', () => {
  it('분:초로 보여 준다', () => {
    expect(formatDuration(5 * 60 * 1000)).toBe('5:00');
    expect(formatDuration(90 * 1000)).toBe('1:30');
    expect(formatDuration(9 * 1000)).toBe('0:09');
  });

  it('한 시간이 넘으면 시:분:초로 바꾼다', () => {
    expect(formatDuration(3661 * 1000)).toBe('1:01:01');
  });

  it('0은 0:00이다', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('남은 시간을 올림해서 센다', () => {
    // 4.2초 남았는데 4초로 보이면 교사가 종료 시점을 놓친다.
    expect(formatDuration(4200)).toBe('0:05');
    expect(formatDuration(1)).toBe('0:01');
  });
});
