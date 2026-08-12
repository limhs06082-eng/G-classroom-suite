import type { DutyProfile, DutyRole, DutyRound, RoleAssignment } from '../../shared/domain/types';

/**
 * 역할·당번 배정 로직.
 *
 * 원본 G-class-duty-manager의 autoAssign.ts를 옮기면서 바꾼 것:
 *   1. 날짜 문자열을 지역 시간 기준으로 직접 해석한다.
 *      원본의 `new Date('2026-03-02')`는 UTC 자정으로 파싱되는데 getDay()는
 *      지역 시간을 본다. 한국(UTC+9)에서는 맞지만 UTC보다 뒤진 시간대에서는
 *      요일이 하루 밀려 엉뚱한 학생이 제외된다.
 *   2. 무작위 대신 "적게 한 사람 먼저"로 결정한다. 교사가 학생에게
 *      설명할 수 있어야 하고, 같은 입력에 같은 결과가 나와야 검증할 수 있다.
 *   3. 학생·역할 전체 객체 대신 필요한 것만 받는다.
 */

/** 배정 대상 학생. 보통 order는 학생 번호다. */
export interface DutyCandidate {
  id: string;
  order: number;
}

export interface ExclusionContext {
  /** YYYY-MM-DD. 없으면 날짜와 무관한 제외만 본다. */
  date?: string;
  roleId?: string;
  /** 그날만 빠지는 학생 (결석·체험학습 등) */
  absentStudentIds?: ReadonlySet<string>;
}

/** 'YYYY-MM-DD'를 지역 시간 기준 날짜로 읽는다. Date 생성자의 UTC 해석을 피한다. */
export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  // 2026-02-31 같은 값은 3월로 넘어가 버린다. 되돌아온 값이 같은지 확인한다.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/** 0=일 … 6=토. 읽을 수 없는 날짜면 null. */
export function weekdayOf(dateStr: string): number | null {
  return parseLocalDate(dateStr)?.getDay() ?? null;
}

function isWithin(dateStr: string, start: string, end: string): boolean {
  // YYYY-MM-DD는 문자열 비교가 곧 날짜 비교다.
  return start !== '' && end !== '' && dateStr >= start && dateStr <= end;
}

/**
 * 이 학생을 이 날짜·이 역할에서 빼야 하는가.
 *
 * 제외 사유가 하나라도 걸리면 뺀다. 교사가 설정한 제외를 무시하고 배정하면
 * 그 학생은 다음 날 곤란해진다.
 */
export function isExcluded(
  profile: DutyProfile | undefined,
  role: DutyRole | undefined,
  context: ExclusionContext = {},
): boolean {
  const { date, roleId, absentStudentIds } = context;

  if (profile === undefined) return false;

  if (absentStudentIds?.has(profile.studentId) === true) return true;

  // 역할 쪽에서 뺀 학생
  if (role !== undefined && role.excludedStudentIds.includes(profile.studentId)) return true;

  // 학생 쪽에서 뺀 역할
  const targetRoleId = roleId ?? role?.id;
  if (targetRoleId !== undefined && profile.excludedRoleIds.includes(targetRoleId)) return true;

  if (date === undefined) {
    // 날짜를 모르면 기간 제외는 판단할 수 없다. 기간이 하나라도 있으면 뺀다.
    return profile.exclusionPeriods.length > 0;
  }

  if (profile.excludedDates.includes(date)) return true;

  for (const period of profile.exclusionPeriods) {
    if (isWithin(date, period.startDate, period.endDate)) return true;
  }

  const weekday = weekdayOf(date);
  if (weekday !== null) {
    if (profile.excludedWeekdays.includes(weekday)) return true;

    if (targetRoleId !== undefined) {
      const specific = profile.roleSpecificExclusions?.[targetRoleId];
      if (specific?.dates?.includes(date) === true) return true;
      if (specific?.weekdays?.includes(weekday) === true) return true;
    }
  }

  return false;
}

/** 이 역할이 이 날짜에 필요한가. activeDays가 비어 있으면 매일 필요하다. */
export function roleAppliesOn(role: DutyRole, dateStr: string): boolean {
  if (!role.isActive) return false;
  if (role.activeDays.length === 0) return true;

  const weekday = weekdayOf(dateStr);
  return weekday === null ? true : role.activeDays.includes(weekday);
}

/**
 * 지난 배정 횟수.
 *
 * 공정성의 근거가 되는 숫자다. 이게 틀리면 특정 학생만 계속 당번에 걸리는데,
 * 화면상으로는 정상으로 보여서 교사가 알아채기 어렵다.
 */
export function countPastAssignments(rounds: readonly DutyRound[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const round of rounds) {
    for (const assignment of round.assignments) {
      for (const studentId of assignment.studentIds) {
        counts.set(studentId, (counts.get(studentId) ?? 0) + 1);
      }
    }
  }

  return counts;
}

export interface AutoAssignWarning {
  roleId: string;
  roleName: string;
  needed: number;
  assigned: number;
  message: string;
}

export interface AutoAssignInput {
  candidates: readonly DutyCandidate[];
  roles: readonly DutyRole[];
  profiles: ReadonlyMap<string, DutyProfile>;
  /** 공정성 계산에 쓸 지난 배정 */
  history: readonly DutyRound[];
  /** 배정 기준일. 요일 제외와 역할 적용 요일을 판단한다. */
  date: string;
  /** 다시 배정해도 그대로 둘 역할 */
  lockedRoleIds?: readonly string[];
  /** 고정할 역할의 기존 배정 */
  previousAssignments?: readonly RoleAssignment[];
  absentStudentIds?: ReadonlySet<string>;
}

