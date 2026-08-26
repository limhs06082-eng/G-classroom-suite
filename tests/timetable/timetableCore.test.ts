import { describe, expect, it } from 'vitest';

import type { TimetableEntry } from '../../src/shared/domain/types';
import {
  cellSubject,
  paintCell,
  subjectButtons,
  todayPeriods,
  weekdayOf,
} from '../../src/features/timetable/timetableCore';

const CLASS = 'class-1';

function at(weekday: number, period: number, subject: string): TimetableEntry {
  return { classId: CLASS, weekday, period, subject };
}

describe('칸 찍기', () => {
  it('빈 칸에 찍으면 들어간다', () => {
    const after = paintCell([], CLASS, 1, 3, '수학');

    expect(after).toEqual([at(1, 3, '수학')]);
  });

  it('찬 칸에 다른 과목을 찍으면 바뀐다', () => {
    const after = paintCell([at(1, 3, '국어')], CLASS, 1, 3, '수학');

    // 한 칸에 두 과목이 있을 수 없다. 늘어나면 화면이 둘을 겹쳐 그린다.
    expect(after).toEqual([at(1, 3, '수학')]);
  });

  it('같은 과목을 다시 찍으면 지워진다', () => {
    const after = paintCell([at(1, 3, '수학')], CLASS, 1, 3, '수학');

    // 지우개를 따로 두지 않는다. 잘못 찍었을 때 되돌리는 길이 손에 있어야 한다.
    expect(after).toEqual([]);
  });

  it('다른 학급 칸은 건드리지 않는다', () => {
    const other: TimetableEntry = { classId: 'class-2', weekday: 1, period: 3, subject: '영어' };

    const after = paintCell([other], CLASS, 1, 3, '수학');

    expect(after).toHaveLength(2);
    expect(after).toContainEqual(other);
  });

  it('빈 과목을 찍으면 지워진다', () => {
    // 직접 입력 칸을 비운 채 찍은 경우다. 빈 글자 항목이 남으면 안 된다.
    expect(paintCell([at(1, 3, '수학')], CLASS, 1, 3, '')).toEqual([]);
  });

  it('넘겨받은 목록을 고치지 않는다', () => {
    // 화면은 update()에 넣을 새 목록을 기대한다. 원본을 건드리면 React가
    // 같은 배열을 보고 다시 그리지 않는다.
    const before = [at(1, 3, '국어')];

    paintCell(before, CLASS, 1, 3, '수학');

    expect(before).toEqual([at(1, 3, '국어')]);
  });
});

describe('칸 읽기', () => {
  it('찍힌 과목을 돌려준다', () => {
    expect(cellSubject([at(2, 4, '체육')], CLASS, 2, 4)).toBe('체육');
  });

  it('빈 칸은 빈 글자다', () => {
    expect(cellSubject([at(2, 4, '체육')], CLASS, 2, 5)).toBe('');
  });

  it('다른 학급 것을 가져오지 않는다', () => {
    const other: TimetableEntry = { classId: 'class-2', weekday: 2, period: 4, subject: '영어' };

    expect(cellSubject([other], CLASS, 2, 4)).toBe('');
  });
});

describe('과목 단추', () => {
  it('기본 목록으로 시작한다', () => {
    const buttons = subjectButtons([], CLASS);

    expect(buttons).toContain('국어');
    expect(buttons).toContain('창체');
  });

  it('직접 입력한 과목이 단추가 된다', () => {
    /*
     * 기본 목록은 고학년에 맞춰져 있다. 저학년은 '즐거운생활'을 쓰는데,
     * 한 벌로 두 쪽을 다 덮을 수 없다. 한 번 치면 그 뒤로는 단추다.
     */
    const buttons = subjectButtons([at(1, 1, '즐거운생활')], CLASS);

    expect(buttons).toContain('즐거운생활');
  });

  it('기본에 있는 과목을 써도 두 번 나오지 않는다', () => {
    const buttons = subjectButtons([at(1, 1, '국어')], CLASS);

    expect(buttons.filter((s) => s === '국어')).toHaveLength(1);
  });

  it('같은 과목을 여러 칸에 써도 단추는 하나다', () => {
    // 국어를 여섯 칸에 찍는 것이 보통이다. 그때마다 단추가 늘면 못 쓴다.
    const buttons = subjectButtons([at(1, 1, '즐거운생활'), at(2, 1, '즐거운생활')], CLASS);

    expect(buttons.filter((s) => s === '즐거운생활')).toHaveLength(1);
  });

  it('다른 학급이 쓴 과목은 안 가져온다', () => {
    const other: TimetableEntry = { classId: 'class-2', weekday: 1, period: 1, subject: '중국어' };

    expect(subjectButtons([other], CLASS)).not.toContain('중국어');
  });
});

describe('오늘 교시', () => {
  it('교시 순서대로 돌려준다', () => {
    const entries = [at(3, 2, '수학'), at(3, 1, '국어'), at(3, 4, '체육')];

    expect(todayPeriods(entries, CLASS, 3)).toEqual([
      { period: 1, subject: '국어' },
      { period: 2, subject: '수학' },
      { period: 4, subject: '체육' },
    ]);
  });

  it('중간이 비어도 그대로 둔다', () => {
    // 3교시가 빈 것은 자료가 빠진 게 아니라 그 교시가 없다는 뜻이다.
    const entries = [at(3, 1, '국어'), at(3, 4, '체육')];

    expect(todayPeriods(entries, CLASS, 3).map((p) => p.period)).toEqual([1, 4]);
  });

  it('다른 요일은 안 섞는다', () => {
    const entries = [at(3, 1, '국어'), at(4, 1, '수학')];

    expect(todayPeriods(entries, CLASS, 3)).toEqual([{ period: 1, subject: '국어' }]);
  });

  it('주말은 빈 목록이다', () => {
    expect(todayPeriods([at(1, 1, '국어')], CLASS, 0)).toEqual([]);
  });

  it('넘겨받은 목록의 차례를 흩지 않는다', () => {
    // sort는 제자리에서 뒤집는다. 원본을 정렬해 버리면 저장된 자료의
    // 차례가 화면을 그릴 때마다 몰래 바뀐다.
    const entries = [at(3, 2, '수학'), at(3, 1, '국어')];

    todayPeriods(entries, CLASS, 3);

    expect(entries.map((entry) => entry.period)).toEqual([2, 1]);
  });
});

describe('요일 재기', () => {
  it('월요일은 1이다', () => {
    // 2026-08-24는 월요일이다.
    expect(weekdayOf(new Date(2026, 7, 24))).toBe(1);
  });

  it('금요일은 5다', () => {
    expect(weekdayOf(new Date(2026, 7, 28))).toBe(5);
  });

  it('주말은 0이다', () => {
    // Date의 getDay()는 일요일이 0이라 그대로 쓰면 일요일이 월요일이 된다.
    expect(weekdayOf(new Date(2026, 7, 29))).toBe(0);
    expect(weekdayOf(new Date(2026, 7, 30))).toBe(0);
  });
});
