import { describe, expect, it } from 'vitest';

import {
  countPastAssignments,
  isExcluded,
  parseLocalDate,
  roleAppliesOn,
  runAutoAssign,
  summarizeFairness,
  weekdayOf,
  type DutyCandidate,
} from '../../src/features/duty/dutyCore';
import { createDutyProfile, createDutyRole, createDutyRound } from '../../src/shared/domain/factories';
import type { DutyProfile, DutyRole, DutyRound } from '../../src/shared/domain/types';

const NOW = '2026-03-02T09:00:00.000Z';
/** 2026-03-02는 월요일 */
const MONDAY = '2026-03-02';
const SATURDAY = '2026-03-07';

function candidates(count: number): DutyCandidate[] {
  return Array.from({ length: count }, (_, i) => ({ id: `stu-${i + 1}`, order: i + 1 }));
}

function profiles(list: DutyProfile[]): Map<string, DutyProfile> {
  return new Map(list.map((p) => [p.studentId, p]));
}

function allProfiles(count: number, overrides: Record<string, Partial<DutyProfile>> = {}): Map<string, DutyProfile> {
  return profiles(
    Array.from({ length: count }, (_, i) => {
      const id = `stu-${i + 1}`;
      return { ...createDutyProfile(id, i + 1), ...overrides[id] };
    }),
  );
}

function role(name: string, neededCount: number, extra: Partial<DutyRole> = {}): DutyRole {
  return {
    ...createDutyRole({ classId: 'class-1', name, category: '청소구역', neededCount, cycle: 'weekly' }, NOW),
    ...extra,
  };
}

function round(assignments: Array<[string, string[]]>): DutyRound {
  return createDutyRound(
    {
      classId: 'class-1',
      startDate: '2026-02-23',
      endDate: '2026-02-27',
      label: '지난주',
      assignments: assignments.map(([roleId, studentIds]) => ({ roleId, studentIds })),
    },
    NOW,
  );
}

describe('parseLocalDate / weekdayOf', () => {
  it('YYYY-MM-DD를 지역 시간 기준으로 읽는다', () => {
    const date = parseLocalDate('2026-03-02');

    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(2);
    expect(date?.getDate()).toBe(2);
  });

  it('2026-03-02는 월요일이다', () => {
    // 원본은 UTC 자정으로 파싱해 UTC보다 뒤진 시간대에서 요일이 하루 밀렸다.
    expect(weekdayOf('2026-03-02')).toBe(1);
    expect(weekdayOf('2026-03-07')).toBe(6);
    expect(weekdayOf('2026-03-08')).toBe(0);
  });

  it('없는 날짜를 거절한다', () => {
    expect(parseLocalDate('2026-02-31')).toBeNull();
    expect(parseLocalDate('2026-13-01')).toBeNull();
    expect(weekdayOf('아무거나')).toBeNull();
  });
});

