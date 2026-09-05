import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createClassRoom,
  createEmptySuiteData,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import RosterPage from '../../src/shared/roster/RosterPage';
import { applyRosterImport, updateStudent } from '../../src/shared/roster/rosterOps';
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
    students: [
      createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나', birthday: '2015-09-07' }, NOW),
      createStudent({ id: 'stu-2', classId: 'class-1', number: 2, name: '이두리' }, NOW),
    ],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

const save = vi.fn(async (_data: SuiteData) => {});

beforeEach(() => {
  save.mockClear();
  document.getElementById('print-root')?.remove();
});

function show(): void {
  render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({ load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }), save })}
        >
          <RosterPage />
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

/*
 * 리뷰가 잡은 두 결함. 수정 창의 초기값이 첫 학생 것으로 굳어 생일이 지워졌고,
 * 명단이 이미 있는 반에 생년월일을 붙여 넣어도 안 들어왔다.
 */
describe('생일 — 수정 창과 붙여넣기', () => {
  it('수정 창을 열면 그 학생의 생일이 차 있고, 이름만 고쳐 저장해도 생일이 남는다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole('button', { name: '김하나 정보 수정' }));
    expect(screen.getByLabelText('생일')).toHaveValue('2015-09-07');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(
      () => {
        const last = save.mock.calls.at(-1)?.[0];
        expect(last?.students.find((s) => s.id === 'stu-1')?.birthday).toBe('2015-09-07');
      },
      { timeout: 3000 },
    );

    // 둘째 학생을 열면 첫 학생 생일이 남아 있지 않다.
    await user.click(screen.getByRole('button', { name: '이두리 정보 수정' }));
    expect(screen.getByLabelText('생일')).toHaveValue('');
  });

  it('이름만 고치는 호출은 생일을 건드리지 않고, 일부러 비운 저장만 지운다', () => {
    const renamed = updateStudent(seeded(), 'stu-1', { name: '김하나로' }, NOW);
    expect(renamed.students[0]?.birthday).toBe('2015-09-07');

    const cleared = updateStudent(seeded(), 'stu-1', { birthday: '' }, NOW);
    expect(cleared.students[0]).not.toHaveProperty('birthday');
  });

  it('명단이 이미 있는 반에 생년월일 열을 붙여 넣으면 기존 학생에게 들어간다', () => {
    const next = applyRosterImport(
      seeded(),
      'class-1',
      [
        { line: 1, number: 1, name: '김하나', birthday: '2015-09-07' },
        { line: 2, number: 2, name: '이두리', birthday: '2015-12-25' },
      ],
      'add',
      NOW,
    );

    expect(next.students.find((s) => s.id === 'stu-2')?.birthday).toBe('2015-12-25');
    expect(next.students).toHaveLength(2);
  });
});
