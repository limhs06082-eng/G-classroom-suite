
import { describe, expect, it } from 'vitest';

import { validateAndRepair } from '../../src/shared/domain/invariants';
import {
  addClassRoom,
  countClassData,
  deleteClassRoom,
  updateClassRoom,
  addTerm,
  setTermArchived,
  updateTerm,
  visibleTerms,
} from '../../src/shared/roster/classOps';
import {
  createClassRoom,
  createDutyProfile,
  createEmptySuiteData,
  createRewardProfile,
  createSeatingProfile,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';

const NOW = '2026-08-14T09:00:00.000Z';

/**
 * 학급 둘에 자료가 골고루 든 상태.
 * 한쪽을 지웠을 때 다른 쪽이 멀쩡한지 봐야 하므로 둘 다 채운다.
 */
function seeded(): { data: SuiteData; mineId: string; otherId: string; studentId: string } {
  const term = createTerm(
    { schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    NOW,
  );
  const mine = createClassRoom({ termId: term.id, name: '우리 반' }, NOW);
  const other = createClassRoom({ termId: term.id, name: '옆 반' }, NOW);

  const a = createStudent({ classId: mine.id, number: 1, name: '김하나' }, NOW);
  const b = createStudent({ classId: other.id, number: 1, name: '이두리' }, NOW);

  const data: SuiteData = {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [mine, other],
    students: [a, b],
    seatingProfiles: [createSeatingProfile(a.id), createSeatingProfile(b.id)],
    dutyProfiles: [createDutyProfile(a.id, 1), createDutyProfile(b.id, 1)],
    rewardProfiles: [createRewardProfile(a.id), createRewardProfile(b.id)],
    groups: [
      { id: 'g-mine', classId: mine.id, name: '1모둠', color: 'blue', studentIds: [a.id], leaderId: null, createdAt: NOW, updatedAt: NOW },
      { id: 'g-other', classId: other.id, name: '1모둠', color: 'blue', studentIds: [b.id], leaderId: null, createdAt: NOW, updatedAt: NOW },
    ],
    seatingStates: [
      { classId: mine.id, rows: 4, cols: 5, disabledSeatIds: [], positions: [], perspective: 'student', updatedAt: NOW },
      { classId: other.id, rows: 4, cols: 5, disabledSeatIds: [], positions: [], perspective: 'student', updatedAt: NOW },
    ],
    savedLayouts: [
      { id: 'sl-mine', classId: mine.id, name: '3월 자리', rows: 4, cols: 5, disabledSeatIds: [], positions: [], createdAt: NOW },
      { id: 'sl-other', classId: other.id, name: '3월 자리', rows: 4, cols: 5, disabledSeatIds: [], positions: [], createdAt: NOW },
    ],
    dutyRoles: [
      { id: 'r-mine', classId: mine.id, name: '칠판', category: '기타', description: '', neededCount: 1, cycle: 'weekly', activeDays: [1], isActive: true, fixedStudentIds: [], excludedStudentIds: [], createdAt: NOW, updatedAt: NOW },
      { id: 'r-other', classId: other.id, name: '칠판', category: '기타', description: '', neededCount: 1, cycle: 'weekly', activeDays: [1], isActive: true, fixedStudentIds: [], excludedStudentIds: [], createdAt: NOW, updatedAt: NOW },
    ],
    dutyRounds: [
      { id: 'dr-mine', classId: mine.id, startDate: '2026-08-10', endDate: '2026-08-14', label: '1주', status: 'active', assignments: [], lockedRoleIds: [], createdAt: NOW, updatedAt: NOW },
    ],
    dutyCompletions: [{ classId: mine.id, date: '2026-08-14', completed: [], substitutions: [] }],
    behaviorPresets: [
      { id: 'bp-mine', classId: mine.id, name: '칭찬', defaultPoints: 1, targetUnit: 'student', color: 'blue', isActive: true, order: 0, createdAt: NOW },
    ],
    scoreEntries: [
      { id: 'se-mine', classId: mine.id, occurredAt: NOW, targetUnit: 'student', targetId: a.id, points: 1, reason: '칭찬', presetId: 'bp-mine' },
    ],
    scoreGoals: [
      { id: 'sg-mine', classId: mine.id, title: '목표', targetUnit: 'class', targetId: mine.id, targetPoints: 100, reward: '', startDate: '2026-08-01', createdAt: NOW },
    ],
    assignments: [
      { id: 'as-mine', classId: mine.id, title: '과제', description: '', dueDate: '2026-08-20', status: 'active', createdAt: NOW, updatedAt: NOW },
    ],
    submissions: [{ assignmentId: 'as-mine', studentId: a.id, status: 'submitted', note: '', updatedAt: NOW }],
    timetableEntries: [{ classId: mine.id, weekday: 1, period: 1, subject: '국어' }],
    attendanceRecords: [
      { classId: mine.id, date: '2026-08-14', entries: [{ studentId: a.id, status: 'absent', note: '' }] },
    ],
    notices: [{ classId: mine.id, date: '2026-08-14', items: [{ id: 'ni-1', text: '준비물: 색연필' }] }],
    timetableOverrides: [{ classId: mine.id, date: '2026-08-14', period: 1, subject: '체육' }],
    rewardItems: [
      { id: 'ri-mine', classId: mine.id, name: '자리 선택권', cost: 10, isActive: true, order: 0, createdAt: NOW },
    ],
    redemptions: [
      { id: 'rd-mine', classId: mine.id, occurredAt: NOW, targetUnit: 'student', targetId: a.id, itemName: '자리 선택권', cost: 10 },
    ],
    observations: [
      { id: 'ob-mine', classId: mine.id, studentId: a.id, date: '2026-08-14', text: '발표를 잘했다', createdAt: NOW },
    ],
    classEvents: [
      { id: 'ev-mine', classId: mine.id, date: '2026-08-20', title: '현장학습', note: '', createdAt: NOW },
    ],
    activeTermId: term.id,
    activeClassId: mine.id,
  };

  return { data, mineId: mine.id, otherId: other.id, studentId: a.id };
}

describe('countClassData', () => {
  it('그 학급에 딸린 자료를 센다', () => {
    const { data, mineId } = seeded();

    expect(countClassData(data, mineId)).toEqual({
      students: 1,
      groups: 1,
      seatingStates: 1,
      savedLayouts: 1,
      seatingProfiles: 1,
      dutyProfiles: 1,
      rewardProfiles: 1,
      dutyRoles: 1,
      dutyRounds: 1,
      dutyCompletions: 1,
      behaviorPresets: 1,
      scoreEntries: 1,
      scoreGoals: 1,
      assignments: 1,
      submissions: 1,
      timetableEntries: 1,
      attendanceRecords: 1,
      notices: 1,
      timetableOverrides: 1,
      rewardItems: 1,
      redemptions: 1,
      observations: 1,
      classEvents: 1,
    });
  });

  it('다른 학급 것은 세지 않는다', () => {
    const { data, otherId } = seeded();
    const count = countClassData(data, otherId);

    expect(count.students).toBe(1);
    expect(count.dutyRounds).toBe(0);
    expect(count.scoreEntries).toBe(0);
  });
});

describe('deleteClassRoom', () => {
  it('23개 배열에서 그 학급 것이 함께 사라진다', () => {
    const { data, mineId } = seeded();

    const next = deleteClassRoom(data, mineId);

    expect(countClassData(next, mineId)).toEqual({
      students: 0,
      groups: 0,
      seatingStates: 0,
      savedLayouts: 0,
      seatingProfiles: 0,
      dutyProfiles: 0,
      rewardProfiles: 0,
      dutyRoles: 0,
      dutyRounds: 0,
      dutyCompletions: 0,
      behaviorPresets: 0,
      scoreEntries: 0,
      scoreGoals: 0,
      assignments: 0,
      submissions: 0,
      timetableEntries: 0,
      attendanceRecords: 0,
      notices: 0,
      timetableOverrides: 0,
      rewardItems: 0,
      redemptions: 0,
      observations: 0,
      classEvents: 0,
    });
    expect(next.classRooms.some((room) => room.id === mineId)).toBe(false);
  });

  it('다른 학급 자료는 하나도 건드리지 않는다', () => {
    const { data, mineId, otherId } = seeded();

    const next = deleteClassRoom(data, mineId);

    expect(countClassData(next, otherId)).toEqual(countClassData(data, otherId));
  });

  it('지운 뒤 불변조건 검사가 아무것도 고치지 않는다', () => {
    /*
     * 이 테스트가 14개 중 하나를 빠뜨린 것을 잡는다.
     * 고아가 남으면 검사가 정리하면서 복구 기록을 남긴다.
     */
    const { data, mineId } = seeded();

    const { repairs } = validateAndRepair(deleteClassRoom(data, mineId));

    expect(repairs).toEqual([]);
  });

  it('마지막 학급은 지우지 않는다', () => {
    const { data, mineId, otherId } = seeded();
    const oneLeft = deleteClassRoom(data, otherId);

    expect(deleteClassRoom(oneLeft, mineId)).toBe(oneLeft);
  });

  it('활성 학급을 지우면 남은 학급으로 옮겨 간다', () => {
    const { data, mineId, otherId } = seeded();

    const next = deleteClassRoom(data, mineId);

    expect(next.activeClassId).toBe(otherId);
  });

  it('없는 학급이면 아무것도 바꾸지 않는다', () => {
    const { data } = seeded();

    expect(deleteClassRoom(data, '없는학급')).toBe(data);
  });
});

describe('addClassRoom', () => {
  it('학년·반을 안 넣어도 만들어진다', () => {
    const { data } = seeded();

    const next = addClassRoom(data, { termId: data.terms[0]?.id ?? '', name: '3학년 3반' }, NOW);
    const made = next.classRooms.at(-1);

    expect(made?.name).toBe('3학년 3반');
    expect(next.classRooms).toHaveLength(3);
  });

  it('빈 이름은 만들지 않는다', () => {
    const { data } = seeded();

    expect(addClassRoom(data, { termId: data.terms[0]?.id ?? '', name: '   ' }, NOW)).toBe(data);
  });

  it('없는 학기면 만들지 않는다', () => {
    const { data } = seeded();

    expect(addClassRoom(data, { termId: '없는학기', name: '3학년 3반' }, NOW)).toBe(data);
  });
});

describe('updateClassRoom', () => {
  it('이름과 학년·반을 고친다', () => {
    const { data, mineId } = seeded();

    const next = updateClassRoom(data, mineId, { name: '4학년 1반', grade: 4, classNo: 1 }, NOW);
    const room = next.classRooms.find((r) => r.id === mineId);

    expect(room?.name).toBe('4학년 1반');
    expect(room?.grade).toBe(4);
    expect(room?.classNo).toBe(1);
  });

  it('빈 이름으로는 고치지 않는다', () => {
    const { data, mineId } = seeded();

    const next = updateClassRoom(data, mineId, { name: '  ' }, NOW);

    expect(next.classRooms.find((r) => r.id === mineId)?.name).toBe('우리 반');
  });
});

describe('학기', () => {
  it('새 학기를 만든다', () => {
    const { data } = seeded();

    const next = addTerm(
      { ...data },
      { schoolYear: '2027', semester: '1학기', startDate: '2027-03-02', endDate: '2027-07-20' },
      NOW,
    );

    expect(next.terms).toHaveLength(2);
    expect(next.terms.at(-1)?.schoolYear).toBe('2027');
  });

  it('활성 학기는 보관하지 않는다', () => {
    // 지금 쓰는 학기를 치우면 화면이 빈 상태가 된다.
    const { data } = seeded();
    const termId = data.terms[0]?.id ?? '';

    expect(setTermArchived(data, termId, true, NOW)).toBe(data);
  });

  it('활성이 아닌 학기는 보관하고 되돌릴 수 있다', () => {
    const { data } = seeded();
    const withSecond = addTerm(
      data,
      { schoolYear: '2027', semester: '1학기', startDate: '2027-03-02', endDate: '2027-07-20' },
      NOW,
    );
    const secondId = withSecond.terms.at(-1)?.id ?? '';

    const archived = setTermArchived(withSecond, secondId, true, NOW);
    expect(archived.terms.find((term) => term.id === secondId)?.archivedAt).toBe(NOW);
    expect(visibleTerms(archived).map((term) => term.id)).not.toContain(secondId);

    const back = setTermArchived(archived, secondId, false, NOW);
    expect(back.terms.find((term) => term.id === secondId)?.archivedAt).toBeUndefined();
    expect(visibleTerms(back).map((term) => term.id)).toContain(secondId);
  });

  it('학기 이름과 기간을 고친다', () => {
    const { data } = seeded();
    const termId = data.terms[0]?.id ?? '';

    const next = updateTerm(data, termId, { name: '고친 이름', endDate: '2026-08-31' }, NOW);
    const term = next.terms.find((term) => term.id === termId);

    expect(term?.name).toBe('고친 이름');
    expect(term?.endDate).toBe('2026-08-31');
  });
});

describe('학급을 지울 때 시간표', () => {
  function withTimetable() {
    const { data, mineId, otherId, studentId } = seeded();
    return {
      mineId,
      otherId,
      studentId,
      data: {
        ...data,
        timetableEntries: [
          { classId: mineId, weekday: 1, period: 1, subject: '국어' },
          { classId: mineId, weekday: 1, period: 2, subject: '수학' },
          { classId: otherId, weekday: 1, period: 1, subject: '영어' },
        ],
      },
    };
  }

  it('세는 항목에 들어간다', () => {
    const { data, mineId } = withTimetable();

    /*
     * classOps 머리말이 못 박아 둔 규칙이다 — 세는 항목과 지우는 항목은
     * 반드시 같아야 한다. 어긋나면 교사가 못 본 자료가 사라진다.
     */
    expect(countClassData(data, mineId).timetableEntries).toBe(2);
  });

  it('학급을 지우면 그 학급 시간표만 사라진다', () => {
    const { data, mineId, otherId } = withTimetable();

    const after = deleteClassRoom(data, mineId);

    expect(after.timetableEntries).toEqual([
      { classId: otherId, weekday: 1, period: 1, subject: '영어' },
    ]);
  });

  it('연쇄에서 빠져도 불변식이 그물이 된다', () => {
    const { data, mineId, otherId } = withTimetable();
    // 학급만 지우고 시간표를 안 지운 상태를 손으로 만든다.
    const broken: SuiteData = {
      ...data,
      classRooms: data.classRooms.filter((room) => room.id !== mineId),
      activeClassId: otherId,
    };

    const result = validateAndRepair(broken, NOW);

    // 서른다섯 칸이 백업 파일에 영영 남는 것을 막는 마지막 그물이다.
    expect(result.data.timetableEntries).toHaveLength(1);
    expect(result.repairs.some((r) => r.code === 'ORPHAN_TIMETABLE')).toBe(true);
  });
});
