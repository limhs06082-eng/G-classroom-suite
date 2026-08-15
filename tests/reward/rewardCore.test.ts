import { describe, expect, it } from 'vitest';

import {
  computeScores,
  cycleRangeFor,
  goalProgress,
  goalTargetLabel,
  isCounted,
  startOfDayIso,
} from '../../src/features/reward/rewardCore';
import {
  createGroup,
  createScoreEntry,
  createScoreGoal,
  DEFAULT_SCORE_CYCLE,
} from '../../src/shared/domain/factories';
import type { Group, ScoreEntry } from '../../src/shared/domain/types';

const NOW = '2026-03-02T09:00:00.000Z';

function entry(
  targetUnit: ScoreEntry['targetUnit'],
  targetId: string,
  points: number,
  occurredAt = NOW,
): ScoreEntry {
  return createScoreEntry({ classId: 'class-1', targetUnit, targetId, points, reason: '테스트', occurredAt }, NOW);
}

function group(id: string, studentIds: string[]): Group {
  return createGroup({ id, classId: 'class-1', name: `${id}모둠`, color: 'sky', studentIds }, NOW);
}

describe('computeScores', () => {
  it('학생별로 점수를 더한다', () => {
    const totals = computeScores([entry('student', 'stu-1', 2), entry('student', 'stu-1', 3)], []);

    expect(totals.students.get('stu-1')).toBe(5);
  });

  it('음수 점수를 뺀다', () => {
    const totals = computeScores([entry('student', 'stu-1', 3), entry('student', 'stu-1', -1)], []);

    expect(totals.students.get('stu-1')).toBe(2);
  });

  it('되돌린 기록은 세지 않는다', () => {
    // 기록은 남아 있되 점수에서만 빠진다. 지워 버리면 왜 줄었는지 알 수 없다.
    const revoked = { ...entry('student', 'stu-1', 5), revokedAt: NOW };
    const totals = computeScores([entry('student', 'stu-1', 2), revoked], []);

    expect(totals.students.get('stu-1')).toBe(2);
    expect(isCounted(revoked)).toBe(false);
  });

  it('모둠 점수는 모둠에 준 점수와 구성원 점수를 합친 것이다', () => {
    // 교사가 모둠 대항으로 쓸 때 기대하는 숫자다.
    const totals = computeScores(
      [entry('group', 'g-1', 2), entry('student', 'stu-1', 3), entry('student', 'stu-2', 1)],
      [group('g-1', ['stu-1', 'stu-2'])],
    );

    expect(totals.groups.get('g-1')).toBe(6);
  });

  it('다른 모둠 학생의 점수는 섞이지 않는다', () => {
    const totals = computeScores(
      [entry('student', 'stu-1', 3), entry('student', 'stu-9', 100)],
      [group('g-1', ['stu-1'])],
    );

    expect(totals.groups.get('g-1')).toBe(3);
  });

  it('학급 점수는 학급에 직접 준 것만 센다', () => {
    const totals = computeScores(
      [entry('class', 'class', 5), entry('student', 'stu-1', 100)],
      [group('g-1', ['stu-1'])],
    );

    expect(totals.classTotal).toBe(5);
  });

  it('기준 시각 이전 기록은 빼고 센다', () => {
    const totals = computeScores(
      [
        entry('student', 'stu-1', 10, '2026-02-01T09:00:00.000Z'),
        entry('student', 'stu-1', 3, '2026-03-02T09:00:00.000Z'),
      ],
      [],
      { since: '2026-03-01T00:00:00.000' },
    );

    expect(totals.students.get('stu-1')).toBe(3);
  });

  it('기록이 없어도 모둠은 0으로 나온다', () => {
    const totals = computeScores([], [group('g-1', ['stu-1'])]);

    expect(totals.groups.get('g-1')).toBe(0);
    expect(totals.classTotal).toBe(0);
  });
});

/**
 * 지역 자정의 UTC 표기.
 *
 * 기대값을 글자로 박으면 시간대에 따라 테스트가 깨진다. occurredAt이
 * UTC라 since도 UTC여야 하고, 그 값은 실행 환경의 시간대에 달려 있다.
 */
const localMidnight = (year: number, month: number, day: number): string =>
  new Date(year, month - 1, day).toISOString();

