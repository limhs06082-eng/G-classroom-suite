import { shuffle, systemRng, type Rng } from './rng';
import type { Seat, SeatingStudent, StudentPosition } from './types';

/**
 * 자리 배치 알고리즘.
 *
 * 원본 G-seat-group-maker의 shuffle.ts를 옮기면서 두 가지를 바꿨다.
 *   1. Math.random() 직접 호출 → 생성기 주입. 결과를 검증할 수 있게 된다.
 *   2. Student 대신 SeatingStudent. 알고리즘이 도메인 전체를 알 필요가 없다.
 */

export interface SeatingResult {
  ok: boolean;
  /** 실패 사유. 교사가 무엇을 고쳐야 하는지 알 수 있게 쓴다. */
  message?: string;
  /** 성공했지만 알릴 것. 예: 떨어뜨리기 조건을 다 지키지 못했다. */
  warning?: string;
  positions: StudentPosition[];
}

export interface SeatingOptions {
  /**
   * 이웃에 앉히지 않을 짝. 앞뒤·옆·대각선(8방향)을 이웃으로 본다.
   * 조건을 만족하는 배치가 나올 때까지 다시 섞는다(최대 attempts번).
   */
  avoidPairs?: ReadonlyArray<readonly [string, string]>;
  attempts?: number;
}

/** 두 자리가 이웃인가 — 앞뒤·옆·대각선. */
function areNeighbors(a: Seat, b: Seat): boolean {
  return Math.abs(a.row - b.row) <= 1 && Math.abs(a.column - b.column) <= 1;
}

/** 떨어뜨려야 할 짝 중 이웃에 앉은 짝의 수. 0이면 조건을 다 지킨 것이다. */
export function countAdjacentPairs(
  positions: readonly StudentPosition[],
  seats: readonly Seat[],
  avoidPairs: ReadonlyArray<readonly [string, string]>,
): number {
  const seatById = new Map(seats.map((seat) => [seat.id, seat]));
  const seatOf = new Map(positions.map((p) => [p.studentId, seatById.get(p.seatId)]));

  let count = 0;
  for (const [a, b] of avoidPairs) {
    const seatA = seatOf.get(a);
    const seatB = seatOf.get(b);
    if (seatA !== undefined && seatB !== undefined && areNeighbors(seatA, seatB)) count += 1;
  }
  return count;
}

const DEFAULT_ATTEMPTS = 60;

export function performRandomSeating(
  students: readonly SeatingStudent[],
  seats: readonly Seat[],
  currentPositions: readonly StudentPosition[],
  rng: Rng = systemRng,
  options: SeatingOptions = {},
): SeatingResult {
  const avoidPairs = options.avoidPairs ?? [];
  if (avoidPairs.length === 0) return shuffleOnce(students, seats, currentPositions, rng);

  /*
   * 조건이 있으면 여러 번 섞어 가장 나은 것을 고른다. 완전 탐색이 아니라
   * 재시도인 까닭은, 교실 자리 문제는 대개 짝 두셋이라 예순 번 안에
   * 거의 항상 풀리고, 안 풀리는 경우(자리 여섯에 짝 다섯)는 어떤 알고리즘
   * 으로도 안 풀리기 때문이다 — 그때는 지키지 못했다고 말한다.
   */
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  let best: SeatingResult | null = null;
  let bestViolations = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = shuffleOnce(students, seats, currentPositions, rng);
    if (!result.ok) return result;

    const violations = countAdjacentPairs(result.positions, seats, avoidPairs);
    if (violations < bestViolations) {
      best = result;
      bestViolations = violations;
    }
    if (violations === 0) return result;
  }

  if (best === null) return shuffleOnce(students, seats, currentPositions, rng);
  return {
    ...best,
    warning: `떨어뜨리기 조건 ${bestViolations}쌍을 지키지 못했습니다. 고정 자리를 풀거나 자리를 늘리면 나아집니다.`,
  };
}

function shuffleOnce(
  students: readonly SeatingStudent[],
  seats: readonly Seat[],
  currentPositions: readonly StudentPosition[],
  rng: Rng,
): SeatingResult {
  const availableSeats = seats.filter((seat) => !seat.isDisabled);

  if (students.length === 0) {
    return {
      ok: false,
      message: '배치할 학생이 없습니다. 학생 명단을 먼저 등록해 주세요.',
      positions: [],
    };
  }

  if (availableSeats.length < students.length) {
    return {
      ok: false,
      message: `학생 ${students.length}명보다 쓸 수 있는 자리가 ${availableSeats.length}개로 적습니다. 자리를 늘리거나 사용 안 함으로 둔 자리를 되살려 주세요.`,
      // 실패해도 기존 배치를 그대로 돌려준다. 화면이 비어 버리면 안 된다.
      positions: [...currentPositions],
    };
  }

  const currentSeatByStudent = new Map(
    currentPositions.map((position) => [position.studentId, position.seatId]),
  );
  const availableSeatIds = new Set(availableSeats.map((seat) => seat.id));

  const positions: StudentPosition[] = [];
  const occupiedSeatIds = new Set<string>();
  const unassigned: SeatingStudent[] = [];

  for (const student of students) {
    const currentSeatId = currentSeatByStudent.get(student.id);
    // 고정 학생이라도 그 자리가 사라졌으면 다시 배치 대상이 된다.
    const keepsSeat =
      student.isLocked && currentSeatId !== undefined && availableSeatIds.has(currentSeatId);

    if (keepsSeat && currentSeatId !== undefined && !occupiedSeatIds.has(currentSeatId)) {
      positions.push({ studentId: student.id, seatId: currentSeatId });
      occupiedSeatIds.add(currentSeatId);
    } else {
      unassigned.push(student);
    }
  }

  const freeSeatIds = availableSeats
    .map((seat) => seat.id)
    .filter((id) => !occupiedSeatIds.has(id));

  shuffle(unassigned, rng).forEach((student, index) => {
    const targetSeatId = freeSeatIds[index];
    if (targetSeatId !== undefined) {
      positions.push({ studentId: student.id, seatId: targetSeatId });
    }
  });

  return { ok: true, positions };
}
