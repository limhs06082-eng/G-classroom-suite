import { describe, expect, it } from 'vitest';

import {
  absentToday,
  isConfirmed,
  monthDay,
  monthlyCounts,
  nextStatus,
  notesInRange,
  rangeCounts,
  reasonOf,
  setReason,
  setConfirmed,
  setNote,
  setStatus,
  setStatusMany,
  statusOf,
  summarize,
} from '../../src/features/attendance/attendanceCore';
import type { AttendanceRecord } from '../../src/shared/domain/types';

const CLASS = 'class-1';
const DATE = '2026-08-29';

describe('setStatus · statusOf', () => {
  it('기록이 없으면 출석(null)이다', () => {
    expect(statusOf([], CLASS, DATE, 'stu-1')).toBeNull();
  });

  it('상태를 찍으면 그날 기록이 생긴다', () => {
    const next = setStatus([], CLASS, DATE, 'stu-1', 'absent');

    expect(statusOf(next, CLASS, DATE, 'stu-1')).toBe('absent');
    // 다른 학생·다른 날은 그대로 출석이다.
    expect(statusOf(next, CLASS, DATE, 'stu-2')).toBeNull();
    expect(statusOf(next, CLASS, '2026-08-30', 'stu-1')).toBeNull();
  });

  it('출석(null)으로 되돌리면 항목이 사라지고, 빈 기록은 통째로 사라진다', () => {
    const marked = setStatus([], CLASS, DATE, 'stu-1', 'late');
    const cleared = setStatus(marked, CLASS, DATE, 'stu-1', null);

    expect(statusOf(cleared, CLASS, DATE, 'stu-1')).toBeNull();
    // 서른 명 전원 출석인 날의 빈 껍데기가 파일에 쌓이면 안 된다.
    expect(cleared).toEqual([]);
  });

  it('상태를 바꿔도 사유 메모는 남는다', () => {
    const marked = setStatus([], CLASS, DATE, 'stu-1', 'absent');
    const noted = setNote(marked, CLASS, DATE, 'stu-1', '감기');
    const changed = setStatus(noted, CLASS, DATE, 'stu-1', 'late');

    const record = changed.find((r) => r.date === DATE);
    expect(record?.entries[0]).toEqual({ studentId: 'stu-1', status: 'late', note: '감기' });
  });

  it('넘겨받은 목록을 건드리지 않는다', () => {
    const original: AttendanceRecord[] = [];
    setStatus(original, CLASS, DATE, 'stu-1', 'absent');
    expect(original).toEqual([]);
  });
});

describe('nextStatus — 탭-탭 순환', () => {
  it('출석 → 결석 → 지각 → 조퇴 → 체험학습 → 출석', () => {
    expect(nextStatus(null)).toBe('absent');
    expect(nextStatus('absent')).toBe('late');
    expect(nextStatus('late')).toBe('early');
    expect(nextStatus('early')).toBe('fieldTrip');
    expect(nextStatus('fieldTrip')).toBeNull();
  });
});

describe('summarize', () => {
  it('출석 수는 명단에서 기록된 항목 수를 뺀 것이다', () => {
    let records: AttendanceRecord[] = [];
    records = setStatus(records, CLASS, DATE, 'stu-1', 'absent');
    records = setStatus(records, CLASS, DATE, 'stu-2', 'late');

    const summary = summarize(records, CLASS, DATE, 25);

    expect(summary.present).toBe(23);
    expect(summary.byStatus).toEqual({ absent: 1, late: 1, early: 0, fieldTrip: 0 });
    expect(summary.marked).toBe(2);
  });
});

