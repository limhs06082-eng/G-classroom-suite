import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import AssignmentPage from '../../src/features/assignment/AssignmentPage';
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
 * 기한을 과거로 둔다. useAssignment는 실제 오늘 날짜를 쓰므로
 * 지연 뱃지를 검증하려면 어느 날 실행해도 기한이 지나 있어야 한다.
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

async function renderPage(): Promise<void> {
  render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({
            load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }),
          })}
        >
          <AssignmentPage />
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );

  await screen.findByRole('button', { name: '마감하기' });
}

/** 과제 고르는 칩. 삭제 버튼이나 표 보기 칸과 헷갈리지 않게 목록에서 찾는다. */
function chip(title: string): HTMLElement {
  return within(screen.getByRole('list', { name: '과제 목록' })).getByRole('button', {
    name: new RegExp(title),
  });
}

describe('과제 마감', () => {
  it('마감하면 칩에 마감이 뜨고 지연 뱃지가 사라진다', async () => {
    await renderPage();

    // 기한이 2020년이고 이두리가 안 냈으므로 처음에는 지연이다.
    expect(chip('독서록').textContent).toContain('지연');

    fireEvent.click(screen.getByRole('button', { name: '마감하기' }));

    await waitFor(() => {
      expect(chip('독서록').textContent).toContain('마감');
    });
    expect(chip('독서록').textContent).not.toContain('지연');
  });

  it('마감해도 학생 상태는 계속 바꿀 수 있다', async () => {
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: '마감하기' }));
    await screen.findByRole('button', { name: '다시 열기' });

    // 마감은 잠금이 아니다. 늦게 낸 학생을 체크할 수 있어야 한다.
    fireEvent.click(screen.getByRole('button', { name: '이두리 미제출' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '이두리 제출' })).toBeTruthy();
    });
  });

  it('진행 중일 때는 보관 버튼이 없다', async () => {
    await renderPage();

    // 진행 중인 과제를 한 번에 숨기는 것은 실수하기 쉽다. 마감을 거쳐야 한다.
    expect(screen.queryByRole('button', { name: '보관하기' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '마감하기' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '보관하기' })).toBeTruthy();
    });
  });

  it('다시 열면 마감 표시가 사라진다', async () => {
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: '마감하기' }));
    await screen.findByRole('button', { name: '다시 열기' });

    fireEvent.click(screen.getByRole('button', { name: '다시 열기' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '마감하기' })).toBeTruthy();
    });
    expect(chip('독서록').textContent).not.toContain('마감');
  });
});

describe('과제 보관', () => {
  async function archiveFirst(): Promise<void> {
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: '마감하기' }));
    await screen.findByRole('button', { name: '보관하기' });

    fireEvent.click(screen.getByRole('button', { name: '보관하기' }));
    await screen.findByRole('button', { name: /보관한 과제 1개/ });
  }

  it('보관하면 목록에서 사라지고 보관함에 나타난다', async () => {
    await archiveFirst();

    expect(
      within(screen.getByRole('list', { name: '과제 목록' })).queryByRole('button', {
        name: /독서록/,
      }),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /보관한 과제 1개/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /되돌리기/ })).toBeTruthy();
    });
  });

  it('되돌리면 마감 상태로 돌아오고 제출 기록도 남아 있다', async () => {
    await archiveFirst();

    fireEvent.click(screen.getByRole('button', { name: /보관한 과제 1개/ }));
    fireEvent.click(await screen.findByRole('button', { name: /되돌리기/ }));

    // 보관은 삭제가 아니다. 김하나의 제출 기록이 그대로 있어야 한다.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '김하나 제출' })).toBeTruthy();
    });
    expect(chip('독서록').textContent).toContain('마감');
  });

  it('보관한 과제가 없으면 보관함 줄이 안 나온다', async () => {
    await renderPage();

    expect(screen.queryByRole('button', { name: /보관한 과제/ })).toBeNull();
  });
});
