import { describe, expect, it } from 'vitest';

import { setStatus } from '../../src/features/attendance/attendanceCore';
import {
  createAssignment,
  createClassRoom,
  createEmptySuiteData,
  createObservation,
  createStudent,
  createSubmission,
  createTerm,
} from '../../src/shared/domain/factories';
import type { ScoreEntry, SuiteData } from '../../src/shared/domain/types';
import {
  commentOf,
  draftBehaviorComment,
  NEIS_COMMENT_LIMIT,
  upsertBehaviorComment,
} from '../../src/shared/roster/behaviorCommentCore';

const NOW = '2026-03-02T09:00:00.000Z';
const CLASS = 'class-1';
const RANGE = { from: '2026-03-02', to: '2026-07-20' };

function score(id: string, reason: string, points: number, extra: Partial<ScoreEntry> = {}): ScoreEntry {
  return {
    id,
    classId: CLASS,
    occurredAt: '2026-04-01T09:00:00.000Z',
    targetUnit: 'student',
    targetId: 'stu-1',
    points,
    reason,
    ...extra,
  };
}

function seeded(): SuiteData {
  const term = createTerm(
    { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: RANGE.from, endDate: RANGE.to },
    NOW,
  );
  const room = createClassRoom({ id: CLASS, termId: 'term-1', name: '우리 반' }, NOW);
  let attendanceRecords = setStatus([], CLASS, '2026-03-10', 'stu-2', 'absent'); // 출결을 쓰는 학급이다

  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room],
    students: [
      createStudent({ id: 'stu-1', classId: CLASS, number: 1, name: '김하나' }, NOW),
      createStudent({ id: 'stu-2', classId: CLASS, number: 2, name: '이두리' }, NOW),
    ],
    attendanceRecords,
    scoreEntries: [
      score('s-1', '도움 주기', 1),
      score('s-2', '도움 주기', 1),
      score('s-3', '도움 주기', 1),
      score('s-4', '정리 정돈', 1),
      score('s-5', '떠들기', -1), // 지도 기록은 초안에 넣지 않는다
      score('s-6', '도움 주기', 1, { revokedAt: NOW }), // 되돌린 것은 세지 않는다
      score('s-7', '도움 주기', 1, { occurredAt: '2025-12-01T09:00:00.000Z' }), // 학기 밖
    ],
    dutyRounds: [
      {
        id: 'r-1',
        classId: CLASS,
        startDate: '2026-03-02',
        endDate: '2026-03-06',
        label: '1주',
        status: 'ended',
        assignments: [{ roleId: 'role-1', studentIds: ['stu-1'] }],
        lockedRoleIds: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'r-2',
        classId: CLASS,
        startDate: '2026-03-09',
        endDate: '2026-03-13',
        label: '2주',
        status: 'ended',
        assignments: [{ roleId: 'role-1', studentIds: ['stu-1', 'stu-2'] }],
        lockedRoleIds: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    assignments: [
      createAssignment({ id: 'a-1', classId: CLASS, title: '독서록', dueDate: '2026-04-01' }, NOW),
      createAssignment({ id: 'a-2', classId: CLASS, title: '일기', dueDate: '2026-04-08' }, NOW),
    ],
    submissions: [
      createSubmission('a-1', 'stu-1', 'submitted', NOW),
      createSubmission('a-2', 'stu-1', 'completed', NOW),
    ],
    observations: [
      createObservation(
        { id: 'o-2', classId: CLASS, studentId: 'stu-1', text: '발표를 잘했다.', date: '2026-05-01' },
        NOW,
      ),
      createObservation(
        { id: 'o-1', classId: CLASS, studentId: 'stu-1', text: '모둠 활동에서 친구를 먼저 도왔다', date: '2026-04-01' },
        NOW,
      ),
      createObservation(
        { id: 'o-old', classId: CLASS, studentId: 'stu-1', text: '작년 일', date: '2025-11-01' },
        NOW,
      ),
    ],
    activeTermId: 'term-1',
    activeClassId: CLASS,
  };
}

