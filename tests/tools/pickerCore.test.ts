import { describe, expect, it } from 'vitest';

import { createSeededRng } from '../../src/features/seating/rng';
import { drawOne, remainingPool } from '../../src/features/tools/pickerCore';
import { createStudent } from '../../src/shared/domain/factories';
import type { Student } from '../../src/shared/domain/types';

const NOW = '2026-08-29T09:00:00.000Z';

function roster(): Student[] {
  return [1, 2, 3, 4, 5].map((n) =>
    createStudent({ id: `stu-${n}`, classId: 'class-1', number: n, name: `학생${n}` }, NOW),
  );
}

describe('remainingPool', () => {
  it('결석한 학생을 뺀다', () => {
    const pool = remainingPool(roster(), ['stu-2'], [], true);
    expect(pool.map((s) => s.id)).toEqual(['stu-1', 'stu-3', 'stu-4', 'stu-5']);
  });

  it('제외 모드가 켜져 있으면 이미 뽑힌 학생도 뺀다', () => {
    const pool = remainingPool(roster(), [], ['stu-1', 'stu-3'], true);
    expect(pool.map((s) => s.id)).toEqual(['stu-2', 'stu-4', 'stu-5']);
  });

  it('제외 모드가 꺼져 있으면 뽑힌 학생도 다시 뽑힐 수 있다', () => {
    const pool = remainingPool(roster(), [], ['stu-1', 'stu-3'], false);
    expect(pool).toHaveLength(5);
  });
});

describe('drawOne', () => {
  it('풀에서 한 명을 뽑는다 — 같은 시드는 같은 사람', () => {
    const first = drawOne(roster(), createSeededRng(7));
    const second = drawOne(roster(), createSeededRng(7));

    expect(first).not.toBeNull();
    expect(first?.id).toBe(second?.id);
  });

  it('빈 풀에서는 null이다', () => {
    expect(drawOne([], createSeededRng(1))).toBeNull();
  });
});
