import { useCallback, useMemo } from 'react';

import {
  createDutyCompletion,
  createDutyRole,
  createDutyRound,
  STARTER_ROLES,
} from '../../shared/domain/factories';
import type {
  DutyCompletion,
  DutyProfile,
  DutyRole,
  DutyRound,
  Student,
  SuiteData,
} from '../../shared/domain/types';
import { useActiveClass, useRoster, useSuite } from '../../shared/roster/SuiteDataProvider';
import {
  roleAppliesOn,
  runAutoAssign,
  summarizeFairness,
  weekOf,
  type AutoAssignWarning,
  type DutyWeek,
  type FairnessSummary,
} from './dutyCore';

/**
 * 역할·당번 화면과 저장소를 잇는 훅.
 *
 * 화면은 localStorage를 모른다. 전부 useSuite().update를 거친다.
 */

/** 오늘 이 역할을 맡은 학생. 대타가 있으면 대타로 바꿔 보여 준다. */
export interface TodayDuty {
  role: DutyRole;
  students: Student[];
  /** 원래 담당인데 오늘 대타로 바뀐 학생 */
  replaced: Array<{ original: Student; substitute: Student }>;
  /** 오늘 수행을 마친 학생. 개별 체크 표시는 이것을 봐야 한다. */
  doneStudentIds: Set<string>;
  /** 이 역할의 담당 전원이 마쳤는가 */
  isDone: boolean;
}

export interface DutyView {
  classId: string | null;
  today: string;
  week: DutyWeek;
  roles: DutyRole[];
  currentRound: DutyRound | null;
  history: DutyRound[];
  todayDuties: TodayDuty[];
  fairness: FairnessSummary;
  roster: Student[];
  studentById: Map<string, Student>;
  hasRoles: boolean;

  seedStarterRoles: () => number;
  addRole: (input: Pick<DutyRole, 'name' | 'category' | 'neededCount' | 'cycle'>) => void;
  updateRole: (roleId: string, patch: Partial<DutyRole>) => void;
  deleteRole: (roleId: string) => Promise<void>;
  assignWeek: () => { warnings: AutoAssignWarning[]; assignedRoles: number };
  toggleRoleLock: (roleId: string) => void;
  toggleCompleted: (roleId: string, studentId: string) => void;
  /** 역할 하나의 오늘 완료를 통째로 켜거나 끈다. 청소 검사 때 12번 누르지 않게. */
  setRoleDone: (roleId: string, studentIds: string[], done: boolean) => void;
  setSubstitute: (roleId: string, originalStudentId: string, substituteStudentId: string | null) => void;
  clearRounds: () => Promise<void>;
}

function todayString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function upsertCompletion(
  data: SuiteData,
  classId: string,
  date: string,
  recipe: (completion: DutyCompletion) => DutyCompletion,
): SuiteData {
  const existing = data.dutyCompletions.find((c) => c.classId === classId && c.date === date);
  const next = recipe(existing ?? createDutyCompletion(classId, date));

  return {
    ...data,
    dutyCompletions: existing
      ? data.dutyCompletions.map((c) => (c.classId === classId && c.date === date ? next : c))
      : [...data.dutyCompletions, next],
  };
}

