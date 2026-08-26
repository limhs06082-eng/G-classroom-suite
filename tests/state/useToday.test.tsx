import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useToday } from '../../src/shared/state/useToday';

/*
 * 이 갈고리가 없으면 그릴 때 날짜를 한 번 재고 만다. G-board는 교실
 * 컴퓨터에서 며칠씩 켜져 있어서, 다음 날 아침 화면에 어제 급식이 걸린다.
 * 하필 그 시각이 선생님이 교실에 들어와 화면을 한 번 보는 때다.
 */
function Probe() {
  return <span data-testid="today">{useToday()}</span>;
}

function shown(): string {
  return document.querySelector('[data-testid="today"]')?.textContent ?? '';
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useToday', () => {
  it('오늘 날짜를 준다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 9, 0, 0));

    render(<Probe />);

    // 여덟 월이 8월이다. UTC로 재면 아침에 하루 밀린다.
    expect(shown()).toBe('2026-08-26');
  });

  it('자정 전에는 그대로다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 22, 0, 0));
    render(<Probe />);

    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });

    expect(shown()).toBe('2026-08-26');
  });

  it('자정이 지나면 저절로 바뀐다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 22, 0, 0));
    render(<Probe />);

    // 자정까지 두 시간 + 경계를 넘기는 1분.
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 60 * 1000 + 60 * 1000);
    });

    expect(shown()).toBe('2026-08-27');
  });

  it('다음 날 자정에도 또 바뀐다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 22, 0, 0));
    render(<Probe />);

    // 한 번 깨우고 마는 것이면 주말을 넘기지 못한다.
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 60 * 1000 + 60 * 1000);
    });
    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    });

    expect(shown()).toBe('2026-08-28');
  });

  it('달과 해가 넘어가도 맞다', () => {
    vi.setSystemTime(new Date(2026, 11, 31, 23, 0, 0));
    render(<Probe />);

    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000 + 60 * 1000);
    });

    expect(shown()).toBe('2027-01-01');
  });

  it('화면을 떠나면 타이머를 남기지 않는다', () => {
    vi.setSystemTime(new Date(2026, 7, 26, 9, 0, 0));
    const view = render(<Probe />);

    view.unmount();

    // 하루 종일 켜 두는 프로그램에서 안 치운 타이머는 그대로 쌓인다.
    expect(vi.getTimerCount()).toBe(0);
  });
});
