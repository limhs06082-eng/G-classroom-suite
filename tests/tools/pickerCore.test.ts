import { describe, expect, it } from 'vitest';

import { createSeededRng } from '../../src/features/seating/rng';
import { drawMany, drawOne, drawPerGroup, remainingPool } from '../../src/features/tools/pickerCore';
import { createStudent } from '../../src/shared/domain/factories';
import type { Group, Student } from '../../src/shared/domain/types';

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

describe('drawPerGroup — 모둠마다 한 명', () => {
  const groups: Group[] = [
    { id: 'g-1', classId: 'class-1', name: '1모둠', color: 'sky', studentIds: ['stu-1', 'stu-2'], leaderId: null, createdAt: NOW, updatedAt: NOW },
    { id: 'g-2', classId: 'class-1', name: '2모둠', color: 'teal', studentIds: ['stu-3', 'stu-4'], leaderId: null, createdAt: NOW, updatedAt: NOW },
    { id: 'g-3', classId: 'class-1', name: '3모둠', color: 'amber', studentIds: ['stu-5'], leaderId: null, createdAt: NOW, updatedAt: NOW },
  ];

  it('모둠 순서대로 한 명씩, 풀에 없는 학생은 뽑지 않는다', () => {
    // stu-5는 결석 등으로 풀에서 빠진 상태
    const pool = roster().filter((s) => s.id !== 'stu-5');
    const picked = drawPerGroup(groups, pool, createSeededRng(3));

    expect(picked).toHaveLength(2);
    expect(picked[0]?.group.id).toBe('g-1');
    expect(['stu-1', 'stu-2']).toContain(picked[0]?.student.id);
    expect(picked[1]?.group.id).toBe('g-2');
    expect(['stu-3', 'stu-4']).toContain(picked[1]?.student.id);
  });

  it('풀이 전부 비어 있으면 빈 목록이다', () => {
    expect(drawPerGroup(groups, [], createSeededRng(1))).toEqual([]);
  });
});

describe('drawMany', () => {
  it('겹치지 않게 여러 명을 뽑는다', () => {
    const picked = drawMany(roster(), 3, createSeededRng(7));

    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((s) => s.id)).size).toBe(3);
  });

  it('풀보다 많이 달라면 풀 전부를 준다', () => {
    expect(drawMany(roster(), 10, createSeededRng(1))).toHaveLength(5);
  });

  it('같은 시드는 같은 사람들을 같은 순서로 준다', () => {
    const first = drawMany(roster(), 2, createSeededRng(7)).map((s) => s.id);
    const second = drawMany(roster(), 2, createSeededRng(7)).map((s) => s.id);

    expect(first).toEqual(second);
  });

  it('0명이나 빈 풀에서는 빈 목록이다', () => {
    expect(drawMany(roster(), 0, createSeededRng(1))).toEqual([]);
    expect(drawMany([], 2, createSeededRng(1))).toEqual([]);
  });
});
