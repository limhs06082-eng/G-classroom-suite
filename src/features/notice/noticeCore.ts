import type { Assignment, DailyNotice, NoticeItem } from '../../shared/domain/types';
import { shortDate } from './eventsCore';

/**
 * 알림장을 문자·앱에 붙여 넣을 한 덩어리 글로.
 *
 * e알리미·카톡·하이클래스에 매일 붙여 넣는 담임에게 인쇄는 답이 아니다.
 * 번호는 항목과 과제를 이어 매긴다 — 받는 쪽은 그냥 "오늘 알림장"이다.
 */
export function noticeText(input: {
  className: string;
  date: string;
  items: readonly { text: string }[];
  dueSoon: readonly { title: string; dueDate: string }[];
  events: readonly string[];
}): string {
  const lines: string[] = [`[${input.className} 알림장] ${shortDate(input.date)}`];
  let n = 0;
  for (const item of input.items) lines.push(`${(n += 1)}. ${item.text}`);
  for (const assignment of input.dueSoon) {
    lines.push(`${(n += 1)}. (${assignment.dueDate === input.date ? '오늘까지' : '내일까지'}) ${assignment.title}`);
  }
  if (input.events.length > 0) {
    lines.push('', '다가오는 일정');
    for (const event of input.events) lines.push(`· ${event}`);
  }
  return lines.join('\n');
}

/**
 * 알림장 판단.
 *
 * 알림장은 날짜·학급마다 한 장이다. 내일까지인 과제는 여기 저장하지 않고
 * `assignmentsDueSoon`이 그때그때 계산한다 — 과제 자료를 베껴 두면
 * 과제 쪽만 고쳐지는 날이 온다.
 */

/** 그날 알림장 항목. 없으면 빈 목록이다. */
export function itemsFor(
  notices: readonly DailyNotice[],
  classId: string,
  date: string,
): NoticeItem[] {
  const found = notices.find((notice) => notice.classId === classId && notice.date === date);
  return found?.items ?? [];
}

/**
 * 그날 항목을 통째로 바꾼다. 바뀐 목록을 돌려준다.
 *
 * 빈 목록이면 그날 기록 자체를 지운다 — 아무것도 안 적은 날의 빈 껍데기가
 * 파일에 쌓이면 안 된다(출결과 같은 규칙).
 */
export function setItems(
  notices: readonly DailyNotice[],
  classId: string,
  date: string,
  items: NoticeItem[],
): DailyNotice[] {
  const rest = notices.filter((notice) => notice.classId !== classId || notice.date !== date);
  if (items.length === 0) return rest;
  return [...rest, { classId, date, items }];
}

/** `"2026-08-29"` + 1일. 달을 넘겨도 Date가 알아서 되감는다. */
function nextDay(date: string): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const moved = new Date(year, month - 1, day + 1);
  return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}-${String(moved.getDate()).padStart(2, '0')}`;
}

/**
 * 알림장에 자동으로 붙는 과제 — 오늘·내일 마감, 진행 중(active)만.
 *
 * 마감(closed)·보관(archived)은 이미 지나간 이야기라 종례에 알릴 것이
 * 아니다. 오늘 마감이 앞에 온다.
 */
export function assignmentsDueSoon(
  assignments: readonly Assignment[],
  classId: string,
  today: string,
): Assignment[] {
  const tomorrow = nextDay(today);

  return assignments
    .filter(
      (assignment) =>
        assignment.classId === classId &&
        assignment.status === 'active' &&
        (assignment.dueDate === today || assignment.dueDate === tomorrow),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * 최근 알림장에서 자주 쓴 글줄.
 *
 * "우유갑 정리", "독서록"처럼 매주 반복되는 문구를 칩으로 내밀어 다시
 * 치지 않게 한다. 오늘 것은 빼고(이미 적혀 있으니), 최근 days일 안에서
 * 두 번 이상 나온 글줄을 많이 쓴 순으로 limit개 준다.
 */
export function frequentPhrases(
  notices: readonly DailyNotice[],
  classId: string,
  today: string,
  options: { days?: number; limit?: number } = {},
): string[] {
  const days = options.days ?? 30;
  const limit = options.limit ?? 6;
  const [year = 0, month = 1, day = 1] = today.split('-').map(Number);
  const since = new Date(year, month - 1, day - days);
  const sinceIso = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`;

  const counts = new Map<string, number>();
  for (const notice of notices) {
    if (notice.classId !== classId || notice.date === today || notice.date < sinceIso) continue;
    // 같은 날 두 번 적힌 것은 한 번으로 — "매일 반복됐는가"를 세는 것이다.
    for (const text of new Set(notice.items.map((item) => item.text.trim()))) {
      if (text === '') continue;
      counts.set(text, (counts.get(text) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
    .slice(0, limit)
    .map(([text]) => text);
}
