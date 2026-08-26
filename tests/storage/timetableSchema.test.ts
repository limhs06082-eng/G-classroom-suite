import { describe, expect, it } from 'vitest';

import {
  createClassRoom,
  createEmptySuiteData,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { parseSuiteData, serializeSuiteData } from '../../src/shared/storage/schema';

const NOW = '2026-08-26T09:00:00.000Z';

/*
 * 학급이 실제로 있어야 한다. 없는 학급을 가리키는 칸은 불변조건 검사가
 * 고아로 보고 치운다(invariants.ts의 8-2c). 자리표와 같은 규칙이다.
 * 학급을 안 두면 여기 시험이 '고아라서 비었다'를 '잘 담겼다'로 착각한다.
 */
function withClass(): SuiteData {
  const term = createTerm(
    {
      id: 'term-1',
      schoolYear: '2026',
      semester: '2학기',
      startDate: '2026-08-17',
      endDate: '2027-01-05',
    },
    NOW,
  );
  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [createClassRoom({ id: 'class-1', termId: term.id, name: '3학년 2반' }, NOW)],
    activeTermId: term.id,
    activeClassId: 'class-1',
  };
}

/*
 * 시간표는 학급 자료다. 백업 파일에 안 들어가면 컴퓨터를 바꾼 교사가
 * 서른다섯 칸을 다시 채워야 한다. 왕복이 되는지부터 못 박는다.
 */
describe('시간표 저장·복원', () => {
  it('담은 칸이 그대로 돌아온다', () => {
    const data = withClass();
    data.timetableEntries = [
      { classId: 'class-1', weekday: 1, period: 3, subject: '수학' },
      { classId: 'class-1', weekday: 5, period: 1, subject: '즐거운생활' },
    ];

    // parseSuiteData는 글자가 아니라 이미 JSON.parse된 값을 받는다.
    const back = parseSuiteData(JSON.parse(serializeSuiteData(data)), NOW);

    expect(back.data.timetableEntries).toEqual(data.timetableEntries);
  });

  it('시간표 칸이 없는 옛 자료도 열린다', () => {
    // 2-가까지 쓰던 백업 파일에는 이 칸이 아예 없다.
    const old = JSON.parse(serializeSuiteData(withClass())) as Record<string, unknown>;
    delete old['timetableEntries'];

    const back = parseSuiteData(old, NOW);

    expect(back.data.timetableEntries).toEqual([]);
  });

  it('망가진 칸은 버리고 나머지를 살린다', () => {
    const raw = JSON.parse(serializeSuiteData(withClass())) as Record<string, unknown>;
    raw['timetableEntries'] = [
      { classId: 'class-1', weekday: 1, period: 1, subject: '국어' },
      { weekday: 2, period: 1, subject: '학급이 없다' },
      { classId: 'class-1', period: 1, subject: '요일이 없다' },
      '글자가 왔다',
    ];

    const back = parseSuiteData(raw, NOW);

    // 한 칸이 망가졌다고 시간표 전체를 버리면 안 된다.
    expect(back.data.timetableEntries).toEqual([
      { classId: 'class-1', weekday: 1, period: 1, subject: '국어' },
    ]);
    expect(back.repairs.some((repair) => repair.message.includes('시간표'))).toBe(true);
  });

  it('범위를 벗어난 교시·요일은 버린다', () => {
    const raw = JSON.parse(serializeSuiteData(withClass())) as Record<string, unknown>;
    raw['timetableEntries'] = [
      { classId: 'class-1', weekday: 6, period: 1, subject: '토요일' },
      { classId: 'class-1', weekday: 1, period: 8, subject: '8교시' },
      { classId: 'class-1', weekday: 1, period: 0, subject: '0교시' },
    ];

    // 화면은 1~5요일 × 1~7교시만 그린다. 벗어난 칸은 어디에도 안 나타나면서
    // 파일만 키우고, 나중에 범위를 넓히면 유령처럼 되살아난다.
    expect(parseSuiteData(raw, NOW).data.timetableEntries).toEqual([]);
  });
});
