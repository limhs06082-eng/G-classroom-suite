import type { ClassEvent } from '../../shared/domain/types';

/**
 * 학급 일정 판단.
 *
 * 시계를 부르지 않는다. 오늘(YYYY-MM-DD)을 받아 D-day를 센다.
 * ISO 날짜는 사전순이 곧 시간순이라 글자 비교로 충분하다.
 */

/** `"2026-08-29"` → 이 지역 자정 Date. `new Date('YYYY-MM-DD')`는 UTC라 쓰지 않는다. */
function localDate(date: string): Date {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** 오늘부터 며칠 뒤인가. 오늘이면 0, 지났으면 음수. */
export function daysUntil(today: string, date: string): number {
  const ms = localDate(date).getTime() - localDate(today).getTime();
  return Math.round(ms / 86_400_000);
}

/** "D-3" · "D-day" · "3일 지남" */
export function ddayLabel(today: string, date: string): string {
  const days = daysUntil(today, date);
  if (days === 0) return 'D-day';
  if (days > 0) return `D-${days}`;
  return `${-days}일 지남`;
}

/** 오늘 이후(오늘 포함) 일정, 가까운 순. */
export function upcomingEvents(
  events: readonly ClassEvent[],
  classId: string,
  today: string,
  limit = Number.POSITIVE_INFINITY,
): ClassEvent[] {
  return events
    .filter((event) => event.classId === classId && event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit);
}

/** 그날 일정. 오늘 보드·알림장 칠판이 쓴다. */
export function eventsOn(
  events: readonly ClassEvent[],
  classId: string,
  date: string,
): ClassEvent[] {
  return events
    .filter((event) => event.classId === classId && event.date === date)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** 지난 일정, 최근 것부터. 학기말 돌아보기용. */
export function pastEvents(
  events: readonly ClassEvent[],
  classId: string,
  today: string,
): ClassEvent[] {
  return events
    .filter((event) => event.classId === classId && event.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));
}
