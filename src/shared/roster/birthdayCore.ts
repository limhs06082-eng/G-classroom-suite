import type { Student } from '../domain/types';

/**
 * 생일 — 시계를 부르지 않는 순수 함수. 날짜는 전부 YYYY-MM-DD 글자다.
 *
 * 2월 29일생은 평년에 2월 28일로 본다. 4년에 한 번 축하하면 그 아이는
 * 초등학교를 다니는 동안 한두 번밖에 생일이 없다.
 */

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function localDate(date: string): Date {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 올해(또는 내년)의 생일 날짜. 이미 지났으면 내년. 깨진 값이면 null. */
export function nextBirthday(today: string, birthday: string): { date: string; days: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (match === null) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const [todayYear = 0] = today.split('-').map(Number);
  const occurrence = (year: number): string => {
    const safeDay = month === 2 && day === 29 && !isLeap(year) ? 28 : day;
    return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
  };

  const thisYear = occurrence(todayYear);
  const date = thisYear >= today ? thisYear : occurrence(todayYear + 1);
  const days = Math.round((localDate(date).getTime() - localDate(today).getTime()) / 86_400_000);
  return { date, days };
}

/** 그날 생일인 학생, 번호순. */
export function birthdaysOn(students: readonly Student[], date: string): Student[] {
  return students
    .filter((student) => {
      if (student.birthday === undefined) return false;
      const next = nextBirthday(date, student.birthday);
      return next !== null && next.days === 0;
    })
    .sort((a, b) => a.number - b.number);
}

export interface UpcomingBirthday {
  student: Student;
  /** 올해(또는 내년) 생일 날짜 */
  date: string;
  days: number;
}

/** 오늘부터 withinDays일 안(오늘 포함)의 생일, 가까운 순 → 번호순. */
export function upcomingBirthdays(
  students: readonly Student[],
  today: string,
  withinDays: number,
): UpcomingBirthday[] {
  return students
    .flatMap((student) => {
      if (student.birthday === undefined) return [];
      const next = nextBirthday(today, student.birthday);
      if (next === null || next.days > withinDays) return [];
      return [{ student, date: next.date, days: next.days }];
    })
    .sort((a, b) => a.days - b.days || a.student.number - b.student.number);
}

export { iso as isoDate };
