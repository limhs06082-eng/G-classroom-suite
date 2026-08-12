import { createId } from '../../shared/domain/factories';
import type { Group } from '../../shared/domain/types';
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

  // 기존 모둠은 이름·색·id를 유지하고 구성원만 비운다. 교사가 붙인 이름이 사라지면 안 된다.
  const groups: Group[] = Array.from({ length: groupCount }, (_, index) => {
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
    if (index !== undefined && index < groupCount) {
      groups[index]?.studentIds.push(studentId);
      placed.add(studentId);
      keptLocked.push(studentId);
    } else {
      // 모둠 수를 줄이면 갈 곳이 없어진다. 조용히 흘리지 않고 알린다.
      lockCleared = true;
    }
  }

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
    else {
      groups[target]?.studentIds.push(studentId);
      placed.add(studentId);
    }
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
    placed.add(studentId);
  }

  // 모둠장은 그 모둠에 남아 있을 때만 유지한다.
  for (const [index, group] of groups.entries()) {
    const previousLeader = existingGroups[index]?.leaderId ?? null;
    group.leaderId =
      previousLeader !== null && group.studentIds.includes(previousLeader) ? previousLeader : null;
  }

  return { groups, lockedStudentIds: keptLocked, lockCleared };
}