describe('draftBehaviorComment — 기록에서 초안', () => {
  it('개근·칭찬·당번·과제·관찰을 나이스 문체 한 단락으로 잇는다', () => {
    expect(draftBehaviorComment(seeded(), 'stu-1', RANGE)).toBe(
      [
        '결석·지각·조퇴 없이 개근함.',
        '도움 주기 3회, 정리 정돈 1회 등 칭찬받은 일이 모두 4회임.',
        '당번 활동을 2회 맡아 수행함.',
        '과제를 빠짐없이 성실히 제출함(2/2).',
        '모둠 활동에서 친구를 먼저 도왔다.',
        '발표를 잘했다.',
      ].join(' '),
    );
  });

  it('출결을 쓰지 않는 학급에는 개근 문장을 넣지 않고, 결석이 있으면 출결 문장 자체가 없다', () => {
    const quiet = { ...seeded(), attendanceRecords: [] };
    expect(draftBehaviorComment(quiet, 'stu-1', RANGE).startsWith('결석·지각·조퇴')).toBe(false);

    const absent = { ...seeded(), attendanceRecords: setStatus([], CLASS, '2026-03-10', 'stu-1', 'absent') };
    expect(draftBehaviorComment(absent, 'stu-1', RANGE)).not.toContain('개근');
  });

  it('과제를 다 내지 않았으면 건수로 적고, 거의 다 냈으면 "대부분"이다 — "빠짐없이"는 전부일 때만', () => {
    const partial = { ...seeded(), submissions: [createSubmission('a-1', 'stu-1', 'submitted', NOW)] };
    expect(draftBehaviorComment(partial, 'stu-1', RANGE)).toContain('과제 2건 중 1건을 제출함.');

    const ten = Array.from({ length: 10 }, (_, i) =>
      createAssignment({ id: `a-${i}`, classId: CLASS, title: `과제${i}`, dueDate: '2026-04-01' }, NOW),
    );
    const nine = ten.slice(0, 9).map((a) => createSubmission(a.id, 'stu-1', 'submitted', NOW));
    const mostly = { ...seeded(), assignments: ten, submissions: nine };
    expect(draftBehaviorComment(mostly, 'stu-1', RANGE)).toContain('과제를 대부분 성실히 제출함(9/10).');
    expect(draftBehaviorComment(mostly, 'stu-1', RANGE)).not.toContain('빠짐없이');
  });

  it('아무 기록이 없으면 빈 글이다', () => {
    const empty = { ...seeded(), attendanceRecords: [], scoreEntries: [], dutyRounds: [], assignments: [], submissions: [], observations: [] };
    expect(draftBehaviorComment(empty, 'stu-1', RANGE)).toBe('');
    expect(draftBehaviorComment(seeded(), 'ghost', RANGE)).toBe('');
  });
});

describe('upsertBehaviorComment · commentOf', () => {
  it('학급·학생마다 하나. 빈 글이면 지운다', () => {
    let comments = upsertBehaviorComment([], { classId: CLASS, studentId: 'stu-1', text: '성실함.' }, NOW);
    expect(commentOf(comments, CLASS, 'stu-1')).toBe('성실함.');
    expect(comments).toHaveLength(1);

    comments = upsertBehaviorComment(comments, { classId: CLASS, studentId: 'stu-1', text: '성실하고 밝음.' }, NOW);
    expect(comments).toHaveLength(1);
    expect(commentOf(comments, CLASS, 'stu-1')).toBe('성실하고 밝음.');

    comments = upsertBehaviorComment(comments, { classId: CLASS, studentId: 'stu-1', text: '   ' }, NOW);
    expect(comments).toEqual([]);
    expect(commentOf(comments, CLASS, 'stu-1')).toBe('');
  });

  it('나이스 글자 수 기준은 500자다', () => {
    expect(NEIS_COMMENT_LIMIT).toBe(500);
  });
});
