import { describe, expect, it } from 'vitest';

import { addObservation, nextCounsel } from '../../src/shared/roster/observationCore';

const NOW = '2026-09-07T09:00:00.000Z';

describe('상담 기록', () => {
  it('상담 표시와 다음 상담 날짜를 남기고, 보통 기록에는 키가 없다', () => {
    const list = addObservation(
      [],
      { classId: 'c', studentId: 's', text: '학습 태도 상담', kind: 'counsel', followUpDate: '2026-09-21' },
      NOW,
    );
    expect(list[0]).toMatchObject({ kind: 'counsel', followUpDate: '2026-09-21', date: '2026-09-07' });

    const plain = addObservation([], { classId: 'c', studentId: 's', text: '발표 잘함' }, NOW);
    expect(plain[0]).not.toHaveProperty('kind');
    expect(plain[0]).not.toHaveProperty('followUpDate');
  });

  it('다음 상담은 오늘 이후 가장 가까운 것 — 지난 것은 세지 않는다', () => {
    let list = addObservation([], { classId: 'c', studentId: 's', text: '1차', kind: 'counsel', followUpDate: '2026-09-01' }, NOW);
    list = addObservation(list, { classId: 'c', studentId: 's', text: '2차', kind: 'counsel', followUpDate: '2026-09-21' }, NOW);
    list = addObservation(list, { classId: 'c', studentId: 's', text: '3차', kind: 'counsel', followUpDate: '2026-09-10' }, NOW);
    list = addObservation(list, { classId: 'c', studentId: 'other', text: '남', kind: 'counsel', followUpDate: '2026-09-08' }, NOW);

    expect(nextCounsel(list, 's', '2026-09-07')).toMatchObject({ date: '2026-09-10', days: 3 });
    expect(nextCounsel(list, 's', '2026-09-22')).toBeNull();
    expect(nextCounsel([], 's', '2026-09-07')).toBeNull();
  });
});
