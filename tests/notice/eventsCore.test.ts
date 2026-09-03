import { describe, expect, it } from 'vitest';

import { daysUntil, ddayLabel, eventsOn, pastEvents, upcomingEvents } from '../../src/features/notice/eventsCore';
import { createClassEvent } from '../../src/shared/domain/factories';

const NOW = '2026-08-01T00:00:00.000Z';
const TODAY = '2026-08-29';
const CLASS = 'class-1';

const events = [
  createClassEvent({ id: 'e-past', classId: CLASS, date: '2026-08-20', title: '수행평가' }, NOW),
  createClassEvent({ id: 'e-today', classId: CLASS, date: '2026-08-29', title: '학부모 상담' }, NOW),
  createClassEvent({ id: 'e-soon', classId: CLASS, date: '2026-09-01', title: '현장학습' }, NOW),
  createClassEvent({ id: 'e-far', classId: CLASS, date: '2026-10-15', title: '운동회' }, NOW),
  createClassEvent({ id: 'e-other', classId: 'class-2', date: '2026-08-30', title: '옆 반' }, NOW),
];

describe('daysUntil · ddayLabel', () => {
  it('오늘은 0, 앞날은 양수, 지난 날은 음수다', () => {
    expect(daysUntil(TODAY, '2026-08-29')).toBe(0);
    expect(daysUntil(TODAY, '2026-09-01')).toBe(3);
    expect(daysUntil(TODAY, '2026-08-27')).toBe(-2);
  });

  it('달을 넘겨도 정확하다 (서머타임·UTC 함정 없이)', () => {
    expect(daysUntil('2026-02-27', '2026-03-02')).toBe(3);
    expect(ddayLabel(TODAY, '2026-09-01')).toBe('D-3');
    expect(ddayLabel(TODAY, TODAY)).toBe('D-day');
    expect(ddayLabel(TODAY, '2026-08-27')).toBe('2일 지남');
  });
});

describe('upcomingEvents · eventsOn · pastEvents', () => {
  it('오늘 이후를 가까운 순으로, 옆 반은 빼고, 개수 제한을 지킨다', () => {
    expect(upcomingEvents(events, CLASS, TODAY).map((e) => e.id)).toEqual(['e-today', 'e-soon', 'e-far']);
    expect(upcomingEvents(events, CLASS, TODAY, 2).map((e) => e.id)).toEqual(['e-today', 'e-soon']);
  });

  it('그날 일정과 지난 일정을 가른다', () => {
    expect(eventsOn(events, CLASS, TODAY).map((e) => e.id)).toEqual(['e-today']);
    expect(pastEvents(events, CLASS, TODAY).map((e) => e.id)).toEqual(['e-past']);
  });
});
