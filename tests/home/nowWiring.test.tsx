import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HomePage, { TodayNow } from '../../src/features/home/HomePage';
import { TimetableCard } from '../../src/features/home/TimetableCard';
import { ToolsProvider } from '../../src/features/tools/ToolsContext';
import {
  createClassRoom,
  createEmptySuiteData,
  createTerm,
} from '../../src/shared/domain/factories';
import type { PeriodTime, SuiteData, TimetableEntry } from '../../src/shared/domain/types';
import { SuiteDataProvider, useSuite } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

/*
 * 배선을 시험한다.
 *
 * 아래 층은 저마다 잘 시험되어 있다. `nowCore`는 갈래를 다 확인했고,
 * `useNow`는 1분마다 깨는 것을 확인했고, `NowCard`는 여섯 갈래를 다 그려
 * 봤다. 그런데 **그것들을 잇는 자리**는 아무도 안 봤다. 이 판에서만 세 번
 * 겪은 일이다 — provider를 툴바만 감싸도, 화면에 닿는 길이 없어도, 카드가
 * 제 provider를 만들어도 층별 시험은 전부 초록불이었다.
 *
 * 그래서 여기서는 아무것도 흉내 내지 않는다. 시스템 시계만 가짜로 두고
 * `TodayNow`를 진짜로 그린다 — `useToday`·`useNow`·`todayPeriods`·`nowState`·
 * `NowCard`가 전부 실제로 돈다. `nowState`를 직접 부르는 시험은 tests/now에
 * 이미 있다. 여기서 보는 것은 **시계와 자료가 카드까지 흘러가는가**다.
 */

const T0 = '2026-03-02T09:00:00.000Z';

/**
 * 월요일 다섯 줄 + 화요일 한 줄.
 *
 * 화요일 줄은 자정을 넘기는 시험이 본다. 과목 이름을 일부러 '화요일과목'으로
 * 두어, 요일이 안 바뀌었는데 우연히 같은 글자가 떠서 통과하는 일이 없게 한다.
 */
const ENTRIES: TimetableEntry[] = [
  { classId: 'class-1', weekday: 1, period: 1, subject: '국어' },
  { classId: 'class-1', weekday: 1, period: 2, subject: '수학' },
  { classId: 'class-1', weekday: 1, period: 3, subject: '사회' },
  { classId: 'class-1', weekday: 1, period: 4, subject: '체육' },
  { classId: 'class-1', weekday: 1, period: 5, subject: '음악' },
  { classId: 'class-1', weekday: 2, period: 1, subject: '화요일과목' },
];

/** 08:40에 시작하는 학교. 40분 수업·10분 쉬는 시간에 점심만 한 시간이다. */
const EARLY: PeriodTime[] = [
  { period: 1, start: '08:40', end: '09:20' },
  { period: 2, start: '09:30', end: '10:10' },
  { period: 3, start: '10:20', end: '11:00' },
  { period: 4, start: '11:10', end: '11:50' },
  { period: 5, start: '12:50', end: '13:30' },
  { period: 6, start: '13:40', end: '14:20' },
  { period: 7, start: '14:30', end: '15:10' },
];

/** 시간표와 교시 시각을 함께 채운다. 교시 시각은 기본값(09:00 시작) 일곱 줄이다. */
function seeded(overrides: Partial<SuiteData> = {}): SuiteData {
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
    timetableEntries: ENTRIES,
    ...overrides,
  };
}

/**
 * 자료가 다 들어온 때를 알려 준다.
 *
 * `SuiteDataProvider`는 읽기가 끝나기 **전에도** 아이들을 그리고, 그때 자료는
 * 빈 것이다. 빈 자료에는 학급이 없어 '지금' 카드가 아예 안 그려지는데, 그
 * 화면이 하필 주말 시험이 바라는 화면과 같다 — 기다리지 않으면 그 시험은
 * 카드를 어떻게 망가뜨려도 초록불이다. 시험마다 이 글자를 먼저 기다린다.
 */
function Loaded() {
  const { isLoading } = useSuite();
  return <span>{isLoading ? '읽는 중' : '다 읽음'}</span>;
}

