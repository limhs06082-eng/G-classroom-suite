import { describe, expect, it } from 'vitest';

import {
  createClassRoom,
  createEmptySuiteData,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import { parseSuiteData, serializeSuiteData } from '../../src/shared/storage/schema';

const NOW = '2026-03-02T09:00:00.000Z';

describe('생일·샘플 표시 스키마', () => {
  it('생일은 왕복하고, 날짜 꼴이 아니면 버린다. 샘플 표시도 왕복한다', () => {
    const term = createTerm(
      { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2027-02-28', isSample: true },
      NOW,
    );
    const room = createClassRoom({ id: 'class-1', termId: 'term-1', name: '샘플 반', isSample: true }, NOW);
    const raw = {
      ...createEmptySuiteData(),
      terms: [term],
      classRooms: [room],
      students: [
        createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나', birthday: '2015-09-07' }, NOW),
        { ...createStudent({ id: 'stu-2', classId: 'class-1', number: 2, name: '이두리' }, NOW), birthday: '9월 7일' },
      ],
      activeTermId: 'term-1',
      activeClassId: 'class-1',
    };

    const { data: parsed } = parseSuiteData(JSON.parse(serializeSuiteData(raw)));

    expect(parsed.students[0]?.birthday).toBe('2015-09-07');
    expect(parsed.students[1]).not.toHaveProperty('birthday');
    expect(parsed.classRooms[0]?.isSample).toBe(true);
    expect(parsed.terms[0]?.isSample).toBe(true);
  });

  it('표시가 없으면 키 자체가 없다', () => {
    const { data: parsed } = parseSuiteData({
      ...createEmptySuiteData(),
      terms: [createTerm({ id: 't', schoolYear: '2026', semester: '1학기', startDate: '', endDate: '' }, NOW)],
      classRooms: [createClassRoom({ id: 'c', termId: 't', name: '반' }, NOW)],
    });

    expect(parsed.classRooms[0]).not.toHaveProperty('isSample');
    expect(parsed.terms[0]).not.toHaveProperty('isSample');
  });
});
