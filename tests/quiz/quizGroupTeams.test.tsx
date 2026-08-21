import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import QuizPage from '../../src/features/quiz/QuizPage';
import {
  createClassRoom,
  createEmptySuiteData,
  createGroup,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

const NOW = '2026-08-21T09:00:00.000Z';

/** 모둠 여섯. 두 앱으로 나뉘어 있을 때는 네 팀 고정이라 둘이 참여할 수 없었다. */
function seeded(groupNames: readonly string[] = []): SuiteData {
  const term = createTerm(
    { id: 'term-1', schoolYear: '2026', semester: '2학기', startDate: '2026-08-01', endDate: '2027-01-31' },
    NOW,
  );
  const room = createClassRoom({ id: 'c-1', termId: term.id, name: '3학년 3반' }, NOW);

  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room],
    students: [createStudent({ id: 's-1', classId: 'c-1', number: 1, name: '김하나' }, NOW)],
    groups: groupNames.map((name, i) =>
      createGroup({ id: `g-${i + 1}`, classId: 'c-1', name, color: 'sky' }, NOW),
    ),
    activeTermId: term.id,
    activeClassId: room.id,
  };
}

async function renderQuiz(data: SuiteData): Promise<void> {
  render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({ load: async () => ({ data, repairs: [], isFirstRun: false }) })}
        >
          <QuizPage />
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );

  await screen.findByLabelText('1번째 모둠 이름');
}

const teamInputs = (): string[] =>
  screen.getAllByLabelText(/번째 모둠 이름/).map((el) => (el as HTMLInputElement).value);

describe('퀴즈가 진짜 모둠을 쓴다', () => {
  it('편성한 모둠이 있으면 그 이름을 그대로 쓴다', async () => {
    await renderQuiz(seeded(['독수리', '호랑이', '거북이', '토끼', '여우', '사슴']));

    expect(teamInputs()).toEqual(['독수리', '호랑이', '거북이', '토끼', '여우', '사슴']);
    expect(screen.getByText(/자리·모둠에서 편성한 6모둠/)).toBeTruthy();
  });

  it('모둠이 없으면 기본 팀을 쓰고 그렇게 알린다', async () => {
    await renderQuiz(seeded([]));

    expect(teamInputs()).toHaveLength(4);
    expect(screen.getByText(/아직 편성한 모둠이 없어 기본 팀/)).toBeTruthy();
  });

  it('직접 정하면 모둠보다 우선한다', async () => {
    await renderQuiz(seeded(['독수리', '호랑이']));

    fireEvent.blur(screen.getByLabelText('1번째 모둠 이름'), {
      target: { value: '남학생' },
    });

    await waitFor(() => {
      expect(screen.getByText('직접 정한 팀을 씁니다.')).toBeTruthy();
    });
  });

  it('자리·모둠 따라가기를 누르면 입력칸이 모둠 이름으로 되돌아온다', async () => {
    /*
     * 회귀 방지. defaultValue는 처음 그릴 때만 읽히므로 key에 값을 넣지 않으면
     * 바탕 값이 바뀌어도 칸이 옛 글자를 붙들고 있다.
     */
    await renderQuiz(seeded(['독수리', '호랑이']));

    fireEvent.blur(screen.getByLabelText('1번째 모둠 이름'), { target: { value: '남학생' } });
    await waitFor(() => {
      expect(screen.getByText('직접 정한 팀을 씁니다.')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '자리·모둠 따라가기' }));

    await waitFor(() => {
      expect(teamInputs()[0]).toBe('독수리');
    });
  });
});
