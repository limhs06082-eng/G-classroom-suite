import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StudentAssignments } from '../../src/features/assignment/StudentAssignments';
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

/**
 * useAssignment는 실제 오늘 날짜를 쓴다. 지연을 검증하려면 기한이
 * 과거여야 어느 날 실행해도 통과한다.
 */
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
      createAssignment({ id: 'a-1', classId: room.id, title: '독서록', dueDate: '2020-01-01' }, NOW),
      createAssignment({ id: 'a-2', classId: room.id, title: '일기', dueDate: '' }, NOW),
    ],
    submissions: [createSubmission('a-1', 'stu-1', 'submitted', NOW)],
    activeTermId: term.id,
    activeClassId: room.id,
  };
}

async function renderPanel(): Promise<void> {
  render(
    <ToastProvider>
      <SuiteDataProvider
        adapter={stubAdapter({
          load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }),
        })}
      >
        <StudentAssignments />
      </SuiteDataProvider>
    </ToastProvider>,
  );

  await screen.findByLabelText('독서록 제출');
}

describe('StudentAssignments', () => {
  it('고른 학생의 과제가 전부 나온다', async () => {
    await renderPanel();

    // 아무도 안 골랐으면 첫 학생(김하나)을 보여 준다.
    expect(screen.getByLabelText('독서록 제출')).toBeTruthy();
    expect(screen.getByLabelText('일기 미제출')).toBeTruthy();
  });

  it('보완 사유를 적으면 저장된다', async () => {
    await renderPanel();

    fireEvent.change(screen.getByLabelText('독서록 보완 사유'), {
      target: { value: '분량 부족' },
    });

    await waitFor(() => {
      expect((screen.getByLabelText('독서록 보완 사유') as HTMLInputElement).value).toBe(
        '분량 부족',
      );
    });
  });

  it('보완 사유는 그 학생 그 과제에만 남는다', async () => {
    await renderPanel();

    fireEvent.change(screen.getByLabelText('독서록 보완 사유'), {
      target: { value: '분량 부족' },
    });

    await waitFor(() => {
      expect((screen.getByLabelText('독서록 보완 사유') as HTMLInputElement).value).toBe(
        '분량 부족',
      );
    });

    // 다른 학생으로 옮기면 빈칸이어야 한다.
    fireEvent.click(screen.getByRole('button', { name: /이두리/ }));

    await waitFor(() => {
      expect((screen.getByLabelText('독서록 보완 사유') as HTMLInputElement).value).toBe('');
    });
  });

  it('기한이 지났는데 안 낸 학생은 칩에 지연이 뜬다', async () => {
    await renderPanel();

    // 이두리는 기한이 2020년인 독서록을 안 냈다.
    const chip = screen.getByRole('button', { name: /이두리/ });
    expect(chip.textContent).toContain('지연 1');

    // 김하나는 냈으므로 지연이 없다.
    expect(screen.getByRole('button', { name: /김하나/ }).textContent).not.toContain('지연');
  });

  it('상태 단추를 누르면 다음 상태로 넘어간다', async () => {
    await renderPanel();

    fireEvent.click(screen.getByLabelText('일기 미제출'));

    await waitFor(() => {
      expect(screen.getByLabelText('일기 제출')).toBeTruthy();
    });
  });
});
