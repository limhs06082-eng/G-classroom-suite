import { describe, expect, it } from 'vitest';

import {
  createClassRoom,
  createEmptySuiteData,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import { CURRENT_SCHEMA_VERSION } from '../../src/shared/domain/types';
import { parseSuiteData, serializeSuiteData } from '../../src/shared/storage/schema';

const NOW = '2026-03-02T09:00:00.000Z';

describe('행동특성 및 종합의견 스키마', () => {
  it('저장했다 읽으면 그대로고, 없는 학생 것은 정리된다', () => {
    const term = createTerm(
      { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
      NOW,
    );
    const room = createClassRoom({ id: 'class-1', termId: 'term-1', name: '우리 반' }, NOW);
    const data = {
      ...createEmptySuiteData(),
      terms: [term],
      classRooms: [room],
      students: [createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' }, NOW)],
      activeTermId: 'term-1',
      activeClassId: 'class-1',
      behaviorComments: [
        { id: 'bc-1', classId: 'class-1', studentId: 'stu-1', text: '성실함.', updatedAt: NOW },
        { id: 'bc-ghost', classId: 'class-1', studentId: 'ghost', text: '없는 학생', updatedAt: NOW },
      ],
    };

    const { data: parsed } = parseSuiteData(JSON.parse(serializeSuiteData(data)));

    expect(parsed.behaviorComments).toEqual([
      { id: 'bc-1', classId: 'class-1', studentId: 'stu-1', text: '성실함.', updatedAt: NOW },
    ]);
  });

  it('칸이 없는 옛 백업은 빈 목록으로, 알림 없이 열린다', () => {
    const { behaviorComments: _dropped, ...withoutComments } = createEmptySuiteData();

    const { data: parsed, repairs } = parseSuiteData(withoutComments);

    expect(parsed.behaviorComments).toEqual([]);
    expect(repairs).toEqual([]);
  });

  it('4판이다', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(4);
  });
});
