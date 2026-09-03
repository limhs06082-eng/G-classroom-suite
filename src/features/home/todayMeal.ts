import { hasSchool } from '../../shared/domain/school';
import type { MealMenu } from '../../shared/external/neisParse';
import type { MealState } from './MealCard';

/**
 * 급식을 담아 두는 곳. `CacheStore`가 이 모양이다.
 *
 * 구체 타입 대신 모양만 받는 까닭이 둘이다. 첫째, 이 파일에 Tauri를
 * 건드리는 모듈이 하나도 안 들어온다 — 들어오면 웹 묶음에 섞인다.
 * 둘째, 시험이 메모리 대역을 그대로 끼울 수 있다.
 */
export interface MealCache {
  getMeals(date: string): MealMenu[] | null;
  putMeals(date: string, meals: MealMenu[]): Promise<void>;
}

/** 급식을 받아 오는 곳. `NeisSource`가 이 모양이다. */
export interface MealSource {
  fetchMeals(officeCode: string, schoolCode: string, date: string): Promise<MealMenu[]>;
}

/**
 * 오늘 급식이 어떤 상태인지 정한다.
 *
 * 카드 그리기와 떼어 둔 까닭은 **이 판단이 그리기보다 틀리기 쉽기**
 * 때문이다. 캐시에 있는 것과 아직 안 물어본 것, 방학이라 빈 것과 못
 * 받아 온 것이 전부 여기서 갈린다. 효과 안에 붙여 두면 이 갈림을
 * 시험할 길이 없어, 정작 틀리기 쉬운 자리만 확인 없이 나간다.
 */
export async function loadTodayMeal(
  cache: MealCache,
  source: MealSource,
  officeCode: string,
  schoolCode: string,
  date: string,
): Promise<MealState> {
  if (!hasSchool(officeCode, schoolCode)) return { kind: 'no-school' };

  /*
   * 빈 배열은 '물어봤더니 없더라'다. null이라야 '아직 안 물어봤다'다.
   * 이 둘을 같이 보면 방학 내내 NEIS를 두드린다.
   */
  const cached = cache.getMeals(date);
  if (cached !== null) return { kind: 'ready', meals: cached };

  let meals: MealMenu[];
  try {
    meals = await source.fetchMeals(officeCode, schoolCode, date);
  } catch {
    // 조용히 빈 카드로 두지 않는다. 왜 비었는지 말해 줘야 한다.
    return { kind: 'failed' };
  }

  try {
    await cache.putMeals(date, meals);
  } catch {
    // 담다 실패한 것이지 못 받아 온 것이 아니다. 오늘 화면에는 떠야 한다.
  }

  return { kind: 'ready', meals };
}

/**
 * 이번 주 급식 — 날짜마다 loadTodayMeal을 그대로 쓴다.
 *
 * 캐시가 7일치라 두 번째부터는 NEIS를 안 두드린다. 차례로 묻는 까닭은
 * NEIS가 한꺼번에 다섯 요청을 받으면 한도에 걸리는 날이 있어서다 —
 * 하나 실패해도 나머지는 그대로 보인다.
 */
export async function loadWeekMeals(
  cache: MealCache,
  source: MealSource,
  officeCode: string,
  schoolCode: string,
  dates: readonly string[],
): Promise<Array<{ date: string; state: MealState }>> {
  const out: Array<{ date: string; state: MealState }> = [];
  for (const date of dates) {
    out.push({ date, state: await loadTodayMeal(cache, source, officeCode, schoolCode, date) });
  }
  return out;
}

/** 그 날짜가 든 주의 월~금. 주말이면 다음 주다 — 일요일 저녁에 보는 것은 다음 주 급식이다. */
export function schoolWeekOf(date: string): string[] {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const base = new Date(year, month - 1, day);
  const dow = base.getDay(); // 0=일
  const offsetToMonday = dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow;
  const monday = new Date(year, month - 1, day + offsetToMonday);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}
