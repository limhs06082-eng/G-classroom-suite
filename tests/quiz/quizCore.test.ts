import { describe, expect, it } from 'vitest';

import {
  acceptedAnswers,
  correctChoiceText,
  createRunState,
  isCorrect,
  normalizeAnswer,
  questionStats,
  teamScores,
  toResult,
  validateQuizSet,
} from '../../src/features/quiz/quizCore';
import { createQuestion, createQuizSet } from '../../src/shared/domain/factories';
import type { QuizQuestion } from '../../src/shared/domain/types';

const NOW = '2026-08-12T09:00:00.000Z';

const choice = (overrides: Partial<QuizQuestion> = {}): QuizQuestion =>
  createQuestion({
    id: 'q-choice',
    type: 'choice',
    text: '가장 큰 수는?',
    choices: ['1', '2', '3', '4'],
    answer: '2',
    ...overrides,
  });

const ox = (overrides: Partial<QuizQuestion> = {}): QuizQuestion =>
  createQuestion({ id: 'q-ox', type: 'ox', text: '지구는 둥글다', answer: 'O', ...overrides });

const short = (overrides: Partial<QuizQuestion> = {}): QuizQuestion =>
  createQuestion({ id: 'q-short', type: 'short', text: '수도는?', answer: '서울', ...overrides });

describe('normalizeAnswer', () => {
  it('앞뒤 공백과 가운데 띄어쓰기를 없앤다', () => {
    // 형성평가는 맞춤법 시험이 아니다.
    expect(normalizeAnswer('  대 한 민 국 ')).toBe('대한민국');
  });

  it('영문 대소문자를 맞춘다', () => {
    expect(normalizeAnswer('Apple')).toBe('apple');
  });
});

describe('isCorrect', () => {
  it('객관식은 보기 번호로 채점한다', () => {
    expect(isCorrect(choice(), '2')).toBe(true);
    expect(isCorrect(choice(), '1')).toBe(false);
  });

  it('OX를 채점한다', () => {
    expect(isCorrect(ox(), 'O')).toBe(true);
    expect(isCorrect(ox(), 'X')).toBe(false);
  });

  it('단답형은 띄어쓰기가 달라도 맞다고 본다', () => {
    expect(isCorrect(short({ answer: '대한민국' }), '대 한 민 국')).toBe(true);
  });

  it('단답형은 쉼표로 여러 정답을 받는다', () => {
    const question = short({ answer: '서울, 서울특별시' });

    expect(isCorrect(question, '서울')).toBe(true);
    expect(isCorrect(question, '서울특별시')).toBe(true);
    expect(isCorrect(question, '부산')).toBe(false);
    expect(acceptedAnswers(question)).toEqual(['서울', '서울특별시']);
  });

  it('정답을 적어 두지 않은 단답형은 맞다고 처리하지 않는다', () => {
    // 맞다고 처리하면 정답률 통계가 통째로 망가진다.
    expect(isCorrect(short({ answer: '' }), '아무거나')).toBe(false);
    expect(isCorrect(short({ answer: '서울' }), '')).toBe(false);
  });
});

describe('correctChoiceText', () => {
  it('보기 번호를 보기 내용으로 바꾼다', () => {
    expect(correctChoiceText(choice())).toBe('3');
  });

  it('번호가 범위를 벗어나면 빈 문자열', () => {
    expect(correctChoiceText(choice({ answer: '9' }))).toBe('');
  });
});

