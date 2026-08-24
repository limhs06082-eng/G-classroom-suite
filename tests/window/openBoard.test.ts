import { afterEach, describe, expect, it, vi } from 'vitest';

import { closeBoard, openBoard } from '../../src/shared/window/openBoard';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('openBoard — 웹에서', () => {
  it('새 탭을 연다', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    openBoard('/board/seating');

    expect(open).toHaveBeenCalledWith('/board/seating', '_blank', 'noopener');
  });

  it('경로를 그대로 넘긴다', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    openBoard('/board/duty');

    expect(open).toHaveBeenCalledWith('/board/duty', '_blank', 'noopener');
  });
});

describe('closeBoard — 웹에서', () => {
  it('대체 동작을 정확히 한 번 호출한다', () => {
    const fallback = vi.fn();

    closeBoard(fallback);

    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('window.open을 부르지 않는다', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    closeBoard(vi.fn());

    expect(open).not.toHaveBeenCalled();
  });
});
