import { describe, expect, it } from 'vitest';

import {
  assignmentsDueSoon,
  itemsFor,
  noticeText,
  setItems,
} from '../../src/features/notice/noticeCore';

describe('noticeText — 문자로 붙여 넣을 한 덩어리', () => {
  it('머리·번호 매긴 항목·과제·일정 순으로 잇는다', () => {
    expect(
      noticeText({
        className: '3학년 2반',
        date: '2026-09-05',
        items: [{ text: '우유갑 정리' }, { text: '독서록' }],
        dueSoon: [{ title: '일기', dueDate: '2026-09-06' }],
        events: ['내일 현장학습 — 도시락'],
      }),
    ).toBe(
      ['[3학년 2반 알림장] 9/5(토)', '1. 우유갑 정리', '2. 독서록', '3. (내일까지) 일기', '', '다가오는 일정', '· 내일 현장학습 — 도시락'].join('\n'),
    );
  });

  it('일정이 없으면 일정 묶음이 없다', () => {
    expect(noticeText({ className: '반', date: '2026-09-05', items: [{ text: 'a' }], dueSoon: [], events: [] })).toBe(
      '[반 알림장] 9/5(토)\n1. a',
    );
  });
});
import { createAssignment } from '../../src/shared/domain/factories';
import type { DailyNotice } from '../../src/shared/domain/types';

const CLASS = 'class-1';
const DATE = '2026-08-29';
const NOW = '2026-08-01T00:00:00.000Z';

describe('itemsFor · setItems', () => {
  it('기록이 없는 날은 빈 목록이다', () => {
    expect(itemsFor([], CLASS, DATE)).toEqual([]);
  });

  it('항목을 저장하고 그날 것만 돌려준다', () => {
    const next = setItems([], CLASS, DATE, [{ id: 'n-1', text: '색연필 가져오기' }]);

    expect(itemsFor(next, CLASS, DATE)).toEqual([{ id: 'n-1', text: '색연필 가져오기' }]);
    expect(itemsFor(next, CLASS, '2026-08-30')).toEqual([]);
  });

  it('빈 목록으로 저장하면 그날 기록 자체가 사라진다', () => {
    const saved = setItems([], CLASS, DATE, [{ id: 'n-1', text: '색연필' }]);
    const cleared = setItems(saved, CLASS, DATE, []);

    expect(cleared).toEqual([]);
  });

  it('다른 학급·다른 날짜의 기록은 건드리지 않는다', () => {
    const other: DailyNotice = { classId: 'class-2', date: DATE, items: [{ id: 'x', text: '옆 반' }] };
    const next = setItems([other], CLASS, DATE, [{ id: 'n-1', text: '우리 반' }]);

    expect(next).toHaveLength(2);
    expect(itemsFor(next, 'class-2', DATE)).toEqual([{ id: 'x', text: '옆 반' }]);
  });
});

describe('assignmentsDueSoon — 알림장에 자동으로 붙는 과제', () => {
  it('오늘·내일 마감인 진행 중 과제만 꼽는다', () => {
    const assignments = [
      createAssignment({ id: 'a-today', classId: CLASS, title: '독서록', dueDate: '2026-08-29' }, NOW),
      createAssignment({ id: 'a-tomorrow', classId: CLASS, title: '수학 익힘', dueDate: '2026-08-30' }, NOW),
      createAssignment({ id: 'a-far', classId: CLASS, title: '일기', dueDate: '2026-09-05' }, NOW),
      createAssignment({ id: 'a-past', classId: CLASS, title: '지난 과제', dueDate: '2026-08-28' }, NOW),
      createAssignment({ id: 'a-nodate', classId: CLASS, title: '기한 없음' }, NOW),
      createAssignment(
        { id: 'a-closed', classId: CLASS, title: '마감됨', dueDate: '2026-08-30', status: 'closed' },
        NOW,
      ),
      createAssignment({ id: 'a-other', classId: 'class-2', title: '옆 반', dueDate: '2026-08-30' }, NOW),
    ];

    const due = assignmentsDueSoon(assignments, CLASS, DATE);

    // 오늘 마감이 내일 마감보다 앞에 온다.
    expect(due.map((a) => a.id)).toEqual(['a-today', 'a-tomorrow']);
  });
});

describe('frequentPhrases — 자주 쓰는 문구', () => {
  it('최근 두 번 이상 쓴 글줄을 많이 쓴 순으로, 오늘 것은 빼고 준다', async () => {
    const { frequentPhrases } = await import('../../src/features/notice/noticeCore');
    const notices: DailyNotice[] = [
      { classId: CLASS, date: '2026-08-25', items: [{ id: 'a', text: '우유갑 정리' }, { id: 'b', text: '독서록' }] },
      { classId: CLASS, date: '2026-08-26', items: [{ id: 'c', text: '우유갑 정리' }, { id: 'd', text: '우유갑 정리' }] },
      { classId: CLASS, date: '2026-08-27', items: [{ id: 'e', text: '독서록' }, { id: 'f', text: '우유갑 정리' }] },
      { classId: CLASS, date: '2026-08-28', items: [{ id: 'g', text: '한 번만 쓴 것' }] },
      { classId: CLASS, date: DATE, items: [{ id: 'h', text: '독서록' }] }, // 오늘 — 안 센다
      { classId: 'class-2', date: '2026-08-26', items: [{ id: 'i', text: '독서록' }] },
    ];

    // 우유갑 정리 3일, 독서록 2일(오늘 제외). 한 번만 쓴 것은 안 나온다.
    expect(frequentPhrases(notices, CLASS, DATE)).toEqual(['우유갑 정리', '독서록']);
  });

  it('오래된 것은 세지 않는다', async () => {
    const { frequentPhrases } = await import('../../src/features/notice/noticeCore');
    const notices: DailyNotice[] = [
      { classId: CLASS, date: '2026-05-01', items: [{ id: 'a', text: '옛날 것' }] },
      { classId: CLASS, date: '2026-05-02', items: [{ id: 'b', text: '옛날 것' }] },
    ];
    expect(frequentPhrases(notices, CLASS, DATE, { days: 30 })).toEqual([]);
  });
});