describe('validateQuizSet', () => {
  it('문제가 온전하면 진행할 수 있다', () => {
    const result = validateQuizSet(createQuizSet({ title: '퀴즈', questions: [choice(), ox()] }, NOW));

    expect(result.issues).toEqual([]);
    expect(result.isPlayable).toBe(true);
  });

  it('문제가 하나도 없으면 진행할 수 없다', () => {
    expect(validateQuizSet(createQuizSet({ title: '빈 퀴즈' }, NOW)).isPlayable).toBe(false);
  });

  it('보기가 모자란 객관식을 짚어 준다', () => {
    const broken = choice({ choices: ['하나', '', '', ''] });
    const result = validateQuizSet(createQuizSet({ title: '퀴즈', questions: [broken] }, NOW));

    expect(result.issues.some((i) => i.message.includes('보기가 두 개'))).toBe(true);
    expect(result.isPlayable).toBe(false);
  });

  it('정답을 안 고른 객관식을 짚어 준다', () => {
    const broken = choice({ answer: '9' });
    const result = validateQuizSet(createQuizSet({ title: '퀴즈', questions: [broken] }, NOW));

    expect(result.issues.some((i) => i.message.includes('정답 보기'))).toBe(true);
  });

  it('정답이 빈 단답형을 짚어 준다', () => {
    const result = validateQuizSet(createQuizSet({ title: '퀴즈', questions: [short({ answer: '' })] }, NOW));

    expect(result.issues.some((i) => i.message.includes('인정할 답'))).toBe(true);
  });

  it('문제 내용이 비면 짚어 준다', () => {
    const result = validateQuizSet(createQuizSet({ title: '퀴즈', questions: [ox({ text: '  ' })] }, NOW));

    expect(result.issues.some((i) => i.message.includes('문제 내용'))).toBe(true);
  });
});

describe('teamScores', () => {
  const set = createQuizSet(
    { id: 'qs-1', title: '퀴즈', questions: [choice({ points: 2 }), ox({ points: 3 })] },
    NOW,
  );

  it('맞힌 문제의 배점을 더한다', () => {
    const run = {
      ...createRunState('qs-1', ['1모둠', '2모둠'], NOW),
      correctTeamsByQuestion: { 'q-choice': ['1모둠'], 'q-ox': ['1모둠', '2모둠'] },
    };

    expect(teamScores(set, run, ['1모둠', '2모둠', '3모둠'])).toEqual({
      '1모둠': 5,
      '2모둠': 3,
      '3모둠': 0,
    });
  });

  it('참가하지 않은 팀 이름은 무시한다', () => {
    const run = {
      ...createRunState('qs-1', ['1모둠', '2모둠'], NOW),
      correctTeamsByQuestion: { 'q-choice': ['없는모둠'] },
    };

    expect(teamScores(set, run, ['1모둠'])).toEqual({ '1모둠': 0 });
  });

  it('아무도 맞히지 않으면 전원 0점', () => {
    expect(teamScores(set, createRunState('qs-1', ['1모둠', '2모둠'], NOW), ['1모둠', '2모둠'])).toEqual({
      '1모둠': 0,
      '2모둠': 0,
    });
  });
});

describe('toResult / questionStats', () => {
  const set = createQuizSet({ id: 'qs-1', title: '퀴즈', questions: [choice(), ox()] }, NOW);
  const run = {
    ...createRunState('qs-1', ['1모둠', '2모둠'], NOW),
    correctTeamsByQuestion: { 'q-choice': ['1모둠', '2모둠'], 'q-ox': [] },
  };

  it('문항별 정답 팀 수를 남긴다', () => {
    const result = toResult(set, run, ['1모둠', '2모둠', '3모둠'], 'r-1', NOW);

    expect(result.correctByQuestion).toEqual({ 'q-choice': 2, 'q-ox': 0 });
    expect(result.totalTeams).toBe(3);
  });

  it('정답률을 계산해 어려웠던 문제를 드러낸다', () => {
    const result = toResult(set, run, ['1모둠', '2모둠', '3모둠'], 'r-1', NOW);
    const stats = questionStats(set, result);

    expect(stats[0]?.ratio).toBeCloseTo(2 / 3);
    expect(stats[1]?.ratio).toBe(0);
  });

  it('팀이 없어도 나눗셈이 깨지지 않는다', () => {
    const result = toResult(set, createRunState('qs-1', ['1모둠', '2모둠'], NOW), [], 'r-1', NOW);
    const stats = questionStats(set, result);

    expect(stats[0]?.ratio).toBe(0);
    expect(Number.isNaN(stats[0]?.ratio)).toBe(false);
  });
});
