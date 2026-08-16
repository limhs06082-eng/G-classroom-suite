import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import RewardPage from '../../src/features/reward/RewardPage';
import {
  createBehaviorPreset,
  createClassRoom,
  createEmptySuiteData,
  createScoreEntry,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

const EARLIER = '2026-03-01T09:00:00.000Z';

function seeded(): SuiteData {
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
    students: [createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' }, EARLIER)],
    behaviorPresets: [
      createBehaviorPreset(
        {
          id: 'bp-1',
          classId: 'class-1',
          name: '도움 주기',
          defaultPoints: 1,
          targetUnit: 'student',
          color: 'sky',
          order: 0,
        },
        EARLIER,
      ),
      createBehaviorPreset(
        {
          id: 'bp-2',
          classId: 'class-1',
          name: '정리 정돈',
          defaultPoints: 1,
          targetUnit: 'student',
          color: 'teal',
          order: 1,
        },
        EARLIER,
      ),
    ],
    // 이미 준 점수. 항목을 지워도 남아야 한다.
    scoreEntries: [
      createScoreEntry(
        {
          id: 'se-1',
          classId: 'class-1',
          targetUnit: 'student',
          targetId: 'stu-1',
          points: 1,
          reason: '도움 주기',
          presetId: 'bp-1',
        },
        EARLIER,
      ),
    ],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
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
          <RewardPage />
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );

  await screen.findByRole('button', { name: '항목 정리' });
}

const chip = (name: string): HTMLElement => screen.getByRole('button', { name: new RegExp(name) });

describe('행동 항목 정리', () => {
  it('항목 칩 안에 버튼이 없다', async () => {
    // 칩 자체가 버튼이다. 안에 삭제 버튼을 넣으면 버튼 안의 버튼이 된다.
    await renderPage();

    expect(chip('도움 주기').querySelector('button')).toBeNull();
  });

  it('평소에는 칩을 누르면 항목이 골라진다', async () => {
    await renderPage();

    fireEvent.click(chip('도움 주기'));

    await waitFor(() => {
      expect(chip('도움 주기').getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('정리 모드에 들어가면 골라 둔 항목이 풀린다', async () => {
    // 점수를 주려다 지우는 일이 없어야 한다.
    await renderPage();

    fireEvent.click(chip('도움 주기'));
    await waitFor(() => {
      expect(chip('도움 주기').getAttribute('aria-pressed')).toBe('true');
    });

    fireEvent.click(screen.getByRole('button', { name: '항목 정리' }));

    await waitFor(() => {
      expect(screen.getByLabelText('도움 주기 삭제')).toBeTruthy();
    });
    expect(screen.getByLabelText('도움 주기 삭제').getAttribute('aria-pressed')).toBeNull();
  });

  it('정리 모드에서 칩을 누르면 확인창이 뜬다', async () => {
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: '항목 정리' }));
    fireEvent.click(await screen.findByLabelText('도움 주기 삭제'));

    expect(await screen.findByText('도움 주기 항목을 지울까요?')).toBeTruthy();
  });

  it('지우면 목록에서 사라지고 준 점수는 남는다', async () => {
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: '항목 정리' }));
    fireEvent.click(await screen.findByLabelText('도움 주기 삭제'));
    fireEvent.click(await screen.findByRole('button', { name: '항목 삭제' }));

    await waitFor(() => {
      expect(screen.queryByLabelText('도움 주기 삭제')).toBeNull();
    });
    // 다른 항목은 그대로다.
    expect(screen.getByLabelText('정리 정돈 삭제')).toBeTruthy();

    // 기록에 사유가 글자로 저장돼 있어 항목을 지워도 점수는 온전하다.
    fireEvent.click(screen.getByRole('button', { name: '정리 끝내기' }));
    fireEvent.click(await screen.findByRole('tab', { name: /기록/ }));
    // 사유가 여러 곳에 나올 수 있다. 남아 있다는 것만 본다.
    expect((await screen.findAllByText(/도움 주기/)).length).toBeGreaterThan(0);
  });

  it('정리를 끝내면 다시 고를 수 있다', async () => {
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: '항목 정리' }));
    await screen.findByLabelText('도움 주기 삭제');

    fireEvent.click(screen.getByRole('button', { name: '정리 끝내기' }));

    await waitFor(() => {
      expect(screen.queryByLabelText('도움 주기 삭제')).toBeNull();
    });
    fireEvent.click(chip('도움 주기'));
    await waitFor(() => {
      expect(chip('도움 주기').getAttribute('aria-pressed')).toBe('true');
    });
  });
});
