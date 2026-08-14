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

function startOfDayIso(dateStr: string): string {
  return `${dateStr}T00:00:00.000`;
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