export interface AutoAssignResult {
  assignments: RoleAssignment[];
  warnings: AutoAssignWarning[];
}

export function runAutoAssign(input: AutoAssignInput): AutoAssignResult {
  const {
    candidates,
    roles,
    profiles,
    history,
    date,
    lockedRoleIds = [],
    previousAssignments = [],
    absentStudentIds,
  } = input;

  const pastCounts = countPastAssignments(history);
  const locked = new Set(lockedRoleIds);
  const previousByRole = new Map(previousAssignments.map((a) => [a.roleId, a.studentIds]));

  const assignments: RoleAssignment[] = [];
  const warnings: AutoAssignWarning[] = [];

  /** 이번 차례에 이미 역할을 받은 학생. 한 사람에게 몰리지 않게 한다. */
  const assignedThisRound = new Set<string>();
  /** 이번 배정으로 늘어난 몫까지 반영한 누적 횟수 */
  const runningCounts = new Map(pastCounts);

  const take = (studentId: string): void => {
    assignedThisRound.add(studentId);
    runningCounts.set(studentId, (runningCounts.get(studentId) ?? 0) + 1);
  };

  const applicableRoles = roles.filter((role) => roleAppliesOn(role, date));

  for (const role of applicableRoles) {
    // 고정된 역할은 손대지 않는다.
    if (locked.has(role.id)) {
      const kept = previousByRole.get(role.id) ?? [];
      assignments.push({ roleId: role.id, studentIds: [...kept] });
      for (const studentId of kept) take(studentId);
      continue;
    }

    const eligible = candidates.filter(
      (candidate) =>
        !isExcluded(profiles.get(candidate.id), role, {
          date,
          roleId: role.id,
          ...(absentStudentIds === undefined ? {} : { absentStudentIds }),
        }),
    );

    const picked: string[] = [];

    // 1) 고정 담당자를 먼저 넣는다. 교사가 정한 것이므로 공정성보다 앞선다.
    for (const studentId of role.fixedStudentIds) {
      if (picked.length >= role.neededCount) break;
      if (!eligible.some((candidate) => candidate.id === studentId)) continue;
      if (picked.includes(studentId)) continue;

      picked.push(studentId);
      take(studentId);
    }

    /*
     * 2) 남은 자리는 "적게 한 사람 먼저"로 채운다.
     *    같은 횟수면 번호 순. 무작위가 아니라 규칙이어야
     *    교사가 학생에게 "돌아가면서 하는 것"이라고 설명할 수 있다.
     */
    const fill = (allowRepeat: boolean): void => {
      const pool = eligible
        .filter((candidate) => !picked.includes(candidate.id))
        .filter((candidate) => allowRepeat || !assignedThisRound.has(candidate.id))
        .sort((a, b) => {
          const diff = (runningCounts.get(a.id) ?? 0) - (runningCounts.get(b.id) ?? 0);
          return diff !== 0 ? diff : a.order - b.order;
        });

      for (const candidate of pool) {
        if (picked.length >= role.neededCount) break;
        picked.push(candidate.id);
        take(candidate.id);
      }
    };

    fill(false);
    // 3) 그래도 모자라면 이미 다른 역할을 받은 학생까지 쓴다.
    if (picked.length < role.neededCount) fill(true);

    assignments.push({ roleId: role.id, studentIds: picked });

    if (picked.length < role.neededCount) {
      warnings.push({
        roleId: role.id,
        roleName: role.name,
        needed: role.neededCount,
        assigned: picked.length,
        message:
          picked.length === 0
            ? `${role.name}에 배정할 수 있는 학생이 없습니다. 제외 설정을 확인해 주세요.`
            : `${role.name}에 ${role.neededCount}명이 필요한데 ${picked.length}명만 배정했습니다.`,
      });
    }
  }

  return { assignments, warnings };
}

export interface FairnessSummary {
  /** 학생별 누적 배정 횟수 */
  counts: Map<string, number>;
  min: number;
  max: number;
  /** 최다와 최소의 차이. 클수록 한쪽으로 쏠려 있다. */
  spread: number;
  /** 평균보다 유독 많이 한 학생 */
  overloadedStudentIds: string[];
  /** 평균보다 유독 적게 한 학생 */
  underloadedStudentIds: string[];
}

export function summarizeFairness(
  candidates: readonly DutyCandidate[],
  rounds: readonly DutyRound[],
): FairnessSummary {
  const raw = countPastAssignments(rounds);

  // 한 번도 안 한 학생이 0으로 잡혀야 쏠림이 드러난다.
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    counts.set(candidate.id, raw.get(candidate.id) ?? 0);
  }

  const values = [...counts.values()];
  if (values.length === 0) {
    return { counts, min: 0, max: 0, spread: 0, overloadedStudentIds: [], underloadedStudentIds: [] };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;

  const overloadedStudentIds: string[] = [];
  const underloadedStudentIds: string[] = [];

  for (const [studentId, count] of counts) {
    if (count > average + 1) overloadedStudentIds.push(studentId);
    else if (count < average - 1) underloadedStudentIds.push(studentId);
  }

  return {
    counts,
    min,
    max,
    spread: max - min,
    overloadedStudentIds: overloadedStudentIds.sort(),
    underloadedStudentIds: underloadedStudentIds.sort(),
  };
}
