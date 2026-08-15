import { CLASS_TARGET_ID } from '../../shared/domain/factories';
import type { Group, ScoreCycle, ScoreEntry, ScoreGoal } from '../../shared/domain/types';
import { addDays, parseLocalDate, weekdayOf } from '../duty/dutyCore';

/**
 * 점수 계산.
 *
 * 원본은 누적 점수와 거래 로그를 둘 다 저장하고 양쪽을 함께 갱신했다.
 * 되돌리기·수정에서 한쪽만 반영되면 화면의 점수와 기록이 달라지고,
 * 어느 쪽이 맞는지 알 방법이 없다.
 *
 * 여기서는 **기록이 유일한 원본**이다. 점수는 항상 합산해서 만든다.
 */

/** 되돌린 기록은 계산에서 빠진다. 지우지는 않는다. */
export function isCounted(entry: ScoreEntry): boolean {
  return entry.revokedAt === undefined;
}

export type CyclePeriod = 'weekly' | 'monthly' | 'all';

export interface CycleRange {
  /** 이 시각 이후의 기록만 센다. 'all'이면 null. */
  since: string | null;
  label: string;
}

/**
 * 그 날 지역 자정에 해당하는 UTC 순간.
 *
 * `${dateStr}T00:00:00.000`처럼 지역 글자열을 만들면 안 된다.
 * ScoreEntry.occurredAt은 `new Date().toISOString()` — **UTC**다.
 * 한국(UTC+9)에서 월요일 아침 7시에 준 점수는 2026-08-16T22:00Z로 적히고,
 * 지역 글자열 '2026-08-17T00:00:00.000'과 글자로 비교하면 빠져 버린다.
 *
 * **자정부터 오전 9시까지 준 점수가 그 주기에서 통째로 빠졌다.**
 * 교사가 점수를 가장 많이 주는 아침 활동 시간이 거기다.
 *
 * parseLocalDate가 만드는 Date가 지역 자정이고, toISOString()이 같은
 * 순간의 UTC 표기다. 지역→UTC 변환은 이 함수 한 곳에서만 한다.
 */
export function startOfDayIso(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  // 읽을 수 없는 날짜. 부르는 쪽이 이미 걸러내지만 형태는 맞춰 둔다.
  if (date === null) return `${dateStr}T00:00:00.000Z`;

  return date.toISOString();
}

/**
 * 점수를 언제부터 세는가.
 *
 * 주간은 설정한 시작 요일부터, 월간은 설정한 시작일부터.
 * 원본의 PeriodSettings를 그대로 따르되 이름만 ScoreCycle로 바꿨다.
 */
