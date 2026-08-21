import type { QuizRun, QuizSet } from '../../../shared/domain/types';
import { isCorrect } from '../quizCore';
import type { QuizResponse, QuizSessionMode, QuizSessionQuestion } from './types';

/**
 * 세션 순수 로직.
 *
 * 통신은 QuizSessionRelay가 맡고, 여기에는 계산만 둔다.
 * 그래야 Firebase 없이도 규칙을 전부 검증할 수 있다.
 */

/** 0·1·O·I·L처럼 헷갈리는 글자를 뺀 32자 (Crockford Base32) */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 5;

/**
 * 학생이 입력할 6자 코드.
 *
 * 32^6 ≈ 10억 가지라 찍어서 들어올 수 없다.
 * 겹치면 다시 만들되, 무한히 돌지 않도록 횟수를 제한한다.
 */
export function createSessionCode(
  isTaken: (code: string) => boolean,
  random: () => number = Math.random,
): string {
  let code = '';

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    code = '';
    for (let index = 0; index < CODE_LENGTH; index += 1) {
      const pick = Math.floor(random() * CODE_ALPHABET.length);
      code += CODE_ALPHABET[Math.min(Math.max(pick, 0), CODE_ALPHABET.length - 1)] ?? '0';
    }
    if (!isTaken(code)) return code;
  }

  // 다섯 번 다 겹쳤다. 마지막 것을 그대로 쓴다. 실제로는 일어나지 않는다.
  return code;
}

/**
 * 지금 답할 수 있는 문제.
 *
 * 두 모드의 유일한 차이다. 나머지 화면·집계는 전부 공유한다.
 */
export function openQuestionIdsFor(
  set: QuizSet,
  mode: QuizSessionMode,
  questionIndex: number,
): string[] {
  if (mode === 'student') return set.questions.map((question) => question.id);

  const question = set.questions[questionIndex];
  return question === undefined ? [] : [question.id];
}

/** 학생에게 보낼 문제. 정답과 해설을 뺀다. */
export function toSessionQuestions(set: QuizSet): QuizSessionQuestion[] {
  return set.questions.map((question) => ({
    id: question.id,
    type: question.type,
    text: question.text,
    choices: [...question.choices],
  }));
}

/**
 * 학생 응답으로 채점 결과를 갱신한다.
 *
 * 교사가 칠판에서 직접 누른 (문제, 모둠)은 건드리지 않는다.
 * 단답형은 기계 채점이 틀릴 수 있고, 그때 교사가 고친 것이
 * 조용히 되돌아가면 안 된다.
 */
export function mergeAutoGrading(
  run: QuizRun,
  set: QuizSet,
  responses: readonly QuizResponse[],
): Record<string, string[]> {
  const next: Record<string, string[]> = { ...run.correctTeamsByQuestion };

  for (const question of set.questions) {
    const mine = responses.filter((row) => row.questionId === question.id);
    if (mine.length === 0) continue;

    const touched = new Set(run.manualTeamsByQuestion[question.id] ?? []);
    const current = new Set(next[question.id] ?? []);

    for (const row of mine) {
      const team = run.teams[row.teamIndex];
      if (team === undefined || touched.has(team)) continue;

      if (isCorrect(question, row.answer)) current.add(team);
      else current.delete(team);
    }

    next[question.id] = [...current];
  }

  return next;
}

/** 그 문제에 답한 모둠 수. 응답 하나가 곧 모둠 하나다. */
export function submittedTeamCount(
  responses: readonly QuizResponse[],
  questionId: string,
): number {
  return responses.filter((row) => row.questionId === questionId).length;
}
