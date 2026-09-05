import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createClassRoom,
  createEmptySuiteData,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import StudentDetailPage from '../../src/shared/roster/StudentDetailPage';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

const NOW = '2026-03-02T09:00:00.000Z';

function seeded(): SuiteData {
  const term = createTerm(
    { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2027-02-28' },
    NOW,
  );
  const room = createClassRoom({ id: 'class-1', termId: 'term-1', name: '우리 반' }, NOW);
  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room],
    students: [createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' }, NOW)],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function show(): void {
  render(
    <MemoryRouter initialEntries={['/roster/stu-1']}>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({ load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }) })}
        >
          <Routes>
            <Route path="roster/:studentId" element={<StudentDetailPage />} />
          </Routes>
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  document.getElementById('print-root')?.remove();
});

/*
 * 상담 주간의 "지난번에 뭐라 했더라"를 없앤다. 관찰 기록에 상담 표시와
 * 다음 상담 날짜를 남기면 머리에 D-n이 선다.
 */
describe('상담 기록', () => {
  it('상담으로 표시해 적으면 배지가 붙고 다음 상담 D-n이 머리에 선다', async () => {
    const user = userEvent.setup();
    show();
    const input = await screen.findByRole('textbox', { name: '김하나 관찰 기록 추가' });

    await user.click(screen.getByRole('button', { name: '상담' }));
    await user.type(screen.getByLabelText('다음 상담'), inDays(3));
    await user.type(input, '학습 태도 상담, 집에서 숙제 시간 정하기로{Enter}');

    const list = screen.getByRole('list', { name: '관찰 기록 목록' });
    expect(within(list).getByText('학습 태도 상담, 집에서 숙제 시간 정하기로')).toBeInTheDocument();
    expect(within(list).getByText('상담')).toBeInTheDocument();
    expect(screen.getByText('다음 상담 D-3')).toBeInTheDocument();
  });
});
