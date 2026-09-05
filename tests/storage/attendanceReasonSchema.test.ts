import { describe, expect, it } from 'vitest';

import {
  createClassRoom,
  createEmptySuiteData,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import { parseSuiteData, serializeSuiteData } from '../../src/shared/storage/schema';

const NOW = '2026-03-02T09:00:00.000Z';

describe('출결 사유 분류 스키마', () => {
  it('분류는 왕복하고, 모르는 분류는 항목은 두고 분류만 버린다', () => {
    // 학급·학생이 없는 기록은 고아로 정리되므로 진짜 학급을 세워 둔다.
    const term = createTerm(
      { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
      NOW,
    );
    const room = createClassRoom({ id: 'class-1', termId: 'term-1', name: '우리 반' }, NOW);
    const raw = {
      ...createEmptySuiteData(),
      terms: [term],
      classRooms: [room],
      students: ['stu-1', 'stu-2', 'stu-3'].map((id, index) =>
        createStudent({ id, classId: 'class-1', number: index + 1, name: `학생${index + 1}` }, NOW),
      ),
      activeTermId: 'term-1',
      activeClassId: 'class-1',
      attendanceRecords: [
        {
          classId: 'class-1',
          date: '2026-03-05',
          entries: [
            { studentId: 'stu-1', status: 'absent', note: '병원', reason: 'illness' },
            { studentId: 'stu-2', status: 'late', note: '', reason: 'bogus' },
            { studentId: 'stu-3', status: 'early', note: '' },
          ],
        },
      ],
    };

    const { data: parsed } = parseSuiteData(JSON.parse(serializeSuiteData(parseSuiteData(raw).data)));
    const entries = parsed.attendanceRecords[0]?.entries ?? [];

    expect(entries).toEqual([
      { studentId: 'stu-1', status: 'absent', note: '병원', reason: 'illness' },
      { studentId: 'stu-2', status: 'late', note: '' },
      { studentId: 'stu-3', status: 'early', note: '' },
    ]);
  });
});
