import { afterEach, describe, expect, it, vi } from 'vitest';

import { openBoard } from '../../src/shared/window/openBoard';

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
