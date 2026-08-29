import { beforeEach, describe, expect, it } from 'vitest';

import type { Region } from '../../src/shared/domain/regions';
import type { Weather } from '../../src/shared/external/weatherParse';
import { CacheStore } from '../../src/shared/storage/CacheStore';
import { MemoryFileStore } from '../../src/shared/storage/MemoryFileStore';
import {
  loadTodayWeather,
  type WeatherCache,
  type WeatherFetcher,
} from '../../src/features/home/todayWeather';

/*
 * 급식(`todayMeal.test.ts`)과 같은 자리다. 카드는 받은 상태를 그리기만 하고,
 * 이 함수가 '주소를 못 읽는 것'과 '캐시에 있는 것', '못 받아 온 것'과 '받았는데
 * 못 읽은 것'을 가른다. 넷을 섞으면 머리띠가 조용히 거짓말을 한다 — 머리띠는
 * 실패해도 아무것도 안 그리는 자리라 아무도 신고하지 않는다.
 */

const INCHEON = '인천광역시 남동구 서창남순환로 190-28';
const GYEONGGI = '경기도 성남시 수정구 위례동로 55';

const NOW = '2026-08-29T09:00:00.000Z';

function weather(temperature: number): Weather {
  return { temperature, low: 23.6, high: 27.6, code: 1 };
}

/**
 * 부른 횟수와 **어느 지역으로 불렀는지**를 센다.
 *
 * 횟수만 세면 주소를 안 읽고 늘 서울을 부르는 구현도 통과한다. 화면에는
 * 멀쩡한 숫자가 뜨고 틀렸다는 표시가 어디에도 없다.
 */
function source(result: Weather | null | Error): WeatherFetcher & { asked: Region[] } {
  const fake = {
    asked: [] as Region[],
    fetchWeather(region: Region): Promise<Weather | null> {
      fake.asked.push(region);
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    },
  };
  return fake;
}

let files: MemoryFileStore;

beforeEach(() => {
  files = new MemoryFileStore();
});

async function cache(): Promise<CacheStore> {
  return CacheStore.open(files, 'E10:7341236', () => NOW);
}

describe('loadTodayWeather — 물을 데가 없을 때', () => {
  it('주소가 비면 no-school이고 묻지 않는다', async () => {
    const open = source(weather(26.3));

    const state = await loadTodayWeather(await cache(), open, '');

    expect(state).toEqual({ kind: 'no-school' });
    // 물을 좌표가 없는데 부르면 켤 때마다 헛걸음한다.
    expect(open.asked).toEqual([]);
  });

  it('시·도를 못 읽는 주소도 no-school이고 묻지 않는다', async () => {
    /*
     * failed가 아니다. 둘을 섞으면 안 되는 까닭은 급식과 같다 — 교사가 할
     * 일이 다르다. 여기서는 인터넷이 아니라 학교 설정을 봐야 한다.
     */
    const open = source(weather(26.3));

    const state = await loadTodayWeather(await cache(), open, '어딘가 먼 곳 123');

    expect(state).toEqual({ kind: 'no-school' });
    expect(open.asked).toEqual([]);
  });
});

describe('loadTodayWeather — 주소에서 지역을 뽑는다', () => {
  it('그 주소의 지역 좌표로 부른다', async () => {
    const open = source(weather(26.3));

    await loadTodayWeather(await cache(), open, INCHEON);

    expect(open.asked[0]?.name).toBe('인천광역시');
    expect(open.asked[0]?.lat).toBeCloseTo(37.4563);
  });

  it('주소가 다르면 다른 지역으로 부른다', async () => {
    // 한 곳만 보면 주소를 버리고 서울을 박아 넣은 구현도 통과한다.
    const open = source(weather(26.3));

    await loadTodayWeather(await cache(), open, GYEONGGI);

    expect(open.asked[0]?.name).toBe('경기도');
  });

  it('지역 이름을 상태에 실어 준다', async () => {
    /*
     * 화면이 이 이름을 함께 띄운다. 시·도 단위라 거친데 그것을 감추면
     * 교사가 그 숫자를 자기 학교 마당의 온도로 여긴다.
     */
    const state = await loadTodayWeather(await cache(), source(weather(26.3)), GYEONGGI);

    expect(state).toEqual({ kind: 'ready', region: '경기도', weather: weather(26.3) });
  });
});

