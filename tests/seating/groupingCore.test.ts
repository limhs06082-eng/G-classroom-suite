import { describe, expect, it } from 'vitest';

import {
  computeGroupCount,
  computeTargetCapacities,
  createDefaultGroups,
  MAX_GROUP_COUNT,
  MIN_GROUP_COUNT,
  performBalancedGrouping,
  performRandomGrouping,
  type BalancedInput,
} from '../../src/features/seating/groupingCore';
import { createSeededRng } from '../../src/features/seating/rng';
import type { Gender, Group } from '../../src/shared/domain/types';

const NOW = '2026-03-02T09:00:00.000Z';
const EARLIER = '2026-03-01T09:00:00.000Z';

const ids = (count: number): string[] => Array.from({ length: count }, (_, i) => `stu-${i + 1}`);

function group(id: string, name: string, studentIds: string[], leaderId: string | null = null): Group {
  return {
    id,
    classId: 'class-1',
    name,
    color: 'sky',
    studentIds,
    leaderId,
    createdAt: EARLIER,
    updatedAt: EARLIER,
  };
}

const rng = () => createSeededRng(42);

describe('computeGroupCount', () => {
  it('모둠 수 지정 모드는 그 값을 쓰되 범위를 벗어나지 않는다', () => {
    expect(computeGroupCount('groupCount', 4, 4, 24)).toBe(4);
    expect(computeGroupCount('groupCount', 1, 4, 24)).toBe(MIN_GROUP_COUNT);
    expect(computeGroupCount('groupCount', 99, 4, 24)).toBe(MAX_GROUP_COUNT);
  });

  it('모둠당 인원 모드는 인원으로 나눈 값을 올림한다', () => {
    expect(computeGroupCount('membersPerGroup', 4, 4, 24)).toBe(6);
    expect(computeGroupCount('membersPerGroup', 4, 4, 25)).toBe(7);
  });

  it('학생이 없으면 최소 모둠 수를 쓴다', () => {
    expect(computeGroupCount('groupCount', 5, 4, 0)).toBe(MIN_GROUP_COUNT);
  });
});

describe('computeTargetCapacities', () => {
  it('나누어떨어지면 똑같이 나눈다', () => {
    expect(computeTargetCapacities(24, 4)).toEqual([6, 6, 6, 6]);
  });

  it('나머지는 앞쪽 모둠부터 한 명씩 더 받는다', () => {
    expect(computeTargetCapacities(26, 4)).toEqual([7, 7, 6, 6]);
  });

  it('정원의 합은 항상 전체 인원과 같다', () => {
    for (const total of [1, 7, 23, 30]) {
      for (const count of [2, 3, 5, 7]) {
        const sum = computeTargetCapacities(total, count).reduce((a, b) => a + b, 0);
        expect(sum).toBe(total);
      }
    }
  });
});

describe('createDefaultGroups', () => {
  it('개수만큼 이름과 색을 붙여 만든다', () => {
    const groups = createDefaultGroups(3, 'class-1', NOW);

    expect(groups.map((g) => g.name)).toEqual(['1모둠', '2모둠', '3모둠']);
    expect(new Set(groups.map((g) => g.color)).size).toBe(3);
    expect(groups.every((g) => g.studentIds.length === 0)).toBe(true);
  });
});

