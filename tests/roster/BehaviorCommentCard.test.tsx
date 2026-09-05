import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createClassRoom,
  createEmptySuiteData,
  createObservation,
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
    { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    NOW,
  );
  const room = createClassRoom({ id: 'class-1', termId: 'term-1', name: '우리 반' }, NOW);
  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room],
    students: [createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' }, NOW)],
    observations: [
      createObservation(
        { classId: 'class-1', studentId: 'stu-1', text: '발표를 잘했다', date: '2026-04-01' },
        NOW,
      ),
    ],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

const save = vi.fn(async (_data: SuiteData) => {});

function show(data: SuiteData = seeded()): void {
  render(
    <MemoryRouter initialEntries={['/roster/stu-1']}>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({ load: async () => ({ data, repairs: [], isFirstRun: false }), save })}
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
  save.mockClear();
  document.getElementById('print-root')?.remove();
});

afterEach(() => {
  vi.useRealTimers();
});

/*
 * 학기말에 관찰 기록을 다시 읽으며 처음부터 쓰던 글이다. 초안이 나오고,
 * 고친 글이 남고, 나이스에 붙일 수 있게 복사되면 이 기능은 제 몫을 한다.
 */
describe('행동특성 및 종합의견 카드', () => {
  it('초안을 넣고, 고친 글이 자료에 남고, 복사된다', async () => {
    const user = userEvent.setup();
    show();
    const box = await screen.findByRole('textbox', { name: '김하나 행동특성 및 종합의견' });
    expect(box).toHaveValue('');

    await user.click(screen.getByRole('button', { name: '초안 넣기' }));
    expect(box).toHaveValue('발표를 잘했다.');
    expect(screen.getByText(/\/ 500자/)).toBeInTheDocument();

    await user.click(box);
    await user.keyboard(' 밝고 성실함.');
    await user.tab(); // blur → 저장

    await waitFor(
      () => {
        const last = save.mock.calls.at(-1)?.[0] as SuiteData | undefined;
        expect(last?.behaviorComments[0]?.text).toBe('발표를 잘했다. 밝고 성실함.');
      },
      { timeout: 3000 },
    );

    // user-event가 navigator.clipboard를 자체 스텁으로 바꾼다. 거기서 다시 읽어 확인한다.
    await user.click(screen.getByRole('button', { name: '복사하기' }));
    expect(await navigator.clipboard.readText()).toBe('발표를 잘했다. 밝고 성실함.');
  });

  it('글이 있으면 초안이 묻고 나서 바꾼다', async () => {
    const user = userEvent.setup();
    show({
      ...seeded(),
      behaviorComments: [
        { id: 'bc-1', classId: 'class-1', studentId: 'stu-1', text: '내가 쓴 글.', updatedAt: NOW },
      ],
    });
    const box = await screen.findByRole('textbox', { name: '김하나 행동특성 및 종합의견' });
    expect(box).toHaveValue('내가 쓴 글.');

    await user.click(screen.getByRole('button', { name: '초안 넣기' }));
    // 묻는 창이 뜬다. 확인해야 바뀐다.
    expect(box).toHaveValue('내가 쓴 글.');
    await user.click(screen.getByRole('button', { name: '초안으로 바꾸기' }));
    expect(box).toHaveValue('발표를 잘했다.');
  });
});
