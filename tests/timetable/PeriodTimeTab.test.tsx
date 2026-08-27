import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { PeriodTimeTab } from '../../src/features/timetable/PeriodTimeTab';
import SettingsPage from '../../src/features/settings/SettingsPage';
import { createEmptySuiteData } from '../../src/shared/domain/factories';
import type { PeriodTime, SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider, useSuite } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

/**
 * 저장된 일과를 화면 밖에 내건다.
 *
 * 입력칸이 08:00을 보여 주는 것과 08:00이 저장된 것은 다른 일이다. 이
 * 화면의 핵심이 바로 그 차이 — 못 읽는 값은 칸에만 남고 자료에는 안
 * 들어간다 — 이라서 자료를 직접 내걸어야 확인할 수 있다.
 */
function Probe() {
  const { data } = useSuite();
  return <span data-testid="saved">{JSON.stringify(data.periodTimes)}</span>;
}

function show(data: SuiteData = createEmptySuiteData()) {
  return render(
    <ToastProvider>
      <SuiteDataProvider
        adapter={stubAdapter({ load: async () => ({ data, repairs: [], isFirstRun: false }) })}
      >
        <PeriodTimeTab />
        <Probe />
      </SuiteDataProvider>
    </ToastProvider>,
  );
}

function saved(): PeriodTime[] {
  return JSON.parse(screen.getByTestId('saved').textContent ?? '[]') as PeriodTime[];
}

describe('교시 시각', () => {
  it('일곱 줄이 채워진 채로 열린다', async () => {
    show();

    // 빈 채로 두면 '지금' 카드가 처음부터 안 뜬다.
    expect(await screen.findByLabelText('1교시 시작')).toHaveValue('09:00');
    expect(screen.getByLabelText('7교시 끝')).toHaveValue('15:30');
  });

  it('고치면 저장된다', async () => {
    const user = userEvent.setup();
    show();

    const input = await screen.findByLabelText('1교시 시작');
    await user.clear(input);
    await user.type(input, '08:40');

    expect(saved()[0]?.start).toBe('08:40');
  });

  it('끝이 시작보다 이르면 알려 주고 저장하지 않는다', async () => {
    const user = userEvent.setup();
    show();

    const input = await screen.findByLabelText('1교시 끝');
    await user.clear(input);
    await user.type(input, '08:00');

    /*
     * 거꾸로 된 줄이 들어가면 '지금' 카드가 그 교시를 통째로 건너뛴다.
     * 조용히 사라지는 쪽이라 그 자리에서 막는다.
     */
    expect(await screen.findByRole('status')).toHaveTextContent('끝이 시작보다');
    expect(saved()[0]?.end).toBe('09:40');
  });

  it('끝이 시작과 같아도 막는다', async () => {
    const user = userEvent.setup();
    show();

    const input = await screen.findByLabelText('1교시 끝');
    await user.clear(input);
    await user.type(input, '09:00');

    /*
     * 길이가 0인 교시도 '지금' 카드는 못 읽는 줄로 보고 버린다(nowCore의
     * `endMin <= startMin`). 부등호를 하나 늦추면 여기만 조용히 새는데,
     * 그때는 invariants가 일곱 줄을 통째로 기본값으로 되돌려 버려서
     * 선생님이 고쳐 둔 나머지 여섯 줄까지 같이 날아간다.
     */
    expect(await screen.findByRole('status')).toHaveTextContent('끝이 시작보다');
    expect(saved()[0]?.end).toBe('09:40');
  });

  it('기본 일과로 되돌릴 수 있다', async () => {
    const user = userEvent.setup();
    const data = createEmptySuiteData();
    data.periodTimes = data.periodTimes.map((time) =>
      time.period === 1 ? { ...time, start: '07:00', end: '07:40' } : time,
    );
    show(data);

    await user.click(await screen.findByRole('button', { name: '기본 일과로' }));
    await user.click(screen.getByRole('button', { name: '되돌리기' }));

    expect(saved()[0]?.start).toBe('09:00');
  });

  it('되돌리기를 취소하면 그대로다', async () => {
    const user = userEvent.setup();
    const data = createEmptySuiteData();
    data.periodTimes = data.periodTimes.map((time) =>
      time.period === 1 ? { ...time, start: '07:00', end: '07:40' } : time,
    );
    show(data);

    await user.click(await screen.findByRole('button', { name: '기본 일과로' }));
    await user.click(screen.getByRole('button', { name: '취소' }));

    // 일곱 줄을 손으로 맞춰 둔 것을 확인 없이 날리면 되돌릴 길이 없다.
    expect(saved()[0]?.start).toBe('07:00');
    expect(screen.getByLabelText('1교시 시작')).toHaveValue('07:00');
  });

  it('되돌리면 칸에 남아 있던 잘못된 값도 같이 사라진다', async () => {
    const user = userEvent.setup();
    show();

    const input = await screen.findByLabelText('1교시 끝');
    await user.clear(input);
    await user.type(input, '08:00');
    await user.click(screen.getByRole('button', { name: '기본 일과로' }));
    await user.click(screen.getByRole('button', { name: '되돌리기' }));

    /*
     * 막은 값은 칸에만 남는다. 되돌릴 때 그것까지 안 버리면 칸은 08:00을,
     * 자료는 09:40을 들고 있는 채로 갈라진다 — 선생님은 화면을 믿으므로
     * 저장되지 않은 값을 저장된 값으로 여기고 화면을 떠난다. 이 화면이
     * 막으려는 바로 그 어긋남이 되돌리기 단추에서 되살아나는 자리다.
     */
    expect(screen.getByLabelText('1교시 끝')).toHaveValue('09:40');
    expect(screen.getByRole('status')).not.toHaveTextContent('끝이 시작보다');
  });

  it('한 칸을 비우면 알려 주고 저장하지 않는다', async () => {
    const user = userEvent.setup();
    show();

    await user.clear(await screen.findByLabelText('2교시 시작'));

    // 빈 칸은 형식이 깨진 값과 같다. 그대로 넘기면 그 줄이 통째로 버려진다.
    expect(screen.getByRole('status')).toHaveTextContent('채워');
    expect(saved()[1]?.start).toBe('09:50');
  });
});

