import { useEffect, useState } from 'react';

import { hasSchool } from '../../shared/domain/school';
import { useSuite } from '../../shared/roster/SuiteDataProvider';
import { useToday } from '../../shared/state/useToday';
import type { MealState } from './MealCard';
import { loadTodayMeal } from './todayMeal';

/**
 * 오늘 급식을 받아 온다.
 *
 * 캐시를 먼저 보고, 없으면 NEIS에 묻는다. 학교 인터넷은 끊긴다 —
 * 어제 받아 둔 것이 있으면 그날도 보인다.
 *
 * **설치형에서만 부른다.** NEIS가 `Access-Control` 헤더를 안 줘서 브라우저는
 * 직접 못 부르고, 그 제약은 우리가 어쩔 수 없다. Tauri 조각은 전부 동적
 * import라 웹 번들에는 실리지 않지만, 부르는 쪽이 `isDesktop()` 뒤에 서는
 * 것까지가 약속이다.
 *
 * 홈의 급식 카드와 오늘 보드(/board/today)가 함께 쓴다.
 */
export function useTodayMeal(): MealState {
  const { data } = useSuite();
  const [state, setState] = useState<MealState>({ kind: 'loading' });

  const officeCode = data.profile.officeCode ?? '';
  const schoolCode = data.profile.schoolCode ?? '';

  const date = useToday();

  useEffect(() => {
    // 학교가 없으면 여기서 끝낸다. 물을 데가 없는데 Tauri 조각을 들일 이유가 없다.
    if (!hasSchool(officeCode, schoolCode)) {
      setState({ kind: 'no-school' });
      return;
    }

    let cancelled = false;
    setState({ kind: 'loading' });

    void (async () => {
      const [{ NeisSource }, { TauriHttpClient }, { CacheStore }, { TauriFileStore }] =
        await Promise.all([
          import('../../shared/external/NeisSource'),
          import('../../shared/external/TauriHttpClient'),
          import('../../shared/storage/CacheStore'),
          import('../../shared/storage/TauriFileStore'),
        ]);

      // 캐시에 임자를 달아 연다. 학교를 고치면 앞 학교 급식은 통째로 버려진다.
      const cache = await CacheStore.open(new TauriFileStore(), `${officeCode}:${schoolCode}`);

      const next = await loadTodayMeal(
        cache,
        new NeisSource(new TauriHttpClient()),
        officeCode,
        schoolCode,
        date,
      );

      if (!cancelled) setState(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [officeCode, schoolCode, date]);

  return state;
}

/**
 * 이번 주 급식. 카드에서 '이번 주'를 펼쳤을 때만(enabled) 받아 온다.
 *
 * 캐시가 7일치라 대개는 NEIS를 새로 두드리지 않는다. 설치형에서만
 * 부른다 — useTodayMeal과 같은 약속이다.
 */
export function useWeekMeals(
  enabled: boolean,
): Array<{ date: string; state: MealState }> | null {
  const { data } = useSuite();
  const [week, setWeek] = useState<Array<{ date: string; state: MealState }> | null>(null);

  const officeCode = data.profile.officeCode ?? '';
  const schoolCode = data.profile.schoolCode ?? '';
  const date = useToday();

  useEffect(() => {
    if (!enabled || !hasSchool(officeCode, schoolCode)) {
      setWeek(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const [{ NeisSource }, { TauriHttpClient }, { CacheStore }, { TauriFileStore }, meals] =
        await Promise.all([
          import('../../shared/external/NeisSource'),
          import('../../shared/external/TauriHttpClient'),
          import('../../shared/storage/CacheStore'),
          import('../../shared/storage/TauriFileStore'),
          import('./todayMeal'),
        ]);

      const cache = await CacheStore.open(new TauriFileStore(), `${officeCode}:${schoolCode}`);
      const next = await meals.loadWeekMeals(
        cache,
        new NeisSource(new TauriHttpClient()),
        officeCode,
        schoolCode,
        meals.schoolWeekOf(date),
      );

      if (!cancelled) setWeek(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, officeCode, schoolCode, date]);

  return week;
}
