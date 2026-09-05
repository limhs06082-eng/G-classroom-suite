import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { useNow } from '../../shared/state/useNow';
import { useToday } from '../../shared/state/useToday';
import { nowState } from '../now/nowCore';
import { effectivePeriods, weekdayOf } from '../timetable/timetableCore';
import { usePeriodChime } from './usePeriodChime';

/**
 * 수업 끝 알림음 — 앱 셸에 하나.
 *
 * 어느 화면에 있든 선생님 컴퓨터(이 창)에서 한 번 울린다. 칠판 창(/board/*)은
 * 셸 밖의 딴 창이라 여기 없고, 그래서 조용하다 — 창마다 울리면 같은 스피커로
 * 두 번 울린다. 잎 컴포넌트라 매분 다시 그려도 셸은 그대로다.
 */
export function PeriodChime() {
  const { data } = useSuite();
  const activeClass = useActiveClass();
  const date = useToday();
  const minutes = useNow();
  const [year = 0, month = 0, day = 0] = date.split('-').map(Number);
  const weekday = weekdayOf(new Date(year, month - 1, day));
  const periods =
    activeClass === null || weekday === 0
      ? []
      : effectivePeriods(data.timetableEntries, data.timetableOverrides, activeClass.id, date, weekday);

  usePeriodChime(nowState(data.periodTimes, periods, minutes), date);
  return null;
}
