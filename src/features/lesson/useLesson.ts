import { useCallback, useMemo } from 'react';

import {
  createLessonTemplate,
  createStage,
  starterLessonStages,
} from '../../shared/domain/factories';
import type { LessonStage, LessonTemplate } from '../../shared/domain/types';
import { useSuite } from '../../shared/roster/SuiteDataProvider';
import { normalizeSubject } from '../../shared/subjects';
import { moveStage, nextIndex, prevIndex, progressOf, type LessonProgress } from './lessonCore';

/** 수업 진행판 화면과 저장소를 잇는 훅. */
export interface LessonView {
  templates: LessonTemplate[];
  /** 진행 중인 수업. 없으면 null */
  running: LessonTemplate | null;
  progress: LessonProgress | null;
  doneStageIds: string[];

  addTemplate: (title: string, withStarter: boolean) => string;
  renameTemplate: (templateId: string, title: string) => void;
  /** 과목은 비워도 된다. 과목이 없는 수업 흐름이 정상이다. */
  setTemplateSubject: (templateId: string, subject: string) => void;
  deleteTemplate: (templateId: string) => Promise<void>;
  updateStage: (templateId: string, stageId: string, patch: Partial<LessonStage>) => void;
  addStage: (templateId: string, phase: LessonStage['phase']) => void;
  removeStage: (templateId: string, stageId: string) => void;
  reorderStage: (templateId: string, from: number, to: number) => void;

  startLesson: (templateId: string) => void;
  stopLesson: () => void;
  goNext: () => void;
  goPrev: () => void;
  goTo: (index: number) => void;
  toggleDone: (stageId: string) => void;
}

export function useLesson(): LessonView {
  const { data, update, guard } = useSuite();

  const templates = useMemo(
    () => [...data.lessonTemplates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data.lessonTemplates],
  );

  const running = useMemo(
    () =>
      data.lessonRun === null
        ? null
        : (data.lessonTemplates.find((item) => item.id === data.lessonRun?.templateId) ?? null),
    [data.lessonRun, data.lessonTemplates],
  );

  const progress = useMemo(
    () =>
      running === null || data.lessonRun === null
        ? null
        : progressOf(running, data.lessonRun.stageIndex, data.lessonRun.doneStageIds),
    [running, data.lessonRun],
  );

  const patchTemplate = useCallback(
    (templateId: string, recipe: (template: LessonTemplate) => LessonTemplate): void => {
      const now = new Date().toISOString();
      update((current) => ({
        ...current,
        lessonTemplates: current.lessonTemplates.map((item) =>
          item.id === templateId ? { ...recipe(item), updatedAt: now } : item,
        ),
      }));
    },
    [update],
  );

  const addTemplate = useCallback(
    (title: string, withStarter: boolean): string => {
      const template = createLessonTemplate({
        title,
        ...(withStarter ? { stages: starterLessonStages() } : {}),
      });
      update((current) => ({ ...current, lessonTemplates: [...current.lessonTemplates, template] }));
      return template.id;
    },
    [update],
  );

  const renameTemplate = useCallback(
    (templateId: string, title: string): void => {
      const trimmed = title.trim();
      if (trimmed === '') return;
      patchTemplate(templateId, (template) => ({ ...template, title: trimmed }));
    },
    [patchTemplate],
  );

  const setTemplateSubject = useCallback(
    (templateId: string, subject: string): void => {
      patchTemplate(templateId, (template) => ({
        ...template,
        subject: normalizeSubject(subject),
      }));
    },
    [patchTemplate],
  );

  const deleteTemplate = useCallback(
    async (templateId: string): Promise<void> => {
      await guard('수업 흐름 삭제 직전');
      update((current) => ({
        ...current,
        lessonTemplates: current.lessonTemplates.filter((item) => item.id !== templateId),
        // 진행 중이던 수업을 지우면 진행 상태도 함께 정리한다.
        lessonRun: current.lessonRun?.templateId === templateId ? null : current.lessonRun,
      }));
    },
    [guard, update],
  );

  const updateStage = useCallback(
    (templateId: string, stageId: string, patch: Partial<LessonStage>): void => {
      patchTemplate(templateId, (template) => ({
        ...template,
        stages: template.stages.map((stage) =>
          stage.id === stageId ? { ...stage, ...patch } : stage,
        ),
      }));
    },
    [patchTemplate],
  );

  const addStage = useCallback(
    (templateId: string, phase: LessonStage['phase']): void => {
      patchTemplate(templateId, (template) => ({
        ...template,
        stages: [...template.stages, createStage({ phase, title: '새 단계', minutes: 5 })],
      }));
    },
    [patchTemplate],
  );

  const removeStage = useCallback(
    (templateId: string, stageId: string): void => {
      patchTemplate(templateId, (template) => ({
        ...template,
        stages: template.stages.filter((stage) => stage.id !== stageId),
      }));
    },
    [patchTemplate],
  );

  const reorderStage = useCallback(
    (templateId: string, from: number, to: number): void => {
      patchTemplate(templateId, (template) => ({
        ...template,
        stages: moveStage(template.stages, from, to),
      }));
    },
    [patchTemplate],
  );

  const startLesson = useCallback(
    (templateId: string): void => {
      update((current) => ({
        ...current,
        lessonRun: {
          templateId,
          stageIndex: 0,
          doneStageIds: [],
          startedAt: new Date().toISOString(),
        },
      }));
    },
    [update],
  );

  const stopLesson = useCallback((): void => {
    update((current) => ({ ...current, lessonRun: null }));
  }, [update]);

  const moveTo = useCallback(
    (compute: (current: number, total: number) => number): void => {
      update((current) => {
        if (current.lessonRun === null) return current;

        const template = current.lessonTemplates.find(
          (item) => item.id === current.lessonRun?.templateId,
        );
        const total = template?.stages.length ?? 0;

        return {
          ...current,
          lessonRun: { ...current.lessonRun, stageIndex: compute(current.lessonRun.stageIndex, total) },
        };
      });
    },
    [update],
  );

  const goNext = useCallback((): void => moveTo(nextIndex), [moveTo]);
  const goPrev = useCallback((): void => moveTo((index) => prevIndex(index)), [moveTo]);
  const goTo = useCallback(
    (index: number): void => moveTo((_, total) => Math.max(0, Math.min(index, total - 1))),
    [moveTo],
  );

  const toggleDone = useCallback(
    (stageId: string): void => {
      update((current) => {
        if (current.lessonRun === null) return current;

        const done = new Set(current.lessonRun.doneStageIds);
        if (done.has(stageId)) done.delete(stageId);
        else done.add(stageId);

        return { ...current, lessonRun: { ...current.lessonRun, doneStageIds: [...done] } };
      });
    },
    [update],
  );

  return {
    templates,
    running,
    progress,
    doneStageIds: data.lessonRun?.doneStageIds ?? [],
    addTemplate,
    renameTemplate,
    setTemplateSubject,
    deleteTemplate,
    updateStage,
    addStage,
    removeStage,
    reorderStage,
    startLesson,
    stopLesson,
    goNext,
    goPrev,
    goTo,
    toggleDone,
  };
}
