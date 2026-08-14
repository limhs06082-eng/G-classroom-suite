import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AssignmentMatrix } from '../../src/features/assignment/AssignmentMatrix';
import {
  createAssignment,
  createClassRoom,
  createEmptySuiteData,
  createStudent,
  createSubmission,
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
  const room = createClassRoom({ termId: term.id, name: '우리 반' }, NOW);

  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room],
    students: [
      createStudent({ id: 'stu-1', classId: room.id, number: 1, name: '김하나' }, NOW),
      createStudent({ id: 'stu-2', classId: room.id, number: 2, name: '이두리' }, NOW),
    ],
    assignments: [
      createAssignment({ id: 'a-1', classId: room.id, title: '독서록', dueDate: '2026-03-10' }, NOW),
      createAssignment({ id: 'a-2', classId: room.id, title: '일기', dueDate: '' }, NOW),
    ],
    submissions: [createSubmission('a-1', 'stu-1', 'submitted', NOW)],
    activeTermId: term.id,
    activeClassId: room.id,
  };
}

async function renderMatrix(): Promise<void> {
  render(
    <ToastProvider>
      <SuiteDataProvider
        adapter={stubAdapter({
          load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }),
        })}
      >
        <AssignmentMatrix />
      </SuiteDataProvider>
    </ToastProvider>,
  );

  await screen.findByRole('table');
}

describe('AssignmentMatrix', () => {
  it('학생 수 × 과제 수만큼 칸이 그려진다', async () => {
    await renderMatrix();

    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('칸의 이름표에 학생·과제·상태가 줄임 없이 들어간다', async () => {
    await renderMatrix();

    expect(screen.getByLabelText('김하나, 독서록, 제출')).toBeTruthy();
    expect(screen.getByLabelText('이두리, 독서록, 미제출')).toBeTruthy();
    expect(screen.getByLabelText('김하나, 일기, 미제출')).toBeTruthy();
  });

  it('칸에는 한 글자만 보인다', async () => {
    await renderMatrix();

    expect(screen.getByLabelText('김하나, 독서록, 제출').textContent).toBe('제');
    expect(screen.getByLabelText('이두리, 독서록, 미제출').textContent).toBe('미');
  });

  it('학생 이름 열이 스크롤을 따라다닌다', async () => {
    await renderMatrix();

    const row = screen.getByRole('row', { name: /김하나/ });
    expect(within(row).getByRole('rowheader').className).toContain('sticky');
  });

  it('행 끝에 그 학생이 낸 수가 나온다', async () => {
    await renderMatrix();

    const row = screen.getByRole('row', { name: /김하나/ });
    expect(within(row).getByText('1/2')).toBeTruthy();
  });

  it('열 머리에 그 과제를 낸 수가 나온다', async () => {
    await renderMatrix();

    const header = screen.getByRole('columnheader', { name: /독서록/ });
    expect(within(header).getByText('1/2')).toBeTruthy();
  });
});
