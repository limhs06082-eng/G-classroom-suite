import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDuty } from '../../src/features/duty/useDuty';
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

/** 오늘이 포함된 주로 배정을 만들어 둔다. 테스트가 실행되는 날에 맞춰야 한다. */
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
        { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2027-02-28' },
        EARLIER,
      ),
    ],
    classRooms: [createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, EARLIER)],
    students: [
      createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' }, EARLIER),
      createStudent({ id: 'stu-2', classId: 'class-1', number: 2, name: '이두리' }, EARLIER),
    ],
    dutyProfiles: [createDutyProfile('stu-1', 1), createDutyProfile('stu-2', 2)],
    dutyRoles: [
      createDutyRole(
        { id: 'role-1', classId: 'class-1', name: '칠판 지우기', category: '칠판', neededCount: 2, cycle: 'weekly' },
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
          assignments: [{ roleId: 'role-1', studentIds: ['stu-1', 'stu-2'] }],
        },
        EARLIER,
      ),
    ],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

function Harness() {
  const duty = useDuty();
  const entry = duty.todayDuties[0];

  return (
    <div>
      <p data-testid="role-count">{duty.todayDuties.length}</p>
      <p data-testid="done-ids">{[...(entry?.doneStudentIds ?? [])].sort().join(',')}</p>
      <p data-testid="is-done">{String(entry?.isDone ?? false)}</p>
      <button type="button" onClick={() => duty.toggleCompleted('role-1', 'stu-1')}>
        1번 완료
      </button>
      <button type="button" onClick={() => duty.toggleCompleted('role-1', 'stu-2')}>
        2번 완료
      </button>
    </div>
  );
}

function renderDuty() {
  return render(
    <ToastProvider>
      <SuiteDataProvider
        adapter={stubAdapter({
          load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }),
        })}
      >
        <Harness />
      </SuiteDataProvider>
    </ToastProvider>,
  );
}

describe('useDuty — 오늘의 수행 체크', () => {
  it('오늘 배정된 역할을 보여 준다', async () => {
    renderDuty();

    await waitFor(() => expect(screen.getByTestId('role-count')).toHaveTextContent('1'));
  });

  it('학생 한 명만 체크하면 그 학생만 완료로 표시된다', async () => {
    /*
     * 개별 체크가 역할 전체 완료 여부를 보고 있던 결함이 있었다.
     * 교사가 학생을 눌러도 화면이 그대로여서 눌린 건지 알 수 없었다.
     */
    renderDuty();
    await waitFor(() => expect(screen.getByTestId('role-count')).toHaveTextContent('1'));

    await act(async () => {
      screen.getByRole('button', { name: '1번 완료' }).click();
    });

    expect(screen.getByTestId('done-ids')).toHaveTextContent('stu-1');
    // 담당 전원이 마쳐야 역할이 완료다
    expect(screen.getByTestId('is-done')).toHaveTextContent('false');
  });

  it('담당 전원이 체크되면 역할이 완료가 된다', async () => {
    renderDuty();
    await waitFor(() => expect(screen.getByTestId('role-count')).toHaveTextContent('1'));

    await act(async () => {
      screen.getByRole('button', { name: '1번 완료' }).click();
      screen.getByRole('button', { name: '2번 완료' }).click();
    });

    expect(screen.getByTestId('is-done')).toHaveTextContent('true');
  });

  it('다시 누르면 완료가 풀린다', async () => {
    renderDuty();
    await waitFor(() => expect(screen.getByTestId('role-count')).toHaveTextContent('1'));

    await act(async () => {
      screen.getByRole('button', { name: '1번 완료' }).click();
    });
    expect(screen.getByTestId('done-ids')).toHaveTextContent('stu-1');

    await act(async () => {
      screen.getByRole('button', { name: '1번 완료' }).click();
    });
    expect(screen.getByTestId('done-ids')).toHaveTextContent('');
  });
});
