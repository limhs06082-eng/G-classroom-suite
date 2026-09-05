import { describe, expect, it } from 'vitest';

import { createStudent } from '../../src/shared/domain/factories';
import { birthdaysOn, nextBirthday, upcomingBirthdays } from '../../src/shared/roster/birthdayCore';

const NOW = '2026-03-02T09:00:00.000Z';

function student(id: string, name: string, birthday?: string) {
  return createStudent(
    { id, classId: 'class-1', number: Number(id.slice(-1)), name, ...(birthday === undefined ? {} : { birthday }) },
    NOW,
  );
}

describe('nextBirthday — 다음 생일까지', () => {
  it('오늘이면 0, 앞이면 며칠 뒤, 지났으면 내년', () => {
    expect(nextBirthday('2026-09-07', '2015-09-07')).toEqual({ date: '2026-09-07', days: 0 });
    expect(nextBirthday('2026-09-07', '2015-09-10')).toEqual({ date: '2026-09-10', days: 3 });
    expect(nextBirthday('2026-09-07', '2015-03-01')).toEqual({ date: '2027-03-01', days: 175 });
  });

  it('2월 29일생은 평년에 2월 28일로 본다', () => {
    expect(nextBirthday('2027-01-10', '2016-02-29')).toEqual({ date: '2027-02-28', days: 49 });
    expect(nextBirthday('2028-01-10', '2016-02-29')).toEqual({ date: '2028-02-29', days: 50 });
  });

  it('빈 값·깨진 값은 null', () => {
    expect(nextBirthday('2026-09-07', '')).toBeNull();
    expect(nextBirthday('2026-09-07', '2015-13-40')).toBeNull();
    expect(nextBirthday('2026-09-07', 'abc')).toBeNull();
  });
});

describe('birthdaysOn · upcomingBirthdays', () => {
  const roster = [
    student('stu-1', '김하나', '2015-09-07'),
    student('stu-2', '이두리', '2015-09-10'),
    student('stu-3', '박세리', '2015-12-25'),
    student('stu-4', '최네오'),
  ];

  it('그날 생일인 학생만', () => {
    expect(birthdaysOn(roster, '2026-09-07').map((s) => s.name)).toEqual(['김하나']);
    expect(birthdaysOn(roster, '2026-09-08')).toEqual([]);
  });

  it('며칠 안의 생일을 가까운 순으로, 생일 없는 학생은 빼고', () => {
    const soon = upcomingBirthdays(roster, '2026-09-07', 30);

    expect(soon.map((item) => [item.student.name, item.days])).toEqual([
      ['김하나', 0],
      ['이두리', 3],
    ]);
    expect(upcomingBirthdays(roster, '2026-09-07', 120).map((item) => item.student.name)).toEqual([
      '김하나',
      '이두리',
      '박세리',
    ]);
  });
});
