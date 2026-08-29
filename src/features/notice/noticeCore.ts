import type { Assignment, DailyNotice, NoticeItem } from '../../shared/domain/types';

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
