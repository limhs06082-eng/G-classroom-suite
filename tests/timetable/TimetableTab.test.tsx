import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import SettingsPage from '../../src/features/settings/SettingsPage';
import { TimetableTab } from '../../src/features/timetable/TimetableTab';
import {
  createClassRoom,
  createEmptySuiteData,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData, TimetableEntry } from '../../src/shared/domain/types';
import { SuiteDataProvider, useSuite } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

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
    // 두 반을 둔다. 머리띠의 ClassSwitcher가 설정 화면을 열어 둔 채로도
    // 학급을 바꾸므로, 바뀌었을 때 화면이 어떻게 되는지가 시험 대상이다.
    classRooms: [
      createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, T0),
      createClassRoom({ id: 'class-2', termId: 'term-1', name: '3학년 5반' }, T0),
    ],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

/**
 * 화면 밖에서 학급 자료를 들여다보고 흔든다.
 *
 * 칸을 찍은 결과가 화면에만 있고 학급 자료에 없으면 탭을 떠나는 순간 사라진다.
 * 화면을 다시 읽는 것으로는 그 차이를 볼 수 없어서 자료를 직접 내건다.
 */
function Probe() {
  const { data, update } = useSuite();

  return (
    <>
      <button
        type="button"
        onClick={() => update((current) => ({ ...current, activeClassId: 'class-2' }))}
      >
        옆 반으로
      </button>
      <span data-testid="saved">{JSON.stringify(data.timetableEntries)}</span>
    </>
  );
}

function show(data: SuiteData = seeded()) {
  return render(
    <ToastProvider>
      <SuiteDataProvider
        adapter={stubAdapter({ load: async () => ({ data, repairs: [], isFirstRun: false }) })}
      >
        <TimetableTab />
        <Probe />
      </SuiteDataProvider>
    </ToastProvider>,
  );
}

/** 월요일 3교시 칸. 표의 칸에는 `월요일 3교시` 라벨을 단다. */
function cell(weekdayName: string, period: number): HTMLElement {
  return screen.getByRole('button', { name: `${weekdayName}요일 ${period}교시` });
}

/** 학급 자료에 실제로 담긴 칸. */
function saved(): TimetableEntry[] {
  return JSON.parse(screen.getByTestId('saved').textContent ?? '[]') as TimetableEntry[];
}