/**
 * 실제 앱과 같은 껍데기로 감싼다.
 *
 * `ToolsProvider`가 필요한 까닭은 카드가 수업 중에 `useTools()`를 부르기
 * 때문이다. 실제 앱에서는 `AppShell`이 씌워 준다 — 카드도 홈도 제 것을
 * 만들지 않는다. 만들면 툴바와 다른 상태를 보게 되어 단추가 조용히 죽는다.
 */
function show(children: ReactNode, data: SuiteData = seeded()) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({ load: async () => ({ data, repairs: [], isFirstRun: false }) })}
        >
          <ToolsProvider>
            {children}
            <Loaded />
          </ToolsProvider>
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

function showNow(data: SuiteData = seeded()) {
  return show(<TodayNow />, data);
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
  vi.restoreAllMocks();
});

describe('지금 카드 배선', () => {
  it('시계가 가리키는 교시가 화면에 뜬다', async () => {
    // 2026-08-24는 월요일. 기본 교시 시각으로 3교시는 10:40~11:20이다.
    vi.setSystemTime(new Date(2026, 7, 24, 10, 58, 0));

    showNow();
    await screen.findByText('다 읽음');

    /*
     * 교시와 과목을 함께 본다. 과목만 보면 오늘 줄을 통째로 넘겨 놓고
     * 엉뚱한 교시를 짚어도 통과한다. 남은 시간도 함께 본다 —
     * `periodTimes`를 빈 배열로 넘기면 여기서 걸린다.
     */
    expect(screen.getByText('3교시 사회')).toBeInTheDocument();
    expect(screen.getByText('22분 남음')).toBeInTheDocument();
  });

  it('1분이 지나면 남은 시간이 준다', async () => {
    vi.setSystemTime(new Date(2026, 7, 24, 10, 58, 0));

    showNow();
    await screen.findByText('22분 남음');

    /*
     * 61초를 민다. `useNow`가 다음 분까지 재고 **1초를 더** 두기 때문이다
     * (경계에 아슬아슬하게 걸치면 깨어나서 시계를 봐도 아직 같은 분이다).
     * 60초만 밀면 타이머가 안 깨서, 카드가 멀쩡해도 이 시험이 붉어진다.
     */
    act(() => {
      vi.advanceTimersByTime(61 * 1000);
    });

    // useNow를 얼려 두어도 나머지 시험은 전부 통과한다. 여기서만 걸린다.
    expect(screen.getByText('21분 남음')).toBeInTheDocument();
  });

  it('교시 시각을 고치면 카드가 따라간다', async () => {
    /*
     * 08:40 시작으로 고친 학교다. 기본값(09:00 시작)이라면 09:00은 1교시가
     * 막 시작한 참(40분 남음)이지만, 이 학교에서는 이미 20분이 지났다.
     * 설정 화면을 아무리 잘 만들어도 카드가 저장된 값을 안 보면 헛일이다.
     */
    vi.setSystemTime(new Date(2026, 7, 24, 9, 0, 0));

    showNow(seeded({ periodTimes: EARLY }));
    await screen.findByText('다 읽음');

    expect(screen.getByText('1교시 국어')).toBeInTheDocument();
    expect(screen.getByText('20분 남음')).toBeInTheDocument();
    // 기본 교시 시각을 그대로 쓰면 이 값이 나온다.
    expect(screen.queryByText('40분 남음')).not.toBeInTheDocument();
  });

  it('평일에 한 칸도 없으면 시간표를 짜라고 한다', async () => {
    vi.setSystemTime(new Date(2026, 7, 24, 10, 58, 0));

    showNow(seeded({ timetableEntries: [] }));
    await screen.findByText('다 읽음');

    // 주말에 카드를 비켜 주게 만들면서 이 갈래까지 함께 죽이기 쉽다.
    expect(screen.getByText(/시간표를 짜면/)).toBeInTheDocument();
  });

  it('옆 반 시간표를 우리 반 것으로 쓰지 않는다', async () => {
    vi.setSystemTime(new Date(2026, 7, 24, 10, 58, 0));

    showNow(seeded({ timetableEntries: [{ classId: 'class-2', weekday: 1, period: 3, subject: '중국어' }] }));
    await screen.findByText('다 읽음');

    // 학급을 안 걸러도 화면은 그럴듯하다. 그럴듯한 것이 남의 반 시간표다.
    expect(screen.queryByText(/중국어/)).not.toBeInTheDocument();
    expect(screen.getByText(/시간표를 짜면/)).toBeInTheDocument();
  });

  it('전자칠판 단추가 진짜로 칠판을 연다', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    /*
     * 웹에서 `openBoard`는 새 탭을 연다. 여는 법을 안 넘기고 빈 함수를
     * 넘겨도 위의 시험은 **전부** 통과한다 — 카드가 그려지고 단추도 있고
     * 눌리기까지 하는데 아무 일도 안 일어난다. 이 판에서 세 번 겪은
     * 그 사고와 같은 모양이라 여기서 못 박는다.
     */
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    vi.setSystemTime(new Date(2026, 7, 24, 10, 58, 0));

    showNow();
    await screen.findByText('다 읽음');

    await user.click(screen.getByRole('button', { name: '전자칠판' }));

    expect(opened).toHaveBeenCalledWith('/board/lesson', '_blank', 'noopener');
  });
});

