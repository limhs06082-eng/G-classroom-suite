import { describe, expect, it } from 'vitest';

import { setStatus } from '../../src/features/attendance/attendanceCore';
import { buildCommentPrompt, collectCommentFacts } from '../../src/shared/ai/commentPrompt';
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

const NOW = '2026-03-02T09:00:00.000Z';
const CLASS = 'class-1';
const RANGE = { from: '2026-03-02', to: '2026-07-20' };

function score(id: string, reason: string, points: number): ScoreEntry {
  return {
    id,
    classId: CLASS,
    occurredAt: '2026-04-01T09:00:00.000Z',
    targetUnit: 'student',
    targetId: 'stu-1',
    points,
    reason,
  };
}

function seeded(): SuiteData {
  const term = createTerm(
    { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: RANGE.from, endDate: RANGE.to },
    NOW,
  );
  const room = createClassRoom({ id: CLASS, termId: 'term-1', name: '우리 반' }, NOW);
  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room],
    students: [
      createStudent({ id: 'stu-1', classId: CLASS, number: 7, name: '김하나' }, NOW),
      createStudent({ id: 'stu-2', classId: CLASS, number: 8, name: '이두리' }, NOW),
    ],
    attendanceRecords: setStatus([], CLASS, '2026-03-10', 'stu-2', 'absent'),
    scoreEntries: [score('s-1', '도움 주기', 1), score('s-2', '도움 주기', 1), score('s-3', '떠들기', -1)],
    assignments: [createAssignment({ id: 'a-1', classId: CLASS, title: '독서록', dueDate: '2026-04-01' }, NOW)],
    submissions: [createSubmission('a-1', 'stu-1', 'submitted', NOW)],
    observations: [
      createObservation(
        { classId: CLASS, studentId: 'stu-1', text: '모둠 활동에서 친구를 먼저 도왔다', date: '2026-04-01' },
        NOW,
      ),
    ],
    activeTermId: 'term-1',
    activeClassId: CLASS,
  };
}

describe('collectCommentFacts — 이름 없는 사실 모음', () => {
  it('출결·칭찬·과제·관찰을 모으고 지도(감점) 기록은 빼며 이름·번호는 어디에도 없다', () => {
    const facts = collectCommentFacts(seeded(), 'stu-1', RANGE);

    expect(facts).toEqual({
      attendance: 'perfect',
      absentDays: 0,
      lateDays: 0,
      earlyDays: 0,
      fieldTripDays: 0,
      praise: [{ reason: '도움 주기', count: 2 }],
      dutyCount: 0,
      assignments: { total: 1, submitted: 1 },
      observations: [{ date: '2026-04-01', text: '모둠 활동에서 친구를 먼저 도왔다' }],
    });
    expect(JSON.stringify(facts)).not.toContain('김하나');
    expect(JSON.stringify(facts)).not.toContain('떠들기');
  });

  it('출결을 안 쓰는 학급은 unknown, 결석이 있으면 absent', () => {
    expect(collectCommentFacts({ ...seeded(), attendanceRecords: [] }, 'stu-1', RANGE)?.attendance).toBe('unknown');
    expect(collectCommentFacts(seeded(), 'stu-2', RANGE)?.attendance).toBe('absent');
    expect(collectCommentFacts(seeded(), 'stu-2', RANGE)?.absentDays).toBe(1);
    expect(collectCommentFacts(seeded(), 'ghost', RANGE)).toBeNull();
  });
});

describe('buildCommentPrompt', () => {
  it('규칙(문체·500자·이름 금지·감점 제외)을 시스템에, 사실을 사용자 글에 넣는다', () => {
    const facts = collectCommentFacts(seeded(), 'stu-1', RANGE);
    if (facts === null) throw new Error('facts');

    const prompt = buildCommentPrompt(facts);

    expect(prompt.system).toContain('500자');
    expect(prompt.system).toContain('행동특성 및 종합의견');
    expect(prompt.system).toMatch(/이름/);
    expect(prompt.user).toContain('도움 주기 2회');
    expect(prompt.user).toContain('모둠 활동에서 친구를 먼저 도왔다');
    expect(prompt.user).toContain('개근');
    expect(prompt.user).not.toContain('김하나');
  });
});
