import { describe, expect, it } from 'vitest';

import { eventsBetween, schoolWeek } from '../../src/features/notice/weekCore';
import { createClassEvent } from '../../src/shared/domain/factories';

const NOW = '2026-08-01T00:00:00.000Z';
const CLASS = 'class-1';

describe('schoolWeek — 이번 주·다음 주 월~금', () => {
  it('수요일이면 이번 주는 그 주, 다음 주는 그다음 주', () => {
    expect(schoolWeek('2026-09-09', 'this')).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
    ]);
    expect(schoolWeek('2026-09-09', 'next')[0]).toBe('2026-09-14');
    expect(schoolWeek('2026-09-09', 'next')[4]).toBe('2026-09-18');
  });

  it('토요일이면 이번 주는 이미 다음 주다 — 금요일 저녁에 만드는 안내문의 관점', () => {
    expect(schoolWeek('2026-09-12', 'this')[0]).toBe('2026-09-14');
    expect(schoolWeek('2026-09-12', 'next')[0]).toBe('2026-09-21');
  });
});

describe('eventsBetween', () => {
  it('기간 안(양끝 포함) 일정만 날짜순으로, 옆 반은 빼고', () => {
    const events = [
      createClassEvent({ id: 'e-3', classId: CLASS, date: '2026-09-11', title: '금' }, NOW),
      createClassEvent({ id: 'e-1', classId: CLASS, date: '2026-09-07', title: '월' }, NOW),
      createClassEvent({ id: 'e-out', classId: CLASS, date: '2026-09-12', title: '토' }, NOW),
      createClassEvent({ id: 'e-other', classId: 'class-2', date: '2026-09-08', title: '옆' }, NOW),
    ];

    expect(eventsBetween(events, CLASS, '2026-09-07', '2026-09-11').map((e) => e.id)).toEqual(['e-1', 'e-3']);
  });
});