describe('isExcluded', () => {
  const cleaning = role('교실 바닥', 2);

  it('제외 조건이 없으면 뺴지 않는다', () => {
    expect(isExcluded(createDutyProfile('stu-1', 1), cleaning, { date: MONDAY })).toBe(false);
  });

  it('그날 결석한 학생을 뺀다', () => {
    const result = isExcluded(createDutyProfile('stu-1', 1), cleaning, {
      date: MONDAY,
      absentStudentIds: new Set(['stu-1']),
    });

    expect(result).toBe(true);
  });

  it('역할 쪽에서 뺀 학생을 뺀다', () => {
    const withExclusion = role('교실 바닥', 2, { excludedStudentIds: ['stu-1'] });

    expect(isExcluded(createDutyProfile('stu-1', 1), withExclusion, { date: MONDAY })).toBe(true);
  });

  it('학생 쪽에서 뺀 역할이면 뺀다', () => {
    const profile = { ...createDutyProfile('stu-1', 1), excludedRoleIds: [cleaning.id] };

    expect(isExcluded(profile, cleaning, { date: MONDAY })).toBe(true);
  });

  it('지정한 날짜에 뺀다', () => {
    const profile = { ...createDutyProfile('stu-1', 1), excludedDates: [MONDAY] };

    expect(isExcluded(profile, cleaning, { date: MONDAY })).toBe(true);
    expect(isExcluded(profile, cleaning, { date: '2026-03-03' })).toBe(false);
  });

  it('지정한 요일에 뺀다', () => {
    const profile = { ...createDutyProfile('stu-1', 1), excludedWeekdays: [1] };

    expect(isExcluded(profile, cleaning, { date: MONDAY })).toBe(true);
    expect(isExcluded(profile, cleaning, { date: '2026-03-03' })).toBe(false);
  });

  it('제외 기간 안이면 뺀다', () => {
    const profile = {
      ...createDutyProfile('stu-1', 1),
      exclusionPeriods: [{ id: 'p1', startDate: '2026-03-01', endDate: '2026-03-05', reason: '입원' }],
    };

    expect(isExcluded(profile, cleaning, { date: MONDAY })).toBe(true);
    expect(isExcluded(profile, cleaning, { date: '2026-03-06' })).toBe(false);
    expect(isExcluded(profile, cleaning, { date: '2026-02-28' })).toBe(false);
  });

  it('역할별 요일 제외를 지킨다', () => {
    const profile = {
      ...createDutyProfile('stu-1', 1),
      roleSpecificExclusions: { [cleaning.id]: { weekdays: [1] } },
    };

    expect(isExcluded(profile, cleaning, { date: MONDAY, roleId: cleaning.id })).toBe(true);
    // 다른 역할에는 영향을 주지 않는다
    expect(isExcluded(profile, role('급식', 2), { date: MONDAY })).toBe(false);
  });
});

describe('roleAppliesOn', () => {
  it('활성 요일이 비면 매일 필요하다', () => {
    expect(roleAppliesOn(role('칠판', 1), MONDAY)).toBe(true);
    expect(roleAppliesOn(role('칠판', 1), SATURDAY)).toBe(true);
  });

  it('활성 요일을 지정하면 그날만 필요하다', () => {
    const weekdaysOnly = role('급식', 2, { activeDays: [1, 2, 3, 4, 5] });

    expect(roleAppliesOn(weekdaysOnly, MONDAY)).toBe(true);
    expect(roleAppliesOn(weekdaysOnly, SATURDAY)).toBe(false);
  });

  it('꺼 둔 역할은 배정하지 않는다', () => {
    expect(roleAppliesOn(role('폐지', 1, { isActive: false }), MONDAY)).toBe(false);
  });
});

