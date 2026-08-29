import { beforeEach, describe, expect, it } from 'vitest';

import type { MealMenu } from '../../src/shared/external/neisParse';
import type { Weather } from '../../src/shared/external/weatherParse';
import { CacheStore } from '../../src/shared/storage/CacheStore';
import { MemoryFileStore } from '../../src/shared/storage/MemoryFileStore';

let files: MemoryFileStore;

const T0 = '2026-06-01T09:00:00.000Z';

function menu(name: string): MealMenu[] {
  return [{ kind: '중식', date: '2026-06-01', dishes: [{ name, allergens: [] }], calories: '' }];
}

/** 온도만 달리해 담는다. 어느 칸이 나왔는지 숫자 하나로 알아보게. */
function weather(temperature: number): Weather {
  return { temperature, low: temperature - 4, high: temperature + 4, code: 1 };
}

beforeEach(() => {
  files = new MemoryFileStore();
});

const SCHOOL = 'E10:7310058';
const OTHER_SCHOOL = 'J10:7530079';

const SEOUL = '서울특별시';
const BUSAN = '부산광역시';

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

describe('CacheStore — 날씨는 한 시간이다', () => {
  /*
   * 급식 시험의 붙박이 시계로는 이 칸을 못 잰다. 급식은 날짜가 열쇠라 담은
   * 시각이 필요 없지만, 날씨는 담고 나서 시간이 흘러야 낡는다.
   */
  let now = T0;

  function advance(minutes: number): void {
    now = new Date(Date.parse(now) + minutes * 60 * 1000).toISOString();
  }

  async function openTicking(school = SCHOOL): Promise<CacheStore> {
    return CacheStore.open(files, school, () => now);
  }

  beforeEach(() => {
    now = T0;
  });

  it('안 담은 지역은 null이다', async () => {
    const cache = await openTicking();

    expect(cache.getWeather(SEOUL)).toBeNull();
  });

  it('담은 것을 꺼낸다', async () => {
    const cache = await openTicking();

    await cache.putWeather(SEOUL, weather(26.4));

    expect(cache.getWeather(SEOUL)?.temperature).toBe(26.4);
  });

  it('59분 뒤에도 그대로다', async () => {
    const cache = await openTicking();
    await cache.putWeather(SEOUL, weather(26.4));

    advance(59);

    expect(cache.getWeather(SEOUL)?.temperature).toBe(26.4);
  });

  it('한 시간이 되면 버린다', async () => {
    const cache = await openTicking();
    await cache.putWeather(SEOUL, weather(26.4));

    /*
     * 딱 한 시간에서 가른다. 오후 두 시 머리띠에 아침 아홉 시 기온이 떠
     * 있으면 교사는 그것이 지금 밖이라고 믿는다 — 낡았다는 표시가 어디에도
     * 없고, 숫자만 보아서는 알 길이 없다.
     */
    advance(60);

    expect(cache.getWeather(SEOUL)).toBeNull();
  });

  it('다른 지역을 물으면 null이다', async () => {
    const cache = await openTicking();

    await cache.putWeather(SEOUL, weather(26.4));

    expect(cache.getWeather(BUSAN)).toBeNull();
  });

  it('지역마다 따로 담긴다', async () => {
    const cache = await openTicking();

    await cache.putWeather(SEOUL, weather(26.4));
    await cache.putWeather(BUSAN, weather(29.1));

    // 한 칸짜리 통이면 뒤에 담은 것이 앞엣것을 덮어 다른 지역 날씨가 뜬다.
    expect(cache.getWeather(SEOUL)?.temperature).toBe(26.4);
    expect(cache.getWeather(BUSAN)?.temperature).toBe(29.1);
  });

  it('다시 열어도 남아 있다', async () => {
    const first = await openTicking();
    await first.putWeather(SEOUL, weather(26.4));

    advance(10);
    const second = await openTicking();

    expect(second.getWeather(SEOUL)?.temperature).toBe(26.4);
  });

  it('다시 열어도 담은 때를 기억한다', async () => {
    const first = await openTicking();
    await first.putWeather(SEOUL, weather(26.4));

    // 앱을 다시 켠 것이 날씨를 새로 받아 온 것은 아니다. 시계는 계속 간다.
    advance(70);
    const second = await openTicking();

    expect(second.getWeather(SEOUL)).toBeNull();
  });

  it('급식과 날씨가 서로를 안 지운다', async () => {
    const first = await openTicking();
    await first.putMeals('2026-06-01', menu('홍국쌀밥'));
    await first.putWeather(SEOUL, weather(26.4));

    const second = await openTicking();

    // 한 파일에 두 칸이 산다. 한쪽을 담는 것이 다른 쪽을 밀어내면 안 된다.
    expect(second.getMeals('2026-06-01')?.[0]?.dishes[0]?.name).toBe('홍국쌀밥');
    expect(second.getWeather(SEOUL)?.temperature).toBe(26.4);
  });

  it('낡은 것은 열 때 파일에서도 지운다', async () => {
    const first = await openTicking();
    await first.putWeather(SEOUL, weather(26.4));

    advance(70);
    await first.putWeather(BUSAN, weather(29.1));
    await openTicking();

    const raw: unknown = JSON.parse((await files.read('cache.json')) ?? '{}');
    const kept = (raw as { weather?: Record<string, unknown> }).weather ?? {};
    expect(Object.keys(kept)).toEqual([BUSAN]);
  });
});

