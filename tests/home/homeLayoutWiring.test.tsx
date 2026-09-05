import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from '../../src/features/home/HomePage';
import { ToolsProvider } from '../../src/features/tools/ToolsContext';
import { createClassRoom, createEmptySuiteData, createTerm } from '../../src/shared/domain/factories';
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

/** jsdom에는 DataTransfer가 없다. 끌기에 필요한 만큼만 흉내 낸다. */
function fakeTransfer(): Record<string, unknown> {
  const store = new Map<string, string>();
  return {
    effectAllowed: 'all',
    dropEffect: 'none',
    setData: (type: string, value: string) => store.set(type, value),
    getData: (type: string) => store.get(type) ?? '',
    setDragImage: () => undefined,
  };
}

function savedOrder(): string[] {
  const raw = window.localStorage.getItem('gboard:home-layout');
  if (raw === null) return [];
  return (JSON.parse(raw) as { order?: string[] }).order ?? [];
}

beforeEach(() => {
  window.localStorage.removeItem('gboard:home-layout');
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 7, 24, 9, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

/*
 * 손잡이를 끌어 다른 카드 자리에 놓으면 그 자리로 간다. 위·아래 단추는 그대로
 * 있다 — 터치 화면과 키보드는 HTML 드래그가 안 되기 때문이다.
 */
describe('홈 카드 끌기·크기', () => {
  it('손잡이를 끌어 다른 카드에 놓으면 그 자리로 가고 이 기기에 남는다', async () => {
    show();
    await screen.findByLabelText('오늘 출결 카드 자리');

    const dataTransfer = fakeTransfer();
    fireEvent.dragStart(screen.getByRole('button', { name: '오늘 출결 카드 끌기' }), { dataTransfer });
    fireEvent.dragOver(screen.getByLabelText('지금 카드 자리'), { dataTransfer });
    fireEvent.drop(screen.getByLabelText('지금 카드 자리'), { dataTransfer });

    // 앞으로 끌었으니 '지금' 앞에 선다.
    expect(savedOrder().slice(0, 2)).toEqual(['attendance', 'now']);
    expect(screen.getByLabelText('오늘 출결 카드 자리')).toHaveStyle({ order: '0' });
  });

  it('넓히기를 누르면 두 칸이 되고 좁히기로 돌아온다', async () => {
    const user = userEvent.setup();
    show();
    const slot = await screen.findByLabelText('오늘 출결 카드 자리');

    expect(slot.className).not.toContain('sm:col-span-2');

    await user.click(screen.getByRole('button', { name: '오늘 출결 카드 넓히기' }));
    expect(slot.className).toContain('sm:col-span-2');

    await user.click(screen.getByRole('button', { name: '오늘 출결 카드 좁히기' }));
    expect(slot.className).not.toContain('sm:col-span-2');
  });
});
