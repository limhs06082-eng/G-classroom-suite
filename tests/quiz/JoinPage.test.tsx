import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import JoinPage from '../../src/features/quiz/JoinPage';
import { MemorySessionRelay } from '../../src/features/quiz/session/MemorySessionRelay';
import { setSessionRelay } from '../../src/features/quiz/session/QuizSessionRelay';
import type { QuizSessionInit } from '../../src/features/quiz/session/types';
import { ToastProvider } from '../../src/shared/ui';

const NOW = '2026-08-14T09:00:00.000Z';

function init(overrides: Partial<QuizSessionInit> = {}): QuizSessionInit {
  return {
    ownerKey: 'owner-1',
    quizSetId: 'qs-1',
    title: '수학 형성평가',
    mode: 'teacher',
    openQuestionIds: ['q1'],
    questions: [
      { id: 'q1', type: 'ox', text: '지구는 둥글다', choices: [] },
      { id: 'q2', type: 'choice', text: '가장 큰 수는?', choices: ['1', '2'] },
    ],
    teams: ['1모둠', '2모둠'],
    expiresAt: '2026-08-14T12:00:00.000Z',
    ...overrides,
  };
}

function renderAt(code: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/join/${code}`]}>
        <Routes>
          <Route path="join/:code" element={<JoinPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('JoinPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('없는 코드면 안내를 보여 준다', async () => {
    setSessionRelay(new MemorySessionRelay(() => NOW));
    renderAt('ZZZZZZ');

    expect(await screen.findByText('받기가 끝났습니다')).toBeInTheDocument();
  });

  it('모둠을 먼저 고르게 한다', async () => {
    const relay = new MemorySessionRelay(() => NOW);
    setSessionRelay(relay);
    const { code } = await relay.open(init());

    renderAt(code);

    expect(await screen.findByRole('button', { name: '1모둠' })).toBeInTheDocument();
    expect(screen.queryByText('지구는 둥글다')).not.toBeInTheDocument();
  });

  it('모둠을 고르면 열린 문제만 보여 준다', async () => {
    const relay = new MemorySessionRelay(() => NOW);
    setSessionRelay(relay);
    const { code } = await relay.open(init());

    renderAt(code);
    await userEvent.click(await screen.findByRole('button', { name: '1모둠' }));

    expect(await screen.findByText('지구는 둥글다')).toBeInTheDocument();
    expect(screen.queryByText('가장 큰 수는?')).not.toBeInTheDocument();
  });

  it('학생 주도면 전체 문제를 보여 준다', async () => {
    const relay = new MemorySessionRelay(() => NOW);
    setSessionRelay(relay);
    const { code } = await relay.open(init({ mode: 'student', openQuestionIds: ['q1', 'q2'] }));

    renderAt(code);
    await userEvent.click(await screen.findByRole('button', { name: '1모둠' }));

    expect(await screen.findByText('지구는 둥글다')).toBeInTheDocument();
    expect(await screen.findByText('가장 큰 수는?')).toBeInTheDocument();
  });

  it('OX 답을 내면 교사 쪽에 도착한다', async () => {
    const relay = new MemorySessionRelay(() => NOW);
    setSessionRelay(relay);
    const { code } = await relay.open(init());

    const seen = vi.fn();
    relay.watchResponses(code, seen);

    renderAt(code);
    await userEvent.click(await screen.findByRole('button', { name: '1모둠' }));
    await userEvent.click(await screen.findByRole('button', { name: 'O' }));

    expect(seen.mock.calls.at(-1)?.[0]).toEqual([
      expect.objectContaining({ questionId: 'q1', teamIndex: 0, answer: 'O' }),
    ]);
  });

  it('세션이 닫히면 화면이 바뀐다', async () => {
    const relay = new MemorySessionRelay(() => NOW);
    setSessionRelay(relay);
    const { code } = await relay.open(init());

    renderAt(code);
    await userEvent.click(await screen.findByRole('button', { name: '1모둠' }));
    await screen.findByText('지구는 둥글다');

    await act(async () => {
      await relay.close(code);
    });

    expect(await screen.findByText('받기가 끝났습니다')).toBeInTheDocument();
  });
});
