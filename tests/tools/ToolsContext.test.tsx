import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ToolsBar } from '../../src/features/tools/ToolsBar';
import { ToolsProvider, useTools } from '../../src/features/tools/ToolsContext';

/*
 * 타이머도 화면 가리개도 이미 있다. 이번 판이 할 일은 **그것들을 '지금'
 * 카드 자리에서 여는 것**뿐이다. 그런데 ToolsBar가 여는 상태를 자기 안에
 * 들고 있어 바깥에서 열 길이 없었다. 그 길이 정말 이어졌는지만 본다.
 */
function Far() {
  const { open } = useTools();
  return (
    <button type="button" onClick={() => open('timer')}>
      멀리서 타이머 열기
    </button>
  );
}

function show() {
  return render(
    <ToolsProvider>
      <Far />
      <ToolsBar />
    </ToolsProvider>,
  );
}

describe('바깥에서 도구 열기', () => {
  it('멀리 있는 단추로 타이머가 열린다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: '멀리서 타이머 열기' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('툴바의 제 단추도 그대로 연다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: '타이머' }));

    // 있던 길을 끊고 새 길을 내면 안 된다. 둘 다 열려야 한다.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('provider 밖에서 쓰면 알려 준다', () => {
    // 조용히 아무 일도 안 일어나면 왜 안 열리는지 알 길이 없다.
    expect(() => render(<Far />)).toThrow(/ToolsProvider/);
  });
});
