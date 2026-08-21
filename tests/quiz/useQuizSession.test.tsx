import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MemorySessionRelay } from '../../src/features/quiz/session/MemorySessionRelay';
import { setSessionRelay } from '../../src/features/quiz/session/QuizSessionRelay';
import { useQuizSession } from '../../src/features/quiz/session/useQuizSession';
import { createQuestion, createQuizSet } from '../../src/shared/domain/factories';
import type { QuizSet } from '../../src/shared/domain/types';

const NOW = '2026-08-14T09:00:00.000Z';

const set: QuizSet = createQuizSet(
  {
    id: 'qs-1',
    title: '퀴즈',
    questions: [
      createQuestion({ id: 'q1', type: 'ox', text: '문제1', answer: 'O' }),
      createQuestion({ id: 'q2', type: 'ox', text: '문제2', answer: 'X' }),
    ],
  },
  NOW,
);

function renderSession() {
  const seen: { current: ReturnType<typeof useQuizSession> | null } = { current: null };

  function Probe() {
    seen.current = useQuizSession();
    return null;
  }

  render(<Probe />);
  return seen;
}

describe('useQuizSession', () => {
  it('세션을 열면 코드와 세션 상태를 들고 있다', async () => {
    setSessionRelay(new MemorySessionRelay(() => NOW));
    const seen = renderSession();

    await act(async () => {
      await seen.current?.start({ set, mode: 'teacher', questionIndex: 0, teams: ['1모둠'] });
    });

    await waitFor(() => expect(seen.current?.code).not.toBeNull());
    expect(seen.current?.session?.openQuestionIds).toEqual(['q1']);
  });

  it('세션 문제에 정답이 들어가지 않는다', async () => {
    setSessionRelay(new MemorySessionRelay(() => NOW));
    const seen = renderSession();

    await act(async () => {
      await seen.current?.start({ set, mode: 'student', questionIndex: 0, teams: ['1모둠'] });
    });

    await waitFor(() => expect(seen.current?.session).not.toBeNull());
    expect(JSON.stringify(seen.current?.session?.questions)).not.toContain('answer');
  });

  it('제출한 답이 responses로 들어온다', async () => {
    const relay = new MemorySessionRelay(() => NOW);
    setSessionRelay(relay);
    const seen = renderSession();

    await act(async () => {
      await seen.current?.start({ set, mode: 'teacher', questionIndex: 0, teams: ['1모둠'] });
    });
    const code = seen.current?.code ?? '';

    await act(async () => {
      await relay.submit(code, { questionId: 'q1', teamIndex: 0, answer: 'O' });
    });

    await waitFor(() => expect(seen.current?.responses).toHaveLength(1));
  });

  it('문제를 넘기면 열린 문제가 따라간다', async () => {
    setSessionRelay(new MemorySessionRelay(() => NOW));
    const seen = renderSession();

    await act(async () => {
      await seen.current?.start({ set, mode: 'teacher', questionIndex: 0, teams: ['1모둠'] });
    });

    await act(async () => {
      await seen.current?.syncOpenQuestions(set, 1);
    });

    await waitFor(() => expect(seen.current?.session?.openQuestionIds).toEqual(['q2']));
  });

  it('학생 주도면 문제를 넘겨도 열린 문제가 그대로다', async () => {
    // 학생이 자기 속도로 푸는 중에 교사가 칠판을 넘겼다고 화면이 바뀌면 안 된다.
    setSessionRelay(new MemorySessionRelay(() => NOW));
    const seen = renderSession();

    await act(async () => {
      await seen.current?.start({ set, mode: 'student', questionIndex: 0, teams: ['1모둠'] });
    });

    await act(async () => {
      await seen.current?.syncOpenQuestions(set, 1);
    });

    expect(seen.current?.session?.openQuestionIds).toEqual(['q1', 'q2']);
  });

  it('세션을 닫으면 코드가 사라진다', async () => {
    setSessionRelay(new MemorySessionRelay(() => NOW));
    const seen = renderSession();

    await act(async () => {
      await seen.current?.start({ set, mode: 'teacher', questionIndex: 0, teams: ['1모둠'] });
    });
    await act(async () => {
      await seen.current?.stop();
    });

    expect(seen.current?.code).toBeNull();
    expect(seen.current?.responses).toEqual([]);
  });
});
