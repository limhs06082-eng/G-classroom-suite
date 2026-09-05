import { describe, expect, it } from 'vitest';

import { createClassRoom, createEmptySuiteData, createTerm } from '../../src/shared/domain/factories';
import { validateAndRepair } from '../../src/shared/domain/invariants';
import { countClassData } from '../../src/shared/roster/classOps';
import {
  createSampleClass,
  hasSampleClass,
  removeSampleClass,
  SAMPLE_CLASS_NAME,
} from '../../src/shared/sample/sampleClass';

const TODAY = '2026-09-07';
const NOW = '2026-09-07T09:00:00.000Z';

/*
 * 연수 자리의 첫 30초. 빈 앱에 "우리 반"이 한 벌로 서야 하고, 그 자료가
 * 검사에 걸려 복구 알림을 띄우면 안 되며, 지우면 흔적 없이 사라져야 한다.
 */
describe('샘플 학급', () => {
  it('빈 자료에 한 벌이 서고, 검사에 걸리지 않는다', () => {
    const data = createSampleClass(createEmptySuiteData(), TODAY, NOW);

    expect(hasSampleClass(data)).toBe(true);
    const room = data.classRooms.find((item) => item.isSample === true);
    expect(room?.name).toBe(SAMPLE_CLASS_NAME);
    expect(data.activeClassId).toBe(room?.id);
    expect(data.terms.find((term) => term.id === room?.termId)?.isSample).toBe(true);

    const count = countClassData(data, room?.id ?? '');
    expect(count.students).toBe(24);
    expect(count.groups).toBe(4);
    expect(count.timetableEntries).toBeGreaterThan(20);
    expect(count.classEvents).toBe(3);
    expect(count.scoreEntries).toBeGreaterThan(10);
    expect(count.observations).toBeGreaterThanOrEqual(6);
    expect(count.attendanceRecords).toBeGreaterThan(0);
    expect(count.assignments).toBe(2);
    expect(count.seatingStates).toBe(1);
    expect(count.dutyRoles).toBe(5);
    expect(count.behaviorPresets).toBe(6);
    expect(count.notices).toBe(1);
    expect(count.rewardItems).toBe(3);

    // 번호 유일·프로필 있음 — 복구 알림이 하나도 없어야 한다.
    const { repairs } = validateAndRepair(data, NOW);
    expect(repairs).toEqual([]);

    // 생일은 전원, 오늘 생일이 한 명.
    const students = data.students.filter((student) => student.classId === room?.id);
    expect(students.every((student) => typeof student.birthday === 'string')).toBe(true);
    expect(students.filter((student) => student.birthday?.slice(5) === TODAY.slice(5))).toHaveLength(1);
  });

  it('두 번 만들어도 하나다', () => {
    const once = createSampleClass(createEmptySuiteData(), TODAY, NOW);
    const twice = createSampleClass(once, TODAY, NOW);

    expect(twice).toBe(once);
    expect(twice.classRooms).toHaveLength(1);
  });

  it('지우면 딸린 자료가 다 사라지고, 마지막 학급이어도 지워진다', () => {
    const data = createSampleClass(createEmptySuiteData(), TODAY, NOW);

    const removed = removeSampleClass(data);

    expect(hasSampleClass(removed)).toBe(false);
    expect(removed.classRooms).toEqual([]);
    expect(removed.terms).toEqual([]);
    expect(removed.students).toEqual([]);
    expect(removed.scoreEntries).toEqual([]);
    expect(removed.activeClassId).toBeNull();
    expect(removed.activeTermId).toBeNull();
  });

  it('진짜 학급이 있으면 그 학기에 붙고, 지워도 진짜 학급은 남는다', () => {
    const term = createTerm(
      { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2027-02-28' },
      NOW,
    );
    const room = createClassRoom({ id: 'class-1', termId: 'term-1', name: '우리 반' }, NOW);
    const base = {
      ...createEmptySuiteData(),
      terms: [term],
      classRooms: [room],
      activeTermId: 'term-1',
      activeClassId: 'class-1',
    };

    const withSample = createSampleClass(base, TODAY, NOW);
    expect(withSample.classRooms).toHaveLength(2);
    expect(withSample.classRooms.find((item) => item.isSample)?.termId).toBe('term-1');
    expect(withSample.terms).toHaveLength(1);

    const removed = removeSampleClass(withSample);
    expect(removed.classRooms.map((item) => item.id)).toEqual(['class-1']);
    expect(removed.terms).toHaveLength(1);
    expect(removed.activeClassId).toBe('class-1');
  });
});
