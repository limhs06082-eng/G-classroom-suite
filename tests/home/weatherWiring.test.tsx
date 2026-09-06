import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmptySuiteData } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

/*
 * 배선을 시험한다.
 *
 * 아래 층은 저마다 초록이다 — 좌표표도, 파서도, 조회도, 캐시도, 판단도.
 * 그런데 그것들을 **잇는 자리**는 아무도 안 본다. 이 판에서 다섯 번 겪은
 * 자리다. 머리띠에 아예 안 붙여도, 주소를 안 읽고 늘 서울을 불러도, 캐시를
 * 건너뛰고 매번 새로 받아 와도 시험은 전부 통과하고 화면에는 멀쩡한 숫자가
 * 뜬다. 머리띠는 실패해도 아무것도 안 그리는 자리라 아무도 신고하지 않는다.
 *
 * 그래서 **진짜 `AppShell`을 그린다.** 컴포넌트만 따로 그리면 "만들었는데
 * 안 붙였다"를 영영 못 잡는다. 바꿔 끼우는 것은 Tauri에 닿는 조각 둘과
 * 빌드 대상뿐이고, regions·weatherParse·WeatherSource·CacheStore·
 * loadTodayWeather·WeatherBadge는 다 실제로 돈다.
 */
const shared = vi.hoisted(() => ({
  desktop: true,
  disk: new Map<string, string>(),
  /** 파일을 몇 번 열었나. '묻지도 않는다'는 파일까지 봐야 확인된다. */
  reads: 0,
  asked: [] as string[],
  weather: null as unknown,
  address: null as unknown,
  failWeather: false,
  failAddress: false,
}));

/* 시험은 늘 웹 대상으로 돈다. 안 바꾸면 머리띠에 아예 안 그려지고 조용히 통과한다. */
vi.mock('../../src/shared/platform/target', () => ({
  TARGET: 'desktop',
  isDesktop: () => shared.desktop,
  resolveTarget: (raw: string | undefined) => (raw === 'desktop' ? 'desktop' : 'web'),
}));

vi.mock('../../src/shared/storage/TauriFileStore', () => ({
  TauriFileStore: class {
    read(path: string): Promise<string | null> {
      shared.reads += 1;
      return Promise.resolve(shared.disk.get(path) ?? null);
    }
    writeAtomic(path: string, text: string): Promise<void> {
      shared.disk.set(path, text);
      return Promise.resolve();
    }
    remove(path: string): Promise<void> {
      shared.disk.delete(path);
      return Promise.resolve();
    }
  },
}));

vi.mock('../../src/shared/external/TauriHttpClient', () => ({
  TauriHttpClient: class {
    getJson(url: string): Promise<unknown> {
      shared.asked.push(url);

      if (url.startsWith('https://api.open-meteo.com/')) {
        return shared.failWeather
          ? Promise.reject(new Error('인터넷 연결 없음'))
          : Promise.resolve(shared.weather);
      }

      return shared.failAddress
        ? Promise.reject(new Error('NEIS가 응답하지 않음'))
        : Promise.resolve(shared.address);
    }
  },
}));

const { AppShell } = await import('../../src/app/AppShell');

const OFFICE = 'E10';
const SCHOOL = '7341236';
const INCHEON = '인천광역시 남동구 서창남순환로 190-28';
const GYEONGGI = '경기도 성남시 수정구 위례동로 55';

/** open-meteo가 실제로 주는 모양. `current`에 딸린 칸까지 그대로 둔다. */
function weatherBody(temperature: number): unknown {
  return {
    latitude: 37.5,
    longitude: 126.75,
    current: { time: '2026-08-29T09:30', interval: 900, temperature_2m: temperature, weather_code: 1 },
    daily: { time: ['2026-08-29'], temperature_2m_max: [27.6], temperature_2m_min: [23.6] },
  };
}

