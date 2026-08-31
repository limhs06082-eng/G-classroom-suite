import { useCallback, useMemo, useState } from 'react';

import {
  CLASS_TARGET_ID,
  createBehaviorPreset,
  createScoreEntry,
  createScoreGoal,
  STARTER_PRESETS,
} from '../../shared/domain/factories';
import type {
  BehaviorPreset,
  Group,
  ScoreEntry,
  ScoreCycle,
  ScoreGoal,
  ScoreTargetUnit,
  Student,
  SuiteData,
} from '../../shared/domain/types';
import { useActiveClass, useRoster, useSuite } from '../../shared/roster/SuiteDataProvider';
import {
  computeScores,
  cycleRangeFor,
  goalProgress,
  startOfDayIso,
  syncGoalAchievements,
  type CyclePeriod,
  type GoalProgress,
  type ScoreTotals,
} from './rewardCore';

/**
 * 점수가 움직인 뒤 목표 달성 상태를 맞춘다.
 *
 * useEffect로 나중에 감시하지 않는다. 그러면 저장이 두 번 일어나고,
 * 다른 창이 같은 자료를 동시에 고칠 때 어느 쪽이 이길지 알 수 없다.
 * **점수 변경과 달성 기록이 한 번의 저장으로 함께 일어나야 한다.**
 */
function withGoalSync(
  data: SuiteData,
  classId: string,
  now: string,
): { data: SuiteData; newlyAchieved: ScoreGoal[] } {
  const mine = data.scoreGoals.filter((goal) => goal.classId === classId);
  const entries = data.scoreEntries.filter((entry) => entry.classId === classId);
  const groups = data.groups.filter((group) => group.classId === classId);

  const synced = syncGoalAchievements(mine, entries, groups, now);

  // 하나도 안 바뀌었으면 배열을 새로 만들지 않는다.
  const changed = synced.goals.some((goal, index) => goal !== mine[index]);
  if (!changed) return { data, newlyAchieved: [] };

  const byId = new Map(synced.goals.map((goal) => [goal.id, goal]));

  return {
    data: {
      ...data,
      scoreGoals: data.scoreGoals.map((goal) => byId.get(goal.id) ?? goal),
    },
    newlyAchieved: synced.newlyAchieved,
  };
}

/**
 * 활동·보상 화면과 저장소를 잇는 훅.
 *
 * 모둠은 seating 기능이 만든 것을 그대로 읽는다.
 * 원본에서는 두 앱에서 모둠을 각각 만들어야 했다.
 */

export interface RewardView {
  classId: string | null;
  period: CyclePeriod;
  setPeriod: (period: CyclePeriod) => void;
  periodLabel: string;

  presets: BehaviorPreset[];
  hasPresets: boolean;
  roster: Student[];
  groups: Group[];
  totals: ScoreTotals;
  goals: GoalProgress[];
  /** 최근 기록부터 */
  recentEntries: ScoreEntry[];
  studentById: Map<string, Student>;

