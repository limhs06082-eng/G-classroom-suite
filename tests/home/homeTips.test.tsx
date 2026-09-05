import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from '../../src/features/home/HomePage';
import { TIPS_SEEN_STORAGE } from '../../src/features/home/tipsStore';
import { ToolsProvider } from '../../src/features/tools/ToolsContext';
import { createClassRoom, createEmptySuiteData, createStudent, createTerm } from '../../src/shared/domain/factories';
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
    students: [createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' }, T0)],
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
  window.localStorage.removeItem(TIPS_SEEN_STORAGE);
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 7, 24, 9, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

/*
 * 연수에서 설명 없이 돌아다니게 하려면 "여기 누르세요"가 화면에 있어야 한다.
 * 한 번 다 보면 다시 안 뜬다 — 매일 아침 같은 안내를 읽게 하지 않는다.
 */
describe('첫 화면 안내', () => {
  it('처음에는 뜨고, 네 걸음을 다 보면 사라지며 이 기기에 남는다', async () => {
    const user = userEvent.setup();
    show();

    expect(await screen.findByRole('region', { name: '처음 안내' })).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 4/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByText(/4 \/ 4/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '마치기' }));

    expect(screen.queryByRole('region', { name: '처음 안내' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(TIPS_SEEN_STORAGE)).toBe('1');
  });

  it('[그만 보기]로도 끝나고, 본 기기에서는 다시 안 뜬다', async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: '그만 보기' }));
    expect(screen.queryByRole('region', { name: '처음 안내' })).not.toBeInTheDocument();
  });

  it('이미 본 기기에서는 처음부터 안 뜬다', async () => {
    window.localStorage.setItem(TIPS_SEEN_STORAGE, '1');
    show();
    await screen.findByLabelText('지금 카드 자리');
    expect(screen.queryByRole('region', { name: '처음 안내' })).not.toBeInTheDocument();
  });
});