/** NEIS 학교 찾기 응답. 두 겹 구조까지 진짜 모양 그대로다. */
function schoolBody(address: string): unknown {
  return {
    schoolInfo: [
      { head: [{ list_total_count: 1 }, { RESULT: { CODE: 'INFO-000' } }] },
      {
        row: [
          {
            ATPT_OFCDC_SC_CODE: OFFICE,
            ATPT_OFCDC_SC_NM: '인천광역시교육청',
            SD_SCHUL_CODE: SCHOOL,
            SCHUL_NM: '서창초등학교',
            ORG_RDNMA: address,
            SCHUL_KND_SC_NM: '초등학교',
          },
        ],
      },
    ],
  };
}

function withProfile(overrides: Partial<SuiteData['profile']> = {}): SuiteData {
  const data = createEmptySuiteData();
  return {
    ...data,
    profile: {
      ...data.profile,
      officeCode: OFFICE,
      schoolCode: SCHOOL,
      schoolAddress: INCHEON,
      ...overrides,
    },
  };
}

let saved: SuiteData[] = [];

function show(data: SuiteData = withProfile()) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({
            load: async () => ({ data, repairs: [], isFirstRun: false }),
            save: async (next) => {
              saved.push(next);
            },
          })}
        >
          <AppShell />
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

/** open-meteo에 나간 것만. NEIS 주소 조회가 같은 통로를 쓴다. */
function weatherCalls(): string[] {
  return shared.asked.filter((url) => url.startsWith('https://api.open-meteo.com/'));
}

beforeEach(() => {
  shared.desktop = true;
  shared.disk.clear();
  shared.reads = 0;
  shared.asked = [];
  shared.weather = weatherBody(26.3);
  shared.address = schoolBody(INCHEON);
  shared.failWeather = false;
  shared.failAddress = false;
  saved = [];
});

describe('머리띠 날씨 배선', () => {
  it('받아 온 온도가 머리띠에 뜬다', async () => {
    /*
     * 이 한 줄이 "만들었는데 안 붙였다"를 잡는 유일한 자리다. AppShell에서
     * <TodayWeather/>를 지워도 나머지 시험은 전부 초록이다.
     */
    show();

    expect(await screen.findByText('26°')).toBeInTheDocument();
  });

  it('지역 이름을 함께 띄운다', async () => {
    show();

    // 시·도 대표 좌표라 거칠다. 이름을 감추면 교사가 학교 마당의 온도로 여긴다.
    expect(await screen.findByText('인천광역시')).toBeInTheDocument();
  });

  it('머리띠 안에 있다', async () => {
    show();
    await screen.findByText('26°');

    // 본문 어딘가가 아니라 머리띠여야 한다. 늘 보이는 자리인 것이 요점이다.
    const header = document.querySelector('header');
    expect(header?.textContent).toContain('26°');
  });

  it('학교 주소의 지역 좌표로 부른다', async () => {
    show();
    await screen.findByText('26°');

    expect(weatherCalls()[0]).toContain('latitude=37.4563');
    expect(weatherCalls()[0]).toContain('longitude=126.7052');
  });

  it('주소가 다르면 다른 좌표로 부른다', async () => {
    /*
     * 한 곳만 보면 `regionOfAddress`를 안 거치고 서울을 박아 넣은 손이
     * 그대로 통과한다. 부산 학교에 서울 날씨를 띄우는 그 자리다.
     */
    show(withProfile({ schoolAddress: GYEONGGI }));
    await screen.findByText('26°');

    expect(weatherCalls()[0]).toContain('latitude=37.275');
    expect(await screen.findByText('경기도')).toBeInTheDocument();
  });

  it('두 번째로 열 때는 다시 묻지 않는다', async () => {
    show();
    await screen.findByText('26°');

    show();
    await waitFor(() => expect(screen.getAllByText('26°').length).toBeGreaterThan(1));

    // 캐시가 파일까지 갔다 와야 진짜다. 껐다 켜도 인터넷 없이 보여야 한다.
    expect(weatherCalls()).toHaveLength(1);
  });

  it('주소를 못 읽으면 아무것도 안 그리고 묻지도 않는다', async () => {
    show(withProfile({ schoolAddress: '어딘가 먼 곳 123' }));

    await waitFor(() => expect(screen.getByText('우리 반')).toBeInTheDocument());

    expect(screen.queryByText('26°')).toBeNull();
    expect(weatherCalls()).toEqual([]);
    /*
     * 파일도 안 연다. 물을 좌표가 없는데 Tauri 조각을 들이고 cache.json을
     * 여는 것은 켤 때마다 하는 헛걸음이다.
     */
    expect(shared.reads).toBe(0);
  });

  it('통신이 끊겨도 머리띠가 안 깨진다', async () => {
    shared.failWeather = true;

    show();

    // 머리띠는 살아 있고, 오류 문구는 안 뜬다. 하루 종일 눈에 걸릴 자리다.
    expect(await screen.findByText('우리 반')).toBeInTheDocument();
    expect(screen.queryByText(/받아 오지 못했습니다/)).toBeNull();
  });

  it('open-meteo가 오류 봉투를 자료인 척 보내도 안 깨진다', async () => {
    shared.weather = { error: true, reason: 'Hourly API request limit exceeded.' };

    show();

    expect(await screen.findByText('우리 반')).toBeInTheDocument();
    expect(screen.queryByText(/°/)).toBeNull();
    // 오류를 담아 버리면 한 시간 동안 다시 안 묻는다.
    expect(shared.disk.get('cache.json')).toBeUndefined();
  });

  it('웹에서는 그리지도 묻지도 않는다', async () => {
    /*
     * NEIS가 브라우저의 직접 요청을 막아 주소를 채울 길이 없다. 급식과
     * 같은 사정이다.
     */
    shared.desktop = false;

    show();
    await waitFor(() => expect(screen.getByText('우리 반')).toBeInTheDocument());

    expect(screen.queryByText('26°')).toBeNull();
    expect(shared.asked).toEqual([]);
    expect(shared.reads).toBe(0);
  });
});

