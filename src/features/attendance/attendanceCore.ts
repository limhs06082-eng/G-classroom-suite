import type { AttendanceRecord, AttendanceStatus } from '../../shared/domain/types';

/**
 * 출결 판단.
 *
 * **기록이 없는 학생이 출석이다.** 서른 명 중 스물아홉이 출석인 날
 * 스물아홉 줄을 만들지 않는다 — 과제의 "기록 없음 = 미제출"과 같은 원칙.
 * 시계를 부르지 않는다. 날짜는 전부 YYYY-MM-DD 글자로 받는다.
 */

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  absent: '결석',
  late: '지각',
  early: '조퇴',
  fieldTrip: '체험학습',
};

/**
 * 이름 칸을 탭할 때마다 도는 순서. 출석(null)이 처음이자 끝이다.
 *
 * 결석이 맨 앞인 까닭: 아침 출결에서 제일 많이 찍는 것이 결석이라,
 * 한 번 탭으로 닿아야 한다.
 */
const CYCLE: readonly (AttendanceStatus | null)[] = ['absent', 'late', 'early', 'fieldTrip', null];

export function nextStatus(current: AttendanceStatus | null): AttendanceStatus | null {
  if (current === null) return CYCLE[0] ?? null;
  const index = CYCLE.indexOf(current);
  return CYCLE[index + 1] ?? null;
}

function recordOf(
  records: readonly AttendanceRecord[],
  classId: string,
  date: string,
): AttendanceRecord | undefined {
  return records.find((record) => record.classId === classId && record.date === date);
}

/** 그날 그 학생의 상태. null이면 출석이다. */
export function statusOf(
  records: readonly AttendanceRecord[],
  classId: string,
  date: string,
  studentId: string,
): AttendanceStatus | null {
  const entry = recordOf(records, classId, date)?.entries.find((e) => e.studentId === studentId);
  return entry?.status ?? null;
}

/** 그날 그 학생의 사유 메모. 기록이 없으면 빈 글자다. */
export function noteOf(
  records: readonly AttendanceRecord[],
  classId: string,
  date: string,
  studentId: string,
): string {
  const entry = recordOf(records, classId, date)?.entries.find((e) => e.studentId === studentId);
  return entry?.note ?? '';
}

/**
 * 상태를 찍는다. 바뀐 목록을 돌려준다.
 *
 * null은 출석으로 되돌리기다 — 항목을 지우고, 항목이 하나도 안 남으면
 * 그날 기록 자체를 지운다. 전원 출석인 날의 빈 껍데기가 파일에 쌓이면
 * 백업 파일을 열어 본 사람이 "이 빈 줄은 뭐지"부터 묻게 된다.
 *
 * 넘겨받은 목록은 건드리지 않는다. 화면이 이 결과를 update()에 그대로 넣는다.
 */
export function setStatus(
  records: readonly AttendanceRecord[],
  classId: string,
  date: string,
  studentId: string,
  status: AttendanceStatus | null,
): AttendanceRecord[] {
  const existing = recordOf(records, classId, date);
  const rest = records.filter((record) => record !== existing);
  const entries = existing?.entries ?? [];
  const kept = entries.filter((entry) => entry.studentId !== studentId);

  if (status === null) {
    return kept.length === 0 ? rest : [...rest, { classId, date, entries: kept }];
  }

  // 상태만 바뀌는 것이라 메모는 남긴다. "감기로 결석"이 지각으로 바뀌어도
  // 감기라는 사실은 그대로다.
  const note = entries.find((entry) => entry.studentId === studentId)?.note ?? '';
  return [...rest, { classId, date, entries: [...kept, { studentId, status, note }] }];
}

/** 사유 메모를 고친다. 기록이 없는 학생(출석)에게는 아무 일도 하지 않는다. */
export function setNote(
  records: readonly AttendanceRecord[],
  classId: string,
  date: string,
  studentId: string,
  note: string,
): AttendanceRecord[] {
  return records.map((record) => {
    if (record.classId !== classId || record.date !== date) return record;
    return {
      ...record,
      entries: record.entries.map((entry) =>
        entry.studentId === studentId ? { ...entry, note } : entry,
      ),
    };
  });
}

export interface AttendanceSummary {
  /** 명단 수 - 기록된 항목 수 */
  present: number;
  /** 기록된 항목 수 */
  marked: number;
  byStatus: Record<AttendanceStatus, number>;
}

export function summarize(
  records: readonly AttendanceRecord[],
  classId: string,
  date: string,
  rosterCount: number,
): AttendanceSummary {
  const entries = recordOf(records, classId, date)?.entries ?? [];
  const byStatus: Record<AttendanceStatus, number> = { absent: 0, late: 0, early: 0, fieldTrip: 0 };
  for (const entry of entries) byStatus[entry.status] += 1;

  return { present: rosterCount - entries.length, marked: entries.length, byStatus };
}

/**
 * 그날 교실에 아예 없는 학생 — 결석·체험학습.
 *
 * 지각은 늦게라도 오고 조퇴는 아침에는 있다. 뽑기와 당번 대체가 빼야 할
 * 사람은 하루 종일 없는 쪽이다.
 */
export function absentToday(
  records: readonly AttendanceRecord[],
  classId: string,
  date: string,
): string[] {
  return (recordOf(records, classId, date)?.entries ?? [])
    .filter((entry) => entry.status === 'absent' || entry.status === 'fieldTrip')
    .map((entry) => entry.studentId);
}

/**
 * 그 달 학생별 상태 횟수. month는 "2026-08" 꼴이다.
 *
 * 나이스에 월말 출결을 넣을 때 옆에 두고 보는 표라, 기록이 있는 학생만 담는다.
 */
export function monthlyCounts(
  records: readonly AttendanceRecord[],
  classId: string,
  month: string,
): Map<string, Record<AttendanceStatus, number>> {
  const counts = new Map<string, Record<AttendanceStatus, number>>();

  for (const record of records) {
    if (record.classId !== classId || !record.date.startsWith(`${month}-`)) continue;
    for (const entry of record.entries) {
      const bucket =
        counts.get(entry.studentId) ?? { absent: 0, late: 0, early: 0, fieldTrip: 0 };
      bucket[entry.status] += 1;
      counts.set(entry.studentId, bucket);
    }
  }

  return counts;
}
