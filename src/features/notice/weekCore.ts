import type { ClassEvent } from '../../shared/domain/types';
import { schoolWeekOf } from '../home/todayMeal';

/** YYYY-MM-DD + days. 달을 넘겨도 Date가 되감는다. */
function shift(date: string, days: number): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const moved = new Date(year, month - 1, day + days);
  return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}-${String(moved.getDate()).padStart(2, '0')}`;
}

/**
 * 이번 주·다음 주 월~금.
 *
 * 주말에는 '이번 주'가 이미 다음 주다(schoolWeekOf) — 금요일 저녁이나
 * 일요일에 만드는 주간 안내문은 다음 주 것이다. '다음 주'는 그다음 주.
 */
export function schoolWeek(date: string, which: 'this' | 'next'): string[] {
  const thisWeek = schoolWeekOf(date);
  if (which === 'this') return thisWeek;
  return schoolWeekOf(shift(thisWeek[0] ?? date, 7));
}

/** 기간 안(양끝 포함) 일정, 날짜순. */
export function eventsBetween(
  events: readonly ClassEvent[],
  classId: string,
  from: string,
  to: string,
): ClassEvent[] {
  return events
    .filter((event) => event.classId === classId && event.date >= from && event.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}
