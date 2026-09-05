import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from '../../src/features/home/HomePage';
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
        { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
        T0,
      ),
    ],
    classRooms: [createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, T0)],
    students: [
      createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' }, T0),
      createStudent({ id: 'stu-2', classId: 'class-1', number: 2, name: '이두리' }, T0),
    ],
    seatingStates: [
      {
        classId: 'class-1',
        rows: 2,
        cols: 2,
        disabledSeatIds: ['r2c2'],
        positions: [{ studentId: 'stu-1', seatId: 'r1c1' }],
        perspective: 'student',
        updatedAt: T0,
      },
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
          </ToolsProvider>
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 7, 24, 9, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

/*
 * 한 칸짜리 카드에는 자리표가 들어갈 자리가 없다. 넓혔을 때만 그린다 —
 * 그래야 "카드를 넓힌다"는 조작이 그저 여백을 늘리는 일이 아니게 된다.
 */
describe('자리·모둠 카드 미리보기', () => {
  it('넓히면 자리표가 보이고, 좁히면 사라진다', async () => {
    const user = userEvent.setup();
    show();
    const slot = await screen.findByLabelText('자리·모둠 카드 자리');

    expect(within(slot).queryByText('김하나')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '자리·모둠 카드 넓히기' }));
    expect(within(slot).getByText('김하나')).toBeInTheDocument();
    // 사용 안 함 자리는 그대로 표시된다 — 자리표 모양이 실제와 같아야 한다.
    expect(within(slot).getByLabelText('2행 2열, 사용 안 함')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '자리·모둠 카드 좁히기' }));
    expect(within(slot).queryByText('김하나')).not.toBeInTheDocument();
  });
});
