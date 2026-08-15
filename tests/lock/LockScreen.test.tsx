import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LockScreen } from '../../src/shared/lock/LockScreen';

/** 키패드로 한 자리씩 누른다. */
function press(digits: string): void {
  for (const digit of digits) {
    fireEvent.click(screen.getByRole('button', { name: digit }));
  }
}

describe('LockScreen', () => {
  it('숫자 키패드가 0~9까지 있다', () => {
    // 전자칠판에는 키보드가 없다. 입력칸만 두면 교사도 자기 앱을 못 연다.
    render(<LockScreen onSubmit={() => true} />);

    for (const digit of '0123456789') {
      expect(screen.getByRole('button', { name: digit })).toBeTruthy();
    }
  });

  it('네 자리를 채우면 바로 확인한다', () => {
    const onSubmit = vi.fn(() => true);
    render(<LockScreen onSubmit={onSubmit} />);

    press('123');
    expect(onSubmit).not.toHaveBeenCalled();

    press('4');
    expect(onSubmit).toHaveBeenCalledWith('1234');
  });

  it('틀리면 입력이 지워지고 알린다', () => {
    render(<LockScreen onSubmit={() => false} />);

    press('9999');

    expect(screen.getByText('PIN이 맞지 않습니다')).toBeTruthy();
    // 다시 네 자리를 넣을 수 있어야 한다.
    expect(screen.getByText('0자리 입력함')).toBeTruthy();
  });

  it('한 자리 지우기가 마지막 것만 지운다', () => {
    const onSubmit = vi.fn(() => true);
    render(<LockScreen onSubmit={onSubmit} />);

    press('129');
    fireEvent.click(screen.getByRole('button', { name: '한 자리 지우기' }));
    press('34');

    expect(onSubmit).toHaveBeenCalledWith('1234');
  });

  it('물리 키보드 숫자도 받는다', () => {
    const onSubmit = vi.fn(() => true);
    render(<LockScreen onSubmit={onSubmit} />);

    for (const key of '5678') {
      fireEvent.keyDown(document, { key });
    }

    expect(onSubmit).toHaveBeenCalledWith('5678');
  });

  it('Esc를 눌러도 걷히지 않는다', () => {
    // ToolsBar의 화면 가리기와 반대다. 쉽게 걷히면 안 되는 것이 목적이다.
    const onSubmit = vi.fn(() => true);
    render(<LockScreen onSubmit={onSubmit} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.getByRole('dialog', { name: '교사 잠금' })).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('네 자리를 넘겨 눌러도 늘어나지 않는다', () => {
    const onSubmit = vi.fn(() => false);
    render(<LockScreen onSubmit={onSubmit} />);

    press('12345');

    // 네 자리에서 한 번 확인하고, 틀려서 지워진 뒤 '5'가 첫 자리가 된다.
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('1234');
  });
});
