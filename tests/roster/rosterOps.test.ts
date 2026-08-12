import { describe, expect, it } from 'vitest';

import {
  createClassRoom,
  createEmptySuiteData,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import { validateAndRepair } from '../../src/shared/domain/invariants';
import type { SuiteData } from '../../src/shared/domain/types';
import type { ParsedRosterRow } from '../../src/shared/roster/parseRosterText';
import {
  addStudent,
  applyRosterImport,
  deleteStudent,
  planRosterImport,
  setStudentStatus,
  updateStudent,
} from '../../src/shared/roster/rosterOps';

const NOW = '2026-03-02T09:00:00.000Z';
const EARLIER = '2026-03-01T09:00:00.000Z';
const CLASS_ID = 'class-1';

function baseData(students: Array<{ id: string; number: number; name: string }> = []): SuiteData {
  return {
    ...createEmptySuiteData(),
    terms: [
      createTerm(
        { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
        EARLIER,
      ),
    ],
    classRooms: [createClassRoom({ id: CLASS_ID, termId: 'term-1', name: '3학년 2반' }, EARLIER)],
    students: students.map((s) =>
      createStudent({ id: s.id, classId: CLASS_ID, number: s.number, name: s.name }, EARLIER),
    ),
    activeTermId: 'term-1',
    activeClassId: CLASS_ID,
  };
}

function rows(...pairs: Array<[number, string]>): ParsedRosterRow[] {
  return pairs.map(([number, name], index) => ({ line: index + 1, number, name }));
}

const nameOf = (data: SuiteData, id: string): string | undefined =>
  data.students.find((s) => s.id === id)?.name;
const statusOf = (data: SuiteData, id: string): string | undefined =>
  data.students.find((s) => s.id === id)?.status;

describe('addStudent', () => {
  it('학생과 기능별 프로필을 함께 만든다', () => {
    const result = addStudent(baseData(), CLASS_ID, { number: 1, name: '김하나' }, NOW);

    expect(result.students).toHaveLength(1);
    // 명단에 추가하면 자리배치·당번·보상에서 곧바로 쓸 수 있어야 한다.
    expect(result.seatingProfiles).toHaveLength(1);
    expect(result.dutyProfiles).toHaveLength(1);
    expect(result.rewardProfiles).toHaveLength(1);
    expect(result.dutyProfiles[0]?.order).toBe(1);
  });
});

describe('setStudentStatus — 전출 처리는 삭제가 아니다', () => {
  it('전출시켜도 학생과 기록이 남는다', () => {
    const data = baseData([{ id: 'stu-1', number: 1, name: '김하나' }]);

    const result = setStudentStatus(data, 'stu-1', 'inactive', '3월 15일 전출', NOW);

    expect(result.students).toHaveLength(1);
    expect(statusOf(result, 'stu-1')).toBe('inactive');
    expect(result.students[0]?.statusMemo).toBe('3월 15일 전출');
    expect(result.students[0]?.statusChangedAt).toBe(NOW);
  });

  it('복귀시킬 수 있다', () => {
    const data = setStudentStatus(
      baseData([{ id: 'stu-1', number: 1, name: '김하나' }]),
      'stu-1',
      'inactive',
      undefined,
      NOW,
    );

    expect(statusOf(setStudentStatus(data, 'stu-1', 'active', undefined, NOW), 'stu-1')).toBe('active');
  });
});

describe('deleteStudent', () => {
  it('완전 삭제 후 남은 프로필은 불변조건 검사가 정리한다', () => {
    const data = addStudent(baseData(), CLASS_ID, { number: 1, name: '오타' }, NOW);
    const studentId = data.students[0]?.id ?? '';

    const deleted = deleteStudent(data, studentId);
    expect(deleted.students).toHaveLength(0);
    expect(deleted.seatingProfiles).toHaveLength(1); // 아직 남아 있다

    const { data: repaired } = validateAndRepair(deleted, NOW);
    expect(repaired.seatingProfiles).toHaveLength(0);
    expect(repaired.dutyProfiles).toHaveLength(0);
  });
});

describe('updateStudent', () => {
  it('이름과 번호를 고친다', () => {
    const data = baseData([{ id: 'stu-1', number: 1, name: '김하나' }]);

    const result = updateStudent(data, 'stu-1', { name: '김한나', number: 2 }, NOW);

    expect(nameOf(result, 'stu-1')).toBe('김한나');
    expect(result.students[0]?.number).toBe(2);
    expect(result.students[0]?.updatedAt).toBe(NOW);
  });
});

describe('planRosterImport — 동일인 판정', () => {
  const existing = baseData([
    { id: 'stu-1', number: 1, name: '김하나' },
    { id: 'stu-2', number: 2, name: '이두리' },
  ]);

  it('번호와 이름이 모두 같으면 같은 사람이다', () => {
    const plan = planRosterImport(existing, CLASS_ID, rows([1, '김하나'], [2, '이두리']), 'replace');

    expect(plan.added).toEqual([]);
    expect(plan.updated).toEqual([]);
    expect(plan.deactivated).toEqual([]);
  });

  it('이름이 양쪽에서 유일하면 번호가 바뀌어도 같은 사람이다', () => {
    // 학기가 바뀌어 번호를 새로 매긴 흔한 상황이다.
    const plan = planRosterImport(existing, CLASS_ID, rows([7, '김하나'], [8, '이두리']), 'replace');

    expect(plan.added).toEqual([]);
    expect(plan.updated).toHaveLength(2);
    expect(plan.deactivated).toEqual([]);
  });

  it('번호만 같고 이름이 다르면 다른 사람이다', () => {
    // 번호는 해마다 재사용된다. 같은 사람으로 보면 기록이 엉뚱한 학생에게 붙는다.
    const plan = planRosterImport(existing, CLASS_ID, rows([1, '박세찬']), 'replace');

    expect(plan.added.map((r) => r.name)).toEqual(['박세찬']);
    expect(plan.deactivated.map((s) => s.name).sort()).toEqual(['김하나', '이두리']);
  });

  it('동명이인이 있으면 이름만으로 이어붙이지 않는다', () => {
    const twins = baseData([
      { id: 'stu-1', number: 1, name: '김하나' },
      { id: 'stu-2', number: 2, name: '김하나' },
    ]);

    const plan = planRosterImport(twins, CLASS_ID, rows([5, '김하나']), 'add');

    expect(plan.added).toHaveLength(1);
    expect(plan.updated).toEqual([]);
  });
});

describe('applyRosterImport — replace', () => {
  it('목록에 없는 학생은 삭제가 아니라 전출 처리한다', () => {
    const data = baseData([
      { id: 'stu-1', number: 1, name: '김하나' },
      { id: 'stu-2', number: 2, name: '이두리' },
    ]);

    const result = applyRosterImport(data, CLASS_ID, rows([1, '김하나']), 'replace', NOW);

    expect(result.students).toHaveLength(2);
    expect(statusOf(result, 'stu-1')).toBe('active');
    expect(statusOf(result, 'stu-2')).toBe('inactive');
    expect(result.students.find((s) => s.id === 'stu-2')?.statusMemo).toContain('제외');
  });

  it('전출했던 학생이 목록에 다시 나오면 복귀시킨다', () => {
    const data = setStudentStatus(
      baseData([{ id: 'stu-1', number: 1, name: '김하나' }]),
      'stu-1',
      'inactive',
      '전출',
      EARLIER,
    );

    const result = applyRosterImport(data, CLASS_ID, rows([1, '김하나']), 'replace', NOW);

    expect(statusOf(result, 'stu-1')).toBe('active');
    expect(result.students).toHaveLength(1);
  });

  it('번호가 바뀐 학생은 id를 유지한 채 갱신한다', () => {
    const data = baseData([{ id: 'stu-1', number: 1, name: '김하나' }]);

    const result = applyRosterImport(data, CLASS_ID, rows([9, '김하나']), 'replace', NOW);

    expect(result.students).toHaveLength(1);
    expect(result.students[0]?.id).toBe('stu-1'); // 기록이 따라온다
    expect(result.students[0]?.number).toBe(9);
  });

  it('새 학생에게는 기능별 프로필이 생긴다', () => {
    const result = applyRosterImport(baseData(), CLASS_ID, rows([1, '김하나'], [2, '이두리']), 'replace', NOW);

    expect(result.students).toHaveLength(2);
    expect(result.seatingProfiles).toHaveLength(2);
    expect(result.dutyProfiles).toHaveLength(2);
    expect(result.rewardProfiles).toHaveLength(2);
  });

  it('다른 학급 학생은 건드리지 않는다', () => {
    const data = baseData([{ id: 'stu-1', number: 1, name: '김하나' }]);
    data.classRooms.push(createClassRoom({ id: 'class-2', termId: 'term-1', name: '3학년 3반' }, EARLIER));
    data.students.push(createStudent({ id: 'stu-9', classId: 'class-2', number: 1, name: '남의반' }, EARLIER));

    const result = applyRosterImport(data, CLASS_ID, rows([1, '박세찬']), 'replace', NOW);

    expect(statusOf(result, 'stu-9')).toBe('active');
    expect(nameOf(result, 'stu-9')).toBe('남의반');
  });
});

describe('applyRosterImport — add', () => {
  it('새 학생만 넣고 기존 학생은 그대로 둔다', () => {
    const data = baseData([{ id: 'stu-1', number: 1, name: '김하나' }]);

    const result = applyRosterImport(data, CLASS_ID, rows([2, '이두리']), 'add', NOW);

    expect(result.students).toHaveLength(2);
    expect(statusOf(result, 'stu-1')).toBe('active');
  });

  it('목록에 없는 기존 학생을 전출시키지 않는다', () => {
    const data = baseData([
      { id: 'stu-1', number: 1, name: '김하나' },
      { id: 'stu-2', number: 2, name: '이두리' },
    ]);

    const result = applyRosterImport(data, CLASS_ID, rows([3, '박세찬']), 'add', NOW);

    expect(statusOf(result, 'stu-1')).toBe('active');
    expect(statusOf(result, 'stu-2')).toBe('active');
    expect(result.students).toHaveLength(3);
  });
});

describe('applyRosterImport — 불변조건과 함께', () => {
  it('가져온 결과가 불변조건을 위반하지 않는다', () => {
    const result = applyRosterImport(
      baseData(),
      CLASS_ID,
      rows([1, '김하나'], [2, '이두리'], [3, '박세찬']),
      'replace',
      NOW,
    );

    const { repairs } = validateAndRepair(result, NOW);
    expect(repairs).toEqual([]);
  });

  it('번호가 겹친 목록을 넣으면 불변조건 검사가 바로잡는다', () => {
    const result = applyRosterImport(baseData(), CLASS_ID, rows([1, '김하나'], [1, '이두리']), 'replace', NOW);

    const { data: repaired, repairs } = validateAndRepair(result, NOW);

    expect(repairs.some((r) => r.code === 'DUPLICATE_STUDENT_NUMBER')).toBe(true);
    expect(new Set(repaired.students.map((s) => s.number)).size).toBe(2);
    expect(repaired.students).toHaveLength(2);
  });
});
