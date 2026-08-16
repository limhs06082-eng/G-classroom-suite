import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import DutyPage from '../../src/features/duty/DutyPage';
import {
  createClassRoom,
  createDutyProfile,
  createDutyRole,
  createDutyRound,
  createEmptySuiteData,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

const EARLIER = '2026-03-01T09:00:00.000Z';

/** 배정은 오늘이 든 주여야 한다. 실행하는 날에 맞춘다. */
function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function seeded(): SuiteData {
  const today = todayString();

  return {
    ...createEmptySuiteData(),
    terms: [
      createTerm(
        {
          id: 'term-1',
          schoolYear: '2026',
          semester: '1학기',
          startDate: '2026-03-02',
          endDate: '2027-02-28',
        },
        EARLIER,
      ),
    ],
    classRooms: [createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, EARLIER)],
    students: [
      createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' }, EARLIER),
      createStudent({ id: 'stu-2', classId: 'class-1', number: 2, name: '이두리' }, EARLIER),
      createStudent({ id: 'stu-3', classId: 'class-1', number: 3, name: '박세찬' }, EARLIER),
    ],
    dutyProfiles: [
      createDutyProfile('stu-1', 1),
      createDutyProfile('stu-2', 2),
      createDutyProfile('stu-3', 3),
    ],
    dutyRoles: [
      createDutyRole(
        {
          id: 'role-1',
          classId: 'class-1',
          name: '칠판 지우기',
          category: '칠판',
          neededCount: 1,
          cycle: 'weekly',
        },
        EARLIER,
      ),
    ],
    dutyRounds: [
      createDutyRound(
        {
          id: 'round-1',
          classId: 'class-1',
          startDate: today,
          endDate: today,
          label: '이번 주',
          assignments: [{ roleId: 'role-1', studentIds: ['stu-1'] }],
        },
        EARLIER,
      ),
    ],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

async function openModal(): Promise<void> {
  render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({
            load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }),
          })}
        >
          <DutyPage />
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByLabelText('칠판 지우기 오늘 대체'));
  await screen.findByLabelText('김하나 대신할 학생');
}

/** 오늘 당번 목록. 대체가 반영된 이름이 여기 나온다. */
function dutyList(): HTMLElement {
  const heading = screen.getByRole('heading', { name: '칠판 지우기' });
  const card = heading.closest('li');
  if (card === null) throw new Error('역할 카드를 못 찾았다');
  return card;
}

describe('당번 대체 지정', () => {
  it('대체 버튼은 학생 줄이 아니라 역할 머리에 있다', async () => {
    // 학생 줄은 줄 전체가 완료 토글 버튼이다. 그 안에 버튼을 넣으면 중첩이 된다.
    await openModal();

    const toggle = within(dutyList()).getByRole('button', { name: /김하나/ });
    expect(toggle.querySelector('button')).toBeNull();
  });

  it('고를 수 있는 학생에 오늘 그 역할 당번은 없다', async () => {
    await openModal();

    const select = screen.getByLabelText('김하나 대신할 학생');
    const names = [...select.querySelectorAll('option')].map((option) => option.textContent ?? '');

    expect(names.some((name) => name.includes('이두리'))).toBe(true);
    expect(names.some((name) => name.includes('박세찬'))).toBe(true);
    // 당번인 김하나가 자기를 대신할 수는 없다.
    expect(names.some((name) => name.includes('김하나'))).toBe(false);
  });

  it('대체를 지정하면 오늘 당번이 바뀌고 원래 이름이 함께 보인다', async () => {
    await openModal();

    fireEvent.change(screen.getByLabelText('김하나 대신할 학생'), { target: { value: 'stu-3' } });

    await waitFor(() => {
      expect(within(dutyList()).getByText('박세찬')).toBeTruthy();
    });
    expect(within(dutyList()).getByText('김하나 대신')).toBeTruthy();
  });

  it('대체 없음을 고르면 원래 당번으로 돌아온다', async () => {
    await openModal();

    fireEvent.change(screen.getByLabelText('김하나 대신할 학생'), { target: { value: 'stu-3' } });
    await waitFor(() => {
      expect(within(dutyList()).getByText('박세찬')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('김하나 대신할 학생'), { target: { value: '' } });

    await waitFor(() => {
      expect(within(dutyList()).queryByText('김하나 대신')).toBeNull();
    });
    expect(within(dutyList()).getByText('김하나')).toBeTruthy();
  });

  it('대체 중인 학생이 골라 둔 값으로 남아 있다', async () => {
    // 대체자는 당번이 되므로 후보 목록에서 빠진다. 그래도 select 값이 사라지면 안 된다.
    await openModal();

    fireEvent.change(screen.getByLabelText('김하나 대신할 학생'), { target: { value: 'stu-3' } });

    await waitFor(() => {
      expect((screen.getByLabelText('김하나 대신할 학생') as HTMLSelectElement).value).toBe('stu-3');
    });
  });

  it('오늘만 바뀐다고 알린다', async () => {
    await openModal();

    expect(screen.getByText(/내일은 원래 당번으로 돌아옵니다/)).toBeTruthy();
  });
});
