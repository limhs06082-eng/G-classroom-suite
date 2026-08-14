import { describe, expect, it } from 'vitest';

import {
  applyLayout,
  deleteLayout,
  layoutsOf,
  saveLayout,
} from '../../src/features/seating/layoutOps';
import {
  createClassRoom,
  createEmptySuiteData,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';

const NOW = '2026-08-14T09:00:00.000Z';
const LATER = '2026-08-15T09:00:00.000Z';

function seeded(): { data: SuiteData; classId: string; studentIds: string[] } {
  const term = createTerm(
    { schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    NOW,
  );
  const room = createClassRoom({ termId: term.id, name: '우리 반' }, NOW);
  const a = createStudent({ classId: room.id, number: 1, name: '김하나' }, NOW);
  const b = createStudent({ classId: room.id, number: 2, name: '이두리' }, NOW);

  const data: SuiteData = {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room],
    students: [a, b],
    seatingStates: [
      {
        classId: room.id,
        rows: 3,
        cols: 4,
        disabledSeatIds: ['r3c4'],
        positions: [
          { studentId: a.id, seatId: 'r1c1' },
          { studentId: b.id, seatId: 'r2c2' },
        ],
        perspective: 'teacher',
        updatedAt: NOW,
      },
    ],
    activeTermId: term.id,
    activeClassId: room.id,
  };

  return { data, classId: room.id, studentIds: [a.id, b.id] };
}

describe('saveLayout', () => {
  it('지금 배치를 이름 붙여 저장한다', () => {
    const { data, classId } = seeded();
    const next = saveLayout(data, classId, '3월 자리', LATER);

    expect(next.savedLayouts).toHaveLength(1);

    const layout = next.savedLayouts[0];
    expect(layout?.name).toBe('3월 자리');
    expect(layout?.rows).toBe(3);
    expect(layout?.cols).toBe(4);
    expect(layout?.disabledSeatIds).toEqual(['r3c4']);
    expect(layout?.positions).toHaveLength(2);
    expect(layout?.createdAt).toBe(LATER);
  });

  it('이름 앞뒤 공백은 다듬는다', () => {
    const { data, classId } = seeded();
    const next = saveLayout(data, classId, '  3월 자리  ', LATER);

    expect(next.savedLayouts[0]?.name).toBe('3월 자리');
  });

  it('이름이 비면 저장하지 않는다', () => {
    const { data, classId } = seeded();

    expect(saveLayout(data, classId, '   ', LATER)).toBe(data);
  });

  it('자리 배치를 한 적 없는 학급은 저장할 것이 없다', () => {
    const { data, classId } = seeded();
    const empty = { ...data, seatingStates: [] };

    expect(saveLayout(empty, classId, '3월 자리', LATER)).toBe(empty);
  });

  it('저장본은 원본과 배열을 공유하지 않는다', () => {
    const { data, classId } = seeded();
    const next = saveLayout(data, classId, '3월 자리', LATER);

    expect(next.savedLayouts[0]?.positions).not.toBe(next.seatingStates[0]?.positions);
    expect(next.savedLayouts[0]?.disabledSeatIds).not.toBe(
      next.seatingStates[0]?.disabledSeatIds,
    );
  });
});

describe('applyLayout', () => {
  it('저장한 자리와 교실 크기를 되돌린다', () => {
    const { data, classId } = seeded();
    const saved = saveLayout(data, classId, '3월 자리', LATER);
    const layoutId = saved.savedLayouts[0]?.id ?? '';

    // 저장 뒤 교실을 흩뜨려 놓는다.
    const messed: SuiteData = {
      ...saved,
      seatingStates: saved.seatingStates.map((state) => ({
        ...state,
        rows: 6,
        cols: 6,
        disabledSeatIds: [],
        positions: [],
      })),
    };

    const { data: restored, droppedStudents } = applyLayout(messed, layoutId, LATER);
    const state = restored.seatingStates[0];

    expect(droppedStudents).toBe(0);
    expect(state?.rows).toBe(3);
    expect(state?.cols).toBe(4);
    expect(state?.disabledSeatIds).toEqual(['r3c4']);
    expect(state?.positions).toHaveLength(2);
    expect(state?.updatedAt).toBe(LATER);
  });

  it('지금 명단에 없는 학생은 빼고 그 수를 알린다', () => {
    const { data, classId, studentIds } = seeded();
    const saved = saveLayout(data, classId, '3월 자리', LATER);
    const layoutId = saved.savedLayouts[0]?.id ?? '';

    // 이두리가 전학 갔다.
    const moved: SuiteData = {
      ...saved,
      students: saved.students.filter((student) => student.id !== studentIds[1]),
    };

    const { data: restored, droppedStudents } = applyLayout(moved, layoutId, LATER);

    expect(droppedStudents).toBe(1);
    expect(restored.seatingStates[0]?.positions).toHaveLength(1);
    expect(restored.seatingStates[0]?.positions[0]?.studentId).toBe(studentIds[0]);
  });

  it('재학 중이 아닌 학생도 자리에서 뺀다', () => {
    const { data, classId, studentIds } = seeded();
    const saved = saveLayout(data, classId, '3월 자리', LATER);
    const layoutId = saved.savedLayouts[0]?.id ?? '';

    const left: SuiteData = {
      ...saved,
      students: saved.students.map((student) =>
        student.id === studentIds[1] ? { ...student, status: 'inactive' as const } : student,
      ),
    };

    const { droppedStudents } = applyLayout(left, layoutId, LATER);

    expect(droppedStudents).toBe(1);
  });

  it('보는 방향은 자리표에 딸리지 않는다', () => {
    const { data, classId } = seeded();
    const saved = saveLayout(data, classId, '3월 자리', LATER);
    const layoutId = saved.savedLayouts[0]?.id ?? '';

    const { data: restored } = applyLayout(saved, layoutId, LATER);

    expect(restored.seatingStates[0]?.perspective).toBe('teacher');
  });

  it('없는 자리표를 부르면 아무것도 바뀌지 않는다', () => {
    const { data } = seeded();
    const { data: same, droppedStudents } = applyLayout(data, 'no-such-id', LATER);

    expect(same).toBe(data);
    expect(droppedStudents).toBe(0);
  });

  it('배치를 한 적 없는 학급에도 되돌릴 수 있다', () => {
    const { data, classId } = seeded();
    const saved = saveLayout(data, classId, '3월 자리', LATER);
    const layoutId = saved.savedLayouts[0]?.id ?? '';

    const blank: SuiteData = { ...saved, seatingStates: [] };
    const { data: restored } = applyLayout(blank, layoutId, LATER);

    expect(restored.seatingStates).toHaveLength(1);
    expect(restored.seatingStates[0]?.rows).toBe(3);
    expect(restored.seatingStates[0]?.perspective).toBe('student');
  });
});

describe('deleteLayout · layoutsOf', () => {
  it('지운 자리표만 사라진다', () => {
    const { data, classId } = seeded();
    const twice = saveLayout(saveLayout(data, classId, '3월', LATER), classId, '4월', LATER);
    const first = twice.savedLayouts[0]?.id ?? '';

    const next = deleteLayout(twice, first);

    expect(next.savedLayouts).toHaveLength(1);
    expect(next.savedLayouts[0]?.name).toBe('4월');
  });

  it('그 학급 자리표만 골라 준다', () => {
    const { data, classId } = seeded();
    const saved = saveLayout(data, classId, '3월', LATER);

    expect(layoutsOf(saved, classId)).toHaveLength(1);
    expect(layoutsOf(saved, 'other-class')).toHaveLength(0);
  });
});
