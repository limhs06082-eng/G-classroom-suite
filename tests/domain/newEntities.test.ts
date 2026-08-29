import { describe, expect, it } from 'vitest';

import {
  createClassRoom,
  createEmptySuiteData,
  createObservation,
  createRedemption,
  createRewardItem,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import { validateAndRepair } from '../../src/shared/domain/invariants';
import type { SuiteData } from '../../src/shared/domain/types';
import { parseSuiteData, serializeSuiteData } from '../../src/shared/storage/schema';

const NOW = '2026-08-29T09:00:00.000Z';
const EARLIER = '2026-03-01T00:00:00.000Z';

/** 정상 상태의 기준 데이터: 1학기 / 3학년 2반 / 학생 2명 */
function baseData(): SuiteData {
  const term = createTerm(
    { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    EARLIER,
  );
  const classRoom = createClassRoom({ id: 'class-1', termId: term.id, name: '3학년 2반' }, EARLIER);
  const students = [
    createStudent({ id: 'stu-1', classId: classRoom.id, number: 1, name: '김하나' }, EARLIER),
    createStudent({ id: 'stu-2', classId: classRoom.id, number: 2, name: '이두리' }, EARLIER),
  ];

  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [classRoom],
    students,
    activeTermId: term.id,
    activeClassId: classRoom.id,
  };
}

describe('스키마 — 2판 필드가 없는 옛 백업', () => {
  it('필드가 아예 없으면 빈 배열로 조용히 채운다', () => {
    const raw = JSON.parse(serializeSuiteData(baseData())) as Record<string, unknown>;
    delete raw['attendanceRecords'];
    delete raw['notices'];
    delete raw['timetableOverrides'];
    delete raw['rewardItems'];
    delete raw['redemptions'];
    delete raw['observations'];
    raw['schemaVersion'] = 1;

    const { data, repairs } = parseSuiteData(raw, NOW);

    expect(data.attendanceRecords).toEqual([]);
    expect(data.notices).toEqual([]);
    expect(data.timetableOverrides).toEqual([]);
    expect(data.rewardItems).toEqual([]);
    expect(data.redemptions).toEqual([]);
    expect(data.observations).toEqual([]);
    // 옛 백업을 열 때마다 경고가 뜨면 안 된다.
    expect(repairs).toEqual([]);
  });
});

describe('스키마 — 출결·알림장 해석', () => {
  it('출결 기록을 되살리고, 알 수 없는 상태의 항목은 버린다', () => {
    const raw = JSON.parse(serializeSuiteData(baseData())) as Record<string, unknown>;
    raw['attendanceRecords'] = [
      {
        classId: 'class-1',
        date: '2026-08-29',
        entries: [
          { studentId: 'stu-1', status: 'absent', note: '감기' },
          { studentId: 'stu-2', status: '있지도-않은-상태', note: '' },
        ],
      },
    ];

    const { data } = parseSuiteData(raw, NOW);

    expect(data.attendanceRecords).toHaveLength(1);
    expect(data.attendanceRecords[0]?.entries).toEqual([
      { studentId: 'stu-1', status: 'absent', note: '감기' },
    ]);
  });

  it('같은 날짜·학급의 출결 기록이 둘이면 첫 것만 남긴다', () => {
    const raw = JSON.parse(serializeSuiteData(baseData())) as Record<string, unknown>;
    raw['attendanceRecords'] = [
      { classId: 'class-1', date: '2026-08-29', entries: [{ studentId: 'stu-1', status: 'late', note: '' }] },
      { classId: 'class-1', date: '2026-08-29', entries: [] },
    ];

    const { data } = parseSuiteData(raw, NOW);

    expect(data.attendanceRecords).toHaveLength(1);
    expect(data.attendanceRecords[0]?.entries).toHaveLength(1);
  });

  it('알림장 항목의 빈 글줄은 버리고 되살린다', () => {
    const raw = JSON.parse(serializeSuiteData(baseData())) as Record<string, unknown>;
    raw['notices'] = [
      {
        classId: 'class-1',
        date: '2026-08-29',
        items: [
          { id: 'n-1', text: '알림장 준비물: 색연필' },
          { id: 'n-2', text: '' },
        ],
      },
    ];

    const { data } = parseSuiteData(raw, NOW);

    expect(data.notices[0]?.items).toEqual([{ id: 'n-1', text: '알림장 준비물: 색연필' }]);
  });
});

describe('스키마 — 시간표 하루 바꾸기 만료', () => {
  it('지난 날짜의 항목은 조용히 버리고, 오늘·앞날은 남긴다', () => {
    const raw = JSON.parse(serializeSuiteData(baseData())) as Record<string, unknown>;
    raw['timetableOverrides'] = [
      { classId: 'class-1', date: '2026-08-28', period: 1, subject: '체육' }, // 어제
      { classId: 'class-1', date: '2026-08-29', period: 2, subject: '음악' }, // 오늘
      { classId: 'class-1', date: '2026-09-01', period: 3, subject: '' }, // 다음 주(교시 없음)
    ];

    const { data, repairs } = parseSuiteData(raw, NOW);

    expect(data.timetableOverrides.map((o) => o.date)).toEqual(['2026-08-29', '2026-09-01']);
    // 만료는 복구가 아니다. 알림이 뜨면 안 된다.
    expect(repairs).toEqual([]);
  });
});

describe('스키마 — 쿠폰·사용 기록·관찰 해석', () => {
  it('쿠폰 cost는 1 미만이면 1로 끌어올린다', () => {
    const raw = JSON.parse(serializeSuiteData(baseData())) as Record<string, unknown>;
    raw['rewardItems'] = [
      { id: 'item-1', classId: 'class-1', name: '자리 선택권', cost: 0, isActive: true, order: 0, createdAt: EARLIER },
    ];

    const { data } = parseSuiteData(raw, NOW);

    expect(data.rewardItems[0]?.cost).toBe(1);
  });

  it('사용 기록의 revokedAt을 보존한다', () => {
    const base = baseData();
    const redemption = {
      ...createRedemption(
        { classId: 'class-1', targetUnit: 'student', targetId: 'stu-1', itemName: '자유 시간 10분', cost: 15 },
        EARLIER,
      ),
      revokedAt: NOW,
    };
    const raw = JSON.parse(serializeSuiteData({ ...base, redemptions: [redemption] })) as Record<string, unknown>;

    const { data } = parseSuiteData(raw, NOW);

    expect(data.redemptions[0]?.revokedAt).toBe(NOW);
  });

  it('관찰 기록을 되살린다', () => {
    const base = baseData();
    const observation = createObservation(
      { id: 'obs-1', classId: 'class-1', studentId: 'stu-1', text: '모둠 활동을 이끌었다', date: '2026-08-20' },
      EARLIER,
    );
    const raw = JSON.parse(serializeSuiteData({ ...base, observations: [observation] })) as Record<string, unknown>;

    const { data } = parseSuiteData(raw, NOW);

    expect(data.observations).toEqual([observation]);
  });
});

describe('불변조건 — 없는 학급·학생을 가리키는 2판 기록', () => {
  it('없는 학급의 출결·알림장·쿠폰·바꾸기를 정리한다', () => {
    const base = baseData();
    const dirty: SuiteData = {
      ...base,
      attendanceRecords: [{ classId: 'ghost', date: '2026-08-29', entries: [] }],
      notices: [{ classId: 'ghost', date: '2026-08-29', items: [] }],
      timetableOverrides: [{ classId: 'ghost', date: '2026-08-29', period: 1, subject: '체육' }],
      rewardItems: [createRewardItem({ id: 'item-1', classId: 'ghost', name: '자리 선택권', cost: 10 }, EARLIER)],
    };

    const { data, repairs } = validateAndRepair(dirty, NOW);

    expect(data.attendanceRecords).toEqual([]);
    expect(data.notices).toEqual([]);
    expect(data.timetableOverrides).toEqual([]);
    expect(data.rewardItems).toEqual([]);
    expect(repairs.some((r) => r.code === 'ORPHAN_CLASS_RECORD')).toBe(true);
  });

  it('출결 항목에서 다른 반 학생을 정리한다', () => {
    const base = baseData();
    const dirty: SuiteData = {
      ...base,
      attendanceRecords: [
        {
          classId: 'class-1',
          date: '2026-08-29',
          entries: [
            { studentId: 'stu-1', status: 'absent', note: '' },
            { studentId: 'ghost-student', status: 'late', note: '' },
          ],
        },
      ],
    };

    const { data } = validateAndRepair(dirty, NOW);

    expect(data.attendanceRecords[0]?.entries.map((e) => e.studentId)).toEqual(['stu-1']);
  });

  it('없는 학생·모둠을 가리키는 사용 기록과 관찰 기록을 정리한다', () => {
    const base = baseData();
    const dirty: SuiteData = {
      ...base,
      redemptions: [
        createRedemption(
          { id: 'red-1', classId: 'class-1', targetUnit: 'student', targetId: 'stu-1', itemName: '자리 선택권', cost: 10 },
          EARLIER,
        ),
        createRedemption(
          { id: 'red-2', classId: 'class-1', targetUnit: 'group', targetId: 'ghost-group', itemName: '자리 선택권', cost: 10 },
          EARLIER,
        ),
      ],
      observations: [
        createObservation({ id: 'obs-1', classId: 'class-1', studentId: 'stu-2', text: '발표를 잘했다' }, EARLIER),
        createObservation({ id: 'obs-2', classId: 'class-1', studentId: 'ghost-student', text: '유령' }, EARLIER),
      ],
    };

    const { data } = validateAndRepair(dirty, NOW);

    expect(data.redemptions.map((r) => r.id)).toEqual(['red-1']);
    expect(data.observations.map((o) => o.id)).toEqual(['obs-1']);
  });

  it('깨끗한 데이터는 아무것도 고치지 않는다', () => {
    const base = baseData();
    const clean: SuiteData = {
      ...base,
      attendanceRecords: [
        { classId: 'class-1', date: '2026-08-29', entries: [{ studentId: 'stu-1', status: 'fieldTrip', note: '' }] },
      ],
      notices: [{ classId: 'class-1', date: '2026-08-29', items: [{ id: 'n-1', text: '우유갑 정리' }] }],
      rewardItems: [createRewardItem({ id: 'item-1', classId: 'class-1', name: '자리 선택권', cost: 10 }, EARLIER)],
    };

    const { data, repairs } = validateAndRepair(clean, NOW);

    expect(repairs).toEqual([]);
    expect(data.attendanceRecords).toHaveLength(1);
    expect(data.notices).toHaveLength(1);
    expect(data.rewardItems).toHaveLength(1);
  });
});
