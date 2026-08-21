import type { LessonPhase, LessonStage, LessonTemplate } from '../../shared/domain/types';

/**
 * 수업 진행 계산.
 *
 * 원본 G-lesson-flow-board를 옮기면서 진행 상태를 순수 함수로 뽑았다.
 * 화면 안에 있으면 "마지막 단계에서 다음을 누르면?" 같은 경계를 확인할 수 없다.
 */

export const PHASE_LABELS: Record<LessonPhase, string> = {
  intro: '도입',
  activity: '활동',
  wrapup: '정리',
};

export const MODE_LABELS: Record<LessonStage['mode'], string> = {
  individual: '개별',
  pair: '짝',
  group: '모둠',
  whole: '전체',
};

export function totalMinutes(template: LessonTemplate): number {
  return template.stages.reduce((sum, stage) => sum + stage.minutes, 0);
}

export interface LessonProgress {
  /** 현재 단계. 단계가 없으면 null */
  current: LessonStage | null;
  /** 다음에 올 단계. 마지막이면 null */
  next: LessonStage | null;
  index: number;
  total: number;
  /** 완료 체크한 단계 수 기준 진행률 0~1 */
  ratio: number;
  doneCount: number;
  isLast: boolean;
}

export function progressOf(
  template: LessonTemplate,
  stageIndex: number,
  doneStageIds: readonly string[],
): LessonProgress {
  const total = template.stages.length;
  // 저장된 번호가 범위를 벗어나도 화면이 깨지지 않아야 한다.
  const index = total === 0 ? 0 : Math.max(0, Math.min(stageIndex, total - 1));

  const doneSet = new Set(doneStageIds);
  const doneCount = template.stages.filter((stage) => doneSet.has(stage.id)).length;

  return {
    current: template.stages[index] ?? null,
    next: template.stages[index + 1] ?? null,
    index,
    total,
    ratio: total === 0 ? 0 : doneCount / total,
    doneCount,
    isLast: total === 0 || index >= total - 1,
  };
}

/** 다음 단계 번호. 마지막에서는 그대로 머문다. */
export function nextIndex(current: number, total: number): number {
  return total === 0 ? 0 : Math.min(current + 1, total - 1);
}

export function prevIndex(current: number): number {
  return Math.max(0, current - 1);
}

/** 단계를 위아래로 옮긴다. 범위를 벗어나면 원본을 그대로 돌려준다. */
export function moveStage(stages: readonly LessonStage[], from: number, to: number): LessonStage[] {
  if (from === to || from < 0 || to < 0 || from >= stages.length || to >= stages.length) {
    return [...stages];
  }

  const result = [...stages];
  const [moved] = result.splice(from, 1);
  if (moved !== undefined) result.splice(to, 0, moved);
  return result;
}