describe('주말', () => {
  /*
   * `nowState`는 요일을 모른다. 주말에 오늘 줄을 그대로 넘기면 빈 목록이라
   * '시간표를 짜면 알려 드립니다'가 뜨는데, 그건 이미 짜 둔 선생님에게
   * 거짓말이다. 그래서 주말에는 이 카드가 아예 비켜 주기로 했다 — 오늘 할
   * 말('오늘은 수업이 없습니다')은 시간표 카드가 이미 하고 있고, 같은 화면에서
   * 같은 말을 두 번 하면 도움이 아니라 잡음이기 때문이다.
   *
   * 그래서 두 카드를 **함께** 그려서 본다. 따로 그리면 두 카드가 같은 날
   * 다른 말을 하고 있어도 아무도 모른다.
   */
  function showBoth(data: SuiteData = seeded()) {
    return show(
      <>
        <TodayNow />
        <TimetableCard />
      </>,
      data,
    );
  }

  it('짜 둔 시간표가 있으면 시간표 카드만 말한다', async () => {
    // 2026-08-29는 토요일이다.
    vi.setSystemTime(new Date(2026, 7, 29, 10, 58, 0));

    showBoth();
    await screen.findByText('다 읽음');

    expect(screen.queryByRole('heading', { name: '지금' })).not.toBeInTheDocument();
    expect(screen.getByText(/오늘은 수업이 없습니다/)).toBeInTheDocument();
    // 토요일에 '시간표를 짜라'고 하면 이미 짜 둔 선생님이 헷갈린다.
    expect(screen.queryByText(/시간표를 짜면/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '시간표 짜기' })).not.toBeInTheDocument();
  });

  it('일요일도 주말이다', async () => {
    // 2026-08-30은 일요일. getDay()가 0이라 '요일 없음'과 헷갈리기 쉬운 자리다.
    vi.setSystemTime(new Date(2026, 7, 30, 10, 58, 0));

    showBoth();
    await screen.findByText('다 읽음');

    expect(screen.queryByRole('heading', { name: '지금' })).not.toBeInTheDocument();
    expect(screen.getByText(/오늘은 수업이 없습니다/)).toBeInTheDocument();
  });

  it('한 칸도 없는 주말에는 짜러 가는 길을 시간표 카드가 준다', async () => {
    vi.setSystemTime(new Date(2026, 7, 29, 10, 58, 0));

    showBoth(seeded({ timetableEntries: [] }));
    await screen.findByText('다 읽음');

    expect(screen.queryByRole('heading', { name: '지금' })).not.toBeInTheDocument();
    /*
     * 길이 아예 사라지면 안 된다. 주말에 앱을 처음 연 선생님은 이 기능이
     * 있다는 것조차 모른 채 지나간다. 그 길은 시간표 카드가 주말에도 먼저
     * 내주므로 여기서 한 번 더 내밀 필요가 없다 — 딱 하나여야 한다.
     */
    expect(screen.getAllByRole('link', { name: '시간표 짜기' })).toHaveLength(1);
  });
});

