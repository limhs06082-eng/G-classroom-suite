import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from '../../src/features/home/HomePage';
import { ToolsBar } from '../../src/features/tools/ToolsBar';
import { ToolsProvider } from '../../src/features/tools/ToolsContext';
import {
  createClassRoom,
  createEmptySuiteData,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

const T0 = '2026-03-02T09:00:00.000Z';

function seeded(): SuiteData {
  return {
    ...createEmptySuiteData(),
    terms: [
      createTerm(
        { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2027-02-28' },
        T0,
      ),
    ],
    classRooms: [createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, T0)],
    students: [
      createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' }, T0),
      createStudent({ id: 'stu-2', classId: 'class-1', number: 2, name: '이두리' }, T0),
    ],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

function show(): void {
  render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({ load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }) })}
        >
          <ToolsProvider>
            <HomePage />
            <ToolsBar />
          </ToolsProvider>
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.setItem('gboard:tips-seen', '1');
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 7, 24, 9, 0, 0)); // 월요일
});

afterEach(() => {
  vi.useRealTimers();
});

const slot = (label: string): HTMLElement => screen.getByLabelText(`${label} 카드 자리`);

/*
 * 홈 2.0의 약속: 홈에서 적고 끝낸다. 카드는 요약이 아니라 입구이자 작업대다.
 */
describe('홈에서 바로 하기', () => {
  it('오늘 알림장 카드에서 한 줄을 적으면 바로 목록에 선다', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByLabelText('오늘 알림장 카드 자리');

    await user.type(screen.getByRole('textbox', { name: '알림장 한 줄 추가' }), '우유갑 정리{Enter}');

    expect(within(slot('오늘 알림장')).getByText('우유갑 정리')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '알림장 한 줄 추가' })).toHaveValue('');
  });

  it('출결 카드의 [전원 출석 확인]으로 홈에서 하루가 끝난다', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByLabelText('오늘 출결 카드 자리');

    await user.click(screen.getByRole('button', { name: '전원 출석 확인' }));

    expect(within(slot('오늘 출결')).getByText(/전원 출석/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '전원 출석 확인' })).not.toBeInTheDocument();
  });

  it('주요 일정 카드의 [+ 일정]으로 일정을 적으면 D-day 목록에 선다', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByLabelText('주요 일정 카드 자리');

    await user.click(screen.getByRole('button', { name: '+ 일정' }));
    const dialog = await screen.findByRole('dialog', { name: '일정 추가' });
    await user.type(within(dialog).getByRole('textbox', { name: '일정 이름' }), '수학 수행평가');
    await user.clear(within(dialog).getByLabelText('날짜'));
    await user.type(within(dialog).getByLabelText('날짜'), '2026-08-27');
    await user.click(within(dialog).getByRole('button', { name: '추가' }));

    const events = slot('주요 일정');
    expect(within(events).getByText('수학 수행평가')).toBeInTheDocument();
    expect(within(events).getByText('D-3')).toBeInTheDocument();
  });

  it('날짜를 지우면 [추가]가 눌리지 않는다', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByLabelText('주요 일정 카드 자리');

    await user.click(screen.getByRole('button', { name: '+ 일정' }));
    const dialog = await screen.findByRole('dialog', { name: '일정 추가' });
    await user.type(within(dialog).getByRole('textbox', { name: '일정 이름' }), '수학 수행평가');
    expect(within(dialog).getByRole('button', { name: '추가' })).toBeEnabled();

    // 날짜 입력칸을 비우면 값이 ''가 된다. 그때 [추가]가 살아 있으면 눌러도 아무 일이 없다.
    await user.clear(within(dialog).getByLabelText('날짜'));
    expect(within(dialog).getByRole('button', { name: '추가' })).toBeDisabled();
  });

  it('도구 격자에서 타이머가 열린다', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByLabelText('오늘 출결 카드 자리');

    await user.click(within(screen.getByRole('region', { name: '수업 도구' })).getByRole('button', { name: '타이머' }));

    expect(await screen.findByRole('dialog', { name: '타이머' })).toBeInTheDocument();
  });

  it('카드를 접으면 머리만 남고, 펴면 돌아온다', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByLabelText('오늘 출결 카드 자리');

    await user.click(screen.getByRole('button', { name: '오늘 출결 카드 접기' }));
    expect(screen.queryByRole('button', { name: '전원 출석 확인' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '오늘 출결 카드 펴기' }));
    expect(screen.getByRole('button', { name: '전원 출석 확인' })).toBeInTheDocument();
  });
});

/*
 * 교실 PC는 밤새 켜 둔다. 홈 2.0부터 홈이 출석 확인·알림장·일정을 **오늘 날짜로 쓰므로**
 * 렌더 때 한 번 잰 날짜로는 아침에 어제 날짜에 도장을 찍게 된다.
 */
describe('홈의 오늘', () => {
  it('자정을 넘기면 제목 옆 날짜가 바뀐다', async () => {
    vi.setSystemTime(new Date(2026, 7, 24, 23, 59, 59));
    show();
    expect(await screen.findByText('8월 24일 월요일')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByText('8월 25일 화요일')).toBeInTheDocument();
  });
});
