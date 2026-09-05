import { createObservation } from '../domain/factories';
import type { ObservationEntry } from '../domain/types';

/**
 * 관찰 기록 판단.
 *
 * 학생별 날짜 있는 메모의 타임라인이다. 학기말 생활기록부·상담 준비 때
 * 시간순으로 꺼내 쓰는 것이 목적이라, 최신이 위로 온다.
 */

/** 그 학생의 기록, 최신 날짜부터. 같은 날짜면 나중에 적은 것이 위다. */
export function observationsOf(
  observations: readonly ObservationEntry[],
  studentId: string,
): ObservationEntry[] {
  return observations
    .filter((entry) => entry.studentId === studentId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** 기록을 더한다. 빈 글은 더하지 않는다. */
export function addObservation(
  observations: readonly ObservationEntry[],
  input: {
    classId: string;
    studentId: string;
    text: string;
    date?: string;
    /** 상담 기록이면 'counsel' */
    kind?: 'counsel';
    /** 다음 상담 날짜. 상담 기록에만 의미가 있다. */
    followUpDate?: string;
  },
  now?: string,
): ObservationEntry[] {
  const text = input.text.trim();
  if (text === '') return [...observations];

  return [
    ...observations,
    createObservation(
      {
        classId: input.classId,
        studentId: input.studentId,
        text,
        ...(input.date === undefined ? {} : { date: input.date }),
        ...(input.kind === undefined ? {} : { kind: input.kind }),
        ...(input.followUpDate === undefined ? {} : { followUpDate: input.followUpDate }),
      },
      now ?? new Date().toISOString(),
    ),
  ];
}

function localDate(date: string): Date {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * 다음 상담 — 오늘 이후(오늘 포함) 가장 가까운 상담 예정. 지난 것은 세지
 * 않는다. 상담 주간의 "지난번에 언제 보기로 했더라"가 이것이다.
 */
export function nextCounsel(
  observations: readonly ObservationEntry[],
  studentId: string,
  today: string,
): { date: string; days: number; entry: ObservationEntry } | null {
  const upcoming = observations
    .filter(
      (entry) =>
        entry.studentId === studentId &&
        entry.kind === 'counsel' &&
        entry.followUpDate !== undefined &&
        entry.followUpDate >= today,
    )
    .sort((a, b) => (a.followUpDate ?? '').localeCompare(b.followUpDate ?? ''));
  const first = upcoming[0];
  if (first === undefined || first.followUpDate === undefined) return null;
  const days = Math.round((localDate(first.followUpDate).getTime() - localDate(today).getTime()) / 86_400_000);
  return { date: first.followUpDate, days, entry: first };
}

/**
 * 기록을 지운다. 되돌리기 표시가 아니라 진짜 삭제다 — 점수와 달리 관찰
 * 기록은 합산되는 값이 없어, 지운 기록이 다른 숫자를 흔들지 않는다.
 */
export function removeObservation(
  observations: readonly ObservationEntry[],
  observationId: string,
): ObservationEntry[] {
  return observations.filter((entry) => entry.id !== observationId);
}
