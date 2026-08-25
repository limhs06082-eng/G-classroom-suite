import { beforeEach, describe, expect, it } from 'vitest';

import type { MealMenu } from '../../src/shared/external/neisParse';
import { CacheStore } from '../../src/shared/storage/CacheStore';
import { MemoryFileStore } from '../../src/shared/storage/MemoryFileStore';

let files: MemoryFileStore;

const T0 = '2026-06-01T09:00:00.000Z';

function menu(name: string): MealMenu[] {
  return [{ kind: '중식', date: '2026-06-01', dishes: [{ name, allergens: [] }], calories: '' }];
}

beforeEach(() => {
  files = new MemoryFileStore();
});

async function open(now = T0): Promise<CacheStore> {
  return CacheStore.open(files, () => now);
}

describe('CacheStore — 담고 꺼내기', () => {
  it('없는 날은 null이다', async () => {
    const cache = await open();

    expect(cache.getMeals('2026-06-01')).toBeNull();
  });

  it('담은 것을 꺼낸다', async () => {
    const cache = await open();

    await cache.putMeals('2026-06-01', menu('홍국쌀밥'));

    expect(cache.getMeals('2026-06-01')?.[0]?.dishes[0]?.name).toBe('홍국쌀밥');
  });

  it('다시 열어도 남아 있다', async () => {
    const first = await open();
    await first.putMeals('2026-06-01', menu('홍국쌀밥'));

    // 앱을 껐다 켠 것과 같다. 인터넷이 끊긴 날에도 오늘 급식이 보여야 한다.
    const second = await open();

    expect(second.getMeals('2026-06-01')?.[0]?.dishes[0]?.name).toBe('홍국쌀밥');
  });

  it('급식이 없는 날도 기억한다', async () => {
    const cache = await open();

    // 방학이라 빈 목록인 것과, 아직 안 물어본 것은 다르다.
    await cache.putMeals('2026-06-01', []);

    expect(cache.getMeals('2026-06-01')).toEqual([]);
  });
});

describe('CacheStore — 오래된 것은 버린다', () => {
  it('7일이 지난 날짜는 안 돌려준다', async () => {
    const cache = await open('2026-06-01T09:00:00.000Z');
    await cache.putMeals('2026-05-20', menu('옛날 급식'));

    expect(cache.getMeals('2026-05-20')).toBeNull();
  });

  it('7일 안쪽은 그대로 있다', async () => {
    const cache = await open('2026-06-01T09:00:00.000Z');
    await cache.putMeals('2026-05-28', menu('지난주 급식'));

    expect(cache.getMeals('2026-05-28')?.[0]?.dishes[0]?.name).toBe('지난주 급식');
  });

  it('다시 열 때 오래된 것을 파일에서도 지운다', async () => {
    const first = await open('2026-06-01T09:00:00.000Z');
    await first.putMeals('2026-05-20', menu('옛날'));
    await first.putMeals('2026-06-01', menu('오늘'));

    await open('2026-06-01T09:00:00.000Z');

    // 무한정 쌓이면 파일이 계속 커진다. 열 때 한 번 치운다.
    const raw: unknown = JSON.parse((await files.read('cache.json')) ?? '{}');
    const meals = (raw as { meals?: Record<string, unknown> }).meals ?? {};
    expect(Object.keys(meals)).toEqual(['2026-06-01']);
  });
});

describe('CacheStore — 깨져도 앱을 막지 않는다', () => {
  it('파일이 깨져 있으면 빈 캐시로 시작한다', async () => {
    await files.writeAtomic('cache.json', '{ 이건 JSON이 아니다');

    const cache = await open();

    // 캐시는 다시 받으면 그만이다. 여기서 던지면 앱이 안 뜬다.
    expect(cache.getMeals('2026-06-01')).toBeNull();
  });

  it('쓰기가 실패해도 메모리에는 남는다', async () => {
    const cache = await open();
    files.failNextWrite = true;

    await cache.putMeals('2026-06-01', menu('홍국쌀밥'));

    // 파일에 못 써도 오늘 화면에는 급식이 떠야 한다.
    expect(cache.getMeals('2026-06-01')?.[0]?.dishes[0]?.name).toBe('홍국쌀밥');
  });
});
