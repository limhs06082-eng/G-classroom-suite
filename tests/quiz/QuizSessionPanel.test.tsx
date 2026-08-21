import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { QuizSessionPanel } from '../../src/features/quiz/QuizSessionPanel';
import { MemorySessionRelay } from '../../src/features/quiz/session/MemorySessionRelay';
import { setSessionRelay } from '../../src/features/quiz/session/QuizSessionRelay';
import { createQuestion, createQuizSet } from '../../src/shared/domain/factories';
import { ToastProvider } from '../../src/shared/ui';

const NOW = '2026-08-14T09:00:00.000Z';

const set = createQuizSet(
  {
    id: 'qs-1',
    title: '퀴즈',
    questions: [createQuestion({ id: 'q1', type: 'ox', text: '문제', answer: 'O' })],
  },
  NOW,
);

function renderPanel(props: { onSessionCode?: (code: string | null) => void } = {}) {
  return render(
    <ToastProvider>
      <QuizSessionPanel
        set={set}
        questionIndex={0}
        teams={['1모둠', '2모둠']}
        onSessionCode={props.onSessionCode}
      />
    </ToastProvider>,
  );
}

async function openSession() {
  await userEvent.click(screen.getByRole('button', { name: /학생 응답 받기/ }));
  await userEvent.click(await screen.findByRole('button', { name: /수업 중 함께 풀기/ }));
  return (await screen.findByTestId('session-code')).textContent ?? '';
}

describe('QuizSessionPanel', () => {
  it('세션을 열면 코드를 보여 준다', async () => {
    setSessionRelay(new MemorySessionRelay(() => NOW));
    renderPanel();

    const code = await openSession();
    expect(code).toMatch(/^[0-9A-Z]{6}$/);
  });

  it('세션 코드를 위로 알린다', async () => {
    // 칠판이 별도 창이라 이 코드가 저장 자료를 거쳐야 세션을 찾을 수 있다.
    setSessionRelay(new MemorySessionRelay(() => NOW));
    const onSessionCode = vi.fn();
    renderPanel({ onSessionCode });

    const code = await openSession();

    expect(onSessionCode).toHaveBeenCalledWith(code);
  });

  it('제출 현황을 보여 준다', async () => {
    const relay = new MemorySessionRelay(() => NOW);
    setSessionRelay(relay);
    renderPanel();

    const code = await openSession();
    expect(screen.getByText('0 / 2 모둠 제출')).toBeInTheDocument();

    await relay.submit(code, { questionId: 'q1', teamIndex: 0, answer: 'O' });

    expect(await screen.findByText('1 / 2 모둠 제출')).toBeInTheDocument();
  });

  it('받기를 끝내면 다시 열 수 있는 상태로 돌아간다', async () => {
    setSessionRelay(new MemorySessionRelay(() => NOW));
    const onSessionCode = vi.fn();
    renderPanel({ onSessionCode });

    await openSession();
    await userEvent.click(screen.getByRole('button', { name: /받기 종료/ }));

    expect(await screen.findByRole('button', { name: /학생 응답 받기/ })).toBeInTheDocument();
    expect(onSessionCode).toHaveBeenLastCalledWith(null);
  });
});
