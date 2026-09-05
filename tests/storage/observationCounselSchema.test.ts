import { describe, expect, it } from 'vitest';

import {
  createClassRoom,
  createEmptySuiteData,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import { parseSuiteData, serializeSuiteData } from '../../src/shared/storage/schema';

const NOW = '2026-03-02T09:00:00.000Z';

describe('상담 기록 스키마', () => {
  it('상담 표시와 다음 상담 날짜는 왕복하고, 모르는 종류는 버린다', () => {
    const term = createTerm(
      { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
      NOW,
    );
    const room = createClassRoom({ id: 'class-1', termId: 'term-1', name: '반' }, NOW);
    const raw = {
      ...createEmptySuiteData(),
      terms: [term],
      classRooms: [room],
      students: [createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' }, NOW)],
      activeTermId: 'term-1',
      activeClassId: 'class-1',
      observations: [
        { id: 'o-1', classId: 'class-1', studentId: 'stu-1', date: '2026-04-01', text: '상담', createdAt: NOW, kind: 'counsel', followUpDate: '2026-04-15' },
        { id: 'o-2', classId: 'class-1', studentId: 'stu-1', date: '2026-04-02', text: '보통', createdAt: NOW, kind: 'bogus', followUpDate: '언젠가' },
      ],
    };

    const { data: parsed } = parseSuiteData(JSON.parse(serializeSuiteData(parseSuiteData(raw).data)));

    expect(parsed.observations.find((o) => o.id === 'o-1')).toMatchObject({ kind: 'counsel', followUpDate: '2026-04-15' });
    const plain = parsed.observations.find((o) => o.id === 'o-2');
    expect(plain).not.toHaveProperty('kind');
    expect(plain).not.toHaveProperty('followUpDate');
  });
});
