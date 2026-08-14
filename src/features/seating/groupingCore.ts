import { createId } from '../../shared/domain/factories';
import type { Gender, Group } from '../../shared/domain/types';
import { shuffle, systemRng, type Rng } from './rng';
import type { GroupingMode } from './types';

/**
 * 모둠 편성 알고리즘.
 *
 * 원본 G-seat-group-maker의 grouping.ts를 옮기면서 바꾼 것:
 *   1. Math.random() → 생성기 주입
 *   2. 정원 초과로 학생이 미배정으로 남던 문제를 고쳤다 (§performRandomGrouping)
 *   3. Group은 shared/domain의 것을 쓴다. reward 기능이 같은 모둠을 소비한다.
 */

/** 모둠 색. Group.color에 이 id를 저장하고 화면에서 실제 색으로 바꾼다. */
export const GROUP_COLORS = [
  { id: 'sky', label: '파랑' },
  { id: 'teal', label: '청록' },
  { id: 'emerald', label: '초록' },
  { id: 'amber', label: '노랑' },
  { id: 'orange', label: '주황' },
  { id: 'purple', label: '보라' },
  { id: 'pink', label: '분홍' },
  { id: 'slate', label: '회색' },
] as const;

export const MIN_GROUP_COUNT = 2;
export const MAX_GROUP_COUNT = 12;
const MIN_MEMBERS_PER_GROUP = 2;
const MAX_MEMBERS_PER_GROUP = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeGroupCount(
  mode: GroupingMode,
  groupCountSetting: number,
  membersPerGroupSetting: number,
  totalStudents: number,
): number {
  if (totalStudents <= 0) return MIN_GROUP_COUNT;

  if (mode === 'groupCount') {
    return clamp(groupCountSetting, MIN_GROUP_COUNT, MAX_GROUP_COUNT);
  }

  const perGroup = clamp(membersPerGroupSetting, MIN_MEMBERS_PER_GROUP, MAX_MEMBERS_PER_GROUP);
  return clamp(Math.ceil(totalStudents / perGroup), MIN_GROUP_COUNT, MAX_GROUP_COUNT);
}

