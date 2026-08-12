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
  positions: StudentPosition[];
}

export function performRandomSeating(
  students: readonly SeatingStudent[],
  seats: readonly Seat[],
  currentPositions: readonly StudentPosition[],
  rng: Rng = systemRng,
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
