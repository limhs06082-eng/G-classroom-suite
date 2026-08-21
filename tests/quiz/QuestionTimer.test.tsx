import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QuestionTimer } from '../../src/features/quiz/QuestionTimer';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

/** useTimer는 끝날 시각과 지금의 차이를 재므로 시계를 함께 밀어야 한다. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe('QuestionTimer', () => {
  it('제한 시간이 없으면(0) 아무것도 안 그린다', () => {
    const { container } = render(
      <QuestionTimer questionId="q-1" timeLimitSec={0} revealed={false} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('처음에는 제한 시간을 그대로 보여 주고 세지 않는다', () => {
    render(<QuestionTimer questionId="q-1" timeLimitSec={30} revealed={false} />);

    // 문제를 띄우자마자 세면 교사가 다 읽기도 전에 시간이 간다.
    expect(screen.getByText('0:30')).toBeTruthy();
    expect(screen.getByRole('button', { name: /시간 재기/ })).toBeTruthy();
  });

  it('교사가 시작하면 줄어든다', async () => {
    render(<QuestionTimer questionId="q-1" timeLimitSec={30} revealed={false} />);

    fireEvent.click(screen.getByRole('button', { name: /시간 재기/ }));
    await advance(10_000);

    expect(screen.getByText('0:20')).toBeTruthy();
  });

  it('잠깐 멈췄다가 이어서 갈 수 있다', async () => {
    render(<QuestionTimer questionId="q-1" timeLimitSec={30} revealed={false} />);

    fireEvent.click(screen.getByRole('button', { name: /시간 재기/ }));
    await advance(10_000);

    fireEvent.click(screen.getByRole('button', { name: /잠깐/ }));
    await advance(5_000);

    // 멈춘 동안에는 안 줄어든다.
    expect(screen.getByText('0:20')).toBeTruthy();
    expect(screen.getByRole('button', { name: /이어서/ })).toBeTruthy();
  });

  it('0이 되면 시간 종료를 보인다', async () => {
    render(<QuestionTimer questionId="q-1" timeLimitSec={5} revealed={false} />);

    fireEvent.click(screen.getByRole('button', { name: /시간 재기/ }));
    await advance(6_000);

    expect(screen.getByText('시간 종료')).toBeTruthy();
    expect(screen.getByRole('button', { name: /다시/ })).toBeTruthy();
  });

  it('정답을 공개하면 멈춘다', async () => {
    const { rerender } = render(
      <QuestionTimer questionId="q-1" timeLimitSec={30} revealed={false} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /시간 재기/ }));
    await advance(10_000);

    rerender(<QuestionTimer questionId="q-1" timeLimitSec={30} revealed />);
    await advance(5_000);

    // 답을 보여 준 뒤에도 세면 학생이 헷갈린다.
    expect(screen.getByText('0:20')).toBeTruthy();
  });

  it('정답이 공개된 동안에는 시작할 수 없다', () => {
    render(<QuestionTimer questionId="q-1" timeLimitSec={30} revealed />);

    expect(screen.getByRole('button', { name: /시간 재기/ })).toHaveProperty('disabled', true);
  });

  it('문제가 바뀌면 처음 상태로 돌아간다', async () => {
    const { rerender } = render(
      <QuestionTimer questionId="q-1" timeLimitSec={30} revealed={false} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /시간 재기/ }));
    await advance(10_000);
    expect(screen.getByText('0:20')).toBeTruthy();

    rerender(<QuestionTimer questionId="q-2" timeLimitSec={30} revealed={false} />);

    expect(screen.getByText('0:30')).toBeTruthy();
    expect(screen.getByRole('button', { name: /시간 재기/ })).toBeTruthy();
  });
});
