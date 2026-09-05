import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BoardScreen } from '../../src/shared/ui';

describe('BoardScreen 키보드', () => {
  it('Esc는 닫는다', () => {
    const onExit = vi.fn();
    render(
      <BoardScreen title="오늘" onExit={onExit}>
        <p>본문</p>
      </BoardScreen>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onExit).toHaveBeenCalledOnce();
  });

  it('?는 단축키 도움을 열고, 그동안 Esc는 도움만 닫는다', () => {
    const onExit = vi.fn();
    render(
      <BoardScreen title="오늘" onExit={onExit}>
        <p>본문</p>
      </BoardScreen>,
    );

    fireEvent.keyDown(document, { key: '?' });
    expect(screen.getByRole('dialog', { name: '키보드 단축키' })).toBeInTheDocument();

    // 도움이 열려 있는 동안의 Esc — 도움만 닫혀야지 칠판까지 닫히면 안 된다.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('F는 문서 전체를 전체 화면으로 건다 — 이 div가 아니라', () => {
    // div를 걸면 body에 포털로 붙는 도움창이 전체 화면 아래에 깔려 안 보인다.
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    // jsdom에는 fullscreenElement가 아예 없다(undefined). null이어야 '들어가기'로 간다.
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    const request = vi.fn(() => Promise.resolve());
    document.documentElement.requestFullscreen = request;
    try {
      render(
        <BoardScreen title="오늘">
          <p>본문</p>
        </BoardScreen>,
      );

      fireEvent.keyDown(document, { key: 'f' });

      expect(request).toHaveBeenCalledOnce();
    } finally {
      Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true });
    }
  });

  it('머리줄의 물음표 단추로도 연다', () => {
    render(
      <BoardScreen title="오늘">
        <p>본문</p>
      </BoardScreen>,
    );

    fireEvent.click(screen.getByRole('button', { name: '키보드 단축키' }));

    expect(screen.getByRole('dialog', { name: '키보드 단축키' })).toBeInTheDocument();
  });
});
