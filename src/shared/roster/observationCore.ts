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
  input: { classId: string; studentId: string; text: string; date?: string },
  now?: string,
): ObservationEntry[] {
  const text = input.text.trim();
  if (text === '') return [...observations];

  return [
    ...observations,
    createObservation(
      { classId: input.classId, studentId: input.studentId, text, ...(input.date === undefined ? {} : { date: input.date }) },
      now ?? new Date().toISOString(),
    ),
  ];
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