describe('runAutoAssign', () => {
  const base = {
    profiles: allProfiles(10),
    history: [] as DutyRound[],
    date: MONDAY,
  };

  it('역할마다 필요한 인원을 채운다', () => {
    const roles = [role('교실 바닥', 4), role('칠판', 2)];
    const result = runAutoAssign({ ...base, candidates: candidates(10), roles });

    expect(result.warnings).toEqual([]);
    expect(result.assignments.find((a) => a.roleId === roles[0]!.id)?.studentIds).toHaveLength(4);
    expect(result.assignments.find((a) => a.roleId === roles[1]!.id)?.studentIds).toHaveLength(2);
  });

  it('한 사람이 여러 역할을 겹쳐 맡지 않는다', () => {
    const roles = [role('교실 바닥', 4), role('칠판', 2), role('급식', 2)];
    const result = runAutoAssign({ ...base, candidates: candidates(10), roles });

    const all = result.assignments.flatMap((a) => a.studentIds);
    expect(new Set(all).size).toBe(all.length);
  });

  it('학생이 모자라면 겹쳐서라도 채우고 알린다', () => {
    const roles = [role('교실 바닥', 3), role('칠판', 3)];
    const result = runAutoAssign({ ...base, candidates: candidates(4), roles });

    const assignedCounts = result.assignments.map((a) => a.studentIds.length);
    expect(assignedCounts).toEqual([3, 3]);
    // 4명뿐이므로 누군가는 두 역할을 맡는다
    const all = result.assignments.flatMap((a) => a.studentIds);
    expect(new Set(all).size).toBeLessThan(all.length);
  });

  it('배정할 학생이 아예 없으면 경고한다', () => {
    const cleaning = role('교실 바닥', 2, { excludedStudentIds: ['stu-1', 'stu-2'] });
    const result = runAutoAssign({
      ...base,
      candidates: candidates(2),
      roles: [cleaning],
      profiles: allProfiles(2),
    });

    expect(result.assignments[0]?.studentIds).toEqual([]);
    expect(result.warnings[0]?.message).toContain('배정할 수 있는 학생이 없습니다');
  });

  it('필요 인원을 못 채우면 몇 명인지 알린다', () => {
    const result = runAutoAssign({ ...base, candidates: candidates(2), roles: [role('교실 바닥', 5)] });

    expect(result.warnings[0]).toMatchObject({ needed: 5, assigned: 2 });
  });

  describe('공정성', () => {
    it('지난번에 적게 한 학생을 먼저 뽑는다', () => {
      /*
       * 이 기능에서 가장 나쁜 실패는 특정 학생만 계속 당번에 걸리는 것이다.
       * 화면상으로는 정상이라 교사가 알아채기 어렵다.
       */
      const cleaning = role('교실 바닥', 2);
      const history = [round([[cleaning.id, ['stu-1', 'stu-2']]])];

      const result = runAutoAssign({ ...base, candidates: candidates(4), roles: [cleaning], history });

      expect(result.assignments[0]?.studentIds).toEqual(['stu-3', 'stu-4']);
    });

    it('같은 횟수면 번호 순으로 뽑는다', () => {
      // 무작위가 아니라 규칙이어야 교사가 학생에게 설명할 수 있다.
      const result = runAutoAssign({ ...base, candidates: candidates(6), roles: [role('칠판', 2)] });

      expect(result.assignments[0]?.studentIds).toEqual(['stu-1', 'stu-2']);
    });

    it('지난 이력이 많은 학생이라도 오늘 아무것도 안 맡는 것보다는 낫다', () => {
      /*
       * 누적 횟수만 보고 뽑으면, 이력이 적은 학생 한 명이 오늘 역할을 둘 다
       * 가져가고 다른 학생은 아무것도 안 하게 된다.
       * 하루 안에서는 먼저 서로 다른 사람에게 나눠 주고, 모자랄 때만 겹친다.
       */
      const roleA = role('교실 바닥', 1);
      const roleB = role('칠판', 1);
      const history = [round([['past', ['stu-2', 'stu-2', 'stu-2']]])];

      const result = runAutoAssign({
        ...base,
        candidates: candidates(2),
        profiles: allProfiles(2),
        roles: [roleA, roleB],
        history,
      });

      expect(result.assignments.find((a) => a.roleId === roleA.id)?.studentIds).toEqual(['stu-1']);
      expect(result.assignments.find((a) => a.roleId === roleB.id)?.studentIds).toEqual(['stu-2']);
    });

    it('여러 번 돌리면 모두에게 돌아간다', () => {
      const cleaning = role('교실 바닥', 2);
      const history: DutyRound[] = [];

      for (let week = 0; week < 5; week += 1) {
        const result = runAutoAssign({ ...base, candidates: candidates(10), roles: [cleaning], history });
        history.push(round([[cleaning.id, result.assignments[0]?.studentIds ?? []]]));
      }

      const counts = countPastAssignments(history);
      // 10명이 5주간 2명씩 = 10칸. 정확히 한 번씩 돌아가야 한다.
      expect([...counts.values()].every((count) => count === 1)).toBe(true);
      expect(counts.size).toBe(10);
    });
  });

  describe('고정', () => {
    it('고정 담당자를 먼저 넣는다', () => {
      const cleaning = role('교실 바닥', 2, { fixedStudentIds: ['stu-9'] });
      const result = runAutoAssign({ ...base, candidates: candidates(10), roles: [cleaning] });

      expect(result.assignments[0]?.studentIds).toContain('stu-9');
    });

    it('고정 담당자라도 그날 제외 대상이면 넣지 않는다', () => {
      const cleaning = role('교실 바닥', 2, { fixedStudentIds: ['stu-9'] });
      const result = runAutoAssign({
        ...base,
        candidates: candidates(10),
        roles: [cleaning],
        absentStudentIds: new Set(['stu-9']),
      });

      expect(result.assignments[0]?.studentIds).not.toContain('stu-9');
      expect(result.assignments[0]?.studentIds).toHaveLength(2);
    });

    it('잠근 역할은 지난 배정을 그대로 둔다', () => {
      const cleaning = role('교실 바닥', 2);
      const blackboard = role('칠판', 2);

      const result = runAutoAssign({
        ...base,
        candidates: candidates(10),
        roles: [cleaning, blackboard],
        lockedRoleIds: [cleaning.id],
        previousAssignments: [{ roleId: cleaning.id, studentIds: ['stu-7', 'stu-8'] }],
      });

      expect(result.assignments.find((a) => a.roleId === cleaning.id)?.studentIds).toEqual([
        'stu-7',
        'stu-8',
      ]);
      // 잠긴 역할의 학생은 다른 역할에 겹쳐 들어가지 않는다
      const other = result.assignments.find((a) => a.roleId === blackboard.id)?.studentIds ?? [];
      expect(other).not.toContain('stu-7');
    });
  });

  it('그날 필요 없는 역할은 배정하지 않는다', () => {
    const lunch = role('급식', 2, { activeDays: [1, 2, 3, 4, 5] });
    const result = runAutoAssign({ ...base, candidates: candidates(10), roles: [lunch], date: SATURDAY });

    expect(result.assignments).toEqual([]);
  });

  it('같은 입력이면 같은 결과가 나온다', () => {
    const roles = [role('교실 바닥', 4), role('칠판', 2)];
    const input = { ...base, candidates: candidates(12), roles };

    expect(runAutoAssign(input).assignments).toEqual(runAutoAssign(input).assignments);
  });
});

