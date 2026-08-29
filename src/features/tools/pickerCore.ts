import type { Rng } from '../seating/rng';
import type { Student } from '../../shared/domain/types';

/**
 * 발표자 뽑기 판단.
 *
 * 저장하지 않는다 — 뽑기는 수업 한 번의 상태라, 새로 열면 처음부터다.
 * 오늘 결석·체험학습인 학생은 풀에서 빠진다(없는 사람을 뽑아 놓고
 * "없네요"라고 하는 것이 제일 김새는 일이다).
 */

/** 뽑을 수 있는 학생. */
export function remainingPool(
  roster: readonly Student[],
  absentIds: readonly string[],
  pickedIds: readonly string[],
  excludePicked: boolean,
): Student[] {
  const absent = new Set(absentIds);
  const picked = new Set(pickedIds);

  return roster.filter((student) => {
    if (absent.has(student.id)) return false;
    if (excludePicked && picked.has(student.id)) return false;
    return true;
  });
}

/** 풀에서 한 명. 빈 풀이면 null. */
export function drawOne(pool: readonly Student[], rng: Rng): Student | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)] ?? null;
}