describe('absentToday — 등교하지 않은 학생', () => {
  it('결석·체험학습만 꼽고 지각·조퇴는 꼽지 않는다', () => {
    let records: AttendanceRecord[] = [];
    records = setStatus(records, CLASS, DATE, 'stu-1', 'absent');
    records = setStatus(records, CLASS, DATE, 'stu-2', 'late');
    records = setStatus(records, CLASS, DATE, 'stu-3', 'fieldTrip');
    records = setStatus(records, CLASS, DATE, 'stu-4', 'early');

    // 지각은 늦게라도 오고, 조퇴는 아침에는 있다. 뽑기·당번에서 빼야 할
    // 사람은 그날 교실에 아예 없는 결석·체험학습이다.
    expect(absentToday(records, CLASS, DATE)).toEqual(['stu-1', 'stu-3']);
  });
});

describe('setConfirmed — 전원 출석 확인', () => {
  const NOW = '2026-08-29T09:00:00.000Z';

  it('아무 기록이 없어도 확인 도장을 남길 수 있다', () => {
    const confirmed = setConfirmed([], CLASS, DATE, true, NOW);

    expect(isConfirmed(confirmed, CLASS, DATE)).toBe(true);
    // 안 찍은 날과 전원 출석을 확인한 날은 다른 상태다.
    expect(isConfirmed(confirmed, CLASS, '2026-08-30')).toBe(false);
  });

  it('확인을 되돌리면 빈 기록은 사라진다', () => {
    const confirmed = setConfirmed([], CLASS, DATE, true, NOW);
    const undone = setConfirmed(confirmed, CLASS, DATE, false, NOW);

    expect(undone).toEqual([]);
  });

  it('확인 도장이 있으면 마지막 항목을 지워도 기록이 남는다', () => {
    let records = setStatus([], CLASS, DATE, 'stu-1', 'absent');
    records = setConfirmed(records, CLASS, DATE, true, NOW);
    records = setStatus(records, CLASS, DATE, 'stu-1', null);

    expect(isConfirmed(records, CLASS, DATE)).toBe(true);
  });
});

describe('setStatusMany — 전원 일괄', () => {
  it('여러 학생을 한 번에 같은 상태로 찍는다', () => {
    const records = setStatusMany([], CLASS, DATE, ['stu-1', 'stu-2', 'stu-3'], 'fieldTrip');

    expect(statusOf(records, CLASS, DATE, 'stu-2')).toBe('fieldTrip');
    expect(summarize(records, CLASS, DATE, 5).byStatus.fieldTrip).toBe(3);
  });

  it('null이면 전원 출석으로 되돌린다', () => {
    const marked = setStatusMany([], CLASS, DATE, ['stu-1', 'stu-2'], 'late');
    const cleared = setStatusMany(marked, CLASS, DATE, ['stu-1', 'stu-2'], null);

    expect(cleared).toEqual([]);
  });
});

describe('monthlyCounts', () => {
  it('그 달 학생별 상태 횟수를 센다', () => {
    let records: AttendanceRecord[] = [];
    records = setStatus(records, CLASS, '2026-08-03', 'stu-1', 'absent');
    records = setStatus(records, CLASS, '2026-08-04', 'stu-1', 'absent');
    records = setStatus(records, CLASS, '2026-08-04', 'stu-2', 'late');
    records = setStatus(records, CLASS, '2026-09-01', 'stu-1', 'absent'); // 다음 달
    records = setStatus(records, 'other-class', '2026-08-05', 'stu-1', 'absent'); // 옆 반

    const counts = monthlyCounts(records, CLASS, '2026-08');

    expect(counts.get('stu-1')).toEqual({ absent: 2, late: 0, early: 0, fieldTrip: 0 });
    expect(counts.get('stu-2')).toEqual({ absent: 0, late: 1, early: 0, fieldTrip: 0 });
    expect(counts.has('stu-3')).toBe(false);
  });
});

