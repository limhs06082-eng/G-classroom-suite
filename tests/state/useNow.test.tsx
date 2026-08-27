import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNow } from '../../src/shared/state/useNow';

/*
 * 이 갈고리가 없으면 그릴 때 시각을 한 번 재고 만다. G-board는 교실
 * 컴퓨터에서 며칠씩 켜져 있어서, 3교시가 되어도 화면은 1교시에 멈춰 있다.
 */
function Probe() {
  return <span data-testid="now">{useNow()}</span>;
}

function shown(): string {
  return document.querySelector('[data-testid="now"]')?.textContent ?? '';
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useNow', () => {
  it('자정부터 지금까지의 분을 준다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 9, 30, 0));

    render(<Probe />);

    expect(shown()).toBe('570');
  });

  it('1분이 지나면 바뀐다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 9, 30, 0));
    render(<Probe />);

    // 1분 + 경계를 넘기는 1초. untilNextMinute가 그 1초를 더해 잡는다.
    act(() => {
      vi.advanceTimersByTime(60 * 1000 + 1000);
    });

    expect(shown()).toBe('571');
  });

  it('같은 분 안에서는 다시 그리지 않는다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 9, 30, 0));
    render(<Probe />);

    act(() => {
      vi.advanceTimersByTime(30 * 1000);
    });

    // 초마다 깨우면 하루 종일 켜 두는 프로그램에서 그 자체로 비용이다.
    expect(shown()).toBe('570');
  });

  it('자정을 넘기면 0으로 돌아온다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 23, 59, 0));
    render(<Probe />);

    // 두 번 깨워야 한다. 한 번은 자정을 넘기고, 한 번은 그 다음 분이다.
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000 + 1000);
    });

    expect(shown()).toBe('1');
  });

  it('화면을 떠나면 타이머를 남기지 않는다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 9, 0, 0));
    const view = render(<Probe />);

    view.unmount();

    // 하루 종일 켜 두는 프로그램에서 안 치운 타이머는 그대로 쌓인다.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('자다 깨어 타이머가 늦게 와도 지금 시계를 따른다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 9, 30, 0));
    render(<Probe />);

    // 교실 컴퓨터가 두 시간 잠들었다 깨어난 것이다. 타이머는 그동안
    // 흐르지 않았고, 깨어나서야 늦게 온다.
    vi.setSystemTime(new Date(2026, 7, 26, 11, 30, 0));
    act(() => {
      vi.advanceTimersByTime(60 * 1000 + 1000);
    });

    // 잰 값에 1분을 더했으면 571이 된다. 맞는 값은 지금 시계에만 있다.
    expect(shown()).toBe('691');
  });
});
