import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RosterImportPanel } from '../../src/shared/roster/RosterImportPanel';

function typeRoster(text: string): void {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
}

describe('RosterImportPanel', () => {
  it('적용 전에 들어갈 학생을 미리 보여 준다', () => {
    render(<RosterImportPanel onApply={() => {}} />);
    typeRoster('김하나\n이두리');

    expect(screen.getByText('학생 2명')).toBeInTheDocument();
    expect(screen.getByText('김하나')).toBeInTheDocument();
    expect(screen.getByText('이두리')).toBeInTheDocument();
  });

  it('읽지 못한 줄을 줄 번호와 사유까지 보여 준다', () => {
    // 이 화면의 존재 이유. 원본은 못 읽은 줄을 조용히 버려서
    // 25명을 붙여넣고 23명만 들어가도 교사가 알 수 없었다.
    render(<RosterImportPanel onApply={() => {}} />);
    typeRoster('1,김하나\n2\n3,박세찬');

    expect(screen.getByText('학생 2명')).toBeInTheDocument();
    expect(screen.getByText('읽지 못한 줄 1개')).toBeInTheDocument();
    expect(screen.getByText('2행')).toBeInTheDocument();
    expect(screen.getByText(/번호만 있고 이름이 없습니다/)).toBeInTheDocument();
  });

  it('번호 중복과 같은 이름을 확인 대상으로 알린다', () => {
    render(<RosterImportPanel onApply={() => {}} />);
    typeRoster('1,김하나\n1,김하나');

    expect(screen.getByText('번호 중복 1')).toBeInTheDocument();
    expect(screen.getByText('같은 이름 김하나')).toBeInTheDocument();
  });

  it('헤더를 건너뛴 사실을 알린다', () => {
    render(<RosterImportPanel onApply={() => {}} />);
    typeRoster('번호,이름\n1,김하나');

    expect(screen.getByText('헤더 줄 건너뜀')).toBeInTheDocument();
    expect(screen.getByText('학생 1명')).toBeInTheDocument();
  });

  it('읽어낸 학생이 없으면 적용 버튼이 잠긴다', () => {
    render(<RosterImportPanel onApply={() => {}} />);
    typeRoster('2\n3');

    expect(screen.getByRole('button', { name: '명단 적용' })).toBeDisabled();
  });

  it('적용하면 파싱 결과와 선택한 방식을 함께 넘긴다', () => {
    const onApply = vi.fn();
    render(<RosterImportPanel onApply={onApply} />);
    typeRoster('1,김하나\n2,이두리');

    fireEvent.click(screen.getByLabelText(/새 학생만 추가/));
    fireEvent.click(screen.getByRole('button', { name: '명단 적용' }));

    expect(onApply).toHaveBeenCalledOnce();
    const [rows, mode] = onApply.mock.calls[0] ?? [];
    expect(mode).toBe('add');
    expect(rows).toEqual([
      { line: 1, number: 1, name: '김하나' },
      { line: 2, number: 2, name: '이두리' },
    ]);
  });

  it('적용 후에는 입력칸을 비워 같은 명단을 두 번 넣지 않게 한다', () => {
    render(<RosterImportPanel onApply={() => {}} />);
    typeRoster('1,김하나');

    fireEvent.click(screen.getByRole('button', { name: '명단 적용' }));

    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('최초 설정에서는 적용 방식 선택을 숨긴다', () => {
    render(<RosterImportPanel showModeSelector={false} applyLabel="등록" onApply={() => {}} />);

    expect(screen.queryByText('적용 방식')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '등록' })).toBeInTheDocument();
  });
});
