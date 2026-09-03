import { beforeEach, describe, expect, it } from 'vitest';

import type { MealMenu } from '../../src/shared/external/neisParse';
import { CacheStore } from '../../src/shared/storage/CacheStore';
import { MemoryFileStore } from '../../src/shared/storage/MemoryFileStore';
import { loadTodayMeal, type MealCache, type MealSource } from '../../src/features/home/todayMeal';

/*
 * 여기가 이 기능에서 가장 틀리기 쉬운 자리다. 카드는 받은 상태를 그리기만
 * 하지만, 이 함수는 '캐시에 있는 것'과 '아직 안 물어본 것', '방학이라 빈 것'과
 * '못 받아 온 것'을 가른다. 넷을 섞으면 선생님이 엉뚱한 것을 고치러 간다.
 */

const DATE = '2026-06-01';
const OFFICE = 'E10';
const SCHOOL = '7310058';

function menu(name: string): MealMenu[] {
  return [{ kind: '중식', date: DATE, dishes: [{ name, allergens: [] }], calories: '' }];
}

/** 부른 횟수를 센다. '묻지 않았다'를 확인하려면 세는 수밖에 없다. */
function source(result: MealMenu[] | Error): MealSource & { calls: number } {
  const fake = {
    calls: 0,
    fetchMeals(): Promise<MealMenu[]> {
      fake.calls += 1;
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
  return CacheStore.open(files, `${OFFICE}:${SCHOOL}`, () => '2026-06-01T09:00:00.000Z');
}

describe('loadTodayMeal — 학교가 없을 때', () => {
  it('시도코드가 비면 no-school이다', async () => {
    const neis = source(menu('안 불려야 한다'));

    const state = await loadTodayMeal(await cache(), neis, '', SCHOOL, DATE);

    expect(state.kind).toBe('no-school');
    // 물을 데가 없는데 부르면 켤 때마다 헛걸음한다.
    expect(neis.calls).toBe(0);
  });

  it('학교코드가 비면 no-school이다', async () => {
    const state = await loadTodayMeal(await cache(), source([]), OFFICE, '', DATE);

    expect(state.kind).toBe('no-school');
  });
});

describe('loadTodayMeal — 캐시', () => {
  it('캐시에 있으면 NEIS에 묻지 않는다', async () => {
    const store = await cache();
    await store.putMeals(DATE, menu('어제 받아 둔 급식'));
    const neis = source(menu('새로 받은 급식'));

    const state = await loadTodayMeal(store, neis, OFFICE, SCHOOL, DATE);

    expect(state).toEqual({ kind: 'ready', meals: menu('어제 받아 둔 급식') });
    // 학교 인터넷은 끊긴다. 받아 둔 것이 있으면 그날도 보여야 한다.
    expect(neis.calls).toBe(0);
  });

  it('방학이라 빈 날도 기억해서 다시 묻지 않는다', async () => {
    const store = await cache();
    await store.putMeals(DATE, []);
    const neis = source(menu('있을 리 없다'));

    const state = await loadTodayMeal(store, neis, OFFICE, SCHOOL, DATE);

    // 빈 배열은 '물어봤더니 없더라'다. 이걸 '안 물어봤다'로 보면 방학 내내 두드린다.
    expect(state).toEqual({ kind: 'ready', meals: [] });
    expect(neis.calls).toBe(0);
  });

  it('안 물어본 날은 받아 와서 담는다', async () => {
    const store = await cache();
    const neis = source(menu('기장밥'));

    const state = await loadTodayMeal(store, neis, OFFICE, SCHOOL, DATE);

    expect(state).toEqual({ kind: 'ready', meals: menu('기장밥') });
    expect(neis.calls).toBe(1);
    expect(store.getMeals(DATE)?.[0]?.dishes[0]?.name).toBe('기장밥');
  });
});

describe('loadTodayMeal — 못 받아 왔을 때', () => {
  it('failed로 알린다', async () => {
    const state = await loadTodayMeal(
      await cache(),
      source(new Error('인터넷이 끊겼다')),
      OFFICE,
      SCHOOL,
      DATE,
    );

    // 빈 카드로 두면 방학인지 인터넷 문제인지 알 수 없다.
    expect(state.kind).toBe('failed');
  });

  it('못 받아 온 날은 담지 않는다', async () => {
    const store = await cache();

    await loadTodayMeal(store, source(new Error('끊김')), OFFICE, SCHOOL, DATE);

    // 실패를 '급식 없음'으로 담으면 인터넷이 돌아와도 오늘은 영영 빈 카드다.
    expect(store.getMeals(DATE)).toBeNull();
  });

  it('담기가 실패해도 오늘 급식은 보여 준다', async () => {
    const broken: MealCache = {
      getMeals: () => null,
      putMeals: () => Promise.reject(new Error('디스크가 꽉 찼다')),
    };

    const state = await loadTodayMeal(broken, source(menu('기장밥')), OFFICE, SCHOOL, DATE);

    // 캐시를 못 남긴 것이지 급식을 못 받은 것이 아니다.
    expect(state).toEqual({ kind: 'ready', meals: menu('기장밥') });
  });
});

describe('이번 주 급식', () => {
  it('schoolWeekOf — 그 주 월~금, 주말이면 다음 주', async () => {
    const { schoolWeekOf } = await import('../../src/features/home/todayMeal');
    // 2026-06-03은 수요일
    expect(schoolWeekOf('2026-06-03')).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
    ]);
    // 일요일 저녁에 보는 것은 다음 주 급식이다.
    expect(schoolWeekOf('2026-06-07')[0]).toBe('2026-06-08');
    expect(schoolWeekOf('2026-06-06')[0]).toBe('2026-06-08');
  });

  it('loadWeekMeals — 캐시에 있는 날은 NEIS를 안 두드리고, 하루 실패해도 나머지는 온다', async () => {
    const { loadWeekMeals } = await import('../../src/features/home/todayMeal');
    const store = await cache();
    await store.putMeals('2026-06-01', menu('월요일밥'));

    let calls = 0;
    const flaky: MealSource = {
      fetchMeals(_o, _s, date) {
        calls += 1;
        return date === '2026-06-03' ? Promise.reject(new Error('한도')) : Promise.resolve(menu(date));
      },
    };

    const week = await loadWeekMeals(store, flaky, OFFICE, SCHOOL, [
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
    ]);

    expect(calls).toBe(2); // 월요일은 캐시
    expect(week[0]?.state.kind).toBe('ready');
    expect(week[1]?.state.kind).toBe('ready');
    expect(week[2]?.state.kind).toBe('failed');
  });
});
