import { describe, expect, it } from 'vitest';

import {
  createSessionCode,
  mergeAutoGrading,
  openQuestionIdsFor,
  submittedTeamCount,
  toSessionQuestions,
} from '../../src/features/quiz/session/sessionCore';
import type { QuizResponse } from '../../src/features/quiz/session/types';
import { createQuestion, createQuizSet } from '../../src/shared/domain/factories';
import type { QuizRun } from '../../src/shared/domain/types';

const NOW = '2026-08-14T09:00:00.000Z';

const set = createQuizSet(
  {
    id: 'qs-1',
    title: '퀴즈',
    questions: [
      createQuestion({ id: 'q1', type: 'ox', text: '지구는 둥글다', answer: 'O' }),
      createQuestion({ id: 'q2', type: 'short', text: '수도는?', answer: '서울' }),
    ],
  },
  NOW,
);

function runWith(overrides: Partial<QuizRun> = {}): QuizRun {
  return {
    quizSetId: 'qs-1',
    questionIndex: 0,
    correctTeamsByQuestion: {},
    manualTeamsByQuestion: {},
    sessionCode: null,
    revealed: false,
    teams: ['1모둠', '2모둠'],
    startedAt: NOW,
    ...overrides,
  };
}

const response = (questionId: string, teamIndex: number, answer: string): QuizResponse => ({
  questionId,
  teamIndex,
  answer,
  submittedAt: NOW,
});

describe('createSessionCode', () => {
  it('헷갈리는 글자를 쓰지 않는 6자를 만든다', () => {
    const code = createSessionCode(
      () => false,
      () => 0.5,
    );

    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[0-9A-Z]{6}$/);
    expect(code).not.toMatch(/[OIL]/); // 0·1과 헷갈린다
  });

  it('이미 쓰는 코드면 다시 만든다', () => {
    const seen: string[] = [];
    let calls = 0;
    const values = [0.1, 0.9];
    const code = createSessionCode(
      (candidate) => {
        seen.push(candidate);
        return seen.length === 1; // 첫 번째만 충돌
      },
      () => values[calls++ % values.length] ?? 0.5,
    );

    expect(seen).toHaveLength(2);
    expect(code).toBe(seen[1]);
  });
});

describe('openQuestionIdsFor', () => {
  it('교사 주도면 지금 문제 하나만 연다', () => {
    expect(openQuestionIdsFor(set, 'teacher', 1)).toEqual(['q2']);
  });

  it('학생 주도면 전체를 연다', () => {
    expect(openQuestionIdsFor(set, 'student', 0)).toEqual(['q1', 'q2']);
  });

  it('범위를 벗어난 번호에도 깨지지 않는다', () => {
    expect(openQuestionIdsFor(set, 'teacher', 99)).toEqual([]);
  });
});

describe('toSessionQuestions', () => {
  it('정답과 해설을 빼고 내보낸다', () => {
    // 학생이 세션 문서를 그대로 읽는다. 정답이 같이 가면 안 된다.
    const questions = toSessionQuestions(set);

    expect(questions).toEqual([
      { id: 'q1', type: 'ox', text: '지구는 둥글다', choices: [] },
      { id: 'q2', type: 'short', text: '수도는?', choices: [] },
    ]);
    expect(JSON.stringify(questions)).not.toContain('서울');
  });
});

describe('mergeAutoGrading', () => {
  it('맞힌 모둠을 정답으로 넣는다', () => {
    const next = mergeAutoGrading(runWith(), set, [response('q1', 0, 'O')]);

    expect(next['q1']).toEqual(['1모둠']);
  });

  it('틀린 모둠은 넣지 않는다', () => {
    const next = mergeAutoGrading(runWith(), set, [response('q1', 1, 'X')]);

    expect(next['q1'] ?? []).toEqual([]);
  });

  it('단답형은 기존 채점 규칙을 그대로 쓴다', () => {
    const next = mergeAutoGrading(runWith(), set, [response('q2', 0, ' 서 울 ')]);

    expect(next['q2']).toEqual(['1모둠']);
  });

  it('교사가 손댄 자리는 건드리지 않는다', () => {
    // 교사가 오답으로 되돌린 것과 아직 안 본 것은 다르다.
    const run = runWith({
      correctTeamsByQuestion: { q1: [] },
      manualTeamsByQuestion: { q1: ['1모둠'] },
    });

    const next = mergeAutoGrading(run, set, [response('q1', 0, 'O')]);

    expect(next['q1']).toEqual([]);
  });

  it('교사가 정답으로 둔 자리도 자동 채점이 지우지 않는다', () => {
    const run = runWith({
      correctTeamsByQuestion: { q1: ['2모둠'] },
      manualTeamsByQuestion: { q1: ['2모둠'] },
    });

    const next = mergeAutoGrading(run, set, [response('q1', 1, 'X')]);

    expect(next['q1']).toEqual(['2모둠']);
  });

  it('없는 모둠 번호는 무시한다', () => {
    const next = mergeAutoGrading(runWith(), set, [response('q1', 9, 'O')]);

    expect(next['q1'] ?? []).toEqual([]);
  });

  it('응답이 없는 문제에는 빈 항목을 만들지 않는다', () => {
    const next = mergeAutoGrading(runWith(), set, []);

    expect(Object.keys(next)).toEqual([]);
  });
});

describe('submittedTeamCount', () => {
  it('그 문제에 답한 모둠 수를 센다', () => {
    const rows = [response('q1', 0, 'O'), response('q1', 1, 'X'), response('q2', 0, '서울')];

    expect(submittedTeamCount(rows, 'q1')).toBe(2);
    expect(submittedTeamCount(rows, 'q2')).toBe(1);
  });
});
