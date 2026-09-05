import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ToolsBar } from '../../src/features/tools/ToolsBar';
import { ToolsProvider } from '../../src/features/tools/ToolsContext';
import { ToastProvider } from '../../src/shared/ui';

function show() {
  return render(
    <ToastProvider>
      <ToolsProvider>
        <ToolsBar />
      </ToolsProvider>
    </ToastProvider>,
  );
}

/*
 * 학급 회의의 "손 들어 보세요". 질문과 선택지를 적고 크게 띄우면, 교사가
 * 손 든 수를 탭한다. 기록하지 않는다 — 그 자리에서 쓰고 끝이다.
 */
describe('거수 투표', () => {
  it('질문·선택지를 적고 크게 띄우면 손 든 수를 세고, Esc로 돌아온다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: '거수 투표' }));
    const setup = await screen.findByRole('dialog', { name: '거수 투표' });
    await user.type(within(setup).getByRole('textbox', { name: '질문' }), '급식 어땠나요?');
    await user.type(within(setup).getByRole('textbox', { name: '선택지 1' }), '좋았어요');
    await user.type(within(setup).getByRole('textbox', { name: '선택지 2' }), '별로였어요');
    await user.click(within(setup).getByRole('button', { name: '크게 띄우기' }));

    const board = await screen.findByRole('dialog', { name: '거수 투표 결과' });
    expect(within(board).getByText('급식 어땠나요?')).toBeInTheDocument();
    await user.click(within(board).getByRole('button', { name: '좋았어요 하나 더' }));
    await user.click(within(board).getByRole('button', { name: '좋았어요 하나 더' }));
    await user.click(within(board).getByRole('button', { name: '별로였어요 하나 더' }));
    await user.click(within(board).getByRole('button', { name: '별로였어요 하나 빼기' }));
    expect(within(board).getByLabelText('좋았어요 손 든 수')).toHaveTextContent('2');
    expect(within(board).getByLabelText('별로였어요 손 든 수')).toHaveTextContent('0');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '거수 투표 결과' })).not.toBeInTheDocument();
    // 설정 창으로 돌아오고 수는 남아 있다 — 다시 띄우면 이어서 센다.
    expect(await screen.findByRole('dialog', { name: '거수 투표' })).toBeInTheDocument();
  });

  it('선택지가 둘 미만이면 띄울 수 없다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: '거수 투표' }));
    const setup = await screen.findByRole('dialog', { name: '거수 투표' });
    await user.type(within(setup).getByRole('textbox', { name: '선택지 1' }), '하나');
    expect(within(setup).getByRole('button', { name: '크게 띄우기' })).toBeDisabled();
  });
});
