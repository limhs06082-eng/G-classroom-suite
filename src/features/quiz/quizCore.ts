import type { QuizQuestion, QuizResult, QuizRun, QuizSet } from '../../shared/domain/types';

/**
 * 퀴즈 채점과 진행 계산.
 *
 * 원본 G-formative-quiz에서 채점이 화면 컴포넌트 안에 있었다.
 * 단답형의 띄어쓰기·대소문자 처리처럼 조용히 틀리는 부분이라 밖으로 뺐다.
 */

export const QUESTION_TYPE_LABELS = {
  choice: '객관식',
  ox: 'OX',
  short: '단답형',
} as const;

/**
 * 단답형 비교용 정규화.
 *
 * 학생이 띄어쓰기를 다르게 쓰거나 영문 대소문자가 달라도 맞은 것으로 본다.
 * 형성평가는 맞춤법 시험이 아니다.
 */
export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

/** 단답형은 쉼표로 여러 정답을 받는다. */
export function acceptedAnswers(question: QuizQuestion): string[] {
  if (question.type !== 'short') return [question.answer];

  return question.answer
    .split(',')
    .map((part) => normalizeAnswer(part))
    .filter((part) => part !== '');
}

export function isCorrect(question: QuizQuestion, submitted: string): boolean {
  if (question.type === 'short') {
    const normalized = normalizeAnswer(submitted);
    // 정답을 적어 두지 않은 문제는 채점하지 않는다. 맞다고 처리하면 통계가 망가진다.
    if (normalized === '') return false;
    return acceptedAnswers(question).includes(normalized);
  }

  return question.answer.trim() === submitted.trim();
}

/** 객관식 정답 보기의 글자. 저장은 인덱스로 하고 화면에는 보기 내용을 보여 준다. */
export function correctChoiceText(question: QuizQuestion): string {
  if (question.type !== 'choice') return question.answer;

  const index = Number.parseInt(question.answer, 10);
  return Number.isFinite(index) ? (question.choices[index] ?? '') : '';
}

export interface QuizValidation {
  /** 문제 id → 사람이 읽을 문제점 */
  issues: Array<{ questionId: string; message: string }>;
  isPlayable: boolean;
}

/**
 * 진행 전에 문제 세트를 점검한다.
 *
 * 정답이 비어 있거나 보기가 모자란 문제를 그대로 진행하면
 * 수업 중에 채점이 이상해지고 되돌릴 수 없다.
 */
export function validateQuizSet(set: QuizSet): QuizValidation {
  const issues: QuizValidation['issues'] = [];

  for (const question of set.questions) {
    if (question.text.trim() === '') {
      issues.push({ questionId: question.id, message: '문제 내용이 비어 있습니다.' });
    }

    if (question.type === 'choice') {
      const filled = question.choices.filter((choice) => choice.trim() !== '');
      if (filled.length < 2) {
        issues.push({ questionId: question.id, message: '보기가 두 개 이상 있어야 합니다.' });
      }

      const index = Number.parseInt(question.answer, 10);
      if (!Number.isFinite(index) || question.choices[index] === undefined || question.choices[index]?.trim() === '') {
        issues.push({ questionId: question.id, message: '정답 보기를 골라 주세요.' });
      }
    }

    if (question.type === 'short' && acceptedAnswers(question).length === 0) {
      issues.push({ questionId: question.id, message: '인정할 답을 적어 주세요.' });
    }
  }

  return { issues, isPlayable: set.questions.length > 0 && issues.length === 0 };
}

// ── 진행 상태 ─────────────────────────────────────────────────

export type QuizRunState = QuizRun;

export function createRunState(quizSetId: string, teams: readonly string[], startedAt: string): QuizRun {
  return {
    quizSetId,
    questionIndex: 0,
    correctTeamsByQuestion: {},
    manualTeamsByQuestion: {},
    sessionCode: null,
    revealed: false,
    teams: [...teams],
    startedAt,
  };
}

/** 팀별 누적 점수. 맞힌 문제의 배점을 더한다. */
export function teamScores(set: QuizSet, run: QuizRunState, teams: readonly string[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const team of teams) scores[team] = 0;

  for (const question of set.questions) {
    for (const team of run.correctTeamsByQuestion[question.id] ?? []) {
      if (team in scores) scores[team] = (scores[team] ?? 0) + question.points;
    }
  }

  return scores;
}

export function toResult(
  set: QuizSet,
  run: QuizRunState,
  teams: readonly string[],
  id: string,
  playedAt: string,
): QuizResult {
  const correctByQuestion: Record<string, number> = {};
  for (const question of set.questions) {
    correctByQuestion[question.id] = (run.correctTeamsByQuestion[question.id] ?? []).length;
  }

  return {
    id,
    quizSetId: set.id,
    teamScores: teamScores(set, run, teams),
    correctByQuestion,
    totalTeams: teams.length,
    playedAt,
  };
}

export interface QuestionStat {
  question: QuizQuestion;
  correctCount: number;
  totalTeams: number;
  /** 0~1. 낮을수록 어려웠던 문제다. */
  ratio: number;
}

/** 문항별 정답률. 어느 문제를 다시 짚어야 하는지 보여 준다. */
export function questionStats(set: QuizSet, result: QuizResult): QuestionStat[] {
  return set.questions.map((question) => {
    const correctCount = result.correctByQuestion[question.id] ?? 0;
    return {
      question,
      correctCount,
      totalTeams: result.totalTeams,
      ratio: result.totalTeams === 0 ? 0 : correctCount / result.totalTeams,
    };
  });
}
