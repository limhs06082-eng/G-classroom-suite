import { describe, expect, it } from 'vitest';

import { createSeededRng, shuffle } from '../../src/features/seating/rng';
import { countAdjacentPairs, performRandomSeating } from '../../src/features/seating/seatingCore';
import { buildSeats, type SeatingStudent, type StudentPosition } from '../../src/features/seating/types';

function students(count: number, lockedIds: string[] = []): SeatingStudent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `stu-${i + 1}`,
    isLocked: lockedIds.includes(`stu-${i + 1}`),
  }));
}

const rng = () => createSeededRng(42);

describe('shuffle', () => {
  it('같은 시드는 같은 순서를 낸다', () => {
    const items = ['가', '나', '다', '라', '마'];

    expect(shuffle(items, createSeededRng(7))).toEqual(shuffle(items, createSeededRng(7)));
  });

  it('다른 시드는 대체로 다른 순서를 낸다', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);

    expect(shuffle(items, createSeededRng(1))).not.toEqual(shuffle(items, createSeededRng(2)));
  });

  it('원본 배열을 건드리지 않고 모든 원소를 보존한다', () => {
    const items = ['가', '나', '다'];
    const result = shuffle(items, createSeededRng(3));

    expect(items).toEqual(['가', '나', '다']);
    expect([...result].sort()).toEqual(['가', '나', '다']);
  });

  it('빈 배열과 한 개짜리도 처리한다', () => {
    expect(shuffle([], createSeededRng(1))).toEqual([]);
    expect(shuffle(['하나'], createSeededRng(1))).toEqual(['하나']);
  });
});

describe('buildSeats', () => {
  it('행×열만큼 자리를 만들고 사용 안 함을 표시한다', () => {
    const seats = buildSeats(2, 3, ['r1c2']);

    expect(seats).toHaveLength(6);
    expect(seats.map((s) => s.id)).toEqual(['r1c1', 'r1c2', 'r1c3', 'r2c1', 'r2c2', 'r2c3']);
    expect(seats.find((s) => s.id === 'r1c2')?.isDisabled).toBe(true);
    expect(seats.find((s) => s.id === 'r1c1')?.isDisabled).toBe(false);
  });
});

