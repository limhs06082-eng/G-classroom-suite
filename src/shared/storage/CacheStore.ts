import type { MealMenu } from '../external/neisParse';
import type { FileStore } from './FileStore';

/** 며칠 치를 남길 것인가. 지난주 급식을 볼 일은 없지만, 끊긴 날을 넘길 만큼은 든다. */
const KEEP_DAYS = 7;

interface CacheShape {
  meals: Record<string, MealMenu[]>;
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

  private constructor(
    private readonly files: FileStore,
    private readonly clock: () => string,
  ) {}

  static async open(files: FileStore, clock?: () => string): Promise<CacheStore> {
    const store = new CacheStore(files, clock ?? (() => new Date().toISOString()));

    const raw = await files.read('cache.json');
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        const meals = (parsed as CacheShape | null)?.meals;
        if (typeof meals === 'object' && meals !== null) {
          for (const [date, value] of Object.entries(meals)) {
            if (Array.isArray(value)) store.meals.set(date, value as MealMenu[]);
          }
        }
      } catch {
        // 깨졌으면 없는 셈 친다. 다시 받으면 된다.
      }
    }

    // 열 때 한 번 치운다. 안 그러면 파일이 한 해 내내 커진다.
    const dropped = store.forget();
    if (dropped > 0) await store.persist();

    return store;
  }

  /** 오래된 날짜를 버린다. 버린 개수를 돌려준다. */
  private forget(): number {
    const limit = this.oldestKept();
    let dropped = 0;

    for (const date of [...this.meals.keys()]) {
      if (date < limit) {
        this.meals.delete(date);
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

  getMeals(date: string): MealMenu[] | null {
    if (date < this.oldestKept()) return null;
    return this.meals.get(date) ?? null;
  }

  async putMeals(date: string, meals: MealMenu[]): Promise<void> {
    this.meals.set(date, meals);
    await this.persist();
  }

  private async persist(): Promise<void> {
    const shape: CacheShape = { meals: Object.fromEntries(this.meals) };

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
