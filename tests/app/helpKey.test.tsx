import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppShell } from '../../src/app/AppShell';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

/** 라우트 화면 자리의 대역 — 글자를 받는 칸 하나. */
function PageWithInput() {
  return <input aria-label="메모" />;
}

function show(): void {
  render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider adapter={stubAdapter()}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<PageWithInput />} />
            </Route>
          </Routes>
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

/*
 * `?`는 글자이기도 하다. 알림장에 "준비물?"을 치는데 도움창이 튀어나오면
 * 단축키가 아니라 방해다. 그래서 입력칸 안에서는 글자로 남아야 한다.
 */
describe('단축키 도움 (?)', () => {
  it('?를 누르면 열리고, 입력칸 안에서는 글자로 남는다', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('button', { name: '키보드 단축키' });

    await user.keyboard('?');
    expect(screen.getByRole('dialog', { name: '키보드 단축키' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('textbox', { name: '메모' }));
    await user.keyboard('?');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '메모' })).toHaveValue('?');
  });

  it('머리띠 단추로도 연다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole('button', { name: '키보드 단축키' }));

    expect(screen.getByRole('dialog', { name: '키보드 단축키' })).toBeInTheDocument();
  });
});