describe('이미 학교를 고른 교사의 주소 메우기', () => {
  it('주소가 없으면 학교 코드로 받아 와 담는다', async () => {
    /*
     * 주소는 이번 판에 새로 담기 시작한 칸이다. 그 전에 학교를 고른 교사
     * 에게는 없고, 그대로 두면 **기존 사용자 전원에게 이 기능이 안 보인다.**
     */
    show(withProfile({ schoolAddress: undefined }));

    await waitFor(() => expect(saved.length).toBeGreaterThan(0), { timeout: 3000 });
    expect(saved[saved.length - 1]?.profile.schoolAddress).toBe(INCHEON);
  });

  it('메운 주소로 날씨까지 뜬다', async () => {
    // 담기만 하고 그 자리에서 안 쓰면 다음에 켤 때까지 머리띠가 빈다.
    show(withProfile({ schoolAddress: undefined }));

    expect(await screen.findByText('26°')).toBeInTheDocument();
    expect(await screen.findByText('인천광역시')).toBeInTheDocument();
  });

  it('이름이 아니라 학교 코드 둘로 묻는다', async () => {
    show(withProfile({ schoolAddress: undefined }));
    await screen.findByText('26°');

    const neis = shared.asked.filter((url) => url.startsWith('https://open.neis.go.kr/'));
    expect(neis[0]).toContain(`ATPT_OFCDC_SC_CODE=${OFFICE}`);
    expect(neis[0]).toContain(`SD_SCHUL_CODE=${SCHOOL}`);
  });

  it('주소가 이미 있으면 NEIS에 묻지 않는다', async () => {
    // 한 번 담기면 다시 안 묻는다. 켤 때마다 물으면 NEIS 하루 한도를 태운다.
    show();
    await screen.findByText('26°');

    expect(shared.asked.filter((url) => url.startsWith('https://open.neis.go.kr/'))).toEqual([]);
  });

  it('주소를 못 받아 와도 머리띠가 안 깨진다', async () => {
    shared.failAddress = true;

    show(withProfile({ schoolAddress: undefined }));

    // 교사가 부탁한 적 없는 일이다. 조용히 넘어가고 날씨만 안 뜬다.
    expect(await screen.findByText('우리 반')).toBeInTheDocument();
    expect(screen.queryByText('26°')).toBeNull();
  });

  it('없는 학교면 빈 주소를 담지 않는다', async () => {
    /*
     * 빈 글자를 담으면 `schoolAddress`가 '있는데 못 읽는 값'이 된다. 없는
     * 것과 구별이 안 되고, 저장만 한 번 더 일어난다.
     */
    shared.address = { RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } };

    show(withProfile({ schoolAddress: undefined }));
    await waitFor(() =>
      expect(shared.asked.filter((u) => u.startsWith('https://open.neis.go.kr/'))).toHaveLength(1),
    );

    expect(saved).toEqual([]);
  });
});