describe('cycleRangeFor', () => {
  it('전체 기간은 기준 시각이 없다', () => {
    expect(cycleRangeFor('all', DEFAULT_SCORE_CYCLE, '2026-03-04').since).toBeNull();
  });

  it('주간은 설정한 시작 요일부터 센다', () => {
    // 2026-03-04는 수요일. 월요일 시작이면 03-02부터.
    const range = cycleRangeFor('weekly', DEFAULT_SCORE_CYCLE, '2026-03-04');

    expect(range.since).toBe(localMidnight(2026, 3, 2));
  });

  it('시작 요일 당일이면 그날부터 센다', () => {
    const range = cycleRangeFor('weekly', DEFAULT_SCORE_CYCLE, '2026-03-02');

    expect(range.since).toBe(localMidnight(2026, 3, 2));
  });

  it('일요일 시작으로 바꾸면 경계도 함께 옮겨진다', () => {
    const sundayStart = { ...DEFAULT_SCORE_CYCLE, weeklyStartDay: 0 };
    const range = cycleRangeFor('weekly', sundayStart, '2026-03-04');

    expect(range.since).toBe(localMidnight(2026, 3, 1));
  });

  it('1일~말일 기준이면 시작일 설정을 무시한다', () => {
    const cycle = { ...DEFAULT_SCORE_CYCLE, monthlyType: '1st_to_end' as const, monthlyStartDay: 15 };
    const range = cycleRangeFor('monthly', cycle, '2026-08-20');

    expect(range.since).toBe(localMidnight(2026, 8, 1));
  });

  it('지정일 기준이면 그 날부터 센다', () => {
    const cycle = { ...DEFAULT_SCORE_CYCLE, monthlyType: 'specific_day' as const, monthlyStartDay: 15 };
    const range = cycleRangeFor('monthly', cycle, '2026-08-20');

    expect(range.since).toBe(localMidnight(2026, 8, 15));
  });

  it('지정일이 아직 안 왔으면 지난달 그 날부터다', () => {
    const cycle = { ...DEFAULT_SCORE_CYCLE, monthlyType: 'specific_day' as const, monthlyStartDay: 15 };
    const range = cycleRangeFor('monthly', cycle, '2026-08-10');

    expect(range.since).toBe(localMidnight(2026, 7, 15));
  });

  it('월간은 설정한 시작일부터 센다', () => {
    const range = cycleRangeFor('monthly', DEFAULT_SCORE_CYCLE, '2026-03-15');

    expect(range.since).toBe(localMidnight(2026, 3, 1));
  });

  /*
   * 회귀 방지.
   *
   * since를 '2026-03-02T00:00:00.000' 같은 지역 글자열로 두면, occurredAt이
   * UTC라 한국(UTC+9)에서 아침에 준 점수가 전날 UTC로 적혀 빠진다.
   * 자정부터 오전 9시까지 — 교사가 점수를 가장 많이 주는 시간이다.
   */
  it('주기 시작일 아침에 준 점수가 그 주기에 들어온다', () => {
    const range = cycleRangeFor('weekly', DEFAULT_SCORE_CYCLE, '2026-03-02');
    const morning = new Date(2026, 2, 2, 7, 0).toISOString();

    expect(range.since).not.toBeNull();
    expect(morning >= (range.since ?? '')).toBe(true);
  });

  it('주기 시작 전날 밤에 준 점수는 빠진다', () => {
    const range = cycleRangeFor('weekly', DEFAULT_SCORE_CYCLE, '2026-03-02');
    const lastNight = new Date(2026, 2, 1, 23, 30).toISOString();

    expect(lastNight >= (range.since ?? '')).toBe(false);
  });

  it('시작일이 아직 안 지났으면 지난달부터가 이번 주기다', () => {
    /*
     * monthlyType도 함께 지정한다.
     * 예전에는 계산이 monthlyType을 무시해서 monthlyStartDay만 바꿔도 통했지만,
     * 이제 1일~말일 기준이면 시작일 설정을 쓰지 않는다.
     */
    const fifteenth = {
      ...DEFAULT_SCORE_CYCLE,
      monthlyType: 'specific_day' as const,
      monthlyStartDay: 15,
    };
    const range = cycleRangeFor('monthly', fifteenth, '2026-03-10');

    expect(range.since).toBe(localMidnight(2026, 2, 15));
  });
});

