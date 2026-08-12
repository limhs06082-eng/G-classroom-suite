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
  ScoreGoal,
  ScoreTargetUnit,
  Student,
} from '../../shared/domain/types';
import { useActiveClass, useRoster, useSuite } from '../../shared/roster/SuiteDataProvider';
import {
  computeScores,
  cycleRangeFor,
  goalProgress,
  type CyclePeriod,
  type GoalProgress,
  type ScoreTotals,
} from './rewardCore';

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
  award: (
    preset: BehaviorPreset,
    targetId: string,
    override?: { points?: number; reason?: string },
  ) => string | null;
  revoke: (entryId: string) => void;
  restore: (entryId: string) => void;
  addGoal: (input: Pick<ScoreGoal, 'title' | 'targetUnit' | 'targetId' | 'targetPoints' | 'reward'>) => void;
  deleteGoal: (goalId: string) => void;
  clearEntries: () => Promise<void>;
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

  const goals = useMemo(
    () =>
      (classId === null ? [] : data.scoreGoals.filter((goal) => goal.classId === classId)).map(
        (goal) => goalProgress(goal, totals),
      ),
    [data.scoreGoals, classId, totals],
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
    ): string | null => {
      if (classId === null) return null;

      const entry = createScoreEntry({
        classId,
        targetUnit: preset.targetUnit,
        targetId: preset.targetUnit === 'class' ? CLASS_TARGET_ID : targetId,
        points: override.points ?? preset.defaultPoints,
        reason: override.reason ?? preset.name,
        presetId: preset.id,
      });

      update((current) => ({ ...current, scoreEntries: [...current.scoreEntries, entry] }));
      return entry.id;
    },
    [classId, update],
  );

  const revoke = useCallback(
    (entryId: string): void => {
      const now = new Date().toISOString();
      update((current) => ({
        ...current,
        scoreEntries: current.scoreEntries.map((entry) =>
          entry.id === entryId ? { ...entry, revokedAt: now } : entry,
        ),
      }));
    },
    [update],
  );

  const restore = useCallback(
    (entryId: string): void => {
      update((current) => ({
        ...current,
        scoreEntries: current.scoreEntries.map((entry) => {
          if (entry.id !== entryId) return entry;
          const { revokedAt: _revokedAt, ...rest } = entry;
          return rest;
        }),
      }));
    },
    [update],
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
    revoke,
    restore,
    addGoal,
    deleteGoal,
    clearEntries,
  };
}

export type { ScoreTargetUnit };
