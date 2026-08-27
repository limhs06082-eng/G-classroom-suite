import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppShell } from '../../src/app/AppShell';
import { useTools } from '../../src/features/tools/ToolsContext';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

/*
 * 감싸는 자리를 시험한다.
 *
 * ToolsContext.test.tsx는 provider가 있다고 치고 그 안에서만 본다. 그래서
 * AppShell이 **툴바만** 감싸도 그 시험은 전부 통과한다 — context도 툴바도
 * 멀쩡한데 라우트 화면(홈의 '지금' 카드)만 provider를 못 찾아 죽는다.
 * 실제로 그렇게 바꿔 놓고 992개를 돌려 보았고, 하나도 안 깨졌다.
 *
 * 여기서는 AppShell을 라우터에 얹고 **라우트 화면 자리에서** 도구를 연다.
 * 화면과 툴바가 한 provider 아래 있지 않으면 이 시험만 깨진다:
 *  - 화면 쪽이 provider 밖이면 ErrorBoundary가 받아 단추 자체가 안 뜨고,
 *  - 화면과 툴바를 provider 둘로 따로 감싸면 단추는 눌리는데 창이 안 열린다.
 */

/** 라우트 화면 자리에 세워 두는 대역. 2-나-2에서 '지금' 카드가 설 자리다. */
function PageThatOpensTimer() {
  const { open } = useTools();
  return (
    <button type="button" onClick={() => open('timer')}>
      화면에서 타이머 열기
    </button>
  );
}

function show(): void {
  render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider adapter={stubAdapter()}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<PageThatOpensTimer />} />
            </Route>
          </Routes>
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('AppShell 도구 배선', () => {
  it('라우트 화면이 툴바의 도구를 연다', async () => {
    const user = userEvent.setup();
    show();

    // 단추가 떴다는 것부터가 화면이 provider 안에 있다는 증거다.
    await user.click(await screen.findByRole('button', { name: '화면에서 타이머 열기' }));

    // 창은 툴바가 그린다. 열렸다면 화면과 툴바가 같은 provider를 본 것이다.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