describe('하루 종일 켜 둔 채로 자정을 넘길 때', () => {
  it('자정을 넘기면 오늘 줄이 바뀐다', async () => {
    /*
     * G-board는 교실 컴퓨터에서 며칠씩 켜져 있다. 그것이 이 앱의 전제다.
     * 날짜를 그릴 때 한 번만 재면 화요일 아침에 선생님이 보는 '지금'은
     * 월요일 시간표로 고른 교시다 — 그날 하루를 그 화면으로 시작한다.
     *
     * `useNow`만 있고 `useToday`가 없어도 1분마다 다시 그려지므로 나머지
     * 시험은 전부 통과한다. 날짜를 얼리면 여기서만 걸린다.
     */
    // 2026-08-24 월요일 23시 50분. 월요일 수업은 다 끝난 시각이다.
    vi.setSystemTime(new Date(2026, 7, 24, 23, 50, 0));

    showNow();
    await screen.findByText('다 읽음');
    expect(screen.getByText(/오늘 수업이 끝났습니다/)).toBeInTheDocument();

    // 자정까지 10분 + 두 갈고리가 경계를 확실히 넘으려고 두는 1초 여유.
    act(() => {
      vi.advanceTimersByTime(11 * 60 * 1000);
    });

    expect(screen.getByText(/1교시 화요일과목/)).toBeInTheDocument();
    expect(screen.queryByText(/오늘 수업이 끝났습니다/)).not.toBeInTheDocument();
  });
});

describe('홈에 붙였는가', () => {
  it('홈에 지금 카드가 있고, 당번 카드보다 앞이다', async () => {
    /*
     * 위 시험은 전부 `TodayNow`를 직접 그린다. 그러면 **홈에 붙이는 것을
     * 잊어도** 전부 통과한다 — 선생님은 이 판이 만든 것이 어디에도 없는 앱을
     * 보게 되고, 그것이 이 판이 하려던 일의 전부다. tests/home의 급식·시간표
     * 배선 시험과 같은 취지다.
     */
    vi.setSystemTime(new Date(2026, 7, 24, 10, 58, 0));

    show(<HomePage />);

    const now = await screen.findByRole('heading', { name: '지금' });
    expect(screen.getByText('3교시 사회')).toBeInTheDocument();

    /*
     * 자리도 함께 본다. 설계에서 '지금'은 첫눈에 닿는 자리고, 그것이 카드
     * 순서를 정한 유일한 이유다. 아무 데나 끼워 넣어도 '있다'만 보는 시험은
     * 통과한다.
     */
    const duty = screen.getByRole('heading', { name: '오늘의 당번' });
    expect(now.compareDocumentPosition(duty) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('점심때 없는 카드를 가리키지 않는다', () => {
  it('웹에서는 급식 카드를 가리키지 않는다', async () => {
    /*
     * 이 시험이 도는 환경은 늘 웹이다(VITE_TARGET이 안 켜져 있다). 그래서
     * HomePage가 넘기는 hasMealCard는 여기서 늘 거짓이고, 이 시험은 바로
     * 그 갈래를 잰다.
     *
     * NowCard 층의 시험은 hasMealCard를 손으로 넘기므로 배선이 끊겨도
     * 초록불이다. 실제로 HomePage에서 hasMealCard={true}로 바꿔도 1030개가
     * 전부 통과한다 — 그러면 웹 선생님이 점심때 제목이 '급식'이고 내용이
     * "설치형에서만 받아 옵니다"인 카드를 '오늘 급식'이라 여기고 찾아 헤맨다.
     */
    vi.setSystemTime(new Date(2026, 7, 24, 12, 30, 0));

    showNow();
    await screen.findByText('다 읽음');

    expect(screen.getByText('점심시간입니다')).toBeInTheDocument();
    expect(screen.queryByText(/오늘 급식/)).not.toBeInTheDocument();
  });
});
