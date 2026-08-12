/**
 * 자리배치·모둠 편성 전용 타입.
 *
 * 학생·모둠·학급은 shared/domain의 것을 쓴다. 여기에는 좌석처럼
 * 이 기능에서만 의미가 있는 것만 둔다.
 */

/** 교실 좌석 한 자리. id는 `r{row}c{col}` 형식이다. */
export interface Seat {
  id: string;
  /** 1부터 */
  row: number;
  /** 1부터 */
  column: number;
  /** 책상이 없거나 쓰지 않는 자리 */
  isDisabled: boolean;
}

export interface StudentPosition {
  studentId: string;
  seatId: string;
}

export interface SeatLayout {
  classId: string;
  rows: number;
  cols: number;
  disabledSeatIds: string[];
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
