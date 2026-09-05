import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import AttendancePage from '../../src/features/attendance/AttendancePage';
import { setStatus } from '../../src/features/attendance/attendanceCore';
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

/*
 * 학기는 3월 2일 ~ 7월 20일. 기록은 학기 안(3월 5일)과 방학(7월 21일)에
 * 하나씩 — 학기 전체 표에는 하나만 세어져야 한다.
 */
function seeded(): SuiteData {
  const term = createTerm(
    { schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    NOW,
  );
  const room = createClassRoom({ id: 'class-1', termId: term.id, name: '우리 반' }, NOW);
  let records = setStatus([], room.id, '2026-03-05', 'stu-1', 'absent');
  records = setStatus(records, room.id, '2026-07-21', 'stu-1', 'absent');

  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room],
    // 번호를 7로 둔다 — 결석 1과 번호 1이 표에서 헷갈리면 안 된다.
    students: [createStudent({ id: 'stu-1', classId: room.id, number: 7, name: '김하나' }, NOW)],
    attendanceRecords: records,
    activeTermId: term.id,
    activeClassId: room.id,
  };
}

beforeEach(() => {
  document.getElementById('print-root')?.remove();
});

async function renderMonthly(): Promise<void> {
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

  await userEvent.setup().click(await screen.findByRole('tab', { name: '월별 통계' }));
}

describe('출결 집계 — 학기 전체', () => {
  it('[학기 전체]를 누르면 학기 이름이 뜨고 방학 기록은 세지 않는다', async () => {
    const user = userEvent.setup();
    await renderMonthly();

    await user.click(screen.getByRole('button', { name: '학기 전체' }));

    // 달 스테퍼는 사라지고 학기 이름이 그 자리에 선다.
    expect(screen.queryByRole('button', { name: '이전 달' })).not.toBeInTheDocument();
    expect(screen.getAllByText('2026학년도 1학기').length).toBeGreaterThan(0);

    // 김하나 줄의 결석은 1 — 7월 21일(방학) 것은 안 센다.
    // 화면 표가 먼저, 인쇄 표(포털)는 뒤에 붙는다.
    const row = screen.getAllByRole('table')[0]?.querySelector('tbody tr') ?? null;
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('김하나')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('1', { selector: 'td' })).toBeInTheDocument();
  });
});