export function cycleRangeFor(period: CyclePeriod, cycle: ScoreCycle, today: string): CycleRange {
  if (period === 'all') return { since: null, label: '전체 기간' };

  if (period === 'weekly') {
    const weekday = weekdayOf(today);
    if (weekday === null) return { since: null, label: '이번 주' };

    // 시작 요일까지 거슬러 올라간다. 오늘이 시작 요일이면 오늘부터.
    const back = (weekday - cycle.weeklyStartDay + 7) % 7;
    const start = addDays(today, -back);
    return { since: startOfDayIso(start), label: '이번 주' };
  }

  const date = parseLocalDate(today);
  if (date === null) return { since: null, label: '이번 달' };

  // 1일~말일 기준이면 시작일 설정은 쓰지 않는다.
  const startDay =
    cycle.monthlyType === '1st_to_end' ? 1 : Math.min(Math.max(1, cycle.monthlyStartDay), 28);
  const month = date.getMonth();
  const year = date.getFullYear();

  // 시작일이 아직 안 지났으면 지난달부터가 이번 주기다.
  const useCurrentMonth = date.getDate() >= startDay;
  const anchor = new Date(year, useCurrentMonth ? month : month - 1, startDay);
  const anchorStr = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-${String(anchor.getDate()).padStart(2, '0')}`;

  return { since: startOfDayIso(anchorStr), label: '이번 달' };
}

export interface ScoreTotals {
  /** 학생 개인 점수 */
  students: Map<string, number>;
  /**
   * 모둠 점수.
   *
   * 모둠에 직접 준 점수 + 그 모둠 학생들이 받은 점수를 합친다.
   * 교사가 모둠 대항으로 쓸 때 기대하는 숫자가 이것이다.
   */
  groups: Map<string, number>;
  /** 학급 전체에 직접 준 점수 */
  classTotal: number;
}

export function computeScores(
  entries: readonly ScoreEntry[],
  groups: readonly Group[],
  options: { since?: string | null } = {},
): ScoreTotals {
  const since = options.since ?? null;

  const students = new Map<string, number>();
  const groupOwn = new Map<string, number>();
  let classTotal = 0;

  for (const entry of entries) {
    if (!isCounted(entry)) continue;
    if (since !== null && entry.occurredAt < since) continue;

    if (entry.targetUnit === 'student') {
      students.set(entry.targetId, (students.get(entry.targetId) ?? 0) + entry.points);
    } else if (entry.targetUnit === 'group') {
      groupOwn.set(entry.targetId, (groupOwn.get(entry.targetId) ?? 0) + entry.points);
    } else {
      classTotal += entry.points;
    }
  }

  const groupTotals = new Map<string, number>();
  for (const group of groups) {
    const members = group.studentIds.reduce((sum, id) => sum + (students.get(id) ?? 0), 0);
    groupTotals.set(group.id, (groupOwn.get(group.id) ?? 0) + members);
  }

  return { students, groups: groupTotals, classTotal };
}

export interface GoalProgress {
  goal: ScoreGoal;
  current: number;
  /** 0~1 */
  ratio: number;
  isAchieved: boolean;
  remaining: number;
}

export function goalProgress(goal: ScoreGoal, totals: ScoreTotals): GoalProgress {
  const current =
    goal.targetUnit === 'student'
      ? (totals.students.get(goal.targetId) ?? 0)
      : goal.targetUnit === 'group'
        ? (totals.groups.get(goal.targetId) ?? 0)
        : totals.classTotal;

  // 목표가 0 이하면 나눗셈이 무의미하다. 달성으로 본다.
  const ratio = goal.targetPoints <= 0 ? 1 : Math.min(1, Math.max(0, current / goal.targetPoints));

  return {
    goal,
    current,
    ratio,
    isAchieved: current >= goal.targetPoints,
    remaining: Math.max(0, goal.targetPoints - current),
  };
}

/**
 * 목표의 달성 상태를 지금 점수와 맞춘다.
 *
 * 순수 함수로 둔 이유: 달성은 시간이 흐르며 일어나는 일이지만, "지금 이
 * 기록으로 달성인가"는 계산이다. 계산으로 만들어야 테스트할 수 있다.
 *
 * **점수가 목표 아래로 내려가면 achievedAt을 지운다.** 되돌리기로 점수가
 * 줄었는데 달성 표시만 남으면 "달성 완료인데 진행률 80%"라는 화면이 나온다.
 * 이 앱은 기록이 유일한 원본이고 점수는 언제나 합산해서 만든다.
 * achievedAt만 예외로 둘 이유가 없다.
 *
 * 안 바뀐 목표는 **같은 객체**를 돌려준다. 부르는 쪽이 참조로 비교해
 * 불필요한 저장을 건너뛸 수 있다.
 */
export function syncGoalAchievements(
  goals: readonly ScoreGoal[],
  entries: readonly ScoreEntry[],
  groups: readonly Group[],
  now: string,
): { goals: ScoreGoal[]; newlyAchieved: ScoreGoal[] } {
  const newlyAchieved: ScoreGoal[] = [];

  const next = goals.map((goal) => {
    // 목표마다 자기 startDate부터 센다. 화면의 기간 탭과 무관하다.
    const totals = computeScores(entries, groups, { since: startOfDayIso(goal.startDate) });
    const { isAchieved } = goalProgress(goal, totals);

    if (isAchieved && goal.achievedAt === undefined) {
      const achieved = { ...goal, achievedAt: now };
      newlyAchieved.push(achieved);
      return achieved;
    }

    if (!isAchieved && goal.achievedAt !== undefined) {
      // achievedAt은 optional이다. "달성 안 함"은 키를 빼서 표현한다.
      const { achievedAt: _dropped, ...rest } = goal;
      return rest;
    }

    return goal;
  });

  return { goals: next, newlyAchieved };
}

/**
 * 목표 대상의 표시 이름을 만든다.
 * 학급 목표는 대상 id가 고정값이라 별도 조회가 필요 없다.
 */
export function goalTargetLabel(
  goal: ScoreGoal,
  lookup: { studentName: (id: string) => string | undefined; groupName: (id: string) => string | undefined },
): string {
  if (goal.targetUnit === 'class') return '우리 반 전체';
  if (goal.targetUnit === 'student') return lookup.studentName(goal.targetId) ?? '(없는 학생)';
  return lookup.groupName(goal.targetId) ?? '(없는 모둠)';
}

export { CLASS_TARGET_ID };
