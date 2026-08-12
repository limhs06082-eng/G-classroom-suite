import { describe, expect, it } from 'vitest';

import {
  createClassRoom,
  createEmptySuiteData,
  createSeatingState,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import { validateAndRepair } from '../../src/shared/domain/invariants';
import type { StudentPosition, SuiteData } from '../../src/shared/domain/types';

const NOW = '2026-03-02T09:00:00.000Z';
const EARLIER = '2026-03-01T09:00:00.000Z';

function baseData(positions: StudentPosition[] = []): SuiteData {
  const state = createSeatingState('class-1', EARLIER);

  return {
    ...createEmptySuiteData(),
    terms: [
      createTerm(
        { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
        EARLIER,
      ),
    ],
    classRooms: [createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, EARLIER)],
    students: [
      createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' }, EARLIER),
      createStudent({ id: 'stu-2', classId: 'class-1', number: 2, name: '이두리' }, EARLIER),
    ],
    seatingStates: [{ ...state, positions }],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

const positionsOf = (data: SuiteData): StudentPosition[] => data.seatingStates[0]?.positions ?? [];
const codes = (data: ReturnType<typeof validateAndRepair>): string[] => data.repairs.map((r) => r.code);

describe('자리 배치 불변조건', () => {
  it('올바른 배치는 건드리지 않는다', () => {
    const result = validateAndRepair(
      baseData([
        { studentId: 'stu-1', seatId: 'r1c1' },
        { studentId: 'stu-2', seatId: 'r2c3' },
      ]),
      NOW,
    );

    expect(result.repairs).toEqual([]);
    expect(positionsOf(result.data)).toHaveLength(2);
  });

  it('없는 학급의 배치는 정리한다', () => {
    const data = baseData();
    data.seatingStates = [createSeatingState('class-gone', EARLIER)];

    const result = validateAndRepair(data, NOW);

    expect(codes(result)).toContain('ORPHAN_SEATING_STATE');
    expect(result.data.seatingStates).toHaveLength(0);
  });

  it('없는 학생을 가리키는 자리를 비운다', () => {
    const result = validateAndRepair(
      baseData([
        { studentId: 'stu-1', seatId: 'r1c1' },
        { studentId: 'ghost', seatId: 'r1c2' },
      ]),
      NOW,
    );

    expect(codes(result)).toContain('INVALID_SEAT_POSITION');
    expect(positionsOf(result.data)).toEqual([{ studentId: 'stu-1', seatId: 'r1c1' }]);
  });

  it('다른 반 학생이 이 교실에 앉아 있으면 비운다', () => {
    const data = baseData([{ studentId: 'stu-9', seatId: 'r1c1' }]);
    data.classRooms.push(createClassRoom({ id: 'class-2', termId: 'term-1', name: '3학년 3반' }, EARLIER));
    data.students.push(createStudent({ id: 'stu-9', classId: 'class-2', number: 1, name: '남의반' }, EARLIER));

    const result = validateAndRepair(data, NOW);

    expect(codes(result)).toContain('INVALID_SEAT_POSITION');
    expect(positionsOf(result.data)).toEqual([]);
  });

  it('교실 밖 좌석을 비운다', () => {
    // 교사가 교실을 줄이면 바깥에 남은 학생이 화면에서 사라져 버린다.
    const result = validateAndRepair(
      baseData([
        { studentId: 'stu-1', seatId: 'r99c1' },
        { studentId: 'stu-2', seatId: 'r1c1' },
      ]),
      NOW,
    );

    expect(codes(result)).toContain('INVALID_SEAT_POSITION');
    expect(positionsOf(result.data)).toEqual([{ studentId: 'stu-2', seatId: 'r1c1' }]);
  });

  it('형식이 깨진 좌석 id를 비운다', () => {
    const result = validateAndRepair(baseData([{ studentId: 'stu-1', seatId: '어딘가' }]), NOW);

    expect(codes(result)).toContain('INVALID_SEAT_POSITION');
    expect(positionsOf(result.data)).toEqual([]);
  });

  it('사용 안 함으로 둔 자리에 앉은 학생을 비운다', () => {
    const data = baseData([{ studentId: 'stu-1', seatId: 'r1c1' }]);
    data.seatingStates[0]!.disabledSeatIds = ['r1c1'];

    const result = validateAndRepair(data, NOW);

    expect(codes(result)).toContain('INVALID_SEAT_POSITION');
    expect(positionsOf(result.data)).toEqual([]);
  });

  it('두 학생이 같은 자리에 앉아 있으면 한 명만 남긴다', () => {
    // 겹쳐 그려지면 교실 그림에서 한 명이 보이지 않는다.
    const result = validateAndRepair(
      baseData([
        { studentId: 'stu-1', seatId: 'r1c1' },
        { studentId: 'stu-2', seatId: 'r1c1' },
      ]),
      NOW,
    );

    expect(codes(result)).toContain('INVALID_SEAT_POSITION');
    expect(positionsOf(result.data)).toEqual([{ studentId: 'stu-1', seatId: 'r1c1' }]);
  });

  it('한 학생이 두 자리를 차지하면 첫 자리만 남긴다', () => {
    const result = validateAndRepair(
      baseData([
        { studentId: 'stu-1', seatId: 'r1c1' },
        { studentId: 'stu-1', seatId: 'r2c2' },
      ]),
      NOW,
    );

    expect(codes(result)).toContain('INVALID_SEAT_POSITION');
    expect(positionsOf(result.data)).toEqual([{ studentId: 'stu-1', seatId: 'r1c1' }]);
  });

  it('복구 결과를 다시 검사하면 더 고칠 것이 없다', () => {
    const first = validateAndRepair(
      baseData([
        { studentId: 'ghost', seatId: 'r1c1' },
        { studentId: 'stu-1', seatId: 'r99c9' },
        { studentId: 'stu-2', seatId: 'r1c2' },
      ]),
      NOW,
    );

    expect(first.repairs.length).toBeGreaterThan(0);
    expect(validateAndRepair(first.data, NOW).repairs).toEqual([]);
  });
});
