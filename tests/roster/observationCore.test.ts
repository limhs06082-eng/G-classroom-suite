import { describe, expect, it } from 'vitest';

import {
  addObservation,
  observationsOf,
  removeObservation,
} from '../../src/shared/roster/observationCore';

const NOW = '2026-08-29T09:00:00.000Z';

describe('관찰 기록', () => {
  it('빈 글은 더하지 않는다', () => {
    expect(addObservation([], { classId: 'c', studentId: 's', text: '   ' }, NOW)).toEqual([]);
  });

  it('그 학생 것만 최신 날짜부터 돌려준다', () => {
    let list = addObservation([], { classId: 'c', studentId: 's-1', text: '첫 기록', date: '2026-08-01' }, NOW);
    list = addObservation(list, { classId: 'c', studentId: 's-1', text: '둘째 기록', date: '2026-08-20' }, NOW);
    list = addObservation(list, { classId: 'c', studentId: 's-2', text: '남의 기록', date: '2026-08-10' }, NOW);

    const mine = observationsOf(list, 's-1');

    expect(mine.map((entry) => entry.text)).toEqual(['둘째 기록', '첫 기록']);
  });

  it('지우면 그 기록만 사라진다', () => {
    const list = addObservation([], { classId: 'c', studentId: 's-1', text: '기록' }, NOW);
    const id = list[0]?.id ?? '';

    expect(removeObservation(list, id)).toEqual([]);
  });
});