describe('goalProgress', () => {
  const totals = computeScores(
    [entry('student', 'stu-1', 7), entry('class', 'class', 12)],
    [group('g-1', ['stu-1'])],
  );

  it('학급 목표의 진행률을 계산한다', () => {
    const goal = createScoreGoal(
      { classId: 'class-1', title: '학급 100점', targetUnit: 'class', targetId: 'class', targetPoints: 20 },
      NOW,
    );

    const progress = goalProgress(goal, totals);

    expect(progress.current).toBe(12);
    expect(progress.ratio).toBeCloseTo(0.6);
    expect(progress.remaining).toBe(8);
    expect(progress.isAchieved).toBe(false);
  });

  it('목표에 도달하면 달성으로 본다', () => {
    const goal = createScoreGoal(
      { classId: 'class-1', title: '7점', targetUnit: 'student', targetId: 'stu-1', targetPoints: 7 },
      NOW,
    );

    expect(goalProgress(goal, totals).isAchieved).toBe(true);
    expect(goalProgress(goal, totals).remaining).toBe(0);
  });

  it('진행률이 1을 넘지 않는다', () => {
    const goal = createScoreGoal(
      { classId: 'class-1', title: '작은 목표', targetUnit: 'class', targetId: 'class', targetPoints: 5 },
      NOW,
    );

    expect(goalProgress(goal, totals).ratio).toBe(1);
  });

  it('목표 점수가 0이어도 나눗셈이 깨지지 않는다', () => {
    const goal = createScoreGoal(
      { classId: 'class-1', title: '잘못된 목표', targetUnit: 'class', targetId: 'class', targetPoints: 0 },
      NOW,
    );

    expect(goalProgress(goal, totals).ratio).toBe(1);
    expect(Number.isNaN(goalProgress(goal, totals).ratio)).toBe(false);
  });
});

describe('goalTargetLabel', () => {
  const lookup = {
    studentName: (id: string) => (id === 'stu-1' ? '김하나' : undefined),
    groupName: (id: string) => (id === 'g-1' ? '1모둠' : undefined),
  };

  it('대상 종류에 맞는 이름을 만든다', () => {
    const make = (unit: 'student' | 'group' | 'class', targetId: string) =>
      goalTargetLabel(
        createScoreGoal({ classId: 'class-1', title: 't', targetUnit: unit, targetId, targetPoints: 1 }, NOW),
        lookup,
      );

    expect(make('class', 'class')).toBe('우리 반 전체');
    expect(make('student', 'stu-1')).toBe('김하나');
    expect(make('group', 'g-1')).toBe('1모둠');
  });

  it('사라진 대상도 화면이 깨지지 않게 표시한다', () => {
    const goal = createScoreGoal(
      { classId: 'class-1', title: 't', targetUnit: 'student', targetId: 'gone', targetPoints: 1 },
      NOW,
    );

    expect(goalTargetLabel(goal, lookup)).toBe('(없는 학생)');
  });
});

describe('목표는 자기 startDate부터 센다', () => {
  /*
   * 예전에는 goalProgress가 화면 기간 탭이 정한 합계를 받았다.
   * 같은 목표가 '이번 주'에서는 12점, '전체'에서는 340점이었다.
   * ScoreGoal.startDate가 있는데 아무도 읽지 않았다.
   */
  const goal = createScoreGoal(
    {
      id: 'g-1',
      classId: 'class-1',
      title: '우리 반 100점',
      targetUnit: 'class',
      targetId: 'class',
      targetPoints: 100,
      startDate: '2026-03-02',
    },
    NOW,
  );

  const before = new Date(2026, 2, 1, 10, 0).toISOString();
  const after = new Date(2026, 2, 3, 10, 0).toISOString();
  const entries = [entry('class', 'class', 40, before), entry('class', 'class', 30, after)];

  it('시작일 이전 기록은 세지 않는다', () => {
    const totals = computeScores(entries, [], { since: startOfDayIso(goal.startDate) });

    expect(goalProgress(goal, totals).current).toBe(30);
  });

  it('시작일 당일 아침 기록은 센다', () => {
    const morning = new Date(2026, 2, 2, 7, 0).toISOString();
    const totals = computeScores([entry('class', 'class', 5, morning)], [], {
      since: startOfDayIso(goal.startDate),
    });

    expect(goalProgress(goal, totals).current).toBe(5);
  });
});
