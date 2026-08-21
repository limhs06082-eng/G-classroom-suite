import { useCallback, useMemo } from 'react';

import { createQuestion, createQuizSet } from '../../shared/domain/factories';
import { createId } from '../../shared/ids';
import type { QuizQuestion, QuizResult, QuizSet } from '../../shared/domain/types';
import { useSuite } from '../../shared/roster/SuiteDataProvider';
import { normalizeSubject } from '../../shared/subjects';
import { createRunState, teamScores, toResult, validateQuizSet, type QuizRunState } from './quizCore';
import { normalizeTeams, teamsOrDefault } from './teamsCore';
import { mergeAutoGrading } from './session/sessionCore';
import type { QuizResponse } from './session/types';

/**
 * 퀴즈 화면과 저장소를 잇는 훅.
 *
 * 진행 상태를 저장한다. 전자칠판이 새 창으로 열리기 때문에,
 * 화면 안 state로 두면 칠판에서 아무것도 보이지 않는다.
 * 수업 중 퀴즈는 칠판이 주 화면이다.
 */
export interface QuizView {
  sets: QuizSet[];
  results: QuizResult[];
  run: QuizRunState | null;
  runningSet: QuizSet | null;
  /** 지금 화면에 보여 줄 팀. 진행 중이면 그 판이 시작할 때의 팀이다. */
  teams: string[];
  /** 설정에 저장된 팀. 설정 화면이 고치는 대상이다. */
  savedTeams: string[];
  scores: Record<string, number>;

  addSet: (title: string) => string;
  renameSet: (setId: string, title: string) => void;
  /** 과목은 비워도 된다. 과목이 없는 문제 세트가 정상이다. */
  setQuizSubject: (setId: string, subject: string) => void;
  deleteSet: (setId: string) => Promise<void>;
  addQuestion: (setId: string, type: QuizQuestion['type']) => void;
  updateQuestion: (setId: string, questionId: string, patch: Partial<QuizQuestion>) => void;
  removeQuestion: (setId: string, questionId: string) => void;
  validate: (set: QuizSet) => ReturnType<typeof validateQuizSet>;

  /**
   * 모둠 이름을 저장한다. 다음 퀴즈부터 이 이름으로 시작한다.
   *
   * **진행 중에는 아무것도 안 바꾼다.** 팀 이름이 기록의 열쇠라서
   * 바꾸면 앞 문제에서 맞힌 기록이 어느 팀 것인지 알 수 없게 된다.
   */
  setTeams: (teams: string[]) => void;
  /** 퀴즈가 돌고 있어 모둠을 못 바꾸는 상태인가 */
  isTeamsLocked: boolean;
  startRun: (setId: string) => void;
  stopRun: () => void;
  markCorrect: (team: string) => void;
  reveal: () => void;
  goNextQuestion: () => void;
  goPrevQuestion: () => void;
  finishRun: () => void;
  deleteResult: (resultId: string) => void;
  /** 학생 응답으로 채점을 갱신한다. 교사가 손댄 자리는 건드리지 않는다. */
  applyAutoGrading: (responses: readonly QuizResponse[]) => void;
  /** 열린 세션 코드를 기록한다. 전자칠판이 이것으로 세션을 찾는다. */
  setSessionCode: (code: string | null) => void;
}

