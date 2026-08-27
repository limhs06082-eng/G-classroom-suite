import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage from '../../src/features/home/HomePage';
import { ToolsProvider } from '../../src/features/tools/ToolsContext';
import {
  createClassRoom,
  createEmptySuiteData,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

/*
 * 배선을 시험한다.
 *
 * TimetableCard는 따로 잘 시험돼 있다. 그런데 **홈에 붙이는 것을 잊어도**
 * 그 시험은 전부 통과한다 — 선생님은 짜 둔 시간표가 어디에도 안 뜨는 앱을
 * 보게 되고, 그것이 이 판이 하려던 일의 전부다. tests/home/todayMealWiring과
 * 같은 취지다.
 *
 * 웹 대상으로 돈다(VITE_TARGET을 안 준 채로). 그래서 급식 자리는 안내 카드고,
 * 시간표 카드는 그 분기와 **무관하게** 있어야 한다.
 */

const T0 = '2026-03-02T09:00:00.000Z';

function seeded(): SuiteData {
  const data = createEmptySuiteData();
  return {
    ...data,
    terms: [
      createTerm(
        {
          id: 'term-1',
          schoolYear: '2026',
          semester: '1학기',
          startDate: '2026-03-02',
          endDate: '2026-07-20',
        },
        T0,
      ),
    ],
    classRooms: [createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, T0)],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
    timetableEntries: [
      { classId: 'class-1', weekday: 1, period: 2, subject: '수학' },
      { classId: 'class-1', weekday: 1, period: 1, subject: '국어' },
    ],
  };
}

function show(): void {
  render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({ load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }) })}
        >
          {/*
            '지금' 카드가 홈에 붙으면서 필요해졌다. 그 카드는 수업 중에
            useTools()로 타이머·화면 가리개를 여는데, 실제 앱에서는 AppShell이
            provider를 씌워 준다. 여기서 안 씌우면 이 시계(월요일 9시,
            1교시 수업 중)에서 홈이 통째로 죽는다.
          */}
          <ToolsProvider>
            <HomePage />
          </ToolsProvider>
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // 카드가 시계를 본다. 2026-08-24는 월요일이다.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 7, 24, 9, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('홈 시간표 배선', () => {
  it('홈에 오늘 시간표가 뜬다', async () => {
    show();

    expect(await screen.findByText('오늘 시간표')).toBeTruthy();
    expect(await screen.findByText('국어')).toBeTruthy();
    expect(screen.getByText('수학')).toBeTruthy();
  });

  it('웹에서도 뜬다 — 급식 카드와 달리 설치형 안내로 대신하지 않는다', async () => {
    show();

    await screen.findByText('국어');

    /*
     * 급식 자리는 웹에서 안내 카드다. 그 안내가 시간표까지 대신한다고 말하면
     * 거짓이 된다 — 바로 위에 진짜 시간표가 떠 있기 때문이다.
     */
    const notice = screen.getByText(/설치형 G-board에서 받아 옵니다/);
    expect(notice.textContent).toContain('급식은');
    expect(notice.textContent).not.toContain('시간표');
  });
});
