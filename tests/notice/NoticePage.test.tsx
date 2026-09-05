import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import NoticePage from '../../src/features/notice/NoticePage';
import {
  createClassEvent,
  createClassRoom,
  createEmptySuiteData,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

const NOW = '2026-03-02T09:00:00.000Z';

/** 화면은 진짜 오늘을 쓰므로, 내일 일정은 실행 시각 기준으로 만든다. */
function tomorrowIso(): string {
  const day = new Date();
  day.setDate(day.getDate() + 1);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

function seeded(): SuiteData {
  const term = createTerm(
    { schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    NOW,
  );
  const room = createClassRoom({ id: 'class-1', termId: term.id, name: '우리 반' }, NOW);

  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room],
    classEvents: [
      createClassEvent(
        { classId: room.id, date: tomorrowIso(), title: '현장학습', note: '도시락' },
        NOW,
      ),
    ],
    activeTermId: term.id,
    activeClassId: room.id,
  };
}

async function renderPage(): Promise<void> {
  render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({
            load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }),
          })}
        >
          <NoticePage />
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );

  // 칩 단추로 기다린다. '다가오는 일정' 글자는 인쇄 포털에도 있어 둘이 될 수 있다.
  await screen.findByRole('button', { name: '+ 내일 현장학습 — 도시락' });
}

describe('알림장 — 학급 일정 문구', () => {
  it('내일 일정이 칩으로 뜨고, 누르면 알림장 한 줄이 되며 칩은 사라진다', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: '+ 내일 현장학습 — 도시락' }));

    expect(
      within(screen.getByRole('list', { name: '알림장 항목' })).getByDisplayValue('내일 현장학습 — 도시락'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '+ 내일 현장학습 — 도시락' }),
    ).not.toBeInTheDocument();
  });

  it('인쇄에는 다가오는 일정이 같이 찍히고, 항목이 되면 일정 묶음에서는 빠진다', async () => {
    const user = userEvent.setup();
    await renderPage();

    const printRoot = (): HTMLElement => {
      const root = document.getElementById('print-root');
      if (root === null) throw new Error('print-root 없음');
      return root;
    };

    // 인쇄 포털은 PrintLayout이 마운트된 뒤 한 박자 늦게 채워진다. 기다려서 본다.
    expect(await within(printRoot()).findByText('다가오는 일정')).toBeInTheDocument();
    expect(within(printRoot()).getByText(/내일 현장학습 — 도시락/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ 내일 현장학습 — 도시락' }));

    // 항목으로 찍히니 일정 묶음 자체가 사라진다 — 두 번 찍지 않는다.
    await waitFor(() =>
      expect(within(printRoot()).queryByText('다가오는 일정')).not.toBeInTheDocument(),
    );
    expect(within(printRoot()).getByText(/1\. 내일 현장학습 — 도시락/)).toBeInTheDocument();
  });

  it('[문자로 복사]는 항목과 일정을 한 덩어리 글로 복사한다', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: '+ 내일 현장학습 — 도시락' }));
    await user.click(screen.getByRole('button', { name: '문자로 복사' }));

    const text = await navigator.clipboard.readText();
    expect(text).toContain('[우리 반 알림장]');
    expect(text).toContain('1. 내일 현장학습 — 도시락');
  });
});
