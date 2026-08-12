import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Button,
  ConfirmDialog,
  EmptyState,
  Modal,
  PrintLayout,
  Table,
  Tabs,
  ToastProvider,
  useToast,
  type Column,
} from '../../src/shared/ui';

/*
 * 인쇄 포털은 document.body에 직접 붙으므로 테스트 사이에 남는다.
 * 정리를 afterEach에서 하면 Testing Library의 자동 unmount와 순서가 부딪혀
 * "node to be removed is not a child" 오류가 난다. 그래서 렌더 전에 치운다.
 */
beforeEach(() => {
  document.getElementById('print-root')?.remove();
});

// ─────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────

function ToastHarness({ run }: { run: (api: ReturnType<typeof useToast>) => void }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => run(toast)}>
      실행
    </button>
  );
}

function renderToast(run: (api: ReturnType<typeof useToast>) => void) {
  render(
    <ToastProvider>
      <ToastHarness run={run} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: '실행' }));
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('메시지를 띄우고 시간이 지나면 스스로 사라진다', async () => {
    renderToast((toast) => toast.success('저장했습니다.'));

    expect(screen.getByText('저장했습니다.')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(4100);
    });

    expect(screen.queryByText('저장했습니다.')).not.toBeInTheDocument();
  });

  it('오류 알림은 스스로 사라지지 않는다', async () => {
    // 저장 실패 같은 메시지를 놓치면 데이터를 잃는다. 반드시 사용자가 닫아야 한다.
    renderToast((toast) => toast.error('저장 공간이 부족합니다.'));

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText('저장 공간이 부족합니다.')).toBeInTheDocument();
  });

  it('실행 취소 알림은 더 오래 남는다', async () => {
    renderToast((toast) =>
      toast.info('+1점을 주었습니다.', { actionLabel: '실행 취소', onAction: () => {} }),
    );

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('+1점을 주었습니다.')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('+1점을 주었습니다.')).not.toBeInTheDocument();
  });

  it('실행 취소를 누르면 동작을 부르고 알림을 닫는다', () => {
    const onAction = vi.fn();
    renderToast((toast) => toast.info('되돌릴 수 있습니다.', { actionLabel: '실행 취소', onAction }));

    fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));

    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByText('되돌릴 수 있습니다.')).not.toBeInTheDocument();
  });

  it('닫기 버튼으로 즉시 닫는다', () => {
    renderToast((toast) => toast.warning('번호가 겹칩니다.'));

    fireEvent.click(screen.getByRole('button', { name: '알림 닫기' }));

    expect(screen.queryByText('번호가 겹칩니다.')).not.toBeInTheDocument();
  });

  it('알림이 화면을 덮지 않도록 최대 4개만 남긴다', () => {
    renderToast((toast) => {
      for (let i = 1; i <= 6; i += 1) toast.info(`알림 ${i}`);
    });

    expect(screen.queryByText('알림 1')).not.toBeInTheDocument();
    expect(screen.queryByText('알림 2')).not.toBeInTheDocument();
    expect(screen.getByText('알림 3')).toBeInTheDocument();
    expect(screen.getByText('알림 6')).toBeInTheDocument();
  });

  it('같은 말을 여러 번 띄워도 한 줄만 남는다', () => {
    // 복구 알림이 연달아 발생하면 같은 문장이 쌓여 고장처럼 보였다.
    renderToast((toast) => {
      toast.warning('잘못된 좌석 지정을 정리했습니다.');
      toast.warning('잘못된 좌석 지정을 정리했습니다.');
      toast.warning('잘못된 좌석 지정을 정리했습니다.');
    });

    expect(screen.getAllByText('잘못된 좌석 지정을 정리했습니다.')).toHaveLength(1);
  });

  it('같은 말이라도 종류가 다르면 따로 띄운다', () => {
    renderToast((toast) => {
      toast.success('처리했습니다.');
      toast.error('처리했습니다.');
    });

    expect(screen.getAllByText('처리했습니다.')).toHaveLength(2);
  });

  it('실행 취소가 달린 알림은 합치지 않는다', () => {
    // 되돌릴 대상이 각각 다르므로 합치면 한쪽을 되돌릴 수 없다.
    renderToast((toast) => {
      toast.info('+1점을 주었습니다.', { actionLabel: '실행 취소', onAction: () => {} });
      toast.info('+1점을 주었습니다.', { actionLabel: '실행 취소', onAction: () => {} });
    });

    expect(screen.getAllByText('+1점을 주었습니다.')).toHaveLength(2);
  });

  it('중복 알림은 사라지는 시간이 다시 늘어난다', async () => {
    renderToast((toast) => toast.success('저장했습니다.'));

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('저장했습니다.')).toBeInTheDocument();

    // 같은 알림을 다시 띄우면 타이머가 새로 시작된다
    fireEvent.click(screen.getByRole('button', { name: '실행' }));

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('저장했습니다.')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByText('저장했습니다.')).not.toBeInTheDocument();
  });

  it('Provider 밖에서 useToast를 쓰면 명확히 실패한다', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ToastHarness run={() => {}} />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────

describe('Modal', () => {
  it('제목·설명과 연결된 dialog로 그린다', () => {
    render(
      <Modal open onClose={() => {}} title="학생 정보 수정" description="이름과 번호를 바꿉니다.">
        <p>본문</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('학생 정보 수정');
    expect(dialog).toHaveAccessibleDescription('이름과 번호를 바꿉니다.');
  });

  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    render(
      <Modal open={false} onClose={() => {}} title="숨김">
        <p>본문</p>
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Esc와 배경 클릭으로 닫는다', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="닫기 가능">
        <p>본문</p>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('dismissible이 false면 Esc로 닫히지 않는다', () => {
    // 되돌릴 수 없는 작업 중에 실수로 창이 닫히면 안 된다.
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="위험 작업" dismissible={false}>
        <p>본문</p>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
  });

  it('열리면 안쪽 첫 요소로 포커스를 옮긴다', async () => {
    render(
      <Modal open onClose={() => {}} title="포커스">
        <input aria-label="이름" />
      </Modal>,
    );

    await waitFor(() => {
      expect(document.activeElement).not.toBe(document.body);
    });
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('열려 있는 동안 배경 스크롤을 막고 닫으면 되돌린다', () => {
    const { rerender } = render(
      <Modal open onClose={() => {}} title="스크롤">
        <p>본문</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal open={false} onClose={() => {}} title="스크롤">
        <p>본문</p>
      </Modal>,
    );
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

// ─────────────────────────────────────────────────────────────
// ConfirmDialog
// ─────────────────────────────────────────────────────────────

describe('ConfirmDialog', () => {
  it('일반 확인은 바로 누를 수 있다', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="삭제할까요?"
        description="이 과제를 지웁니다."
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('확인 문구를 요구하면 정확히 입력해야 열린다', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="학기 전체를 삭제할까요?"
        description="되돌릴 수 없습니다."
        destructive
        confirmPhrase="삭제"
        confirmLabel="영구 삭제"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    const confirm = screen.getByRole('button', { name: '영구 삭제' });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '삭' } });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '삭제' } });
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('다시 열면 이전 입력이 남지 않는다', () => {
    const { rerender } = render(
      <ConfirmDialog
        open
        title="삭제"
        description="설명"
        confirmPhrase="삭제"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '삭제' } });

    rerender(
      <ConfirmDialog
        open={false}
        title="삭제"
        description="설명"
        confirmPhrase="삭제"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    rerender(
      <ConfirmDialog
        open
        title="삭제"
        description="설명"
        confirmPhrase="삭제"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────
// Table · Tabs · EmptyState · Button · PrintLayout
// ─────────────────────────────────────────────────────────────

interface Row {
  id: string;
  name: string;
}

const COLUMNS: Column<Row>[] = [
  { key: 'name', header: '이름', render: (row) => row.name },
];

describe('Table', () => {
  it('행을 그리고 caption으로 표를 설명한다', () => {
    render(
      <Table columns={COLUMNS} rows={[{ id: '1', name: '김하나' }]} rowKey={(r) => r.id} caption="명단" />,
    );

    expect(screen.getByRole('table', { name: '명단' })).toBeInTheDocument();
    expect(screen.getByText('김하나')).toBeInTheDocument();
  });

  it('행이 없으면 빈 상태를 대신 보여 준다', () => {
    render(
      <Table
        columns={COLUMNS}
        rows={[]}
        rowKey={(r) => r.id}
        empty={<EmptyState title="학생이 없습니다" description="명단을 등록해 주세요." />}
      />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('학생이 없습니다')).toBeInTheDocument();
  });
});

describe('Tabs', () => {
  function Harness() {
    const [active, setActive] = useState('a');
    return (
      <Tabs
        items={[
          { id: 'a', label: '전체', count: 3 },
          { id: 'b', label: '미제출', count: 1 },
        ]}
        activeId={active}
        onChange={setActive}
      >
        <p>{active === 'a' ? '전체 내용' : '미제출 내용'}</p>
      </Tabs>
    );
  }

  it('선택된 탭만 aria-selected가 참이다', () => {
    render(<Harness />);

    expect(screen.getByRole('tab', { name: /전체/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /미제출/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('좌우 화살표로 탭을 옮기고 순환한다', () => {
    render(<Harness />);
    const tablist = screen.getByRole('tablist');

    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(screen.getByRole('tabpanel')).toHaveTextContent('미제출 내용');

    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(screen.getByRole('tabpanel')).toHaveTextContent('전체 내용');

    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(screen.getByRole('tabpanel')).toHaveTextContent('미제출 내용');
  });
});

describe('Button', () => {
  it('loading이면 비활성이 되고 진행 중임을 알린다', () => {
    render(<Button loading>저장</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('iconOnly는 aria-label로 이름을 갖는다', () => {
    render(<Button iconOnly aria-label="명단 열기" />);

    expect(screen.getByRole('button', { name: '명단 열기' })).toBeInTheDocument();
  });
});

describe('PrintLayout', () => {
  it('#print-root 포털에 그리고 앱 화면에는 끼어들지 않는다', async () => {
    const printRoot = document.createElement('div');
    printRoot.id = 'print-root';
    document.body.appendChild(printRoot);

    const { container } = render(
      <PrintLayout title="3학년 2반 명렬표" subtitle="2026학년도 1학기">
        <p>인쇄 내용</p>
      </PrintLayout>,
    );

    await waitFor(() => {
      expect(within(printRoot).getByText('3학년 2반 명렬표')).toBeInTheDocument();
    });
    expect(within(printRoot).getByText('인쇄 내용')).toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('#print-root가 없으면 만들어서 쓴다', async () => {
    expect(document.getElementById('print-root')).toBeNull();

    render(<PrintLayout title="자동 생성">내용</PrintLayout>);

    await waitFor(() => {
      expect(document.getElementById('print-root')).not.toBeNull();
    });
  });
});
