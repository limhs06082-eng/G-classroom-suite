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

const SCHOOL = 'E10:7310058';
const OTHER_SCHOOL = 'J10:7530079';

async function open(now = T0, school = SCHOOL): Promise<CacheStore> {
  return CacheStore.open(files, school, () => now);
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

describe('CacheStore — 캐시는 한 학교의 것이다', () => {
  it('학교를 바꾸면 앞 학교 급식을 돌려주지 않는다', async () => {
    const first = await open(T0, SCHOOL);
    await first.putMeals('2026-06-01', menu('앞 학교 급식'));

    /*
     * 검색에서 같은 이름의 다른 학교를 골랐다가 고치는 일은 흔하다. 날짜만
     * 열쇠로 삼으면 고친 뒤에도 앞 학교 급식이 그대로 뜨고, 캐시에 있으니
     * 새 학교에는 묻지도 않는다. 학교 이름만 바뀐 화면이 된다.
     */
    const second = await open(T0, OTHER_SCHOOL);

    expect(second.getMeals('2026-06-01')).toBeNull();
  });

  it('같은 학교면 그대로 남아 있다', async () => {
    const first = await open(T0, SCHOOL);
    await first.putMeals('2026-06-01', menu('홍국쌀밥'));

    // 학교가 그대로면 버릴 이유가 없다. 인터넷이 끊긴 날 이것이 오늘 급식이다.
    const second = await open(T0, SCHOOL);

    expect(second.getMeals('2026-06-01')?.[0]?.dishes[0]?.name).toBe('홍국쌀밥');
  });

  it('학교를 바꾼 뒤 담으면 파일에도 새 학교 것만 남는다', async () => {
    const first = await open(T0, SCHOOL);
    await first.putMeals('2026-06-01', menu('앞 학교 급식'));

    const second = await open(T0, OTHER_SCHOOL);
    await second.putMeals('2026-06-01', menu('새 학교 급식'));

    const raw: unknown = JSON.parse((await files.read('cache.json')) ?? '{}');
    const shape = raw as { school?: string; meals?: Record<string, MealMenu[]> };
    expect(shape.school).toBe(OTHER_SCHOOL);
    expect(shape.meals?.['2026-06-01']?.[0]?.dishes[0]?.name).toBe('새 학교 급식');
  });

  it('학교 표시가 없는 옛 파일은 버린다', async () => {
    // 0.1.0에는 이 캐시가 없었지만, 누구 것인지 모르는 파일을 믿을 수는 없다.
    await files.writeAtomic('cache.json', JSON.stringify({ meals: { '2026-06-01': menu('출처 불명') } }));

    const cache = await open();

    expect(cache.getMeals('2026-06-01')).toBeNull();
  });
});

describe('CacheStore — 모양이 바뀐 옛 파일', () => {
  it('판이 다르면 버린다', async () => {
    /*
     * MealMenu의 칸이 달라진 뒤 옛 파일을 그대로 읽으면 카드가 그리다 죽고,
     * 이 클래스는 안 던지기로 한 자리라 그 죽음이 홈 화면을 통째로 삼킨다.
     * 못 알아보는 판이면 없는 셈 치는 편이 낫다.
     */
    await files.writeAtomic(
      'cache.json',
      JSON.stringify({ version: 99, school: SCHOOL, meals: { '2026-06-01': menu('먼 훗날') } }),
    );

    const cache = await open();

    expect(cache.getMeals('2026-06-01')).toBeNull();
  });
});