describe('급식과 한 파일을 나눠 쓴다', () => {
  /*
   * 시계를 급식 날짜에 못 박는다. CacheStore는 7일 지난 급식을 버리므로(KEEP_DAYS),
   * 실제 시계로 돌리면 2026-09-06부터 '2026-08-29' 급식이 버려져 이 시험이 깨진다 —
   * 실제로 v0.21.0 배포 CI가 그날 아침 그렇게 막혔다. 다른 describe와 같은 시각.
   */
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 29, 9, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('날씨를 담아도 받아 둔 급식이 남는다', async () => {
    /*
     * `cache.json` 하나에 급식과 날씨가 함께 산다. 여기서 임자 글자
     * (`시도코드:학교코드`)를 급식과 다르게 지으면 `CacheStore`가 남의
     * 급식이라 보고 통째로 버린 채 열고, 날씨를 담는 순간 그 빈 급식이
     * 파일에 덮인다. **급식이 조용히 사라진다** — 날씨는 멀쩡히 뜨고,
     * 급식 카드도 그날은 캐시가 아니라 NEIS에서 받아 와 멀쩡해 보인다.
     * 다음 날, 인터넷이 끊긴 날에야 드러난다.
     */
    shared.disk.set(
      'cache.json',
      JSON.stringify({
        version: 1,
        school: `${OFFICE}:${SCHOOL}`,
        meals: {
          '2026-08-29': [
            { kind: '중식', date: '2026-08-29', dishes: [{ name: '기장밥', allergens: [] }], calories: '' },
          ],
        },
      }),
    );

    show();
    await screen.findByText('26°');

    await waitFor(() => {
      const raw: unknown = JSON.parse(shared.disk.get('cache.json') ?? '{}');
      const shape = raw as { meals?: Record<string, unknown>; weather?: Record<string, unknown> };
      expect(shape.weather?.['인천광역시']).toBeDefined();
      expect(shape.meals?.['2026-08-29']).toBeDefined();
    });
  });
});

describe('켜 둔 채로 다시 물어 온다', () => {
  /*
   * 이 판에서 가장 조용한 결함이 여기 있었다. 낡음 검사는 `getWeather()`
   * **안에** 있어서, 한 시간이 지났다고 저절로 무슨 일이 일어나지 않는다 —
   * 아무도 다시 안 물으면 아침 기온이 하루 종일 머리띠에 박혀 있는다.
   * G-board는 교실 컴퓨터에서 종일 켜져 있는 것이 전제라 이건 실제로
   * 일어나고, 화면에는 멀쩡한 숫자가 떠 있어서 아무도 못 알아챈다.
   *
   * 되받아 오는 가락을 통째로 떼어 내고 시험 1,197개를 돌려 보았다.
   * **하나도 안 깨졌다.** 그래서 여기 못 박는다.
   */
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 29, 9, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('한 시간이 지나면 새 기온을 받아 온다', async () => {
    show();
    expect(await screen.findByText('26°')).toBeInTheDocument();

    // 아침에 켜서 그대로 둔 교실 컴퓨터다. 그리는 일 없이 시각만 흐른다.
    shared.weather = weatherBody(19.1);
    await act(async () => {
      vi.advanceTimersByTime(70 * 60 * 1000);
    });

    expect(await screen.findByText('19°')).toBeInTheDocument();
    expect(weatherCalls().length).toBeGreaterThan(1);
  });

  it('아직 신선하면 다시 묻지 않는다', async () => {
    /*
     * 낡음을 열 분마다 **재기만** 한다. 재는 것과 묻는 것을 같이 두면
     * open-meteo에 하루 백마흔네 번 나가고, 돌아오는 숫자는 늘 같다.
     */
    show();
    await screen.findByText('26°');

    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });

    expect(weatherCalls()).toHaveLength(1);
    expect(screen.getByText('26°')).toBeInTheDocument();
  });
});

