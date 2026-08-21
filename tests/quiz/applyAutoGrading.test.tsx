import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useQuiz } from '../../src/features/quiz/useQuiz';
import { createEmptySuiteData, createQuestion, createQuizSet } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

const NOW = '2026-08-14T09:00:00.000Z';

const set = createQuizSet(
  {
    id: 'qs-1',
    title: '퀴즈',
    questions: [createQuestion({ id: 'q1', type: 'ox', text: '문제', answer: 'O' })],
  },
  NOW,
);

function seeded(): SuiteData {
  return {
    ...createEmptySuiteData(),
    quizSets: [set],
    quizRun: {
      quizSetId: 'qs-1',
      questionIndex: 0,
      correctTeamsByQuestion: {},
      manualTeamsByQuestion: {},
      sessionCode: null,
      revealed: false,
      teams: ['1모둠', '2모둠'],
      startedAt: NOW,
    },
  };
}

function renderQuiz() {
  const seen: { current: ReturnType<typeof useQuiz> | null } = { current: null };

  function Probe() {
    seen.current = useQuiz();
    return null;
  }

  render(
    <ToastProvider>
      <SuiteDataProvider
        adapter={stubAdapter({
          load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }),
        })}
      >
        <Probe />
      </SuiteDataProvider>
    </ToastProvider>,
  );

  return seen;
}

describe('useQuiz.applyAutoGrading', () => {
  it('학생 응답이 채점 결과로 들어간다', async () => {
    const seen = renderQuiz();
    await waitFor(() => expect(seen.current?.run).not.toBeNull());

    act(() =>
      seen.current?.applyAutoGrading([
        { questionId: 'q1', teamIndex: 0, answer: 'O', submittedAt: NOW },
      ]),
    );

    expect(seen.current?.run?.correctTeamsByQuestion['q1']).toEqual(['1모둠']);
  });

  it('교사가 눌렀다 해제한 자리는 그대로 둔다', async () => {
    // 되돌린 것과 아직 안 본 것은 다르다. 되돌린 것을 자동 채점이 되살리면 안 된다.
    const seen = renderQuiz();
    await waitFor(() => expect(seen.current?.run).not.toBeNull());

    act(() => seen.current?.markCorrect('1모둠'));
    act(() => seen.current?.markCorrect('1모둠'));

    act(() =>
      seen.current?.applyAutoGrading([
        { questionId: 'q1', teamIndex: 0, answer: 'O', submittedAt: NOW },
      ]),
    );

    expect(seen.current?.run?.correctTeamsByQuestion['q1'] ?? []).toEqual([]);
  });
});