describe('performRandomGrouping', () => {
  it('모든 학생을 빠짐없이 배정한다', () => {
    const result = performRandomGrouping(ids(24), 'class-1', 4, [], [], NOW, rng());

    const assigned = result.groups.flatMap((g) => g.studentIds);
    expect(assigned).toHaveLength(24);
    expect(new Set(assigned).size).toBe(24);
  });

  it('한 학생이 두 모둠에 들어가지 않는다', () => {
    // Group.studentIds 방향을 택한 대가. 여기서 반드시 지켜야 한다.
    const result = performRandomGrouping(ids(17), 'class-1', 5, [], [], NOW, rng());

    const assigned = result.groups.flatMap((g) => g.studentIds);
    expect(new Set(assigned).size).toBe(assigned.length);
  });

  it('인원을 고르게 나눈다', () => {
    const result = performRandomGrouping(ids(23), 'class-1', 4, [], [], NOW, rng());
    const sizes = result.groups.map((g) => g.studentIds.length).sort((a, b) => a - b);

    // 23명을 4모둠이면 5,6,6,6
    expect(sizes[sizes.length - 1]! - sizes[0]!).toBeLessThanOrEqual(1);
  });

  it('같은 시드는 같은 편성을 낸다', () => {
    const a = performRandomGrouping(ids(20), 'class-1', 4, [], [], NOW, createSeededRng(7));
    const b = performRandomGrouping(ids(20), 'class-1', 4, [], [], NOW, createSeededRng(7));

    expect(a.groups.map((g) => g.studentIds)).toEqual(b.groups.map((g) => g.studentIds));
  });

  describe('기존 모둠 유지', () => {
    it('교사가 붙인 이름과 색을 지운다면 다시 붙여야 한다', () => {
      const existing = [group('g-1', '독수리모둠', ['stu-1']), group('g-2', '호랑이모둠', ['stu-2'])];
      const result = performRandomGrouping(ids(8), 'class-1', 2, existing, [], NOW, rng());

      expect(result.groups.map((g) => g.name)).toEqual(['독수리모둠', '호랑이모둠']);
      expect(result.groups.map((g) => g.id)).toEqual(['g-1', 'g-2']);
    });

    it('모둠 수를 늘리면 기존 모둠 뒤에 새 모둠이 붙는다', () => {
      const existing = [group('g-1', '독수리모둠', [])];
      const result = performRandomGrouping(ids(9), 'class-1', 3, existing, [], NOW, rng());

      expect(result.groups).toHaveLength(3);
      expect(result.groups[0]?.name).toBe('독수리모둠');
      expect(result.groups[1]?.name).toBe('2모둠');
    });
  });

  describe('모둠 고정', () => {
    it('고정한 학생은 원래 모둠에 남는다', () => {
      const existing = [group('g-1', '1모둠', ['stu-1', 'stu-2']), group('g-2', '2모둠', ['stu-3'])];
      const result = performRandomGrouping(ids(9), 'class-1', 2, existing, ['stu-1'], NOW, rng());

      expect(result.groups[0]?.studentIds).toContain('stu-1');
      expect(result.lockedStudentIds).toEqual(['stu-1']);
      expect(result.lockCleared).toBe(false);
    });

    it('모둠 수를 줄여 고정이 풀리면 알린다', () => {
      // 조용히 흘리면 교사는 왜 자리가 바뀌었는지 알 수 없다.
      const existing = [group('g-1', '1모둠', ['stu-1']), group('g-2', '2모둠', ['stu-2'])];
      const result = performRandomGrouping(ids(6), 'class-1', 1, existing, ['stu-2'], NOW, rng());

      expect(result.lockCleared).toBe(true);
      expect(result.lockedStudentIds).toEqual([]);
    });

    it('고정 학생이 한 모둠에 몰려 정원을 넘겨도 아무도 빠뜨리지 않는다', () => {
      const existing = [group('g-1', '1모둠', ['stu-1', 'stu-2', 'stu-3']), group('g-2', '2모둠', [])];
      const result = performRandomGrouping(
        ids(4),
        'class-1',
        2,
        existing,
        ['stu-1', 'stu-2', 'stu-3'],
        NOW,
        rng(),
      );

      const assigned = result.groups.flatMap((g) => g.studentIds);
      expect(assigned).toHaveLength(4);
      expect(new Set(assigned)).toEqual(new Set(ids(4)));
    });
  });

  describe('모둠장', () => {
    it('모둠장이 그 모둠에 남으면 유지한다', () => {
      const existing = [group('g-1', '1모둠', ['stu-1', 'stu-2'], 'stu-1'), group('g-2', '2모둠', [])];
      const result = performRandomGrouping(ids(6), 'class-1', 2, existing, ['stu-1'], NOW, rng());

      expect(result.groups[0]?.leaderId).toBe('stu-1');
    });

    it('모둠장이 다른 모둠으로 가면 해제한다', () => {
      const existing = [group('g-1', '1모둠', ['stu-1'], 'stu-1'), group('g-2', '2모둠', [])];
      const result = performRandomGrouping(ids(6), 'class-1', 2, existing, [], NOW, rng());

      for (const g of result.groups) {
        if (g.leaderId !== null) expect(g.studentIds).toContain(g.leaderId);
      }
    });
  });

  it('어떤 조합에서도 학생을 빠뜨리거나 중복 배정하지 않는다', () => {
    /*
     * 이 기능에서 가장 위험한 실패는 "학생 한 명이 조용히 사라지는 것"이다.
     * 모둠은 멀쩡해 보이고 교사는 인원을 세어 보기 전까지 알 수 없다.
     * 인원·모둠 수·고정 조합을 넓게 훑어 이 조건 하나를 못 박는다.
     */
    for (const total of [1, 2, 5, 12, 23, 30]) {
      for (const count of [2, 3, 4, 7]) {
        for (const lockedCount of [0, 1, Math.floor(total / 2), total]) {
          const studentIds = ids(total);
          const locked = studentIds.slice(0, Math.min(lockedCount, total));

          // 고정 학생을 전부 첫 모둠에 몰아넣어 가장 불리한 상황을 만든다
          const existing = [group('g-1', '1모둠', [...locked])];

          const result = performRandomGrouping(
            studentIds,
            'class-1',
            count,
            existing,
            locked,
            NOW,
            createSeededRng(total * 100 + count * 10 + lockedCount),
          );

          const assigned = result.groups.flatMap((g) => g.studentIds);
          const label = `학생 ${total}명 / ${count}모둠 / 고정 ${locked.length}명`;

          expect(assigned.length, `${label} — 누락`).toBe(total);
          expect(new Set(assigned).size, `${label} — 중복`).toBe(total);
        }
      }
    }
  });

  it('학생이 없어도 빈 모둠을 만들어 돌려준다', () => {
    const result = performRandomGrouping([], 'class-1', 3, [], [], NOW, rng());

    expect(result.groups).toHaveLength(3);
    expect(result.groups.every((g) => g.studentIds.length === 0)).toBe(true);
  });
});