describe('끊겼다고 이미 받아 둔 것을 지우지 않는다', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 29, 9, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('다시 묻다 실패해도 머리띠에 기온이 남는다', async () => {
    show();
    expect(await screen.findByText('26°')).toBeInTheDocument();

    // 한 시간 뒤 다시 물으려는데 학교 공유기가 십오 초 끊긴다.
    shared.failWeather = true;
    await act(async () => {
      vi.advanceTimersByTime(70 * 60 * 1000);
      await Promise.resolve();
    });

    /*
     * "다시 물을 때 loading으로 되돌리지 않는다"고 해 놓고 실패는 그대로
     * 덮고 있었다. 그러면 온 화면의 머리띠에서 날씨가 사라지고 다음에
     * 성공할 때까지 안 돌아온다 — 오후 내내 끊기면 하교할 때까지 빈자리다.
     * 열 분 묵은 기온이 빈자리보다 낫다는 판단이 loading에만 걸릴 이유가 없다.
     */
    expect(screen.getByText('26°')).toBeInTheDocument();
  });

  it('한 번도 못 받았으면 실패는 실패다', async () => {
    shared.failWeather = true;
    show();

    // 지킬 것이 없을 때까지 붙들면 영영 빈 채로 '있는 척'하게 된다.
    await waitFor(() => expect(weatherCalls().length).toBeGreaterThan(0));
    expect(screen.queryByText(/°/)).not.toBeInTheDocument();
  });
})

describe('주소를 못 받았으면 다시 해 본다', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 7, 29, 9, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('부팅 때 실패해도 열 분 뒤에 다시 묻는다', async () => {
    /*
     * 이 효과가 도는 때가 하필 부팅 직후다 — 교실 컴퓨터가 켜지고 G-board가
     * 자동으로 뜨는 그 순간이 학교 네트워크가 아직 안 붙어 있을 확률이 가장
     * 높은 때다. 한 번 실패하고 끝내면, 이 판 이전에 학교를 고른 선생님은
     * 날씨를 영영 못 본다 — 주소를 얻는 길이 이것뿐이다.
     */
    shared.failAddress = true;
    show(withProfile({ schoolAddress: undefined }));
    await screen.findByText('우리 반');

    const neis = (): string[] =>
      shared.asked.filter((url) => url.startsWith('https://open.neis.go.kr/'));
    await waitFor(() => expect(neis().length).toBe(1));

    // 네트워크가 붙었다.
    shared.failAddress = false;
    await act(async () => {
      vi.advanceTimersByTime(11 * 60 * 1000);
      await Promise.resolve();
    });

    await waitFor(() => expect(neis().length).toBeGreaterThan(1));
    expect(await screen.findByText('26°')).toBeInTheDocument();
  });

  it('한 번 받아 두면 그 뒤로는 안 묻는다', async () => {
    show(withProfile({ schoolAddress: undefined }));
    await screen.findByText('26°');

    const before = shared.asked.filter((u) => u.startsWith('https://open.neis.go.kr/')).length;
    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
      await Promise.resolve();
    });

    // 켤 때마다·열 분마다 물으면 NEIS 하루 한도를 태운다.
    expect(shared.asked.filter((u) => u.startsWith('https://open.neis.go.kr/')).length).toBe(before);
  });
})
