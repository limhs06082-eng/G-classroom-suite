import { type PeriodTime } from '../../shared/domain/types';

/**
 * 지금이 어떤 때인가.
 *
 * 화면과 떼어 둔 까닭은 **경계가 많고 전부 시계에 매여 있기** 때문이다.
 * 교시가 시작하는 순간, 끝나는 순간, 오늘 없는 교시의 시각, 중간이 빈
 * 시간표 — 화면 안에 두면 이것들을 확인할 길이 없다. 여기서는 분 하나만
 * 넘겨주면 되니 전부 확인할 수 있다.
 *
 * 시계를 부르지 않는다. `now`를 받는다.
 */

/** 오늘 그 교시에 무슨 과목인가. `timetableCore.todayPeriods`가 주는 모양이다. */
export interface TodayPeriod {
  period: number;
  subject: string;
}

export type NowState =
  | { kind: 'no-timetable' }
  | { kind: 'before'; period: number; subject: string; startsAt: string; minutesUntil: number }
  | { kind: 'lesson'; period: number; subject: string; minutesLeft: number }
  | { kind: 'break'; period: number; subject: string; minutesUntil: number }
  | { kind: 'lunch' }
  | { kind: 'after' };

/** `"09:00"` → 540. 못 읽으면 null. 던지지 않는다. */
export function minutesOf(hm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (match === null) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
}

/** 점심으로 볼 만큼 긴 틈. 보통 쉬는 시간(10분)의 곱절은 되어야 한다. */
const LUNCH_MIN_GAP = 25;

/**
 * 점심때.
 *
 * 따로 묻지 않는다. 일곱 줄 사이에서 **가장 긴 틈**이 점심이고, 그 틈이
 * 쉬는 시간과 구별될 만큼 길어야 한다. 자료가 이미 말하고 있는 것을
 * 한 번 더 묻지 않는 것이 이 판의 규칙이다.
 */
export function lunchGap(times: PeriodTime[]): { start: number; end: number } | null {
  const sorted = sortable(times);
  let best: { start: number; end: number } | null = null;
  let tied = false;

  for (let index = 0; index + 1 < sorted.length; index += 1) {
    const gapStart = sorted[index]?.endMin;
    const gapEnd = sorted[index + 1]?.startMin;
    if (gapStart === undefined || gapEnd === undefined) continue;

    const length = gapEnd - gapStart;
    if (length < LUNCH_MIN_GAP) continue;

    if (best === null || length > best.end - best.start) {
      best = { start: gapStart, end: gapEnd };
      tied = false;
      continue;
    }

    if (length === best.end - best.start) tied = true;
  }

  /*
   * 가장 긴 틈이 둘이면 어느 쪽이 점심인지 자료가 말해 주지 않는다.
   * 앞엣것을 고르면 아침 아홉 시 오십오 분에 "점심"이라고 말하는 화면이
   * 된다 — 못 읽는 줄 하나가 버려지면서 그 자리에 진짜 점심과 같은 길이의
   * 구멍이 생기는 일이 실제로 있었다. 우기지 않는 편이 낫다.
   */
  return tied ? null : best;
}

interface Row {
  period: number;
  startMin: number;
  endMin: number;
}

/** 읽을 수 있는 줄만, 교시 순으로. 못 읽는 줄은 없는 셈 친다. */
function sortable(times: PeriodTime[]): Row[] {
  const rows: Row[] = [];

  for (const time of times) {
    const startMin = minutesOf(time.start);
    const endMin = minutesOf(time.end);
    if (startMin === null || endMin === null || endMin <= startMin) continue;
    rows.push({ period: time.period, startMin, endMin });
  }

  return rows.sort((a, b) => a.startMin - b.startMin);
}

export function nowState(times: PeriodTime[], today: TodayPeriod[], now: number): NowState {
  const subjects = new Map(today.map((slot) => [slot.period, slot.subject]));
  // 오늘 채운 교시만 본다. 금요일에 한 교시만 있는 반에게 있지도 않은
  // 2교시를 곧 시작한다고 하면 안 된다.
  const rows = sortable(times).filter((row) => subjects.has(row.period));
  if (rows.length === 0) return { kind: 'no-timetable' };

  for (const row of rows) {
    // 시작하는 순간은 수업 중이고, 끝나는 순간은 이미 쉬는 시간이다.
    if (now >= row.startMin && now < row.endMin) {
      return {
        kind: 'lesson',
        period: row.period,
        subject: subjects.get(row.period) ?? '',
        minutesLeft: row.endMin - now,
      };
    }
  }

  const next = rows.find((row) => row.startMin > now);
  if (next === undefined) return { kind: 'after' };

  /*
   * 점심은 쉬는 시간보다 먼저 본다. 점심때에 "다음 5교시까지 40분"이라고
   * 하면 틀린 말은 아니지만, 그 시각에 선생님이 알고 싶은 것은 급식이다.
   */
  const lunch = lunchGap(times);
  if (lunch !== null && now >= lunch.start && now < lunch.end) return { kind: 'lunch' };

  const first = rows[0];
  if (first !== undefined && now < first.startMin) {
    return {
      kind: 'before',
      period: next.period,
      subject: subjects.get(next.period) ?? '',
      startsAt: hmOf(next.startMin),
      minutesUntil: next.startMin - now,
    };
  }

  return {
    kind: 'break',
    period: next.period,
    subject: subjects.get(next.period) ?? '',
    minutesUntil: next.startMin - now,
  };
}

/** 540 → `"09:00"`. */
function hmOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
