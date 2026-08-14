import { describe, expect, it } from 'vitest';

import { buildSeats, flipSeats, seatId } from '../../src/features/seating/types';

describe('flipSeats', () => {
  it('행과 열이 함께 뒤집혀 첫 좌석이 마지막이 된다', () => {
    const seats = buildSeats(4, 5, []);
    const flipped = flipSeats(seats);

    expect(flipped).toHaveLength(20);
    expect(flipped[0]?.id).toBe(seatId(4, 5));
    expect(flipped[1]?.id).toBe(seatId(4, 4));
    expect(flipped[19]?.id).toBe(seatId(1, 1));
  });

  it('열이 홀수여도 맞는다', () => {
    const flipped = flipSeats(buildSeats(2, 3, []));

    expect(flipped.map((seat) => seat.id)).toEqual([
      seatId(2, 3),
      seatId(2, 2),
      seatId(2, 1),
      seatId(1, 3),
      seatId(1, 2),
      seatId(1, 1),
    ]);
  });

  it('사용 안 함 표시는 좌석을 따라간다', () => {
    const flipped = flipSeats(buildSeats(2, 2, [seatId(1, 1)]));

    expect(flipped.find((seat) => seat.id === seatId(1, 1))?.isDisabled).toBe(true);
    expect(flipped.find((seat) => seat.id === seatId(2, 2))?.isDisabled).toBe(false);
  });

  it('id·row·column 값은 바꾸지 않는다', () => {
    const flipped = flipSeats(buildSeats(2, 2, []));
    const first = flipped[0];

    expect(first?.id).toBe(seatId(2, 2));
    expect(first?.row).toBe(2);
    expect(first?.column).toBe(2);
  });

  it('원본 배열을 건드리지 않는다', () => {
    const seats = buildSeats(2, 2, []);
    flipSeats(seats);

    expect(seats[0]?.id).toBe(seatId(1, 1));
  });
});
