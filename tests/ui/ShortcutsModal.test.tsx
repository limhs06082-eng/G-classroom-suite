import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ShortcutsModal } from '../../src/shared/ui';

/*
 * 표에 적힌 것이 코드에 실제로 있는지는 여기서 못 본다. 여기서 보는 것은
 * 두 범위가 서로 다른 목록을 내는가뿐이다 — 칠판 창에 "잠금 화면 PIN"이
 * 나오면 그 창에는 없는 기능을 가르치는 셈이다.
 */
describe('ShortcutsModal', () => {
  it('앱 범위에는 칠판·뽑기·입력칸 단축키가 다 나온다', () => {
    render(<ShortcutsModal open onClose={vi.fn()} scope="app" />);

    expect(screen.getByRole('dialog', { name: '키보드 단축키' })).toBeInTheDocument();
    expect(screen.getByText('전체 화면 켜기·끄기')).toBeInTheDocument();
    expect(screen.getByText('한 명 더 뽑기')).toBeInTheDocument();
  });

  it('칠판 범위에는 칠판 것만 나온다', () => {
    render(<ShortcutsModal open onClose={vi.fn()} scope="board" />);

    expect(screen.getByText('전체 화면 켜기·끄기')).toBeInTheDocument();
    expect(screen.queryByText('한 명 더 뽑기')).not.toBeInTheDocument();
  });

  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    render(<ShortcutsModal open={false} onClose={vi.fn()} scope="app" />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
