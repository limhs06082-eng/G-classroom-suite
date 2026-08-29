import type { MealMenu } from '../external/neisParse';
import type { Weather } from '../external/weatherParse';
import type { FileStore } from './FileStore';

/** 며칠 치를 남길 것인가. 지난주 급식을 볼 일은 없지만, 끊긴 날을 넘길 만큼은 든다. */
const KEEP_DAYS = 7;

/**
 * 날씨를 얼마나 쥐고 있을 것인가.
 *
 * open-meteo는 시간 단위로 갱신하니 그보다 자주 물어도 같은 숫자가 온다.
 * 반대로 더 오래 쥐면 오후 머리띠에 아침 기온이 뜨는데, 숫자만 보아서는
 * 낡은 것인지 알 길이 없다. 급식처럼 '오늘 것이냐'로 가를 수 없는 까닭이
 * 이것이다 — 같은 날 안에서도 낡는다.
 */
const WEATHER_TTL_MS = 60 * 60 * 1000;

/**
 * 담긴 것의 모양이 바뀌면 올린다.
 *
 * 옛 파일을 새 코드로 읽으면 `MealMenu`의 칸이 달라 화면이 그리다 죽는다.
 * 이 클래스는 던지지 않기로 한 자리라 그 죽음이 홈 화면 전체를 삼킨다.
 * 못 알아보는 판이면 없는 셈 치는 편이 낫다 — 다시 받으면 그만이다.
 */
const VERSION = 1;

/** 담아 둔 날씨 한 칸. 받은 때를 함께 둬야 낡았는지 잴 수 있다. */
interface WeatherEntry {
  at: string;
  value: Weather;
}

interface CacheShape {
  version: number;
  /** 이 캐시가 누구 것인가. 학교가 바뀌면 담아 둔 급식은 전부 남의 것이다. */
  school: string;
  meals: Record<string, MealMenu[]>;
  /**
   * 지역 이름 → 받아 온 것과 받은 때.
   *
   * 급식과 열쇠도 목숨도 다르다. 급식은 날짜가 열쇠라 날이 지나면 뜻이
   * 없지만, 날씨는 지역이 열쇠고 한 시간이면 낡는다. `school` 옆에
   * 살면서도 학교가 바뀔 때 안 버리는 유일한 칸인 까닭도 그것이다.
   */
  weather?: Record<string, WeatherEntry>;
}

/**
 * 숫자만 통과시킨다.
 *
 * 참·거짓으로 검사하면 안 되는 자리다. 0°C와 WMO 0(맑음)은 거짓 같은
 * 값이고, 하필 그 둘이 가장 자주 온다.
 */
function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 파일에서 읽은 날씨 한 칸을 되살린다. 모양이 어긋나면 null.
 *
 * `parseWeather`가 숫자 넷인지 확인해 두는데, 파일을 거쳐 오면서 그 확인이
 * 풀리면 안 된다. 판 번호가 걸러 주는 것은 우리가 올린 변경뿐이고, 이
 * 파일은 교사 컴퓨터에 그냥 놓인 글자라 반쯤 덮여 쓰이거나 손으로 고쳐질
 * 수 있다. 그때 머리띠에 뜨는 것은 `NaN°`다 — 던지지도 않고, 틀렸다는
 * 표시도 없이. 급식은 못 그리면 카드 한 칸이 비지만 날씨는 모든 화면에
 * 늘 있는 자리라, 여기서 한 번 더 본다.
 */
function entryOf(raw: unknown): WeatherEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = raw as { at?: unknown; value?: unknown };

  if (typeof entry.at !== 'string') return null;
  if (typeof entry.value !== 'object' || entry.value === null) return null;

  const { temperature, low, high, code } = entry.value as {
    temperature?: unknown;
    low?: unknown;
    high?: unknown;
    code?: unknown;
  };

  if (!finiteNumber(temperature)) return null;
  if (!finiteNumber(low) || !finiteNumber(high) || !finiteNumber(code)) return null;

  return { at: entry.at, value: { temperature, low, high, code } };
}

/**
 * 급식·날씨처럼 다시 받으면 그만인 것을 담는다.
 *
 * `data.json`과 갈라 두는 이유가 둘이다. 첫째, 백업 파일에 지난주 급식이
 * 섞이면 안 된다. 둘째, 오래되면 버려야 하는데 학급 자료는 그러면 안 된다.
 * 기준이 다르면 파일도 달라야 한다.
 *
 * **여기서 던지지 않는다.** 캐시가 깨졌다고 앱이 안 뜨면 안 된다.
 * 못 읽으면 없는 셈 치고 다시 받는다.
 */