describe('시간표 짜기', () => {
  it('과목을 고르고 칸을 찍으면 들어간다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole('button', { name: '수학' }));
    await user.click(cell('월', 3));

    expect(within(cell('월', 3)).getByText('수학')).toBeInTheDocument();
  });

  it('찍은 칸이 학급 자료에 담긴다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole('button', { name: '수학' }));
    await user.click(cell('월', 3));

    /*
     * 화면 안의 state로만 그리면 위 시험은 통과하면서 탭을 떠나는 순간
     * 서른다섯 칸이 통째로 사라진다. update()를 거쳤는지를 못 박는다.
     */
    expect(saved()).toEqual([{ classId: 'class-1', weekday: 1, period: 3, subject: '수학' }]);
  });

  it('과목을 안 고르고 칸을 찍으면 알려 준다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole('button', { name: '월요일 3교시' }));

    // 아무 일도 안 일어나면 선생님은 앱이 고장 났다고 여긴다.
    expect(screen.getByRole('status')).toHaveTextContent('과목을 먼저 고르세요');
    expect(saved()).toEqual([]);
  });

  it('과목을 고르면 안내가 사라진다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole('button', { name: '월요일 3교시' }));
    await user.click(screen.getByRole('button', { name: '수학' }));

    // 할 일을 마쳤는데 빨간 글씨가 남아 있으면 아직 뭔가 잘못된 줄 안다.
    expect(screen.getByRole('status')).not.toHaveTextContent('과목을 먼저 고르세요');
  });

  it('같은 과목을 다시 찍으면 지워진다', async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole('button', { name: '수학' }));
    await user.click(cell('월', 3));
    await user.click(cell('월', 3));

    expect(within(cell('월', 3)).queryByText('수학')).not.toBeInTheDocument();
    expect(saved()).toEqual([]);
  });

  it('직접 입력한 과목이 단추가 된다', async () => {
    const user = userEvent.setup();
    show();

    await user.type(await screen.findByLabelText('직접 입력'), '즐거운생활');
    await user.click(screen.getByRole('button', { name: '더하기' }));

    expect(screen.getByRole('button', { name: '즐거운생활' })).toBeInTheDocument();
  });

  it('직접 입력한 과목은 곧바로 골라진다', async () => {
    const user = userEvent.setup();
    show();

    await user.type(await screen.findByLabelText('직접 입력'), '즐거운생활');
    await user.click(screen.getByRole('button', { name: '더하기' }));
    await user.click(cell('월', 3));

    // 더하기 다음에 할 일은 늘 찍기다. 여기서 한 번 더 고르게 하면 손이 는다.
    expect(saved()).toEqual([
      { classId: 'class-1', weekday: 1, period: 3, subject: '즐거운생활' },
    ]);
  });

  it('직접 입력한 과목이 너무 길면 자른다', async () => {
    const user = userEvent.setup();
    show();

    await user.type(await screen.findByLabelText('직접 입력'), '아주아주긴과목이름을붙여넣었다');
    await user.click(screen.getByRole('button', { name: '더하기' }));

    // 길이를 안 자르면 단추 하나가 표를 통째로 찌그러뜨린다. 12자는
    // 수업 흐름·문제 세트가 이미 쓰는 규칙(shared/subjects.ts)이다.
    expect(screen.getByRole('button', { name: '아주아주긴과목이름을붙여' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '아주아주긴과목이름을붙여넣었다' }),
    ).not.toBeInTheDocument();
  });

  it('일곱 교시까지 다섯 요일을 그린다', async () => {
    show();

    await screen.findByRole('button', { name: '월요일 1교시' });
    expect(screen.getByRole('button', { name: '금요일 7교시' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '토요일 1교시' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '월요일 8교시' })).not.toBeInTheDocument();
  });

  it('학급을 바꾸면 직접 입력한 과목이 따라오지 않는다', async () => {
    const user = userEvent.setup();
    show();

    await user.type(await screen.findByLabelText('직접 입력'), '즐거운생활');
    await user.click(screen.getByRole('button', { name: '더하기' }));
    await user.click(screen.getByRole('button', { name: '옆 반으로' }));

    /*
     * 시간표는 학급마다 한 벌이다. 3학년 2반에서 친 과목이 5반 단추 줄에
     * 남아 있으면, 저학년 반과 고학년 반을 오가는 교사가 남의 과목을 찍는다.
     */
    expect(screen.queryByRole('button', { name: '즐거운생활' })).not.toBeInTheDocument();
    // 표 자체는 그대로 있어야 한다 — 학급을 바꿨다고 화면이 죽으면 안 된다.
    expect(screen.getByRole('button', { name: '월요일 1교시' })).toBeInTheDocument();
  });

  it('학급이 없으면 학급부터 만들라고 한다', async () => {
    show(createEmptySuiteData());

    // 시간표는 학급에 매인다. 학급 없이 칸을 찍게 두면 갈 곳 없는 자료가 쌓인다.
    expect(await screen.findByText(/학급을 먼저/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '월요일 1교시' })).not.toBeInTheDocument();
  });
});

/*
 * 탭 목록과 그리는 곳은 SettingsPage 안에서 따로 논다. 목록에만 더하면
 * 눌러도 빈 화면이 나오고, 그리는 줄만 더하면 누를 데가 없다. 둘 다
 * 이어졌는지는 실제로 눌러 봐야 안다 — desktopSettings.test.ts가 상수
 * 배열 대신 진짜 DOM을 보는 것과 같은 뜻이다.
 */
describe('설정 화면에 붙어 있다', () => {
  it('시간표 탭을 누르면 표가 나온다', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({
            load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }),
          })}
        >
          <SettingsPage />
        </SuiteDataProvider>
      </ToastProvider>,
    );

    await user.click(await screen.findByRole('tab', { name: '시간표' }));

    expect(await screen.findByRole('button', { name: '월요일 1교시' })).toBeInTheDocument();
  });
});