/** 인원을 최대한 고르게 나눈 정원. 나머지는 앞쪽 모둠부터 한 명씩 더 받는다. */
export function computeTargetCapacities(totalStudents: number, groupCount: number): number[] {
  if (groupCount <= 0) return [];

  const base = Math.floor(totalStudents / groupCount);
  const remainder = totalStudents % groupCount;

  return Array.from({ length: groupCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

export interface GroupingResult {
  groups: Group[];
  /** 고정이 유지된 학생 */
  lockedStudentIds: string[];
  /** 모둠 수가 줄어 고정이 풀린 학생이 있었는지 */
  lockCleared: boolean;
}

// ── 무작위 편성과 균형 편성이 함께 쓰는 부분 ──────────────────
//    두 벌로 두면 한쪽만 고쳐지는 날이 온다.

/** 기존 모둠은 이름·색·id를 유지하고 구성원만 비운다. 교사가 붙인 이름이 사라지면 안 된다. */
function buildGroupShells(
  groupCount: number,
  classId: string,
  existingGroups: readonly Group[],
  now: string,
): Group[] {
  return Array.from({ length: groupCount }, (_, index) => {
    const existing = existingGroups[index];
    if (existing) return { ...existing, studentIds: [], updatedAt: now };

    const color = GROUP_COLORS[index % GROUP_COLORS.length];
    return {
      id: createId(),
      classId,
      name: `${index + 1}모둠`,
      color: color?.id ?? 'slate',
      studentIds: [],
      leaderId: null,
      createdAt: now,
      updatedAt: now,
    };
  });
}

interface LockOutcome {
  placed: Set<string>;
  keptLocked: string[];
  lockCleared: boolean;
}

/** 고정된 학생을 원래 모둠에 먼저 앉힌다. groups를 직접 고친다. */
function seatLockedStudents(
  groups: Group[],
  studentIds: readonly string[],
  existingGroups: readonly Group[],
  lockedStudentIds: readonly string[],
): LockOutcome {
  const previousGroupIndex = new Map<string, number>();
  existingGroups.forEach((group, index) => {
    for (const studentId of group.studentIds) previousGroupIndex.set(studentId, index);
  });

  const locked = new Set(lockedStudentIds);
  const keptLocked: string[] = [];
  const placed = new Set<string>();
  let lockCleared = false;

  for (const studentId of studentIds) {
    if (!locked.has(studentId)) continue;

    const index = previousGroupIndex.get(studentId);
    if (index !== undefined && index < groups.length) {
      groups[index]?.studentIds.push(studentId);
      placed.add(studentId);
      keptLocked.push(studentId);
    } else {
      // 모둠 수를 줄이면 갈 곳이 없어진다. 조용히 흘리지 않고 알린다.
      lockCleared = true;
    }
  }

  return { placed, keptLocked, lockCleared };
}

/** 모둠장은 그 모둠에 남아 있을 때만 유지한다. groups를 직접 고친다. */
function restoreLeaders(groups: Group[], existingGroups: readonly Group[]): void {
  for (const [index, group] of groups.entries()) {
    const previousLeader = existingGroups[index]?.leaderId ?? null;
    group.leaderId =
      previousLeader !== null && group.studentIds.includes(previousLeader) ? previousLeader : null;
  }
}

// ─────────────────────────────────────────────────────────────

export function createDefaultGroups(count: number, classId: string, now: string): Group[] {
  return Array.from({ length: count }, (_, index) => {
    const color = GROUP_COLORS[index % GROUP_COLORS.length];
    return {
      id: createId(),
      classId,
      name: `${index + 1}모둠`,
      color: color?.id ?? 'slate',
      studentIds: [],
      leaderId: null,
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function performRandomGrouping(
  studentIds: readonly string[],
  classId: string,
  targetGroupCount: number,
  existingGroups: readonly Group[],
  lockedStudentIds: readonly string[],
  now: string,
  rng: Rng = systemRng,
): GroupingResult {
  const groupCount = Math.max(1, targetGroupCount);
  const groups = buildGroupShells(groupCount, classId, existingGroups, now);
  const { placed, keptLocked, lockCleared } = seatLockedStudents(
    groups,
    studentIds,
    existingGroups,
    lockedStudentIds,
  );

  const capacities = computeTargetCapacities(studentIds.length, groupCount);
  const remaining = shuffle(
    studentIds.filter((studentId) => !placed.has(studentId)),
    rng,
  );

  const leftover: string[] = [];
  for (const studentId of remaining) {
    const target = groups.findIndex(
      (group, index) => group.studentIds.length < (capacities[index] ?? 0),
    );

    if (target === -1) leftover.push(studentId);
    else groups[target]?.studentIds.push(studentId);
  }

  /*
   * 누락 방지 backstop.
   *
   * 현재 정원 계산으로는 여기에 도달하지 않는다. 정원의 합이 전체 인원과 같고,
   * 한 모둠이 정원을 넘겨도 다른 모둠의 정원은 줄지 않으므로 남은 자리 합은
   * 항상 남은 학생 수 이상이다. (원본에는 이 단계가 없었지만 그것도 결함은 아니었다.)
   *
   * 그래도 남겨 둔다. 정원 계산 방식이 바뀌면 즉시 깨지는 곳이고,
   * 학생이 조용히 빠지는 결과는 화면상 정상으로 보여 알아채기 어렵다.
   * 비용은 빈 배열 순회 한 번이다.
   */
  for (const studentId of leftover) {
    const smallest = groups.reduce(
      (best, group, index) =>
        group.studentIds.length < (groups[best]?.studentIds.length ?? Infinity) ? index : best,
      0,
    );
    groups[smallest]?.studentIds.push(studentId);
  }

  restoreLeaders(groups, existingGroups);

  return { groups, lockedStudentIds: keptLocked, lockCleared };
}

// ── 균형 편성 ─────────────────────────────────────────────────

export interface BalancedInput {
  studentId: string;
  gender: Gender;
  tags: readonly string[];
}

interface Fit {
  /** 이 학생의 태그와 겹치는 인원 */
  tagClash: number;
  /** 같은 성별 인원 */
  sameGender: number;
  size: number;
}

function fitOf(group: Group, student: BalancedInput, byId: Map<string, BalancedInput>): Fit {
  const tags = new Set(student.tags);
  let tagClash = 0;
  let sameGender = 0;

  for (const memberId of group.studentIds) {
    const member = byId.get(memberId);
    // 명단에서 빠졌는데 고정 자리에 남아 있는 학생. 균형 계산에서는 뺀다.
    if (member === undefined) continue;

    if (member.gender === student.gender) sameGender += 1;
    if (member.tags.some((tag) => tags.has(tag))) tagClash += 1;
  }

  return { tagClash, sameGender, size: group.studentIds.length };
}

/** 앞 기준에서 갈리면 뒤는 보지 않는다. 전부 같으면 false — 먼저 본 모둠이 이긴다. */
function isBetterFit(candidate: Fit, best: Fit): boolean {
  if (candidate.tagClash !== best.tagClash) return candidate.tagClash < best.tagClash;
  if (candidate.sameGender !== best.sameGender) return candidate.sameGender < best.sameGender;
  return candidate.size < best.size;
}

/**
 * 성별과 특성 태그를 고르게 나누는 편성.
 *
 * performRandomGrouping을 대체하지 않는다. "그냥 무작위"도 교사가 고를 수 있어야 한다.
 *
 * 한 명씩 보며 가장 아쉬운 모둠에 넣는다. 성별로 미리 나눠 뱀 순서로 돌리는
 * 방법도 있지만 이쪽을 쓴다. 성별과 태그가 같은 저울에 올라가기 때문이다.
 * 성별로 먼저 나누면 태그는 그 안에서만 조정되고, 성별이 치우친 학급에서 태그가 뭉친다.
 *
 * 완벽한 균형은 약속하지 않는다. 25명을 4모둠으로 나누면 6·6·6·7이고,
 * 남학생이 3명뿐이면 한 모둠은 남학생이 없다. 화면에서 교사가 고칠 수 있다.
 */
export function performBalancedGrouping(
  students: readonly BalancedInput[],
  classId: string,
  targetGroupCount: number,
  existingGroups: readonly Group[],
  lockedStudentIds: readonly string[],
  now: string,
  rng: Rng = systemRng,
): GroupingResult {
  const groupCount = Math.max(1, targetGroupCount);
  const groups = buildGroupShells(groupCount, classId, existingGroups, now);

  const studentIds = students.map((student) => student.studentId);
  const { placed, keptLocked, lockCleared } = seatLockedStudents(
    groups,
    studentIds,
    existingGroups,
    lockedStudentIds,
  );

  const byId = new Map(students.map((student) => [student.studentId, student]));
  const capacities = computeTargetCapacities(students.length, groupCount);

  // 순서가 고정이면 매번 같은 편성이 나온다.
  const remaining = shuffle(
    students.filter((student) => !placed.has(student.studentId)),
    rng,
  );

  for (const student of remaining) {
    const roomy: number[] = [];
    groups.forEach((group, index) => {
      if (group.studentIds.length < (capacities[index] ?? 0)) roomy.push(index);
    });

    // 고정 학생이 한 모둠에 몰려 정원이 다 찬 경우. 그래도 반드시 어딘가에 넣는다.
    const candidates = roomy.length > 0 ? roomy : groups.map((_, index) => index);

    let bestIndex = -1;
    let bestFit: Fit | null = null;

    for (const index of candidates) {
      const group = groups[index];
      if (group === undefined) continue;

      const fit = fitOf(group, student, byId);
      if (bestFit === null || isBetterFit(fit, bestFit)) {
        bestIndex = index;
        bestFit = fit;
      }
    }

    groups[bestIndex]?.studentIds.push(student.studentId);
  }

  restoreLeaders(groups, existingGroups);

  return { groups, lockedStudentIds: keptLocked, lockCleared };
}
