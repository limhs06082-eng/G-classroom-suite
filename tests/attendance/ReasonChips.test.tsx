import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import AttendancePage from '../../src/features/attendance/AttendancePage';
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

const NOW = '2026-03-02T09:00:00.000Z';

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
    students: [createStudent({ id: 'stu-1', classId: room.id, number: 1, name: '김하나' }, NOW)],
    activeTermId: term.id,
    activeClassId: room.id,
  };
}

beforeEach(() => {
  document.getElementById('print-root')?.remove();
});

async function renderToday(): Promise<void> {
  render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({
            load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }),
          })}
        >
          <AttendancePage />
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
  await screen.findByRole('button', { name: '김하나 — 출석' });
}

/*
 * 생활기록부 출결은 결석 횟수 옆에 질병·미인정·기타·인정이 따라간다.
 * 메모 칸에 "병원"이라 적는 것과 별개로, 분류는 눌러서 고른다.
 */
describe('출결 사유 분류 칩', () => {
  it('결석을 찍으면 사유 줄에 네 분류가 뜨고, 누르면 켜지고 다시 누르면 꺼진다', async () => {
    const user = userEvent.setup();
    await renderToday();

    await user.click(screen.getByRole('button', { name: '김하나 — 출석' }));

    const group = screen.getByRole('group', { name: '김하나 사유 분류' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual([
      '질병',
      '미인정',
      '기타',
      '인정',
    ]);

    await user.click(within(group).getByRole('button', { name: '질병' }));
    expect(within(group).getByRole('button', { name: '질병' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(group).getByRole('button', { name: '질병' }));
    expect(within(group).getByRole('button', { name: '질병' })).toHaveAttribute('aria-pressed', 'false');
  });
});