describe('CacheStore — 날씨는 학교 것이 아니다', () => {
  it('학교를 바꿔도 날씨는 안 버린다', async () => {
    const first = await open(T0, SCHOOL);
    await first.putWeather(SEOUL, weather(26.4));

    /*
     * 급식과 갈리는 자리다. 급식은 학교 것이라 학교가 바뀌면 담아 둔 것이
     * 전부 남의 것이 되지만, 하늘은 학교가 아니라 지역 것이다. 같은 지역이면
     * 앞 학교에서 받아 온 숫자가 지금도 맞다.
     */
    const second = await open(T0, OTHER_SCHOOL);

    expect(second.getWeather(SEOUL)?.temperature).toBe(26.4);
  });

  it('학교를 바꾼 뒤 급식을 담아도 앞서 담은 날씨가 파일에 남는다', async () => {
    const first = await open(T0, SCHOOL);
    await first.putWeather(SEOUL, weather(26.4));

    const second = await open(T0, OTHER_SCHOOL);
    await second.putMeals('2026-06-01', menu('새 학교 급식'));

    // 메모리에만 이어 두고 파일에서 흘리면, 다음에 켤 때 없던 일이 된다.
    const raw: unknown = JSON.parse((await files.read('cache.json')) ?? '{}');
    const shape = raw as { school?: string; weather?: Record<string, { value?: Weather }> };
    expect(shape.school).toBe(OTHER_SCHOOL);
    expect(shape.weather?.[SEOUL]?.value?.temperature).toBe(26.4);
  });
});

describe('CacheStore — 날씨 칸이 성해야 꺼낸다', () => {
  /** 이 클래스가 실제로 담는 꼴 그대로 파일을 만든 뒤 날씨 칸만 바꿔치기한다. */
  async function withWeather(entry: unknown): Promise<CacheStore> {
    const first = await open();
    await first.putWeather(SEOUL, weather(26.4));

    /*
     * 판 번호를 시험에 손으로 적지 않는다. 적어 두면 다음에 판이 올라갈 때
     * 이 시험이 딴 까닭으로(판이 안 맞아서) 통과하고, 정작 보려던 것은
     * 아무도 안 보게 된다.
     */
    const shape: unknown = JSON.parse((await files.read('cache.json')) ?? '{}');
    await files.writeAtomic(
      'cache.json',
      JSON.stringify({ ...(shape as object), weather: { [SEOUL]: entry } }),
    );

    return open();
  }

  it('판이 다르면 날씨도 버린다', async () => {
    await files.writeAtomic(
      'cache.json',
      JSON.stringify({
        version: 99,
        school: SCHOOL,
        weather: { [SEOUL]: { at: T0, value: weather(26.4) } },
      }),
    );

    // 학교가 바뀌어도 남기는 칸이지만, 못 알아보는 판이면 얘기가 다르다.
    const cache = await open();

    expect(cache.getWeather(SEOUL)).toBeNull();
  });

  it('파일이 깨져 있으면 날씨 없이 시작한다', async () => {
    await files.writeAtomic('cache.json', '{ 이건 JSON이 아니다');

    const cache = await open();

    expect(cache.getWeather(SEOUL)).toBeNull();
  });

  it('쓰기가 실패해도 메모리에는 남는다', async () => {
    const cache = await open();
    files.failNextWrite = true;

    await cache.putWeather(SEOUL, weather(26.4));

    // 파일에 못 써도 오늘 머리띠에는 날씨가 떠야 한다.
    expect(cache.getWeather(SEOUL)?.temperature).toBe(26.4);
  });

  it('온도가 숫자가 아니면 안 돌려준다', async () => {
    /*
     * `parseWeather`가 숫자 넷인지 확인해 두는데, 파일을 거쳐 오면서 그
     * 확인이 풀리면 안 된다. 이 파일은 교사 컴퓨터에 그냥 놓인 글자라 반쯤
     * 덮여 쓰이거나 손으로 고쳐질 수 있고, 그러면 머리띠에 `NaN°`가 뜬다 —
     * 던지지도 않고, 틀렸다는 표시도 없이. 판 번호가 걸러 주는 것은 우리가
     * 올린 변경뿐이다.
     */
    const cache = await withWeather({
      at: T0,
      value: { temperature: '26.4', low: 22, high: 30, code: 1 },
    });

    expect(cache.getWeather(SEOUL)).toBeNull();
  });

  it('담은 때가 없으면 안 돌려준다', async () => {
    // 언제 받았는지 모르는 숫자는 낡았는지 알 길이 없다. 안 담은 것과 같다.
    const cache = await withWeather({ value: weather(26.4) });

    expect(cache.getWeather(SEOUL)).toBeNull();
  });

  it('담은 때가 앞날이면 안 믿는다', async () => {
    /*
     * 교실 컴퓨터는 시각이 틀어진 채 켜지는 일이 있고(메인보드 전지가 닳으면
     * 그렇게 된다), 뒤늦게 맞추면 담은 때가 앞날로 남는다. 나이만 재고 부호를
     * 안 보면 그 칸은 한 시간이 아니라 그날이 올 때까지 안 낡는다.
     */
    const cache = await withWeather({ at: '2027-06-01T09:00:00.000Z', value: weather(26.4) });

    expect(cache.getWeather(SEOUL)).toBeNull();
  });

  it('0°C와 맑음도 그대로 나온다', async () => {
    const first = await open();
    await first.putWeather(SEOUL, { temperature: 0, low: -3, high: 0, code: 0 });

    /*
     * 되읽을 때 참·거짓으로 걸렀다간 이 둘이 사라진다. 겨울 아침 0°C와
     * WMO 0(맑음)은 가장 자주 오는 값인데 하필 거짓 같은 값이라, 잘못
     * 걸러도 코드에는 이상한 데가 없어 보인다 — 겨울과 맑은 날에만 머리띠가
     * 빈다.
     */
    const second = await open();

    expect(second.getWeather(SEOUL)).toEqual({ temperature: 0, low: -3, high: 0, code: 0 });
  });
});
