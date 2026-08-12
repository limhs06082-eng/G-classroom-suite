import { useCallback, useMemo } from 'react';

import type { Group, Student, SuiteData } from '../../shared/domain/types';
import { useActiveClass, useRoster, useSuite } from '../../shared/roster/SuiteDataProvider';
import { computeGroupCount, performRandomGrouping } from './groupingCore';
import type { GroupingMode } from './types';

/**
 * 모둠 편성 화면과 저장소를 잇는 훅.
 *
 * 여기서 만든 모둠을 9단계 보상 기능이 그대로 소비한다.
 * 그래서 모둠은 seating 전용 데이터가 아니라 shared/domain의 Group이다.
 */

/** 다른 학급의 모둠은 건드리지 않고 이 학급 것만 갈아 끼운다. */
function replaceClassGroups(data: SuiteData, classId: string, groups: Group[]): SuiteData {
  return {
    ...data,
    groups: [...data.groups.filter((group) => group.classId !== classId), ...groups],
  };
}

export interface GroupingView {
  groups: Group[];
  /** 학생 id → 소속 모둠 */
  groupByStudent: Map<string, Group>;
  /** 어느 모둠에도 없는 재학생 */
  ungrouped: Student[];
  lockedStudentIds: Set<string>;
  roster: Student[];
  studentById: Map<string, Student>;
  /** 인원과 설정으로 계산한 권장 모둠 수 */
  suggestGroupCount: (mode: GroupingMode, groupCount: number, membersPerGroup: number) => number;

  shuffleGroups: (targetCount: number) => { lockCleared: boolean };
  renameGroup: (groupId: string, name: string) => void;
  setLeader: (groupId: string, studentId: string | null) => void;
  toggleGroupLock: (studentId: string) => void;
  moveStudent: (studentId: string, targetGroupId: string | null) => void;
  clearGroups: () => Promise<void>;
}

export function useGrouping(): GroupingView {
  const { data, update, guard } = useSuite();
  const activeClass = useActiveClass();
  const roster = useRoster();

  const classId = activeClass?.id ?? null;

  const groups = useMemo(
    () => (classId === null ? [] : data.groups.filter((group) => group.classId === classId)),
    [data.groups, classId],
  );

  const studentById = useMemo(() => new Map(roster.map((s) => [s.id, s])), [roster]);

  const groupByStudent = useMemo(() => {
    const map = new Map<string, Group>();
    for (const group of groups) {
      for (const studentId of group.studentIds) {
        // 전출생은 모둠에서 보이지 않게 한다. 기록은 남아 있다.
        if (studentById.has(studentId)) map.set(studentId, group);
      }
    }
    return map;
  }, [groups, studentById]);

  const ungrouped = useMemo(
    () => roster.filter((student) => !groupByStudent.has(student.id)),
    [roster, groupByStudent],
  );

  const lockedStudentIds = useMemo(
    () => new Set(data.seatingProfiles.filter((p) => p.isGroupLocked).map((p) => p.studentId)),
    [data.seatingProfiles],
  );

  const shuffleGroups = useCallback(
    (targetCount: number): { lockCleared: boolean } => {
      if (classId === null) return { lockCleared: false };

      const now = new Date().toISOString();
      const result = performRandomGrouping(
        roster.map((student) => student.id),
        classId,
        targetCount,
        groups,
        [...lockedStudentIds],
        now,
      );

      update((current) => replaceClassGroups(current, classId, result.groups));
      return { lockCleared: result.lockCleared };
    },
    [classId, roster, groups, lockedStudentIds, update],
  );

  const renameGroup = useCallback(
    (groupId: string, name: string): void => {
      const trimmed = name.trim();
      if (trimmed === '') return;

      const now = new Date().toISOString();
      update((current) => ({
        ...current,
        groups: current.groups.map((group) =>
          group.id === groupId ? { ...group, name: trimmed, updatedAt: now } : group,
        ),
      }));
    },
    [update],
  );

  const setLeader = useCallback(
    (groupId: string, studentId: string | null): void => {
      const now = new Date().toISOString();
      update((current) => ({
        ...current,
        groups: current.groups.map((group) =>
          group.id === groupId ? { ...group, leaderId: studentId, updatedAt: now } : group,
        ),
      }));
    },
    [update],
  );

  const toggleGroupLock = useCallback(
    (studentId: string): void => {
      update((current) => ({
        ...current,
        seatingProfiles: current.seatingProfiles.map((profile) =>
          profile.studentId === studentId
            ? { ...profile, isGroupLocked: !profile.isGroupLocked }
            : profile,
        ),
      }));
    },
    [update],
  );

  const moveStudent = useCallback(
    (studentId: string, targetGroupId: string | null): void => {
      const now = new Date().toISOString();
      update((current) => ({
        ...current,
        groups: current.groups.map((group) => {
          const has = group.studentIds.includes(studentId);

          // 어느 모둠에 있든 먼저 빼고, 대상 모둠에만 넣는다.
          // 한 학생이 두 모둠에 남는 일이 없어야 한다.
          if (group.id === targetGroupId) {
            return has
              ? group
              : { ...group, studentIds: [...group.studentIds, studentId], updatedAt: now };
          }
          if (!has) return group;

          return {
            ...group,
            studentIds: group.studentIds.filter((id) => id !== studentId),
            // 모둠을 떠난 학생이 모둠장으로 남아 있으면 안 된다.
            leaderId: group.leaderId === studentId ? null : group.leaderId,
            updatedAt: now,
          };
        }),
      }));
    },
    [update],
  );

  const clearGroups = useCallback(async (): Promise<void> => {
    if (classId === null) return;
    await guard('모둠 편성 초기화 직전');
    update((current) => replaceClassGroups(current, classId, []));
  }, [classId, guard, update]);

  const suggestGroupCount = useCallback(
    (mode: GroupingMode, groupCount: number, membersPerGroup: number): number =>
      computeGroupCount(mode, groupCount, membersPerGroup, roster.length),
    [roster.length],
  );

  return {
    groups,
    groupByStudent,
    ungrouped,
    lockedStudentIds,
    roster,
    studentById,
    suggestGroupCount,
    shuffleGroups,
    renameGroup,
    setLeader,
    toggleGroupLock,
    moveStudent,
    clearGroups,
  };
}