describe('rangeCounts — 학기 전체 집계', () => {
  it('시작·끝 날짜를 포함해 그 사이 기록만 센다', () => {
    let records: AttendanceRecord[] = [];
    records = setStatus(records, CLASS, '2026-03-02', 'stu-1', 'absent'); // 시작일
    records = setStatus(records, CLASS, '2026-05-10', 'stu-1', 'late');
    records = setStatus(records, CLASS, '2026-07-20', 'stu-2', 'early'); // 끝일
    records = setStatus(records, CLASS, '2026-07-21', 'stu-2', 'absent'); // 방학
    records = setStatus(records, CLASS, '2026-03-01', 'stu-1', 'absent'); // 전날

    const counts = rangeCounts(records, CLASS, '2026-03-02', '2026-07-20');

    expect(counts.get('stu-1')).toEqual({ absent: 1, late: 1, early: 0, fieldTrip: 0 });
    expect(counts.get('stu-2')).toEqual({ absent: 0, late: 0, early: 1, fieldTrip: 0 });
  });
});

describe('notesInRange — 학기 사유 모음', () => {
  it('사유가 적힌 항목만 날짜순으로, 기간 밖은 빼고 모은다', () => {
    let records: AttendanceRecord[] = [];
    records = setStatus(records, CLASS, '2026-05-10', 'stu-1', 'late');
    records = setNote(records, CLASS, '2026-05-10', 'stu-1', '늦잠');
    records = setStatus(records, CLASS, '2026-03-05', 'stu-1', 'absent');
    records = setNote(records, CLASS, '2026-03-05', 'stu-1', '병원');
    records = setStatus(records, CLASS, '2026-03-06', 'stu-1', 'late'); // 사유 없음
    records = setStatus(records, CLASS, '2026-07-21', 'stu-1', 'absent');
    records = setNote(records, CLASS, '2026-07-21', 'stu-1', '방학'); // 기간 밖

    const notes = notesInRange(records, CLASS, '2026-03-02', '2026-07-20');

    expect(notes.get('stu-1')).toEqual([
      { date: '2026-03-05', status: 'absent', note: '병원' },
      { date: '2026-05-10', status: 'late', note: '늦잠' },
    ]);
    expect(notes.has('stu-2')).toBe(false);
  });

  it('monthDay는 M/D다', () => {
    expect(monthDay('2026-03-05')).toBe('3/5');
    expect(monthDay('2026-11-30')).toBe('11/30');
  });

  it('분류만 있는 항목도 모으고, 분류가 같이 실린다', () => {
    let records: AttendanceRecord[] = [];
    records = setStatus(records, CLASS, '2026-03-05', 'stu-1', 'absent');
    records = setReason(records, CLASS, '2026-03-05', 'stu-1', 'illness');

    expect(notesInRange(records, CLASS, '2026-03-01', '2026-03-31').get('stu-1')).toEqual([
      { date: '2026-03-05', status: 'absent', note: '', reason: 'illness' },
    ]);
  });
});

describe('setReason · reasonOf — 사유 분류', () => {
  it('분류를 찍고, 지우고, 상태를 바꿔도 남는다', () => {
    let records: AttendanceRecord[] = [];
    records = setStatus(records, CLASS, DATE, 'stu-1', 'absent');
    expect(reasonOf(records, CLASS, DATE, 'stu-1')).toBeNull();

    records = setReason(records, CLASS, DATE, 'stu-1', 'illness');
    expect(reasonOf(records, CLASS, DATE, 'stu-1')).toBe('illness');

    // "감기로 결석"이 지각으로 바뀌어도 감기(질병)라는 사실은 그대로다.
    records = setStatus(records, CLASS, DATE, 'stu-1', 'late');
    expect(reasonOf(records, CLASS, DATE, 'stu-1')).toBe('illness');

    records = setReason(records, CLASS, DATE, 'stu-1', null);
    expect(reasonOf(records, CLASS, DATE, 'stu-1')).toBeNull();
    expect(records[0]?.entries[0]).not.toHaveProperty('reason');
  });

  it('기록이 없는 학생에게는 분류를 찍을 수 없다 — 출석에는 사유가 없다', () => {
    const records = setReason([], CLASS, DATE, 'stu-1', 'illness');
    expect(records).toEqual([]);
  });
});
