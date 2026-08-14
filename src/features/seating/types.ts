/**
 * 자리배치·모둠 편성 전용 타입.
 *
 * 학생·모둠·학급·저장되는 배치 상태는 shared/domain의 것을 쓴다.
 * 여기에는 계산으로 만들어지고 저장하지 않는 것만 둔다.
 */

// 저장되는 배치는 도메인이 소유한다. 여기서 다시 정의하면 또 갈라진다.
export type { SeatingState, StudentPosition } from '../../shared/domain/types';

/**
 * 교실 좌석 한 자리.
 *
 * 저장하지 않는다. rows·cols·disabledSeatIds에서 매번 만들어 쓴다.
 * 좌석을 저장하면 교실 크기를 바꿀 때마다 두 곳이 어긋난다.
 */
export interface Seat {
  id: string;
  /** 1부터 */
  row: number;
  /** 1부터 */
  column: number;
  /** 책상이 없거나 쓰지 않는 자리 */
  isDisabled: boolean;
}

/**
 * 배치 알고리즘이 학생에 대해 알아야 하는 전부.
 *
 * 코어 Student와 SeatingProfile을 합쳐 만든 얇은 조회용 타입이다.
 * 알고리즘이 도메인 전체를 알 필요가 없어야 테스트하기 쉽다.
 */
export interface SeatingStudent {
  id: string;
  /** 자리를 고정한 학생. 재배치해도 그대로 둔다. */
  isLocked: boolean;
}

export type GroupingMode = 'groupCount' | 'membersPerGroup';

export function seatId(row: number, column: number): string {
  return `r${row}c${column}`;
}

export function buildSeats(rows: number, cols: number, disabledSeatIds: readonly string[]): Seat[] {
  const disabled = new Set(disabledSeatIds);
  const seats: Seat[] = [];

  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= cols; column += 1) {
      const id = seatId(row, column);
      seats.push({ id, row, column, isDisabled: disabled.has(id) });
    }
  }

  return seats;
}

/**
 * 좌석 배열을 교탁에서 본 순서로 뒤집는다.
 *
 * buildSeats가 행 우선(1행 1열 → 1행 n열 → 2행 1열 …)으로 만들고
 * ClassroomGrid가 그 순서대로 그린다. 그래서 배열을 통째로 뒤집으면
 * 행과 열이 함께 뒤집혀 정확히 180도 회전이 된다.
 *
 * seat.id·row·column 값은 건드리지 않는다. 좌석 클릭도 저장된 positions도
 * id로 이어져 있어서, 값까지 바꾸면 누른 자리와 앉는 자리가 어긋난다.
 */
export function flipSeats(seats: readonly Seat[]): Seat[] {
  return [...seats].reverse();
}