export function useDuty(): DutyView {
  const { data, update, guard } = useSuite();
  const activeClass = useActiveClass();
  const roster = useRoster();

  const classId = activeClass?.id ?? null;
  const today = todayString();
  const week = useMemo(() => weekOf(today), [today]);

  const roles = useMemo(
    () => (classId === null ? [] : data.dutyRoles.filter((role) => role.classId === classId)),
    [data.dutyRoles, classId],
  );

  const rounds = useMemo(
    () =>
      classId === null
        ? []
        : data.dutyRounds
            .filter((round) => round.classId === classId)
            .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [data.dutyRounds, classId],
  );

  /** 오늘이 포함된 차례. 없으면 가장 최근 것을 보여 준다. */
  const currentRound = useMemo(() => {
    const covering = rounds.find((round) => today >= round.startDate && today <= round.endDate);
    return covering ?? rounds[rounds.length - 1] ?? null;
  }, [rounds, today]);

  const studentById = useMemo(() => new Map(roster.map((s) => [s.id, s])), [roster]);

  const completion = useMemo(
    () =>
      classId === null
        ? null
        : (data.dutyCompletions.find((c) => c.classId === classId && c.date === today) ?? null),
    [data.dutyCompletions, classId, today],
  );

  const todayDuties = useMemo((): TodayDuty[] => {
    if (currentRound === null) return [];

    const substitutions = completion?.substitutions ?? [];
    const doneKeys = new Set((completion?.completed ?? []).map((c) => `${c.roleId}:${c.studentId}`));

    return roles
      .filter((role) => roleAppliesOn(role, today))
      .flatMap((role) => {
        const assignment = currentRound.assignments.find((a) => a.roleId === role.id);
        if (assignment === undefined) return [];

        const replaced: TodayDuty['replaced'] = [];
        const students: Student[] = [];

        for (const studentId of assignment.studentIds) {
          const swap = substitutions.find(
            (s) => s.roleId === role.id && s.originalStudentId === studentId,
          );
          const original = studentById.get(studentId);
          const substitute = swap === undefined ? undefined : studentById.get(swap.substituteStudentId);

          if (original !== undefined && substitute !== undefined) {
            replaced.push({ original, substitute });
            students.push(substitute);
          } else if (original !== undefined) {
            students.push(original);
          }
        }

        const doneStudentIds = new Set(
          students.filter((student) => doneKeys.has(`${role.id}:${student.id}`)).map((s) => s.id),
        );

        return [
          {
            role,
            students,
            replaced,
            doneStudentIds,
            isDone: students.length > 0 && doneStudentIds.size === students.length,
          },
        ];
      });
  }, [roles, currentRound, completion, today, studentById]);

  const fairness = useMemo(
    () =>
      summarizeFairness(
        roster.map((student) => ({ id: student.id, order: student.number })),
        rounds,
      ),
    [roster, rounds],
  );

  const seedStarterRoles = useCallback((): number => {
    if (classId === null) return 0;

    const now = new Date().toISOString();
    const created = STARTER_ROLES.map((preset) => createDutyRole({ classId, ...preset }, now));

    update((current) => ({ ...current, dutyRoles: [...current.dutyRoles, ...created] }));
    return created.length;
  }, [classId, update]);

  const addRole = useCallback(
    (input: Pick<DutyRole, 'name' | 'category' | 'neededCount' | 'cycle'>): void => {
      if (classId === null) return;
      const role = createDutyRole({ classId, ...input });
      update((current) => ({ ...current, dutyRoles: [...current.dutyRoles, role] }));
    },
    [classId, update],
  );

  const updateRole = useCallback(
    (roleId: string, patch: Partial<DutyRole>): void => {
      const now = new Date().toISOString();
      update((current) => ({
        ...current,
        dutyRoles: current.dutyRoles.map((role) =>
          role.id === roleId ? { ...role, ...patch, updatedAt: now } : role,
        ),
      }));
    },
    [update],
  );

  const deleteRole = useCallback(
    async (roleId: string): Promise<void> => {
      // 역할을 지우면 그 역할의 지난 배정 기록도 함께 사라진다.
      await guard('역할 삭제 직전');
      update((current) => ({
        ...current,
        dutyRoles: current.dutyRoles.filter((role) => role.id !== roleId),
      }));
    },
    [guard, update],
  );

  const assignWeek = useCallback((): { warnings: AutoAssignWarning[]; assignedRoles: number } => {
    if (classId === null) return { warnings: [], assignedRoles: 0 };

    const profiles = new Map<string, DutyProfile>(
      data.dutyProfiles.map((profile) => [profile.studentId, profile]),
    );

    const existing = rounds.find((round) => round.startDate === week.startDate) ?? null;
    const past = rounds.filter((round) => round.startDate !== week.startDate);

    const result = runAutoAssign({
      candidates: roster.map((student) => ({ id: student.id, order: student.number })),
      roles,
      profiles,
      history: past,
      date: week.startDate,
      lockedRoleIds: existing?.lockedRoleIds ?? [],
      previousAssignments: existing?.assignments ?? [],
    });

    const now = new Date().toISOString();
    const round = createDutyRound(
      {
        ...(existing === null ? {} : { id: existing.id }),
        classId,
        startDate: week.startDate,
        endDate: week.endDate,
        label: week.label,
        assignments: result.assignments,
        lockedRoleIds: existing?.lockedRoleIds ?? [],
      },
      now,
    );

    update((current) => {
      /*
       * 재배정하면 **오늘부터의** 완료·대체 기록을 새 배정에 맞춰 정리한다.
       *
       * 안 하면 새로 뽑힌 학생이 예전에 그 역할로 체크된 적 있을 때
       * 하지도 않은 당번이 완료로 표시된다. 당번 체크는 이 화면의
       * 신뢰도 그 자체다.
       *
       * 지난 날짜는 건드리지 않는다 — 월요일에 실제로 한 청소는 수요일에
       * 재배정했다고 없던 일이 되지 않는다. 대타의 완료도 지키기 위해,
       * 완료는 "새 배정에 있거나 그날 대타로 지정된 학생"이면 남긴다.
       */
      const today = todayString();
      const stillAssigned = (roleId: string, studentId: string): boolean =>
        round.assignments.some((a) => a.roleId === roleId && a.studentIds.includes(studentId));

      const dutyCompletions = current.dutyCompletions.map((entry) => {
        if (entry.classId !== classId) return entry;
        if (entry.date < week.startDate || entry.date > week.endDate) return entry;
        if (entry.date < today) return entry; // 지난 일은 역사다.

        const substitutions = entry.substitutions.filter((s) =>
          stillAssigned(s.roleId, s.originalStudentId),
        );
        const isSubstitute = (roleId: string, studentId: string): boolean =>
          substitutions.some((s) => s.roleId === roleId && s.substituteStudentId === studentId);

        return {
          ...entry,
          completed: entry.completed.filter(
            (c) => stillAssigned(c.roleId, c.studentId) || isSubstitute(c.roleId, c.studentId),
          ),
          substitutions,
        };
      });

      return {
        ...current,
        dutyRounds: [
          ...current.dutyRounds.filter(
            (r) => !(r.classId === classId && r.startDate === week.startDate),
          ),
          round,
        ],
        dutyCompletions,
      };
    });

    return { warnings: result.warnings, assignedRoles: result.assignments.length };
  }, [classId, data.dutyProfiles, roster, roles, rounds, week, update]);

  const toggleRoleLock = useCallback(
    (roleId: string): void => {
      if (currentRound === null) return;

      const now = new Date().toISOString();
      update((current) => ({
        ...current,
        dutyRounds: current.dutyRounds.map((round) => {
          if (round.id !== currentRound.id) return round;

          const locked = new Set(round.lockedRoleIds);
          if (locked.has(roleId)) locked.delete(roleId);
          else locked.add(roleId);

          return { ...round, lockedRoleIds: [...locked], updatedAt: now };
        }),
      }));
    },
    [currentRound, update],
  );

  const toggleCompleted = useCallback(
    (roleId: string, studentId: string): void => {
      if (classId === null) return;

      update((current) =>
        upsertCompletion(current, classId, today, (entry) => {
          const exists = entry.completed.some(
            (c) => c.roleId === roleId && c.studentId === studentId,
          );
          return {
            ...entry,
            completed: exists
              ? entry.completed.filter((c) => !(c.roleId === roleId && c.studentId === studentId))
              : [...entry.completed, { roleId, studentId }],
          };
        }),
      );
    },
    [classId, today, update],
  );

  const setRoleDone = useCallback(
    (roleId: string, studentIds: string[], done: boolean): void => {
      if (classId === null) return;

      update((current) =>
        upsertCompletion(current, classId, today, (entry) => {
          const rest = entry.completed.filter((c) => c.roleId !== roleId);
          return {
            ...entry,
            completed: done
              ? [...rest, ...studentIds.map((studentId) => ({ roleId, studentId }))]
              : rest,
          };
        }),
      );
    },
    [classId, today, update],
  );

  const setSubstitute = useCallback(
    (roleId: string, originalStudentId: string, substituteStudentId: string | null): void => {
      if (classId === null) return;

      update((current) =>
        upsertCompletion(current, classId, today, (entry) => {
          const without = entry.substitutions.filter(
            (s) => !(s.roleId === roleId && s.originalStudentId === originalStudentId),
          );
          return {
            ...entry,
            substitutions:
              substituteStudentId === null
                ? without
                : [...without, { roleId, originalStudentId, substituteStudentId }],
          };
        }),
      );
    },
    [classId, today, update],
  );

  const clearRounds = useCallback(async (): Promise<void> => {
    if (classId === null) return;
    await guard('당번 기록 초기화 직전');
    update((current) => ({
      ...current,
      dutyRounds: current.dutyRounds.filter((round) => round.classId !== classId),
    }));
  }, [classId, guard, update]);

  return {
    classId,
    today,
    week,
    roles,
    currentRound,
    history: rounds,
    todayDuties,
    fairness,
    roster,
    studentById,
    hasRoles: roles.length > 0,
    seedStarterRoles,
    addRole,
    updateRole,
    deleteRole,
    assignWeek,
    toggleRoleLock,
    toggleCompleted,
    setRoleDone,
    setSubstitute,
    clearRounds,
  };
}
