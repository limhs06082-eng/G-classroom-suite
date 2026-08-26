import type { TimetableEntry } from '../../shared/domain/types';
import { COMMON_SUBJECTS } from '../../shared/subjects';

/**
 * 시간표 판단.
 *
 * 화면(설정 탭·홈 카드) 둘이 같은 규칙을 봐야 하고, 규칙이 화면 안에 있으면
 * "찬 칸에 다시 찍으면?" 같은 경계를 확인할 수 없다. 그래서 여기로 뺐다.
 * 저장소도 시계도 부르지 않는다 — 시계는 weekdayOf가 받는 Date뿐이다.
 */

/** 표의 가로줄. 초등 시간표에 주말은 없다. */
export const WEEKDAY_NAMES = ['월', '화', '수', '목', '금'] as const;

/**
 * 처음에 보여 줄 과목.
 *
 * `COMMON_SUBJECTS`를 그대로 쓴다. 같은 초등 교과 목록을 여기 한 벌 더 적어
 * 두면 둘이 갈라지는 날이 온다 — 수업 흐름에서 고르는 과목과 시간표에 찍는
 * 과목이 학교 안에서 다른 것일 리 없다.
 *
 * 이 목록은 고학년에 맞춰져 있다. 저학년의 `즐거운생활`·`바른생활`·
 * `슬기로운생활`은 여기 없는데, 한 벌로 두 쪽을 다 덮으면 단추가 열다섯 개가
 * 되어 고르기가 더 어려워진다. 대신 직접 입력한 과목이 단추가 된다.
 */
export const DEFAULT_SUBJECTS: readonly string[] = COMMON_SUBJECTS;

/** 이 학급 것만 고른다. 시간표는 학급마다 한 벌이다. */
function mine(entries: TimetableEntry[], classId: string): TimetableEntry[] {
  return entries.filter((entry) => entry.classId === classId);
}

/**
 * 고를 수 있는 과목.
 *
 * 기본 목록에 **이 시간표에 이미 쓰인 과목**을 더한다. 저학년 담임이
 * `즐거운생활`을 한 번 치면 그 뒤로는 단추다. 기본 목록이 자기 학년에
 * 안 맞는 문제가 한 번의 타이핑으로 끝나고, 그 뒤로는 안 겪는다.
 */
export function subjectButtons(entries: TimetableEntry[], classId: string): string[] {
  const seen = new Set<string>(DEFAULT_SUBJECTS);
  const extra: string[] = [];

  for (const entry of mine(entries, classId)) {
    // 국어를 여섯 칸에 찍는 것이 보통이다. seen에 넣어 두지 않으면
    // 찍은 횟수만큼 같은 단추가 늘어난다.
    if (entry.subject === '' || seen.has(entry.subject)) continue;
    seen.add(entry.subject);
    extra.push(entry.subject);
  }

  return [...DEFAULT_SUBJECTS, ...extra];
}

/** 그 칸의 과목. 빈 칸은 빈 글자다 — 그날 그 교시가 없다는 뜻이다. */
export function cellSubject(
  entries: TimetableEntry[],
  classId: string,
  weekday: number,
  period: number,
): string {
  const found = mine(entries, classId).find(
    (entry) => entry.weekday === weekday && entry.period === period,
  );
  return found?.subject ?? '';
}

/**
 * 칸을 찍는다. 바뀐 목록을 돌려준다.
 *
 * 같은 과목을 다시 찍으면 지워진다. **지우개를 따로 두지 않는 것이 뜻이다** —
 * 잘못 찍었을 때 되돌리는 길이 방금 누른 그 자리에 있어야 한다.
 *
 * 넘겨받은 목록은 건드리지 않는다. 화면은 이 결과를 `update()`에 그대로
 * 넣으므로, 원본을 고치면 React가 같은 배열을 보고 다시 그리지 않는다.
 */
export function paintCell(
  entries: TimetableEntry[],
  classId: string,
  weekday: number,
  period: number,
  subject: string,
): TimetableEntry[] {
  // 먼저 읽고 그다음에 지운다. 지운 목록에서 읽으면 늘 빈 글자가 나와
  // '같은 과목을 다시 찍으면 지운다'가 통째로 죽는다.
  const already = cellSubject(entries, classId, weekday, period);

  const rest = entries.filter(
    (entry) =>
      entry.classId !== classId || entry.weekday !== weekday || entry.period !== period,
  );

  // 빈 과목은 지우기다. 빈 글자 항목이 남으면 '그 교시가 없다'와
  // '과목을 안 적었다'가 구별되지 않는다.
  if (subject === '' || subject === already) return rest;

  // rest에서 그 칸을 이미 뺐으므로, 찬 칸에 다른 과목을 찍으면 겹치지 않고 바뀐다.
  return [...rest, { classId, weekday, period, subject }];
}

/**
 * 그 요일에 채워진 교시를 순서대로.
 *
 * 주말(0)은 저절로 빈 목록이 된다 — 자료에 담기는 요일은 1~5뿐이라
 * 0과 맞는 칸이 애초에 없다. 중간이 빈 교시는 메우지 않는다. 빈 것은
 * 자료가 빠진 게 아니라 그 교시가 없다는 뜻이다.
 */
export function todayPeriods(
  entries: TimetableEntry[],
  classId: string,
  weekday: number,
): { period: number; subject: string }[] {
  return (
    mine(entries, classId)
      .filter((entry) => entry.weekday === weekday)
      // sort는 제자리에서 뒤집는다. 여기 오는 배열은 filter가 만든 새것이라
      // 넘겨받은 목록은 안 흔들린다.
      .sort((a, b) => a.period - b.period)
      .map((entry) => ({ period: entry.period, subject: entry.subject }))
  );
}

/**
 * 월=1 … 금=5, 주말은 0.
 *
 * `getDay()`를 그대로 쓰면 월요일이 1이 되는 것까지는 맞지만 일요일이 0이라
 * '요일 없음'과 구별되지 않고, 토요일은 6으로 남아 없는 칸을 찾게 된다.
 * 주말을 0 하나로 모은다.
 */
export function weekdayOf(date: Date): number {
  const day = date.getDay();
  return day >= 1 && day <= 5 ? day : 0;
}
