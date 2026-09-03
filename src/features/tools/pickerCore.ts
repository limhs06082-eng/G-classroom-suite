import { shuffle, type Rng } from '../seating/rng';
import type { Group, Student } from '../../shared/domain/types';

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

/**
 * 풀에서 여러 명, 겹치지 않게. 모둠 대표 둘·발표 셋처럼 한 번에 뽑을 때.
 *
 * 섞어서 앞에서 자른다(Fisher-Yates 재사용). 풀보다 많이 달라면 있는
 * 만큼만 준다 — "3명 뽑기"를 눌렀는데 2명 남았으면 2명이 답이다.
 */
export function drawMany(pool: readonly Student[], count: number, rng: Rng): Student[] {
  if (count <= 0 || pool.length === 0) return [];
  return shuffle(pool, rng).slice(0, count);
}

/**
 * 모둠마다 한 명. 모둠 발표자·대표를 한 번에 정할 때.
 *
 * 모둠 순서를 지키고, 풀(결석·이미 뽑힌 학생 제외)에 없는 학생은 뽑지
 * 않는다. 풀에 남은 학생이 없는 모둠은 건너뛴다 — 없는 사람을 뽑아
 * 놓고 "없네요"라고 하는 것보다 그 모둠이 빈 것이 낫다.
 */
export function drawPerGroup(
  groups: readonly Group[],
  pool: readonly Student[],
  rng: Rng,
): Array<{ group: Group; student: Student }> {
  const poolById = new Map(pool.map((student) => [student.id, student]));

  return groups.flatMap((group) => {
    const candidates = group.studentIds
      .map((id) => poolById.get(id))
      .filter((student): student is Student => student !== undefined);
    const student = drawOne(candidates, rng);
    return student === null ? [] : [{ group, student }];
  });
}
