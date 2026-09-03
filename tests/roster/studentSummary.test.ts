import { describe, expect, it } from 'vitest';

import {
  createAssignment,
  createClassRoom,
  createEmptySuiteData,
  createObservation,
  createRedemption,
  createScoreEntry,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { summarizeStudent } from '../../src/shared/roster/studentSummary';

const NOW = '2026-08-29T09:00:00.000Z';
const EARLIER = '2026-03-01T00:00:00.000Z';

function seeded(): SuiteData {
  const term = createTerm(
    { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    EARLIER,
  );
  const room = createClassRoom({ id: 'class-1', termId: term.id, name: '3학년 2반' }, EARLIER);
  const a = createStudent({ id: 'stu-1', classId: room.id, number: 1, name: '김하나' }, EARLIER);
  const b = createStudent({ id: 'stu-2', classId: room.id, number: 2, name: '이두리' }, EARLIER);

  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room],
    students: [a, b],
    activeTermId: term.id,
    activeClassId: room.id,
    attendanceRecords: [
      { classId: room.id, date: '2026-08-10', entries: [{ studentId: a.id, status: 'absent', note: '감기' }] },
      {
        classId: room.id,
        date: '2026-08-12',
        entries: [
          { studentId: a.id, status: 'late', note: '' },
          { studentId: b.id, status: 'absent', note: '' },
        ],
      },
    ],
    scoreEntries: [
      createScoreEntry({ id: 'e-1', classId: room.id, targetUnit: 'student', targetId: a.id, points: 10, reason: '' }, EARLIER),
      {
        ...createScoreEntry({ id: 'e-2', classId: room.id, targetUnit: 'student', targetId: a.id, points: 50, reason: '' }, EARLIER),
        revokedAt: NOW,
      },
      createScoreEntry({ id: 'e-3', classId: room.id, targetUnit: 'student', targetId: b.id, points: 7, reason: '' }, EARLIER),
    ],
    redemptions: [
      createRedemption({ id: 'r-1', classId: room.id, targetUnit: 'student', targetId: a.id, itemName: '자리 선택권', cost: 4 }, EARLIER),
    ],
    assignments: [
      createAssignment({ id: 'as-1', classId: room.id, title: '독서록', dueDate: '2026-08-20' }, EARLIER),
      createAssignment({ id: 'as-2', classId: room.id, title: '일기', dueDate: '' }, EARLIER),
      createAssignment({ id: 'as-3', classId: room.id, title: '보관됨', status: 'archived' }, EARLIER),
    ],
    submissions: [{ assignmentId: 'as-1', studentId: a.id, status: 'submitted', note: '', updatedAt: NOW }],
    dutyRounds: [
      { id: 'dr-1', classId: room.id, startDate: '2026-08-03', endDate: '2026-08-07', label: '1주', status: 'ended', assignments: [{ roleId: 'role', studentIds: [a.id] }], lockedRoleIds: [], createdAt: EARLIER, updatedAt: EARLIER },
      { id: 'dr-2', classId: room.id, startDate: '2026-08-10', endDate: '2026-08-14', label: '2주', status: 'ended', assignments: [{ roleId: 'role', studentIds: [a.id, b.id] }], lockedRoleIds: [], createdAt: EARLIER, updatedAt: EARLIER },
    ],
    observations: [
      createObservation({ id: 'ob-1', classId: room.id, studentId: a.id, text: '발표를 잘했다', date: '2026-08-01' }, EARLIER),
      createObservation({ id: 'ob-2', classId: room.id, studentId: b.id, text: '남의 것', date: '2026-08-02' }, EARLIER),
    ],
  };
}

describe('summarizeStudent', () => {
  it('없는 학생은 null', () => {
    expect(summarizeStudent(seeded(), 'ghost')).toBeNull();
  });

  it('출결·점수·과제·당번·관찰을 그 학생 것만 모은다', () => {
    const summary = summarizeStudent(seeded(), 'stu-1');
    expect(summary).not.toBeNull();
    if (summary === null) return;

    expect(summary.attendance.byStatus).toEqual({ absent: 1, late: 1, early: 0, fieldTrip: 0 });
    expect(summary.attendance.dates.map((d) => d.date)).toEqual(['2026-08-12', '2026-08-10']);
    expect(summary.attendance.dates[1]?.note).toBe('감기');

    // 되돌린 50점은 빠지고, 쿠폰 4점을 썼다.
    expect(summary.reward.earned).toBe(10);
    expect(summary.reward.spent).toBe(4);
    expect(summary.reward.balance).toBe(6);

    // 보관된 과제는 세지 않는다. 독서록 제출, 일기 미제출.
    expect(summary.assignments.total).toBe(2);
    expect(summary.assignments.submitted).toBe(1);
    expect(summary.assignments.missing.map((a) => a.id)).toEqual(['as-2']);

    expect(summary.dutyCount).toBe(2);
    expect(summary.observations.map((o) => o.id)).toEqual(['ob-1']);
  });
});