export class CacheStore {
  private meals = new Map<string, MealMenu[]>();
  private weather = new Map<string, WeatherEntry>();

  private constructor(
    private readonly files: FileStore,
    private readonly school: string,
    private readonly clock: () => string,
  ) {}

  /** `school`은 이 캐시의 임자다. 부르는 쪽이 시도코드와 학교코드를 엮어 넘긴다. */
  static async open(
    files: FileStore,
    school: string,
    clock?: () => string,
  ): Promise<CacheStore> {
    const store = new CacheStore(files, school, clock ?? (() => new Date().toISOString()));

    const raw = await files.read('cache.json');
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        const shape = parsed as Partial<CacheShape> | null;

        if (shape?.version === VERSION) {
          /*
           * 담을 때의 학교와 지금 학교가 다르면 급식은 통째로 버린다. 날짜만
           * 열쇠로 삼으면 학교를 고친 뒤에도 앞 학교 급식이 뜨는데, 캐시에
           * 있으니 새 학교에 묻지도 않는다. 이름만 바뀌고 급식은 그대로인
           * 화면이 된다. 검색에서 같은 이름의 다른 학교를 골랐다가 고치는
           * 일은 흔하다.
           */
          const meals = shape.school === school ? shape.meals : undefined;
          if (typeof meals === 'object' && meals !== null) {
            for (const [date, value] of Object.entries(meals)) {
              if (Array.isArray(value)) store.meals.set(date, value);
            }
          }

          /*
           * 날씨는 학교가 바뀌어도 안 버린다. 하늘은 학교 것이 아니라 지역
           * 것이라, 지역이 같으면 앞 학교에서 받아 온 숫자가 지금도 맞다.
           * 버려 봐야 같은 답을 한 번 더 물을 뿐이다.
           */
          const weather = shape.weather;
          if (typeof weather === 'object' && weather !== null) {
            for (const [region, value] of Object.entries(weather)) {
              const entry = entryOf(value);
              if (entry !== null) store.weather.set(region, entry);
            }
          }
        }
      } catch {
        // 깨졌으면 없는 셈 친다. 다시 받으면 된다.
      }
    }

    // 열 때 한 번 치운다. 안 그러면 파일이 한 해 내내 커진다.
    const dropped = store.forget();
    if (dropped > 0) await store.persist(false);

    return store;
  }

  /** 오래된 것을 버린다. 버린 개수를 돌려준다. */
  private forget(): number {
    const limit = this.oldestKept();
    let dropped = 0;

    for (const date of [...this.meals.keys()]) {
      if (date < limit) {
        this.meals.delete(date);
        dropped += 1;
      }
    }

    for (const [region, entry] of [...this.weather]) {
      if (!this.isFresh(entry.at)) {
        this.weather.delete(region);
        dropped += 1;
      }
    }

    return dropped;
  }

  /** 이 날짜보다 앞선 것은 버린다. `YYYY-MM-DD`라 글자 비교로 충분하다. */
  private oldestKept(): string {
    const now = new Date(this.clock());
    now.setDate(now.getDate() - KEEP_DAYS);
    return now.toISOString().slice(0, 10);
  }

  /**
   * 아직 쓸 수 있는 시각인가.
   *
   * 급식처럼 글자 비교로는 못 잰다 — 날짜가 아니라 시각이라 자정을 넘지
   * 않고도 낡는다.
   *
   * 부호까지 보는 까닭은 앞날에 담긴 칸 때문이다. 교실 컴퓨터는 시각이
   * 틀어진 채 켜지는 일이 있고(메인보드 전지가 닳으면 그렇다), 뒤늦게
   * 맞추면 담은 때가 앞날로 남는다. 나이만 재면 그 칸은 한 시간이 아니라
   * 그날이 올 때까지 안 낡는다.
   *
   * 읽을 수 없는 시각도 낡은 것으로 친다. `Date.parse`가 NaN을 주고 NaN
   * 비교는 늘 거짓이라 저절로 그렇게 된다.
   */
  private isFresh(at: string): boolean {
    const age = Date.parse(this.clock()) - Date.parse(at);
    return age >= 0 && age < WEATHER_TTL_MS;
  }

  getMeals(date: string): MealMenu[] | null {
    if (date < this.oldestKept()) return null;
    return this.meals.get(date) ?? null;
  }

  async putMeals(date: string, meals: MealMenu[]): Promise<void> {
    this.meals.set(date, meals);
    await this.persist(true);
  }

  /**
   * 지역 이름이 열쇠다. 학교가 아니다 — 같은 지역이면 어느 학교에서 받아
   * 왔든 같은 하늘이다.
   */
  getWeather(regionName: string): Weather | null {
    const entry = this.weather.get(regionName);
    if (entry === undefined || !this.isFresh(entry.at)) return null;
    return entry.value;
  }

  async putWeather(regionName: string, weather: Weather): Promise<void> {
    // 받은 때를 함께 담는다. 이것이 없으면 낡았는지 잴 방법이 없다.
    this.weather.set(regionName, { at: this.clock(), value: weather });
    await this.persist(true);
  }

  /** 파일에 지금 담긴 것. 못 읽으면 null. 던지지 않는다. */
  private async readShape(): Promise<CacheShape | null> {
    try {
      const raw = await this.files.read('cache.json');
      if (raw === null) return null;

      const parsed: unknown = JSON.parse(raw);
      const shape = parsed as Partial<CacheShape> | null;
      if (shape === null || typeof shape !== 'object') return null;

      return {
        version: typeof shape.version === 'number' ? shape.version : -1,
        school: typeof shape.school === 'string' ? shape.school : '',
        meals: typeof shape.meals === 'object' && shape.meals !== null ? shape.meals : {},
        weather: typeof shape.weather === 'object' && shape.weather !== null ? shape.weather : {},
      };
    } catch {
      // 못 읽으면 얹을 것이 없는 셈 친다. 내 것만 쓴다.
      return null;
    }
  }

  /**
   * 담긴 것을 파일에 남긴다.
   *
   * **쓰기 직전에 파일을 다시 읽어 얹는다.** 급식과 날씨가 이 파일 하나를
   * 나눠 쓰는데, 둘은 각자 `open()`해서 각자 들고 있다. 그냥 제 것만 쓰면
   * 이런 일이 난다 — 날씨 쪽이 08:00에 열어(그때 급식은 어제 것) 급식 카드가
   * 08:01에 오늘 급식을 담고, 08:02에 날씨가 쓰면서 급식을 어제 것으로
   * 되돌린다. 창이 없어진 것도 아닌데 담아 둔 것이 사라진다.
   *
   * 잃을 것이 큰 자료는 아니지만(다시 받으면 그만이다), 인터넷이 끊긴 날
   * 보여 주려고 담아 두는 것이라 조용히 지워지면 담아 두는 뜻이 없다.
   *
   * 임자나 판이 다르면 안 얹는다. 그건 남의 파일이다.
   */
  private async persist(merge: boolean): Promise<void> {
    /*
     * 열 때 낡은 것을 치우고 쓰는 길에서는 얹지 않는다(`merge === false`).
     * 그때 내 손 안의 값은 **방금 읽은 파일에서 버릴 것을 뺀 것**이라, 얹으면
     * 방금 버린 것이 그대로 되살아난다. 치우는 일 자체가 무의미해진다.
     */
    const onDisk = merge ? await this.readShape() : null;
    const mergeable = onDisk !== null && onDisk.version === VERSION && onDisk.school === this.school;

    const shape: CacheShape = {
      version: VERSION,
      school: this.school,
      // 내 것이 이긴다. 내 것은 열 때 파일에서 읽어 온 것에 이번 것을 더한 값이다.
      meals: { ...(mergeable ? onDisk.meals : {}), ...Object.fromEntries(this.meals) },
      weather: { ...(mergeable ? onDisk.weather : {}), ...Object.fromEntries(this.weather) },
    };

    try {
      await this.files.writeAtomic('cache.json', JSON.stringify(shape));
    } catch {
      /*
       * 못 써도 조용히 넘어간다. 캐시를 파일에 못 남긴 것이지 오늘 급식을
       * 못 보는 것은 아니다. 메모리에는 들어 있다. 자료 저장 실패와 달리
       * 선생님께 알릴 일이 아니다 — 잃을 것이 없다.
       */
    }
  }
}