export function useQuiz(): QuizView {
  const { data, update, guard } = useSuite();

  const run = data.quizRun;

  /*
   * 진행 중이면 그 판이 시작할 때의 팀을 쓴다. 도중에 설정이 바뀌어도
   * 이미 쌓인 점수와 어긋나지 않는다.
   */
  const teams = useMemo(
    () => (run !== null && run.teams.length > 0 ? run.teams : teamsOrDefault(data.quizTeams)),
    [run, data.quizTeams],
  );

  const savedTeams = useMemo(() => teamsOrDefault(data.quizTeams), [data.quizTeams]);

  const setRun = useCallback(
    (recipe: (current: QuizRunState | null) => QuizRunState | null): void => {
      update((current) => ({ ...current, quizRun: recipe(current.quizRun) }));
    },
    [update],
  );

  const sets = useMemo(
    () => [...data.quizSets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data.quizSets],
  );

  const results = useMemo(
    () => [...data.quizResults].sort((a, b) => b.playedAt.localeCompare(a.playedAt)),
    [data.quizResults],
  );

  const runningSet = useMemo(
    () => (run === null ? null : (data.quizSets.find((set) => set.id === run.quizSetId) ?? null)),
    [run, data.quizSets],
  );

  const scores = useMemo(
    () => (runningSet === null || run === null ? {} : teamScores(runningSet, run, teams)),
    [runningSet, run, teams],
  );

  const patchSet = useCallback(
    (setId: string, recipe: (set: QuizSet) => QuizSet): void => {
      const now = new Date().toISOString();
      update((current) => ({
        ...current,
        quizSets: current.quizSets.map((set) =>
          set.id === setId ? { ...recipe(set), updatedAt: now } : set,
        ),
      }));
    },
    [update],
  );

  const addSet = useCallback(
    (title: string): string => {
      const set = createQuizSet({ title });
      update((current) => ({ ...current, quizSets: [...current.quizSets, set] }));
      return set.id;
    },
    [update],
  );

  const setQuizSubject = useCallback(
    (setId: string, subject: string): void => {
      patchSet(setId, (set) => ({ ...set, subject: normalizeSubject(subject) }));
    },
    [patchSet],
  );

  const renameSet = useCallback(
    (setId: string, title: string): void => {
      const trimmed = title.trim();
      if (trimmed === '') return;
      patchSet(setId, (set) => ({ ...set, title: trimmed }));
    },
    [patchSet],
  );

  const deleteSet = useCallback(
    async (setId: string): Promise<void> => {
      await guard('문제 세트 삭제 직전');
      update((current) => ({
        ...current,
        quizSets: current.quizSets.filter((set) => set.id !== setId),
        // 결과는 남긴다. 어떤 문제였는지는 사라져도 정답률 기록은 의미가 있다.
      }));
      setRun((value) => (value?.quizSetId === setId ? null : value));
    },
    [guard, update],
  );

  const addQuestion = useCallback(
    (setId: string, type: QuizQuestion['type']): void => {
      patchSet(setId, (set) => ({
        ...set,
        questions: [...set.questions, createQuestion({ type, text: '' })],
      }));
    },
    [patchSet],
  );

  const updateQuestion = useCallback(
    (setId: string, questionId: string, patch: Partial<QuizQuestion>): void => {
      patchSet(setId, (set) => ({
        ...set,
        questions: set.questions.map((question) =>
          question.id === questionId ? { ...question, ...patch } : question,
        ),
      }));
    },
    [patchSet],
  );

  const removeQuestion = useCallback(
    (setId: string, questionId: string): void => {
      patchSet(setId, (set) => ({
        ...set,
        questions: set.questions.filter((question) => question.id !== questionId),
      }));
    },
    [patchSet],
  );

  const startRun = useCallback(
    (setId: string): void => {
      // 저장해 둔 모둠으로 시작한다. 시작할 때마다 묻지 않는다.
      setRun(() => createRunState(setId, savedTeams, new Date().toISOString()));
    },
    [setRun, savedTeams],
  );

  const stopRun = useCallback((): void => setRun(() => null), [setRun]);

  const setTeams = useCallback(
    (next: string[]): void => {
      update((current) => {
        /*
         * 진행 중에는 바꾸지 않는다. correctTeamsByQuestion이 팀을 이름으로
         * 담기 때문에, 이름을 바꾸면 앞 문제의 기록이 어느 팀 것인지
         * 알 수 없게 된다. 화면도 이때 설정을 잠그지만 여기서도 막아 둔다.
         */
        if (current.quizRun !== null) return current;

        return { ...current, quizTeams: normalizeTeams(next) };
      });
    },
    [update],
  );

  const markCorrect = useCallback((team: string): void => {
    setRun((current) => {
      if (current === null) return current;

      const questionId = currentQuestionId(current, data.quizSets);
      if (questionId === null) return current;

      const marked = current.correctTeamsByQuestion[questionId] ?? [];
      const next = marked.includes(team)
        ? marked.filter((name) => name !== team)
        : [...marked, team];

      const manual = current.manualTeamsByQuestion[questionId] ?? [];

      return {
        ...current,
        correctTeamsByQuestion: { ...current.correctTeamsByQuestion, [questionId]: next },
        /*
         * 한 번 누르면 그 자리는 영구히 교사 것이다. 자동 채점이 건드리지 않는다.
         * 눌렀다 해제한 것과 아직 안 본 것은 다르다.
         */
        manualTeamsByQuestion: {
          ...current.manualTeamsByQuestion,
          [questionId]: manual.includes(team) ? manual : [...manual, team],
        },
      };
    });
  }, [data.quizSets, setRun]);

  const reveal = useCallback((): void => {
    setRun((current) => (current === null ? current : { ...current, revealed: !current.revealed }));
  }, [setRun]);

  const move = useCallback(
    (delta: number): void => {
      setRun((current) => {
        if (current === null) return current;

        const set = data.quizSets.find((item) => item.id === current.quizSetId);
        const total = set?.questions.length ?? 0;
        const index = Math.max(0, Math.min(current.questionIndex + delta, Math.max(0, total - 1)));

        // 문제를 넘기면 정답 공개는 다시 닫는다. 다음 문제 답이 미리 보이면 안 된다.
        return { ...current, questionIndex: index, revealed: false };
      });
    },
    [data.quizSets, setRun],
  );

  const goNextQuestion = useCallback((): void => move(1), [move]);
  const goPrevQuestion = useCallback((): void => move(-1), [move]);

  const finishRun = useCallback((): void => {
    if (run === null || runningSet === null) return;

    const result = toResult(runningSet, run, teams, createId(), new Date().toISOString());
    update((current) => ({
      ...current,
      quizResults: [...current.quizResults, result],
      quizRun: null,
    }));
  }, [run, runningSet, teams, update]);

  const setSessionCode = useCallback(
    (next: string | null): void => {
      setRun((current) =>
        current === null || current.sessionCode === next ? current : { ...current, sessionCode: next },
      );
    },
    [setRun],
  );

  const applyAutoGrading = useCallback(
    (responses: readonly QuizResponse[]): void => {
      update((current) => {
        const run = current.quizRun;
        if (run === null) return current;

        const set = current.quizSets.find((item) => item.id === run.quizSetId);
        if (set === undefined) return current;

        const next = mergeAutoGrading(run, set, responses);

        /*
         * 값이 그대로면 저장하지 않는다.
         * 다른 창도 같은 계산을 하므로, 매번 쓰면 서로 알림을 주고받으며 돈다.
         */
        if (JSON.stringify(next) === JSON.stringify(run.correctTeamsByQuestion)) return current;

        return { ...current, quizRun: { ...run, correctTeamsByQuestion: next } };
      });
    },
    [update],
  );

  const deleteResult = useCallback(
    (resultId: string): void => {
      update((current) => ({
        ...current,
        quizResults: current.quizResults.filter((result) => result.id !== resultId),
      }));
    },
    [update],
  );

  return {
    sets,
    results,
    run,
    runningSet,
    teams,
    savedTeams,
    isTeamsLocked: run !== null,
    scores,
    addSet,
    renameSet,
    setQuizSubject,
    deleteSet,
    addQuestion,
    updateQuestion,
    removeQuestion,
    validate: validateQuizSet,
    setTeams,
    startRun,
    stopRun,
    markCorrect,
    reveal,
    goNextQuestion,
    goPrevQuestion,
    finishRun,
    deleteResult,
    applyAutoGrading,
    setSessionCode,
  };
}

function currentQuestionId(run: QuizRunState, sets: readonly QuizSet[]): string | null {
  const set = sets.find((item) => item.id === run.quizSetId);
  return set?.questions[run.questionIndex]?.id ?? null;
}
