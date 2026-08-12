import { describe, expect, it } from 'vitest';

import {
  createClassRoom,
  createDutyCompletion,
  createDutyRole,
  createDutyRound,
  createEmptySuiteData,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import { validateAndRepair } from '../../src/shared/domain/invariants';
import type { SuiteData } from '../../src/shared/domain/types';

const NOW = '2026-03-02T09:00:00.000Z';
const EARLIER = '2026-03-01T09:00:00.000Z';

function baseData(): SuiteData {
  return {
    ...createEmptySuiteData(),
    terms: [
      createTerm(
        { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
        EARLIER,
      ),
    ],
    classRooms: [createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, EARLIER)],
    students: [
      createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' }, EARLIER),
      createStudent({ id: 'stu-2', classId: 'class-1', number: 2, name: '이두리' }, EARLIER),
    ],
    dutyRoles: [
      createDutyRole(
        { id: 'role-1', classId: 'class-1', name: '교실 바닥', category: '청소구역', neededCount: 2, cycle: 'weekly' },
        EARLIER,
      ),
    ],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

function withRound(data: SuiteData, studentIds: string[], roleId = 'role-1'): SuiteData {
  return {
    ...data,
    dutyRounds: [
      createDutyRound(
        {
          id: 'round-1',
          classId: 'class-1',
          startDate: '2026-03-02',
          endDate: '2026-03-06',
          label: '3월 1주차',
          assignments: [{ roleId, studentIds }],
        },
        EARLIER,
      ),
    ],
  };
}

const codes = (result: ReturnType<typeof validateAndRepair>): string[] =>
  result.repairs.map((r) => r.code);
const assignedOf = (data: SuiteData): string[] =>
  data.dutyRounds[0]?.assignments[0]?.studentIds ?? [];

describe('역할·당번 불변조건', () => {
  it('올바른 데이터는 건드리지 않는다', () => {
    const result = validateAndRepair(withRound(baseData(), ['stu-1', 'stu-2']), NOW);

    expect(result.repairs).toEqual([]);
    expect(assignedOf(result.data)).toEqual(['stu-1', 'stu-2']);
  });

  it('없는 학급의 역할을 정리한다', () => {
    const data = baseData();
    data.dutyRoles.push(
      createDutyRole(
        { id: 'role-x', classId: 'class-gone', name: '유령', category: '기타', neededCount: 1, cycle: 'weekly' },
        EARLIER,
      ),
    );

    const result = validateAndRepair(data, NOW);

    expect(codes(result)).toContain('ORPHAN_DUTY_RECORD');
    expect(result.data.dutyRoles.map((r) => r.id)).toEqual(['role-1']);
  });

  it('없는 학생을 가리키는 배정을 비운다', () => {
    // 그냥 두면 오늘의 당번에 유령 이름이 뜬다.
    const result = validateAndRepair(withRound(baseData(), ['stu-1', 'ghost']), NOW);

    expect(codes(result)).toContain('INVALID_DUTY_ASSIGNMENT');
    expect(assignedOf(result.data)).toEqual(['stu-1']);
  });

  it('다른 반 학생이 배정돼 있으면 비운다', () => {
    const data = baseData();
    data.classRooms.push(createClassRoom({ id: 'class-2', termId: 'term-1', name: '3학년 3반' }, EARLIER));
    data.students.push(createStudent({ id: 'stu-9', classId: 'class-2', number: 1, name: '남의반' }, EARLIER));

    const result = validateAndRepair(withRound(data, ['stu-1', 'stu-9']), NOW);

    expect(codes(result)).toContain('INVALID_DUTY_ASSIGNMENT');
    expect(assignedOf(result.data)).toEqual(['stu-1']);
  });

  it('같은 역할에 같은 학생이 두 번 들어가면 한 번만 남긴다', () => {
    const result = validateAndRepair(withRound(baseData(), ['stu-1', 'stu-1']), NOW);

    expect(codes(result)).toContain('INVALID_DUTY_ASSIGNMENT');
    expect(assignedOf(result.data)).toEqual(['stu-1']);
  });

  it('없는 역할을 가리키는 배정을 걷어낸다', () => {
    const result = validateAndRepair(withRound(baseData(), ['stu-1'], 'role-gone'), NOW);

    expect(codes(result)).toContain('INVALID_DUTY_ASSIGNMENT');
    expect(result.data.dutyRounds[0]?.assignments).toEqual([]);
  });

  it('역할의 고정·제외 목록에서 남의 반 학생을 정리한다', () => {
    const data = baseData();
    data.dutyRoles[0]!.fixedStudentIds = ['stu-1', 'ghost'];
    data.dutyRoles[0]!.excludedStudentIds = ['ghost'];

    const result = validateAndRepair(data, NOW);

    expect(result.data.dutyRoles[0]?.fixedStudentIds).toEqual(['stu-1']);
    expect(result.data.dutyRoles[0]?.excludedStudentIds).toEqual([]);
  });

  it('잠근 역할 목록에서 없어진 역할을 뺀다', () => {
    const data = withRound(baseData(), ['stu-1']);
    data.dutyRounds[0]!.lockedRoleIds = ['role-1', 'role-gone'];

    const result = validateAndRepair(data, NOW);

    expect(result.data.dutyRounds[0]?.lockedRoleIds).toEqual(['role-1']);
  });

  it('수행 기록에서 없는 학생을 정리한다', () => {
    const data = baseData();
    data.dutyCompletions = [
      {
        ...createDutyCompletion('class-1', '2026-03-02'),
        completed: [
          { roleId: 'role-1', studentId: 'stu-1' },
          { roleId: 'role-1', studentId: 'ghost' },
        ],
      },
    ];

    const result = validateAndRepair(data, NOW);

    expect(result.data.dutyCompletions[0]?.completed).toEqual([
      { roleId: 'role-1', studentId: 'stu-1' },
    ]);
  });

  it('복구 결과를 다시 검사하면 더 고칠 것이 없다', () => {
    const data = withRound(baseData(), ['stu-1', 'ghost', 'stu-1']);
    data.dutyRoles[0]!.fixedStudentIds = ['ghost'];

    const first = validateAndRepair(data, NOW);
    expect(first.repairs.length).toBeGreaterThan(0);
    expect(validateAndRepair(first.data, NOW).repairs).toEqual([]);
  });
});
