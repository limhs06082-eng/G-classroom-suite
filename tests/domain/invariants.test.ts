import { describe, expect, it } from 'vitest';

import {
  createClassRoom,
  createEmptySuiteData,
  createGroup,
  createSeatingProfile,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import { validateAndRepair, type RepairCode } from '../../src/shared/domain/invariants';
import type { SuiteData } from '../../src/shared/domain/types';

const NOW = '2026-03-02T00:00:00.000Z';
const EARLIER = '2026-03-01T00:00:00.000Z';

/** 정상 상태의 기준 데이터: 1학기 / 3학년 2반 / 학생 3명 */
function baseData(): SuiteData {
  const term = createTerm(
    { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    EARLIER,
  );
  const classRoom = createClassRoom({ id: 'class-1', termId: term.id, name: '3학년 2반' }, EARLIER);
  const students = [
    createStudent({ id: 'stu-1', classId: classRoom.id, number: 1, name: '김하나' }, EARLIER),
    createStudent({ id: 'stu-2', classId: classRoom.id, number: 2, name: '이두리' }, EARLIER),
    createStudent({ id: 'stu-3', classId: classRoom.id, number: 3, name: '박세찬' }, EARLIER),
  ];

  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [classRoom],
    students,
    seatingProfiles: students.map((s) => createSeatingProfile(s.id)),
    activeTermId: term.id,
    activeClassId: classRoom.id,
  };
}

function codes(repairs: { code: RepairCode }[]): RepairCode[] {
  return repairs.map((r) => r.code);
}

describe('validateAndRepair', () => {
  it('정상 데이터는 아무것도 고치지 않는다', () => {
    const { repairs } = validateAndRepair(baseData(), NOW);
    expect(repairs).toEqual([]);
  });

  it('입력 객체를 변형하지 않는다', () => {
    const input = baseData();
    input.students[0]!.classId = 'gone';
    const snapshot = JSON.parse(JSON.stringify(input)) as SuiteData;

    validateAndRepair(input, NOW);

    expect(input).toEqual(snapshot);
  });

  it('복구 결과를 다시 검사하면 더 고칠 것이 없다', () => {
    const broken = baseData();
    broken.students[0]!.classId = 'gone';
    broken.students[1]!.number = broken.students[2]!.number;
    broken.groups = [
      createGroup({ id: 'g-1', classId: 'gone', name: '1모둠', color: '#f00', studentIds: ['stu-9'] }, EARLIER),
    ];

    const first = validateAndRepair(broken, NOW);
    expect(first.repairs.length).toBeGreaterThan(0);

    const second = validateAndRepair(first.data, NOW);
    expect(second.repairs).toEqual([]);
  });

  describe('학급·학생 참조', () => {
    it('학기가 없는 학급을 복구 학기로 옮긴다', () => {
      const data = baseData();
      data.classRooms[0]!.termId = 'term-gone';

      const { data: fixed, repairs } = validateAndRepair(data, NOW);

      expect(codes(repairs)).toContain('ORPHAN_CLASSROOM');
      const termIds = new Set(fixed.terms.map((t) => t.id));
      expect(termIds.has(fixed.classRooms[0]!.termId)).toBe(true);
    });

    it('학급이 없는 학생을 복구 학급으로 옮기고 아무도 삭제하지 않는다', () => {
      const data = baseData();
      data.students[0]!.classId = 'class-gone';

      const { data: fixed, repairs } = validateAndRepair(data, NOW);

      expect(codes(repairs)).toContain('ORPHAN_STUDENT');
      expect(fixed.students).toHaveLength(3);
      expect(fixed.students.map((s) => s.id).sort()).toEqual(['stu-1', 'stu-2', 'stu-3']);

      const classIds = new Set(fixed.classRooms.map((c) => c.id));
      for (const student of fixed.students) {
        expect(classIds.has(student.classId)).toBe(true);
      }
    });

    it('학생이 하나도 없어도 복구 학급을 만들지 않는다', () => {
      const data = baseData();
      data.students = [];
      data.seatingProfiles = [];

      const { data: fixed, repairs } = validateAndRepair(data, NOW);

      expect(repairs).toEqual([]);
      expect(fixed.classRooms).toHaveLength(1);
    });
  });

  describe('학생 번호', () => {
    it('번호가 겹치면 먼저 등록된 학생이 원래 번호를 지킨다', () => {
      const data = baseData();
      data.students[1]!.number = 1; // stu-2가 stu-1의 번호를 침범

      const { data: fixed, repairs } = validateAndRepair(data, NOW);

      expect(codes(repairs)).toContain('DUPLICATE_STUDENT_NUMBER');
      const numberOf = (id: string) => fixed.students.find((s) => s.id === id)?.number;
      expect(numberOf('stu-1')).toBe(1); // 먼저 만들어진 쪽이 유지
      expect(numberOf('stu-2')).not.toBe(1);
      expect(numberOf('stu-3')).toBe(3);
    });

    it('비어 있는 가장 작은 번호를 부여한다', () => {
      const data = baseData();
      data.students[0]!.number = 5;
      data.students[1]!.number = 5;
      data.students[2]!.number = 5;

      const { data: fixed } = validateAndRepair(data, NOW);
      const numbers = fixed.students.map((s) => s.number).sort((a, b) => a - b);

      expect(numbers).toEqual([1, 2, 5]);
    });

    it('다른 반이면 번호가 같아도 건드리지 않는다', () => {
      const data = baseData();
      const otherClass = createClassRoom({ id: 'class-2', termId: 'term-1', name: '3학년 3반' }, EARLIER);
      data.classRooms.push(otherClass);
      data.students.push(createStudent({ id: 'stu-4', classId: 'class-2', number: 1, name: '최네오' }, EARLIER));

      const { data: fixed, repairs } = validateAndRepair(data, NOW);

      expect(codes(repairs)).not.toContain('DUPLICATE_STUDENT_NUMBER');
      expect(fixed.students.find((s) => s.id === 'stu-4')?.number).toBe(1);
    });
  });

  describe('모둠', () => {
    it('한 학생이 여러 모둠에 있으면 먼저 만든 모둠에만 남긴다', () => {
      const data = baseData();
      data.groups = [
        createGroup(
          { id: 'g-late', classId: 'class-1', name: '2모둠', color: '#0f0', studentIds: ['stu-1'] },
          NOW,
        ),
        createGroup(
          { id: 'g-early', classId: 'class-1', name: '1모둠', color: '#f00', studentIds: ['stu-1', 'stu-2'] },
          EARLIER,
        ),
      ];

      const { data: fixed, repairs } = validateAndRepair(data, NOW);

      expect(codes(repairs)).toContain('STUDENT_IN_MULTIPLE_GROUPS');
      const groupOf = (id: string) => fixed.groups.find((g) => g.id === id);
      expect(groupOf('g-early')?.studentIds).toEqual(['stu-1', 'stu-2']);
      expect(groupOf('g-late')?.studentIds).toEqual([]);
    });

    it('배열 순서가 달라도 같은 결과를 낸다', () => {
      const build = (reversed: boolean): SuiteData => {
        const data = baseData();
        const groups = [
          createGroup(
            { id: 'g-early', classId: 'class-1', name: '1모둠', color: '#f00', studentIds: ['stu-1'] },
            EARLIER,
          ),
          createGroup(
            { id: 'g-late', classId: 'class-1', name: '2모둠', color: '#0f0', studentIds: ['stu-1'] },
            NOW,
          ),
        ];
        data.groups = reversed ? groups.reverse() : groups;
        return data;
      };

      const a = validateAndRepair(build(false), NOW).data;
      const b = validateAndRepair(build(true), NOW).data;

      const owner = (d: SuiteData) => d.groups.find((g) => g.studentIds.includes('stu-1'))?.id;
      expect(owner(a)).toBe('g-early');
      expect(owner(b)).toBe('g-early');
    });

    it('없는 학생 참조를 모둠에서 제거한다', () => {
      const data = baseData();
      data.groups = [
        createGroup(
          { id: 'g-1', classId: 'class-1', name: '1모둠', color: '#f00', studentIds: ['stu-1', 'ghost'] },
          EARLIER,
        ),
      ];

      const { data: fixed, repairs } = validateAndRepair(data, NOW);

      expect(codes(repairs)).toContain('GROUP_MEMBER_NOT_FOUND');
      expect(fixed.groups[0]?.studentIds).toEqual(['stu-1']);
    });

    it('구성원이 아닌 모둠장을 해제한다', () => {
      const data = baseData();
      data.groups = [
        createGroup(
          { id: 'g-1', classId: 'class-1', name: '1모둠', color: '#f00', studentIds: ['stu-1'], leaderId: 'stu-3' },
          EARLIER,
        ),
      ];

      const { data: fixed, repairs } = validateAndRepair(data, NOW);

      expect(codes(repairs)).toContain('INVALID_GROUP_LEADER');
      expect(fixed.groups[0]?.leaderId).toBeNull();
    });

    it('학급이 없는 모둠은 소속 학생의 학급으로 되돌린다', () => {
      const data = baseData();
      data.groups = [
        createGroup(
          { id: 'g-1', classId: 'class-gone', name: '1모둠', color: '#f00', studentIds: ['stu-2'] },
          EARLIER,
        ),
      ];

      const { data: fixed, repairs } = validateAndRepair(data, NOW);

      expect(codes(repairs)).toContain('ORPHAN_GROUP');
      expect(fixed.groups[0]?.classId).toBe('class-1');
    });

    it('학급도 학생도 없는 모둠은 정리한다', () => {
      const data = baseData();
      data.groups = [
        createGroup({ id: 'g-1', classId: 'class-gone', name: '유령', color: '#f00', studentIds: [] }, EARLIER),
      ];

      const { data: fixed, repairs } = validateAndRepair(data, NOW);

      expect(codes(repairs)).toContain('ORPHAN_GROUP');
      expect(fixed.groups).toHaveLength(0);
    });
  });

  describe('기능별 프로필', () => {
    it('없는 학생을 가리키는 프로필을 정리한다', () => {
      const data = baseData();
      data.seatingProfiles.push(createSeatingProfile('ghost'));

      const { data: fixed, repairs } = validateAndRepair(data, NOW);

      expect(codes(repairs)).toContain('ORPHAN_PROFILE');
      expect(fixed.seatingProfiles).toHaveLength(3);
    });

    it('중복 프로필은 첫 번째만 남긴다', () => {
      const data = baseData();
      data.seatingProfiles.push({ ...createSeatingProfile('stu-1'), note: '나중 것' });

      const { data: fixed, repairs } = validateAndRepair(data, NOW);

      expect(codes(repairs)).toContain('DUPLICATE_PROFILE');
      expect(fixed.seatingProfiles.filter((p) => p.studentId === 'stu-1')).toHaveLength(1);
      expect(fixed.seatingProfiles.find((p) => p.studentId === 'stu-1')?.note).toBe('');
    });
  });

  describe('활성 학기·학급', () => {
    it('없어진 활성 학기를 살아 있는 학기로 바꾼다', () => {
      const data = baseData();
      data.activeTermId = 'term-gone';

      const { data: fixed, repairs } = validateAndRepair(data, NOW);

      expect(codes(repairs)).toContain('INVALID_ACTIVE_TERM');
      expect(fixed.activeTermId).toBe('term-1');
    });

    it('없어진 활성 학급을 같은 학기의 학급으로 바꾼다', () => {
      const data = baseData();
      data.activeClassId = 'class-gone';

      const { data: fixed, repairs } = validateAndRepair(data, NOW);

      expect(codes(repairs)).toContain('INVALID_ACTIVE_CLASS');
      expect(fixed.activeClassId).toBe('class-1');
    });

    it('선택할 학급이 없으면 null로 둔다', () => {
      const data = baseData();
      data.classRooms = [];
      data.students = [];
      data.seatingProfiles = [];
      data.activeClassId = 'class-gone';

      const { data: fixed } = validateAndRepair(data, NOW);

      expect(fixed.activeClassId).toBeNull();
    });
  });

  it('빈 데이터도 오류 없이 통과한다', () => {
    const { repairs } = validateAndRepair(createEmptySuiteData(), NOW);
    expect(repairs).toEqual([]);
  });
});

describe('8-2d — 교시 시각이 온전한가', () => {
  it('시각을 못 읽는 줄이 있으면 기본 일과로 되돌린다', () => {
    const data = baseData();
    data.periodTimes = data.periodTimes.map((time) =>
      time.period === 2 ? { ...time, start: '깨짐' } : time,
    );

    const result = validateAndRepair(data, NOW);

    /*
     * 그냥 두면 '지금' 카드가 그 줄을 버리고, 버린 자리에 60분짜리 구멍이
     * 생겨 진짜 점심과 길이가 같아진다. 아침 09:55에 "점심"이라고 말하는
     * 화면이 된다 — 실제로 그렇게 되는 것을 확인하고 이 그물을 놓았다.
     */
    expect(result.data.periodTimes[1]?.start).toBe('09:50');
    expect(result.repairs.map((repair) => repair.code)).toContain('INVALID_PERIOD_TIME');
  });

  it('끝이 시작보다 이른 줄도 거른다', () => {
    const data = baseData();
    data.periodTimes = data.periodTimes.map((time) =>
      time.period === 3 ? { ...time, start: '11:00', end: '10:00' } : time,
    );

    const result = validateAndRepair(data, NOW);

    expect(result.data.periodTimes[2]?.start).toBe('10:40');
  });

  it('교시 번호가 눈금 밖이면 거른다', () => {
    const data = baseData();
    data.periodTimes = data.periodTimes.map((time) =>
      time.period === 7 ? { ...time, period: 9 } : time,
    );

    const result = validateAndRepair(data, NOW);

    /*
     * 9교시는 없다. 있는 척하면 카드가 하교 시각을 틀리게 말한다.
     * 버리고 남은 1~6은 1부터 이어지므로 '여섯 교시 학교'로 성립한다 —
     * 뒤에서 지우는 것이 이제 정상이라 그렇다. 대신 덜어 냈다고 알린다.
     */
    expect(result.data.periodTimes.map((time) => time.period)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.repairs.map((repair) => repair.code)).toContain('INVALID_PERIOD_TIME');
  });

  it('중간이 빠지면 자료가 상한 것으로 보고 되돌린다', () => {
    const data = baseData();
    // 3교시만 없앤다. 교사가 지운 것은 늘 뒤쪽이라 중간이 빈 것은 사고다.
    data.periodTimes = data.periodTimes.filter((time) => time.period !== 3);

    const result = validateAndRepair(data, NOW);

    expect(result.data.periodTimes).toHaveLength(7);
    expect(result.repairs.map((repair) => repair.code)).toContain('INVALID_PERIOD_TIME');
  });

  it('뒤에서 지운 것은 그대로 둔다', () => {
    const data = baseData();
    // 저학년 담임이 6·7교시를 지웠다. 이건 정상이다.
    data.periodTimes = data.periodTimes.filter((time) => time.period <= 5);

    const result = validateAndRepair(data, NOW);

    expect(result.data.periodTimes).toHaveLength(5);
    expect(result.repairs.map((repair) => repair.code)).not.toContain('INVALID_PERIOD_TIME');
  });

  it('온전하면 그대로 둔다', () => {
    const data = baseData();
    data.periodTimes = data.periodTimes.map((time) =>
      time.period === 1 ? { ...time, start: '08:40', end: '09:20' } : time,
    );

    const result = validateAndRepair(data, NOW);

    // 교사가 고쳐 둔 일과를 까닭 없이 되돌리면 안 된다.
    expect(result.data.periodTimes[0]?.start).toBe('08:40');
    expect(result.repairs.map((repair) => repair.code)).not.toContain('INVALID_PERIOD_TIME');
  });
});