  seedStarterPresets: () => number;
  addPreset: (input: Pick<BehaviorPreset, 'name' | 'defaultPoints' | 'targetUnit' | 'color'>) => void;
  deletePreset: (presetId: string) => void;
  /** 새로 달성된 목표를 함께 돌려준다. 화면이 축하를 띄운다. */
  award: (
    preset: BehaviorPreset,
    targetId: string,
    override?: { points?: number; reason?: string },
  ) => { entryId: string; achieved: ScoreGoal[] } | null;
  /** 여러 대상에게 한 번의 update()로. 실행 취소는 revokeMany와 짝이다. */
  awardMany: (
    preset: BehaviorPreset,
    targetIds: readonly string[],
  ) => { entryIds: string[]; achieved: ScoreGoal[] } | null;
  revokeMany: (entryIds: readonly string[]) => void;
  revoke: (entryId: string) => void;
  restore: (entryId: string) => void;
  addGoal: (input: Pick<ScoreGoal, 'title' | 'targetUnit' | 'targetId' | 'targetPoints' | 'reward'>) => void;
  deleteGoal: (goalId: string) => void;
  /** 지운 목표 되살리기 — 삭제 실행 취소용 */
  restoreGoal: (goal: ScoreGoal) => void;
  clearEntries: () => Promise<void>;
  /** 점수 주기 설정을 바꾼다 */
  setCycle: (patch: Partial<ScoreCycle>) => void;
  cycle: ScoreCycle;
}

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function useReward(): RewardView {
  const { data, update, guard } = useSuite();
  const activeClass = useActiveClass();
  const roster = useRoster();

  const classId = activeClass?.id ?? null;
  const [period, setPeriod] = useState<CyclePeriod>('weekly');

  const presets = useMemo(
    () =>
      classId === null
        ? []
        : data.behaviorPresets
            .filter((preset) => preset.classId === classId && preset.isActive)
            .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)),
    [data.behaviorPresets, classId],
  );

  const groups = useMemo(
    () => (classId === null ? [] : data.groups.filter((group) => group.classId === classId)),
    [data.groups, classId],
  );

  const entries = useMemo(
    () => (classId === null ? [] : data.scoreEntries.filter((entry) => entry.classId === classId)),
    [data.scoreEntries, classId],
  );

  const range = useMemo(
    () => cycleRangeFor(period, data.scoreCycle, todayString()),
    [period, data.scoreCycle],
  );

  const totals = useMemo(
    () => computeScores(entries, groups, { since: range.since }),
    [entries, groups, range.since],
  );

  /*
   * 목표는 화면의 기간 탭을 따라가지 않는다.
   *
   * 예전에는 위의 totals(기간 탭이 정한 합계)를 그대로 썼다. 그래서 같은
   * 목표가 '이번 주'에서는 12점, '전체'에서는 340점으로 보였고 어느 쪽이
   * 맞는지 화면이 말해 주지 않았다. 목표에는 자기 startDate가 있다.
   *
   * 목표마다 합계를 다시 계산한다. 목표는 한 학급에 많아야 대여섯이고
   * 합산은 기록을 한 번 훑는 일이다.
   */
  const goals = useMemo(
    () =>
      (classId === null ? [] : data.scoreGoals.filter((goal) => goal.classId === classId)).map(
        (goal) =>
          goalProgress(
            goal,
            computeScores(entries, groups, { since: startOfDayIso(goal.startDate) }),
          ),
      ),
    [data.scoreGoals, classId, entries, groups],
  );

  const recentEntries = useMemo(
    () => [...entries].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 60),
    [entries],
  );

  const studentById = useMemo(() => new Map(roster.map((s) => [s.id, s])), [roster]);

  const seedStarterPresets = useCallback((): number => {
    if (classId === null) return 0;

    const now = new Date().toISOString();
    const created = STARTER_PRESETS.map((preset, index) =>
      createBehaviorPreset({ classId, ...preset, order: index }, now),
    );

    update((current) => ({ ...current, behaviorPresets: [...current.behaviorPresets, ...created] }));
    return created.length;
  }, [classId, update]);

  const addPreset = useCallback(
    (input: Pick<BehaviorPreset, 'name' | 'defaultPoints' | 'targetUnit' | 'color'>): void => {
      if (classId === null) return;
      const preset = createBehaviorPreset({ classId, ...input, order: presets.length });
      update((current) => ({ ...current, behaviorPresets: [...current.behaviorPresets, preset] }));
    },
    [classId, presets.length, update],
  );

  const deletePreset = useCallback(
    (presetId: string): void => {
      // 항목을 지워도 이미 준 점수는 남는다. 기록에 사유가 문자열로 저장돼 있다.
      update((current) => ({
        ...current,
        behaviorPresets: current.behaviorPresets.filter((preset) => preset.id !== presetId),
      }));
    },
    [update],
  );

  const award = useCallback(
    (
      preset: BehaviorPreset,
      targetId: string,
      override: { points?: number; reason?: string } = {},
    ): { entryId: string; achieved: ScoreGoal[] } | null => {
      if (classId === null) return null;

      const entry = createScoreEntry({
        classId,
        targetUnit: preset.targetUnit,
        targetId: preset.targetUnit === 'class' ? CLASS_TARGET_ID : targetId,
        points: override.points ?? preset.defaultPoints,
        reason: override.reason ?? preset.name,
        presetId: preset.id,
      });

      const now = new Date().toISOString();
      // update의 콜백은 반환값을 밖으로 낼 수 없다. 여기에 받아 둔다.
      let achieved: ScoreGoal[] = [];

      update((current) => {
        const withEntry = { ...current, scoreEntries: [...current.scoreEntries, entry] };
        const synced = withGoalSync(withEntry, classId, now);
        achieved = synced.newlyAchieved;
        return synced.data;
      });

      return { entryId: entry.id, achieved };
    },
    [classId, update],
  );

  /**
   * 전원에게 한 번에. update() 한 번으로 30건을 넣고 목표 동기화도 한 번만
   * 돈다 — award()를 학급 인원수만큼 돌리면 상태 복제와 목표 재계산이
   * 서른 번 반복돼 학기말(기록 수천 건)에는 눈에 띄게 무겁다.
   */
  const awardMany = useCallback(
    (
      preset: BehaviorPreset,
      targetIds: readonly string[],
    ): { entryIds: string[]; achieved: ScoreGoal[] } | null => {
      if (classId === null || targetIds.length === 0) return null;

      const entries = targetIds.map((targetId) =>
        createScoreEntry({
          classId,
          targetUnit: preset.targetUnit,
          targetId,
          points: preset.defaultPoints,
          reason: preset.name,
          presetId: preset.id,
        }),
      );

      const now = new Date().toISOString();
      let achieved: ScoreGoal[] = [];

      update((current) => {
        const withEntries = { ...current, scoreEntries: [...current.scoreEntries, ...entries] };
        const synced = withGoalSync(withEntries, classId, now);
        achieved = synced.newlyAchieved;
        return synced.data;
      });

      return { entryIds: entries.map((entry) => entry.id), achieved };
    },
    [classId, update],
  );

  /** awardMany의 되돌리기 짝. 역시 update() 한 번이다. */
  const revokeMany = useCallback(
    (entryIds: readonly string[]): void => {
      const ids = new Set(entryIds);
      const now = new Date().toISOString();
      update((current) => {
        const revoked = {
          ...current,
          scoreEntries: current.scoreEntries.map((entry) =>
            ids.has(entry.id) ? { ...entry, revokedAt: now } : entry,
          ),
        };
        return classId === null ? revoked : withGoalSync(revoked, classId, now).data;
      });
    },
    [classId, update],
  );

  const revoke = useCallback(
    (entryId: string): void => {
      const now = new Date().toISOString();
      update((current) => {
        const revoked = {
          ...current,
          scoreEntries: current.scoreEntries.map((entry) =>
            entry.id === entryId ? { ...entry, revokedAt: now } : entry,
          ),
        };
        // 점수가 목표 아래로 떨어졌으면 달성 표시도 풀린다.
        return classId === null ? revoked : withGoalSync(revoked, classId, now).data;
      });
    },
    [classId, update],
  );

  const restore = useCallback(
    (entryId: string): void => {
      const now = new Date().toISOString();
      update((current) => {
        const restored = {
          ...current,
          scoreEntries: current.scoreEntries.map((entry) => {
            if (entry.id !== entryId) return entry;
            const { revokedAt: _revokedAt, ...rest } = entry;
            return rest;
          }),
        };
        return classId === null ? restored : withGoalSync(restored, classId, now).data;
      });
    },
    [classId, update],
  );

  const addGoal = useCallback(
    (
      input: Pick<ScoreGoal, 'title' | 'targetUnit' | 'targetId' | 'targetPoints' | 'reward'>,
    ): void => {
      if (classId === null) return;
      const goal = createScoreGoal({
        classId,
        ...input,
        targetId: input.targetUnit === 'class' ? CLASS_TARGET_ID : input.targetId,
      });
      update((current) => ({ ...current, scoreGoals: [...current.scoreGoals, goal] }));
    },
    [classId, update],
  );

  const deleteGoal = useCallback(
    (goalId: string): void => {
      update((current) => ({
        ...current,
        scoreGoals: current.scoreGoals.filter((goal) => goal.id !== goalId),
      }));
    },
    [update],
  );

  /**
   * 지운 목표를 그대로 되살린다. 삭제 토스트의 실행 취소가 쓴다.
   *
   * 한 학기 누적 목표가 오탭 한 번에 사라지면 시작일·달성 기록까지
   * 같이 사라진다 — 객체째 기억해 뒀다가 그대로 돌려놓는다.
   */
  const restoreGoal = useCallback(
    (goal: ScoreGoal): void => {
      update((current) => ({ ...current, scoreGoals: [...current.scoreGoals, goal] }));
    },
    [update],
  );

  const setCycle = useCallback(
    (patch: Partial<ScoreCycle>): void => {
      update((current) => ({ ...current, scoreCycle: { ...current.scoreCycle, ...patch } }));
    },
    [update],
  );

  const clearEntries = useCallback(async (): Promise<void> => {
    if (classId === null) return;
    await guard('점수 기록 초기화 직전');
    update((current) => ({
      ...current,
      scoreEntries: current.scoreEntries.filter((entry) => entry.classId !== classId),
    }));
  }, [classId, guard, update]);

  return {
    classId,
    period,
    setPeriod,
    periodLabel: range.label,
    presets,
    hasPresets: presets.length > 0,
    roster,
    groups,
    totals,
    goals,
    recentEntries,
    studentById,
    seedStarterPresets,
    addPreset,
    deletePreset,
    award,
    awardMany,
    revokeMany,
    revoke,
    restore,
    addGoal,
    deleteGoal,
    restoreGoal,
    clearEntries,
    setCycle,
    cycle: data.scoreCycle,
  };
}

export type { ScoreTargetUnit };