describe('summarizeFairness', () => {
  it('한 번도 안 한 학생을 0으로 센다', () => {
    // 빠뜨리면 쏠림이 드러나지 않는다.
    const summary = summarizeFairness(candidates(4), [round([['role-1', ['stu-1', 'stu-1']]])]);

    expect(summary.counts.get('stu-4')).toBe(0);
    expect(summary.min).toBe(0);
    expect(summary.max).toBe(2);
    expect(summary.spread).toBe(2);
  });

  it('유독 많이 한 학생을 짚어 준다', () => {
    const history = [
      round([['role-1', ['stu-1', 'stu-1', 'stu-1', 'stu-1']]]),
      round([['role-1', ['stu-2']]]),
    ];

    const summary = summarizeFairness(candidates(4), history);

    expect(summary.overloadedStudentIds).toContain('stu-1');
    expect(summary.underloadedStudentIds).toContain('stu-4');
  });

  it('고르게 배정되면 쏠림이 없다', () => {
    const history = [round([['role-1', ['stu-1', 'stu-2', 'stu-3', 'stu-4']]])];
    const summary = summarizeFairness(candidates(4), history);

    expect(summary.spread).toBe(0);
    expect(summary.overloadedStudentIds).toEqual([]);
    expect(summary.underloadedStudentIds).toEqual([]);
  });

  it('기록이 없어도 견딘다', () => {
    expect(summarizeFairness([], []).spread).toBe(0);
  });
});
