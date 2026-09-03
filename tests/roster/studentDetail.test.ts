import { describe, expect, it } from 'vitest';

import {
  createClassRoom,
  createDutyProfile,
  createEmptySuiteData,
  createRewardProfile,
  createSeatingProfile,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { DutyRole, SuiteData } from '../../src/shared/domain/types';
import {
  applyStudentDetail,
  collectTags,
  readStudentDetail,
} from '../../src/shared/roster/studentDetail';

const NOW = '2026-08-14T09:00:00.000Z';

function role(id: string, classId: string): DutyRole {
  return {
    id,
    classId,
    name: id,
    category: '기타',
    description: '',
    neededCount: 1,
    cycle: 'weekly',
    activeDays: [1, 2, 3, 4, 5],
    isActive: true,
    fixedStudentIds: [],
    excludedStudentIds: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** 학생 하나와 학급 둘이 있는 자료 */
function seeded(): { data: SuiteData; studentId: string } {
  const term = createTerm(
    { schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    NOW,
  );
  const mine = createClassRoom({ termId: term.id, name: '우리 반' }, NOW);
  const other = createClassRoom({ termId: term.id, name: '옆 반' }, NOW);
  const student = createStudent({ classId: mine.id, number: 1, name: '김하나' }, NOW);

  return {
    studentId: student.id,
    data: {
      ...createEmptySuiteData(),
      terms: [term],
      classRooms: [mine, other],
      students: [student],
      seatingProfiles: [createSeatingProfile(student.id)],
      rewardProfiles: [createRewardProfile(student.id)],
      dutyProfiles: [createDutyProfile(student.id, 1)],
      dutyRoles: [role('r-mine', mine.id), role('r-other', other.id)],
      activeTermId: term.id,
      activeClassId: mine.id,
    },
  };
}

describe('applyStudentDetail', () => {
  it('세 프로필을 한 번에 갱신한다', () => {
    const { data, studentId } = seeded();

    const next = applyStudentDetail(data, studentId, {
      gender: 'female',
      tags: ['앞자리'],
      avoidStudentIds: [],
      nickname: '하나',
      fixedRoleId: 'r-mine',
    });

    expect(next.seatingProfiles[0]?.gender).toBe('female');
    expect(next.seatingProfiles[0]?.tags).toEqual(['앞자리']);
    expect(next.rewardProfiles[0]?.nickname).toBe('하나');
    expect(next.dutyProfiles[0]?.fixedRoleId).toBe('r-mine');
  });

  it('넘기지 않은 항목은 그대로 둔다', () => {
    const { data, studentId } = seeded();

    const once = applyStudentDetail(data, studentId, { nickname: '하나' });
    const twice = applyStudentDetail(once, studentId, { gender: 'male' });

    expect(twice.rewardProfiles[0]?.nickname).toBe('하나');
    expect(twice.seatingProfiles[0]?.gender).toBe('male');
  });

  it('다른 학급 역할을 고정 역할로 주면 비운다', () => {
    // 화면에서 못 고르게 막지만, 가져오기 같은 다른 경로로도 들어올 수 있다.
    const { data, studentId } = seeded();

    const next = applyStudentDetail(data, studentId, { fixedRoleId: 'r-other' });

    // DutyProfile.fixedRoleId는 optional이다. '없음'은 키를 빼서 표현한다.
    expect(next.dutyProfiles[0]?.fixedRoleId).toBeUndefined();
  });

  it('없는 역할 id도 비운다', () => {
    const { data, studentId } = seeded();

    const next = applyStudentDetail(data, studentId, { fixedRoleId: '없는역할' });

    expect(next.dutyProfiles[0]?.fixedRoleId).toBeUndefined();
  });

  it('태그의 공백·빈 값·중복을 정리한다', () => {
    // 같은 태그가 두 번 들어가면 배치 조건 계산이 어긋난다.
    const { data, studentId } = seeded();

    const next = applyStudentDetail(data, studentId, {
      tags: ['  앞자리 ', '앞자리', '', '   ', '조용함'],
    });

    expect(next.seatingProfiles[0]?.tags).toEqual(['앞자리', '조용함']);
  });

  it('프로필이 없던 학생에게도 만들어 넣는다', () => {
    const { data, studentId } = seeded();
    const bare: SuiteData = { ...data, seatingProfiles: [], rewardProfiles: [], dutyProfiles: [] };

    const next = applyStudentDetail(bare, studentId, { gender: 'male', nickname: '하나' });

    expect(next.seatingProfiles).toHaveLength(1);
    expect(next.seatingProfiles[0]?.gender).toBe('male');
    expect(next.rewardProfiles[0]?.nickname).toBe('하나');
    expect(next.dutyProfiles).toHaveLength(1);
  });

  it('없는 학생이면 아무것도 바꾸지 않는다', () => {
    const { data } = seeded();

    expect(applyStudentDetail(data, '없는학생', { nickname: 'x' })).toBe(data);
  });
});

describe('readStudentDetail', () => {
  it('세 프로필에서 값을 모아 온다', () => {
    const { data, studentId } = seeded();
    const saved = applyStudentDetail(data, studentId, { gender: 'female', nickname: '하나' });

    expect(readStudentDetail(saved, studentId)).toEqual({
      gender: 'female',
      tags: [],
      avoidStudentIds: [],
      nickname: '하나',
      fixedRoleId: null,
    });
  });

  it('프로필이 없으면 빈 값을 준다', () => {
    const { data, studentId } = seeded();
    const bare: SuiteData = { ...data, seatingProfiles: [], rewardProfiles: [], dutyProfiles: [] };

    expect(readStudentDetail(bare, studentId)).toEqual({
      gender: 'none',
      tags: [],
      avoidStudentIds: [],
      nickname: '',
      fixedRoleId: null,
    });
  });
});

describe('collectTags', () => {
  it('그 학급에서 이미 쓴 태그를 모아 준다', () => {
    const { data, studentId } = seeded();
    const saved = applyStudentDetail(data, studentId, { tags: ['조용함', '앞자리'] });

    expect(collectTags(saved, saved.activeClassId ?? '')).toEqual(['앞자리', '조용함']);
  });
});