describe('loadTodayWeather — 캐시', () => {
  it('담아 둔 것이 있으면 다시 묻지 않는다', async () => {
    const store = await cache();
    await store.putWeather('경기도', weather(21.1));
    const open = source(weather(30));

    const state = await loadTodayWeather(store, open, GYEONGGI);

    expect(state).toEqual({ kind: 'ready', region: '경기도', weather: weather(21.1) });
    expect(open.asked).toEqual([]);
  });

  it('받아 온 것을 그 지역 이름으로 담는다', async () => {
    /*
     * 열쇠가 어긋나면 캐시가 **영원히 안 맞는다**. 그런데도 화면은 멀쩡하다 —
     * 매번 새로 받아 올 뿐이라 눈에 띄는 것이 하나도 없다.
     */
    const store = await cache();

    await loadTodayWeather(store, source(weather(26.3)), GYEONGGI);

    expect(store.getWeather('경기도')).toEqual(weather(26.3));
  });

  it('다른 지역에 담긴 것을 끌어다 쓰지 않는다', async () => {
    const store = await cache();
    await store.putWeather('제주특별자치도', weather(30));
    const open = source(weather(26.3));

    const state = await loadTodayWeather(store, open, GYEONGGI);

    expect(state).toEqual({ kind: 'ready', region: '경기도', weather: weather(26.3) });
    expect(open.asked).toHaveLength(1);
  });
});

describe('loadTodayWeather — 못 받아 왔을 때', () => {
  it('통신이 끊기면 failed다', async () => {
    const state = await loadTodayWeather(
      await cache(),
      source(new Error('인터넷 연결 없음')),
      GYEONGGI,
    );

    expect(state).toEqual({ kind: 'failed' });
  });

  it('받았는데 못 읽어도 failed다', async () => {
    /*
     * `null`은 급식의 빈 배열과 다르다. 빈 배열은 '물어봤더니 없더라'라서
     * 담아 둘 값이 있지만, 여기 `null`은 **담을 것이 없다.** 오늘 하늘이
     * 없는 날은 없다.
     */
    const state = await loadTodayWeather(await cache(), source(null), GYEONGGI);

    expect(state).toEqual({ kind: 'failed' });
  });

  it('못 받아 온 것은 담지 않는다', async () => {
    const store = await cache();

    await loadTodayWeather(store, source(null), GYEONGGI);

    // 실패를 담으면 한 시간 동안 다시 안 묻는다. 인터넷이 돌아와도 그렇다.
    expect(store.getWeather('경기도')).toBeNull();
  });

  it('담기가 실패해도 오늘 날씨는 보여 준다', async () => {
    const broken: WeatherCache = {
      getWeather: () => null,
      putWeather: () => Promise.reject(new Error('디스크가 꽉 찼다')),
    };

    const state = await loadTodayWeather(broken, source(weather(26.3)), GYEONGGI);

    // 캐시를 못 남긴 것이지 날씨를 못 받은 것이 아니다.
    expect(state).toEqual({ kind: 'ready', region: '경기도', weather: weather(26.3) });
  });
});

describe('loadTodayWeather — 옛 이름 주소', () => {
  it('강원도로 저장된 학교도 지금 이름으로 담긴다', async () => {
    /*
     * 열쇠가 `regionOfAddress`가 준 이름이라야 한다. 주소의 첫 낱말을 그대로
     * 쓰면 '강원도'로 담고 '강원특별자치도'로 찾게 되어 캐시가 안 맞는다.
     */
    const store = await cache();

    const state = await loadTodayWeather(store, source(weather(18)), '강원도 춘천시 어디로 1');

    expect(state).toEqual({ kind: 'ready', region: '강원특별자치도', weather: weather(18) });
    expect(store.getWeather('강원특별자치도')).toEqual(weather(18));
  });
});
