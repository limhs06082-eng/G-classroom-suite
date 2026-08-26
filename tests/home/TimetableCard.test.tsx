import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TimetableCard } from '../../src/features/home/TimetableCard';
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

/**
 * 자료가 다 들어온 때를 알려 준다.
 *
 * SuiteDataProvider는 읽기가 끝나기 **전에도** 아이들을 그리고, 그때 자료는
 * 빈 것이다. 빈 자료로 그린 화면이 시험이 바라는 화면과 우연히 같으면 단언이
 * 로딩 전 화면을 보고 통과해 버린다 — 카드를 어떻게 망가뜨려도 초록불이 켜진다.
 * 그래서 시험마다 이 글자를 먼저 기다린다.
 */
function Loaded() {
  const { isLoading } = useSuite();
  return <span>{isLoading ? '읽는 중' : '다 읽음'}</span>;
}

function seeded(entries: TimetableEntry[]): SuiteData {
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
    timetableEntries: entries,
  };
}

function show(data: SuiteData) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({ load: async () => ({ data, repairs: [], isFirstRun: false }) })}
        >
          <TimetableCard />
          <Loaded />
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  /*
   * shouldAdvanceTime이 없으면 findBy*가 멈춘다. 그 기다림은 setInterval로
   * 도는데 가짜 시계가 그 타이머를 붙잡고 아무도 안 감아 주기 때문이다.
   * SuiteDataProvider가 자료를 비동기로 읽으므로 그 기다림이 반드시 필요하다.
   */
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

/** 월요일 것만 채운다. 교시를 흩어 담는다 — 줄 세우는 것은 카드가 할 일이다. */
const MONDAY: TimetableEntry[] = [
  { classId: 'class-1', weekday: 1, period: 2, subject: '수학' },
  { classId: 'class-1', weekday: 1, period: 4, subject: '체육' },
  { classId: 'class-1', weekday: 1, period: 1, subject: '국어' },
];

describe('오늘 시간표 카드', () => {
  it('오늘 교시를 순서대로 보여 준다', async () => {
    // 2026-08-24는 월요일이다.
    vi.setSystemTime(new Date(2026, 7, 24, 9, 0, 0));

    show(seeded(MONDAY));
    await screen.findByText('다 읽음');

    /*
     * 과목 이름만 보면 3교시 것이 1교시 자리에 그려져도 통과한다. 아침에
     * 훑어보는 카드에서 순서가 틀리면 그 자체로 못 쓴다. 줄과 번호를 함께 본다.
     */
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '1국어',
      '2수학',
      '4체육',
    ]);
  });

  it('다른 요일 것을 안 보여 준다', async () => {
    // 화요일. 월요일만 채워져 있으니 오늘은 비었다.
    vi.setSystemTime(new Date(2026, 7, 25, 9, 0, 0));

    show(seeded(MONDAY));
    await screen.findByText('다 읽음');

    expect(screen.getByText(/오늘은 시간표가 비어/)).toBeInTheDocument();
    expect(screen.queryByText('국어')).not.toBeInTheDocument();
  });

  it('주말에는 수업이 없다고 한다', async () => {
    // 2026-08-29는 토요일이다.
    vi.setSystemTime(new Date(2026, 7, 29, 9, 0, 0));

    show(seeded(MONDAY));
    await screen.findByText('다 읽음');

    // '시간표가 비었다'와 '오늘은 학교에 안 간다'는 할 일이 다르다.
    expect(screen.getByText(/오늘은 수업이 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/시간표가 비어/)).not.toBeInTheDocument();
  });

  it('일요일도 주말이다', async () => {
    // 2026-08-30은 일요일. getDay()가 0이라 '요일 없음'과 헷갈리기 쉬운 자리다.
    vi.setSystemTime(new Date(2026, 7, 30, 9, 0, 0));

    show(seeded(MONDAY));
    await screen.findByText('다 읽음');

    expect(screen.getByText(/오늘은 수업이 없습니다/)).toBeInTheDocument();
  });

  it('한 칸도 없으면 짜러 가는 길을 준다', async () => {
    vi.setSystemTime(new Date(2026, 7, 24, 9, 0, 0));

    show(seeded([]));
    await screen.findByText('다 읽음');

    expect(screen.getByText(/한 번 짜 두면/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '시간표 짜기' })).toBeInTheDocument();
  });

  it('한 칸도 없으면 주말에도 짜러 가는 길을 준다', async () => {
    // 토요일.
    vi.setSystemTime(new Date(2026, 7, 29, 9, 0, 0));

    show(seeded([]));
    await screen.findByText('다 읽음');

    /*
     * '오늘은 수업이 없습니다'로 덮으면 주말에 앱을 연 선생님은 이 기능이
     * 있다는 것조차 모른다. 아직 아무것도 안 짠 사람에게는 짜러 가는 길이
     * 늘 먼저다 — 주말인 것은 내일이면 지나가지만 빈 시간표는 안 지나간다.
     */
    expect(screen.getByRole('link', { name: '시간표 짜기' })).toBeInTheDocument();
  });

  it('옆 반 시간표를 우리 반 것으로 보여 주지 않는다', async () => {
    vi.setSystemTime(new Date(2026, 7, 24, 9, 0, 0));

    show(seeded([{ classId: 'class-2', weekday: 1, period: 1, subject: '중국어' }]));
    await screen.findByText('다 읽음');

    expect(screen.queryByText('중국어')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '시간표 짜기' })).toBeInTheDocument();
  });

  it('학급이 없으면 학급부터 만들라고 한다', async () => {
    vi.setSystemTime(new Date(2026, 7, 24, 9, 0, 0));

    /*
     * 학급 없이 시간표 칸만 있는 자료다. '우리 반'이 없으면 우리 반 시간표를
     * 셀 수 없다 — 그것을 '아직 안 짰다'로 뭉개면 시간표 탭으로 보내 놓고
     * 거기서 다시 학급부터 만들라는 말을 듣게 한다. 할 일이 다르다.
     */
    const orphan = createEmptySuiteData();
    show({
      ...orphan,
      timetableEntries: [{ classId: 'class-1', weekday: 1, period: 1, subject: '국어' }],
    });
    await screen.findByText('다 읽음');

    expect(screen.getByText(/학급을 먼저/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '시간표 짜기' })).not.toBeInTheDocument();
  });
});