describe('점심때', () => {
  it('가장 긴 틈을 점심으로 짚어 준다', async () => {
    show();

    /*
     * 점심을 따로 묻지 않고 틈에서 알아낸다(nowCore.lunchGap). 그러면
     * 교사는 자기가 고친 시각이 점심을 어디로 옮겼는지 알 길이 없다.
     * 결과를 그 자리에 적어 두는 것으로 규칙을 눈에 보이게 한다.
     */
    expect(await screen.findByText(/점심 12:10 ~ 13:10/)).toBeInTheDocument();
  });

  it('점심으로 볼 틈이 없으면 없다고 말한다', async () => {
    const data = createEmptySuiteData();
    // 일곱 교시를 쉬는 시간 10분으로만 이어 붙인다. 긴 틈이 없다.
    data.periodTimes = data.periodTimes.map((time) => {
      const startMin = 9 * 60 + (time.period - 1) * 50;
      const hm = (minutes: number): string =>
        `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      return { ...time, start: hm(startMin), end: hm(startMin + 40) };
    });
    show(data);

    // 우기지 않는다. 자료가 안 말해 주는 것을 화면이 지어내면 09:55에
    // "점심"이라고 뜨는 일이 다시 생긴다.
    expect(await screen.findByText(/점심 시간을 정하지 못했습니다/)).toBeInTheDocument();
  });
});

/*
 * 탭 목록과 그리는 곳은 SettingsPage 안에서 따로 논다. 시간표 탭 아래에
 * 이어 그리기로 했으니, 실제로 그 탭을 눌러서 나오는지는 눌러 봐야 안다.
 */
describe('설정 화면 시간표 탭에 함께 있다', () => {
  it('시간표 탭을 누르면 표 아래에 일과가 나온다', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <ToastProvider>
          <SuiteDataProvider adapter={stubAdapter()}>
            <SettingsPage />
          </SuiteDataProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('tab', { name: '시간표' }));

    // 탭을 여덟 개로 늘리지 않는다. 시간표를 짜러 온 김에 일과도 맞춘다.
    expect(await screen.findByLabelText('1교시 시작')).toHaveValue('09:00');
    expect(screen.queryByRole('tab', { name: '교시 시각' })).not.toBeInTheDocument();
  });
});

describe('이웃 교시와 겹치는 것도 막는다', () => {
  it('끝을 잘못 쳐 다음 교시를 삼키면 저장하지 않는다', async () => {
    const user = userEvent.setup();
    show();

    const input = await screen.findByLabelText('2교시 끝');
    await user.clear(input);
    await user.type(input, '13:30');

    /*
     * 그 줄 하나만 놓고 보면 멀쩡하다 — 끝(13:30)이 시작(09:50)보다 늦다.
     * 그런데 '지금' 카드는 지금 시각을 품은 첫 줄을 답으로 내므로, 09:50부터
     * 13:30까지 내내 "2교시 · 150분 남음"이라고 말한다. 3·4교시가 통째로
     * 삼켜지는데 화면 어디에도 표시가 없다. 한눈에 믿으라는 카드가
     * 조용히 틀리면 없느니만 못하다.
     */
    expect(await screen.findByRole('status')).toHaveTextContent('3교시와 겹칩니다');
    expect(saved()[1]?.end).toBe('10:30');
  });

  it('시작을 앞 교시 안으로 당겨도 저장하지 않는다', async () => {
    const user = userEvent.setup();
    show();

    const input = await screen.findByLabelText('3교시 시작');
    await user.clear(input);
    await user.type(input, '10:00');

    // 2교시가 10:30에 끝난다. 10:00에 3교시가 시작하면 30분이 겹친다.
    expect(await screen.findByRole('status')).toHaveTextContent('2교시와 겹칩니다');
    expect(saved()[2]?.start).toBe('10:40');
  });

  it('겹치지 않으면 그대로 저장한다', async () => {
    const user = userEvent.setup();
    show();

    const input = await screen.findByLabelText('2교시 끝');
    await user.clear(input);
    await user.type(input, '10:25');

    // 3교시는 10:40 시작이다. 10:25는 안 겹친다.
    expect(saved()[1]?.end).toBe('10:25');
  });
})