describe('performRandomSeating', () => {
  it('모든 학생에게 서로 다른 자리를 준다', () => {
    const result = performRandomSeating(students(6), buildSeats(3, 3, []), [], rng());

    expect(result.ok).toBe(true);
    expect(result.positions).toHaveLength(6);
    expect(new Set(result.positions.map((p) => p.seatId)).size).toBe(6);
    expect(new Set(result.positions.map((p) => p.studentId)).size).toBe(6);
  });

  it('사용 안 함으로 둔 자리에는 배치하지 않는다', () => {
    const seats = buildSeats(2, 3, ['r1c1', 'r1c2']);
    const result = performRandomSeating(students(4), seats, [], rng());

    expect(result.ok).toBe(true);
    expect(result.positions.map((p) => p.seatId)).not.toContain('r1c1');
    expect(result.positions.map((p) => p.seatId)).not.toContain('r1c2');
  });

  it('자리가 모자라면 거절하고 기존 배치를 지키지 않는다면 화면이 비어 버린다', () => {
    const current: StudentPosition[] = [{ studentId: 'stu-1', seatId: 'r1c1' }];
    const result = performRandomSeating(students(5), buildSeats(2, 2, []), current, rng());

    expect(result.ok).toBe(false);
    expect(result.message).toContain('자리가');
    // 실패해도 기존 배치를 그대로 돌려준다
    expect(result.positions).toEqual(current);
  });

  it('학생이 없으면 거절한다', () => {
    const result = performRandomSeating([], buildSeats(2, 2, []), [], rng());

    expect(result.ok).toBe(false);
    expect(result.positions).toEqual([]);
  });

  describe('자리 고정', () => {
    it('고정한 학생은 원래 자리를 지킨다', () => {
      const current: StudentPosition[] = [{ studentId: 'stu-1', seatId: 'r2c2' }];
      const result = performRandomSeating(students(6, ['stu-1']), buildSeats(3, 3, []), current, rng());

      expect(result.positions.find((p) => p.studentId === 'stu-1')?.seatId).toBe('r2c2');
    });

    it('고정 학생의 자리가 사용 안 함으로 바뀌면 다시 배치한다', () => {
      const current: StudentPosition[] = [{ studentId: 'stu-1', seatId: 'r1c1' }];
      const seats = buildSeats(3, 3, ['r1c1']);
      const result = performRandomSeating(students(6, ['stu-1']), seats, current, rng());

      expect(result.ok).toBe(true);
      expect(result.positions.find((p) => p.studentId === 'stu-1')?.seatId).not.toBe('r1c1');
      expect(result.positions).toHaveLength(6);
    });

    it('고정 학생 둘이 같은 자리를 가리켜도 겹치지 않게 배치한다', () => {
      const current: StudentPosition[] = [
        { studentId: 'stu-1', seatId: 'r1c1' },
        { studentId: 'stu-2', seatId: 'r1c1' },
      ];
      const result = performRandomSeating(
        students(4, ['stu-1', 'stu-2']),
        buildSeats(2, 2, []),
        current,
        rng(),
      );

      expect(result.ok).toBe(true);
      expect(result.positions).toHaveLength(4);
      expect(new Set(result.positions.map((p) => p.seatId)).size).toBe(4);
    });

    it('전원을 고정하면 배치가 그대로 유지된다', () => {
      const current: StudentPosition[] = [
        { studentId: 'stu-1', seatId: 'r1c1' },
        { studentId: 'stu-2', seatId: 'r2c2' },
      ];
      const all = students(2, ['stu-1', 'stu-2']);
      const result = performRandomSeating(all, buildSeats(2, 2, []), current, rng());

      expect(result.positions).toEqual(expect.arrayContaining(current));
      expect(result.positions).toHaveLength(2);
    });
  });

  it('같은 시드로 부르면 같은 배치가 나온다', () => {
    // 교사가 결과를 재현할 수 있어야 하고, 무엇보다 테스트가 가능해야 한다.
    const seats = buildSeats(4, 4, []);
    const a = performRandomSeating(students(10), seats, [], createSeededRng(99));
    const b = performRandomSeating(students(10), seats, [], createSeededRng(99));

    expect(a.positions).toEqual(b.positions);
  });

  it('다른 시드로 부르면 배치가 달라진다', () => {
    const seats = buildSeats(4, 4, []);
    const a = performRandomSeating(students(12), seats, [], createSeededRng(1));
    const b = performRandomSeating(students(12), seats, [], createSeededRng(2));

    expect(a.positions).not.toEqual(b.positions);
  });
});

describe('떨어뜨리기 — avoidPairs', () => {
  function seatsOf(rows: number, cols: number) {
    return buildSeats(rows, cols, []);
  }

  it('조건을 만족하는 배치가 있으면 두 학생이 이웃에 앉지 않는다', () => {
    // 2×4 교실에 학생 넷 — A와 B를 떼어 놓을 자리가 충분하다.
    const students = ['a', 'b', 'c', 'd'].map((id) => ({ id, isLocked: false }));
    const seats = seatsOf(2, 4);

    for (let seed = 1; seed <= 20; seed += 1) {
      const result = performRandomSeating(students, seats, [], createSeededRng(seed), {
        avoidPairs: [['a', 'b']],
      });
      expect(result.ok).toBe(true);
      expect(result.warning).toBeUndefined();
      expect(countAdjacentPairs(result.positions, seats, [['a', 'b']])).toBe(0);
    }
  });

  it('도저히 뗄 수 없으면 배치는 하되 경고를 남긴다', () => {
    // 1×2 교실에 둘 — 어떻게 앉아도 이웃이다.
    const students = ['a', 'b'].map((id) => ({ id, isLocked: false }));
    const seats = seatsOf(1, 2);

    const result = performRandomSeating(students, seats, [], createSeededRng(1), {
      avoidPairs: [['a', 'b']],
      attempts: 5,
    });

    expect(result.ok).toBe(true);
    expect(result.positions).toHaveLength(2);
    expect(result.warning).toContain('1쌍');
  });

  it('대각선도 이웃이다', () => {
    const seats = seatsOf(2, 2);
    const positions = [
      { studentId: 'a', seatId: 'r1c1' },
      { studentId: 'b', seatId: 'r2c2' },
    ];
    expect(countAdjacentPairs(positions, seats, [['a', 'b']])).toBe(1);
  });
});