describe('performBalancedGrouping', () => {
  const person = (id: string, gender: Gender, tags: string[] = []): BalancedInput => ({
    studentId: id,
    gender,
    tags,
  });

  /** 남녀 번갈아 24명 */
  const mixed = (): BalancedInput[] =>
    Array.from({ length: 24 }, (_, i) => person(`stu-${i + 1}`, i % 2 === 0 ? 'male' : 'female'));

  const memberCount = (groups: Group[]): number =>
    groups.reduce((sum, g) => sum + g.studentIds.length, 0);

  it('총원이 보존된다 — 빠지거나 겹치지 않는다', () => {
    const all = performBalancedGrouping(mixed(), 'class-1', 4, [], [], NOW, rng()).groups.flatMap(
      (g) => g.studentIds,
    );

    expect(all).toHaveLength(24);
    expect(new Set(all).size).toBe(24);
  });

  it('성별이 모둠마다 고르게 퍼진다', () => {
    const people = mixed();
    const male = new Set(people.filter((p) => p.gender === 'male').map((p) => p.studentId));
    const { groups } = performBalancedGrouping(people, 'class-1', 4, [], [], NOW, rng());

    // 남 12명을 4모둠에 나누므로 정확히 3명씩이어야 한다.
    for (const g of groups) {
      expect(g.studentIds.filter((id) => male.has(id))).toHaveLength(3);
    }
  });

  it('같은 태그를 가진 학생이 서로 다른 모둠으로 흩어진다', () => {
    const people: BalancedInput[] = [
      ...Array.from({ length: 3 }, (_, i) => person(`care-${i + 1}`, 'male', ['도움 필요'])),
      ...Array.from({ length: 9 }, (_, i) => person(`plain-${i + 1}`, 'female')),
    ];

    const { groups } = performBalancedGrouping(people, 'class-1', 3, [], [], NOW, rng());

    for (const g of groups) {
      expect(g.studentIds.filter((id) => id.startsWith('care-'))).toHaveLength(1);
    }
  });

  it('고정된 학생은 원래 모둠에 남는다', () => {
    const existing = [group('g-1', '1모둠', ['stu-1', 'stu-2']), group('g-2', '2모둠', ['stu-3'])];

    const { groups, lockedStudentIds } = performBalancedGrouping(
      mixed(),
      'class-1',
      4,
      existing,
      ['stu-1', 'stu-3'],
      NOW,
      rng(),
    );

    expect(groups[0]?.studentIds).toContain('stu-1');
    expect(groups[1]?.studentIds).toContain('stu-3');
    expect(lockedStudentIds).toEqual(['stu-1', 'stu-3']);
  });

  it('모둠 수가 줄어 갈 곳이 없어진 고정은 알린다', () => {
    const existing = [
      group('g-1', '1모둠', []),
      group('g-2', '2모둠', []),
      group('g-3', '3모둠', ['stu-5']),
    ];

    const { lockCleared } = performBalancedGrouping(
      mixed(),
      'class-1',
      2,
      existing,
      ['stu-5'],
      NOW,
      rng(),
    );

    expect(lockCleared).toBe(true);
  });

  it('태그가 하나도 없어도 동작한다', () => {
    const { groups } = performBalancedGrouping(mixed(), 'class-1', 3, [], [], NOW, rng());

    expect(memberCount(groups)).toBe(24);
  });

  it('한쪽 성별만 있어도 깨지지 않는다', () => {
    const people = Array.from({ length: 10 }, (_, i) => person(`stu-${i + 1}`, 'male'));
    const { groups } = performBalancedGrouping(people, 'class-1', 3, [], [], NOW, rng());

    expect(memberCount(groups)).toBe(10);
    expect(groups.map((g) => g.studentIds.length).sort()).toEqual([3, 3, 4]);
  });

  it('성별이 지정되지 않아도(none) 인원은 고르게 나뉜다', () => {
    const people = Array.from({ length: 9 }, (_, i) => person(`stu-${i + 1}`, 'none'));
    const { groups } = performBalancedGrouping(people, 'class-1', 3, [], [], NOW, rng());

    expect(groups.map((g) => g.studentIds.length)).toEqual([3, 3, 3]);
  });

  it('모둠 수가 학생 수보다 많아도 깨지지 않는다', () => {
    const people = [person('stu-1', 'male'), person('stu-2', 'female')];
    const { groups } = performBalancedGrouping(people, 'class-1', 5, [], [], NOW, rng());

    expect(groups).toHaveLength(5);
    expect(memberCount(groups)).toBe(2);
  });

  it('학생이 없어도 빈 모둠을 돌려준다', () => {
    const { groups } = performBalancedGrouping([], 'class-1', 3, [], [], NOW, rng());

    expect(groups).toHaveLength(3);
    expect(memberCount(groups)).toBe(0);
  });

  it('같은 씨앗이면 같은 편성이 나온다', () => {
    const people = mixed();
    const a = performBalancedGrouping(people, 'class-1', 4, [], [], NOW, createSeededRng(7));
    const b = performBalancedGrouping(people, 'class-1', 4, [], [], NOW, createSeededRng(7));

    expect(a.groups.map((g) => g.studentIds)).toEqual(b.groups.map((g) => g.studentIds));
  });

  it('기존 모둠의 이름·색·id는 유지한다', () => {
    const existing = [group('g-1', '독수리', []), group('g-2', '호랑이', [])];
    const { groups } = performBalancedGrouping(mixed(), 'class-1', 2, existing, [], NOW, rng());

    expect(groups.map((g) => g.name)).toEqual(['독수리', '호랑이']);
    expect(groups[0]?.id).toBe('g-1');
  });

  it('어떤 조합에서도 학생이 누락되거나 겹치지 않는다', () => {
    for (const total of [1, 7, 24, 25, 31]) {
      for (const count of [2, 3, 4, 6]) {
        const people = Array.from({ length: total }, (_, i) =>
          person(
            `stu-${i + 1}`,
            (['male', 'female', 'other', 'none'] as const)[i % 4] ?? 'none',
            i % 3 === 0 ? ['도움 필요'] : [],
          ),
        );

        const { groups } = performBalancedGrouping(
          people,
          'class-1',
          count,
          [],
          [],
          NOW,
          createSeededRng(total * 100 + count),
        );

        const assigned = groups.flatMap((g) => g.studentIds);
        const label = `학생 ${total}명 / ${count}모둠`;

        expect(assigned.length, `${label} — 누락`).toBe(total);
        expect(new Set(assigned).size, `${label} — 중복`).toBe(total);
      }
    }
  });
});
