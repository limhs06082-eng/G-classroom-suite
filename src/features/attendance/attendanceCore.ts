import type { AttendanceReason, AttendanceRecord, AttendanceStatus } from '../../shared/domain/types';

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

/** 생활기록부 출결의 사유 분류. 나이스와 같은 낱말을 쓴다. */
export const REASON_LABELS: Record<AttendanceReason, string> = {
  illness: '질병',
  unexcused: '미인정',
  other: '기타',
  authorized: '인정',
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

/** 그날 그 학생의 사유 분류. 안 골랐거나 기록이 없으면 null. */
export function reasonOf(
  records: readonly AttendanceRecord[],
  classId: string,
  date: string,
  studentId: string,
): AttendanceReason | null {
  const entry = recordOf(records, classId, date)?.entries.find((e) => e.studentId === studentId);
  return entry?.reason ?? null;
}

/**
 * 사유 분류를 고른다. null이면 지운다.
 *
 * 기록(상태)이 없는 학생에게는 아무 일도 안 한다 — 출석에는 사유가 없다.
 */
export function setReason(
  records: readonly AttendanceRecord[],
  classId: string,
  date: string,
  studentId: string,
  reason: AttendanceReason | null,
): AttendanceRecord[] {
  const existing = recordOf(records, classId, date);
  if (existing === undefined) return [...records];

  const entries = existing.entries.map((entry) => {
    if (entry.studentId !== studentId) return entry;
    const { reason: _dropped, ...rest } = entry;
    return reason === null ? rest : { ...rest, reason };
  });
  return records.map((record) => (record === existing ? { ...existing, entries } : record));
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
  const stamp =
    existing?.confirmedAt === undefined ? {} : { confirmedAt: existing.confirmedAt };

  if (status === null) {
    // 확인 도장이 있으면 항목이 다 비어도 기록을 남긴다 — 도장이 곧 내용이다.
    return kept.length === 0 && existing?.confirmedAt === undefined
      ? rest
      : [...rest, { classId, date, entries: kept, ...stamp }];
  }

  // 상태만 바뀌는 것이라 메모와 분류는 남긴다. "감기로 결석"이 지각으로
  // 바뀌어도 감기(질병)라는 사실은 그대로다.
  const previous = entries.find((entry) => entry.studentId === studentId);
  const note = previous?.note ?? '';
  const reason = previous?.reason === undefined ? {} : { reason: previous.reason };
  return [
    ...rest,
    { classId, date, entries: [...kept, { studentId, status, note, ...reason }], ...stamp },
  ];
}

/**
 * 여러 학생을 한 번에 같은 상태로. 학년 전체 체험학습 같은 날
 * 30명 × 탭 여러 번 대신 버튼 하나로 끝낸다.
 */
export function setStatusMany(
  records: readonly AttendanceRecord[],
  classId: string,
  date: string,
  studentIds: readonly string[],
  status: AttendanceStatus | null,
): AttendanceRecord[] {
  let next: AttendanceRecord[] = [...records];
  for (const studentId of studentIds) {
    next = setStatus(next, classId, date, studentId, status);
  }
  return next;
}

/** 그날 출결을 확인했는가. */
export function isConfirmed(
  records: readonly AttendanceRecord[],
  classId: string,
  date: string,
): boolean {
  return recordOf(records, classId, date)?.confirmedAt !== undefined;
}

/**
 * 확인 도장을 찍거나 뗀다.
 *
 * 결석 0명인 날에도 "찍었다"를 남기는 수단이다. 떼었을 때 항목도 없으면
 * 기록째 지운다(빈 껍데기 규칙).
 */
export function setConfirmed(
  records: readonly AttendanceRecord[],
  classId: string,
  date: string,
  confirmed: boolean,
  now: string,
): AttendanceRecord[] {
  const existing = recordOf(records, classId, date);
  const rest = records.filter((record) => record !== existing);
  const entries = existing?.entries ?? [];

  if (!confirmed) {
    return entries.length === 0 ? rest : [...rest, { classId, date, entries }];
  }

  return [...rest, { classId, date, entries, confirmedAt: now }];
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
 * 한 학생이 그날 교실에 없는가 — absentToday와 같은 규칙의 단건 판별.
 *
 * "없는 학생" 규칙(결석·체험학습)이 화면마다 인라인으로 복제되면
 * 규칙이 바뀔 때 한 곳만 고쳐진다. 당번 화면·칠판이 쓴다.
 */
export function isAwayToday(
  records: readonly AttendanceRecord[],
  classId: string,
  date: string,
  studentId: string,
): boolean {
  const status = statusOf(records, classId, date, studentId);
  return status === 'absent' || status === 'fieldTrip';
}

/**
 * 기간 안 학생별 상태 횟수. from·to 포함 — ISO 날짜라 글자 비교면 된다.
 *
 * 학기말 생활기록부 출결은 한 학기 전체를 세야 한다. 달마다 더하게 하면
 * 손으로 틀린다. 기록이 있는 학생만 담는다.
 */
export function rangeCounts(
  records: readonly AttendanceRecord[],
  classId: string,
  from: string,
  to: string,
): Map<string, Record<AttendanceStatus, number>> {
  const counts = new Map<string, Record<AttendanceStatus, number>>();

  for (const record of records) {
    if (record.classId !== classId || record.date < from || record.date > to) continue;
    for (const entry of record.entries) {
      const bucket =
        counts.get(entry.studentId) ?? { absent: 0, late: 0, early: 0, fieldTrip: 0 };
      bucket[entry.status] += 1;
      counts.set(entry.studentId, bucket);
    }
  }

  return counts;
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
  return rangeCounts(records, classId, `${month}-01`, `${month}-31`);
}

export interface AttendanceNote {
  /** YYYY-MM-DD */
  date: string;
  status: AttendanceStatus;
  note: string;
  reason?: AttendanceReason;
}

/**
 * 기간 안 학생별 사유 메모, 날짜순. 사유가 빈 항목은 담지 않는다.
 *
 * 생활기록부 출결에는 횟수만이 아니라 "질병·미인정" 같은 사유가 따라간다.
 * 학기말에 날짜를 하나씩 열어 보게 하지 않는다.
 */
export function notesInRange(
  records: readonly AttendanceRecord[],
  classId: string,
  from: string,
  to: string,
): Map<string, AttendanceNote[]> {
  const notes = new Map<string, AttendanceNote[]>();

  for (const record of [...records].sort((a, b) => a.date.localeCompare(b.date))) {
    if (record.classId !== classId || record.date < from || record.date > to) continue;
    for (const entry of record.entries) {
      const note = entry.note.trim();
      // 메모도 분류도 없으면 적을 것이 없다. 분류만 있어도 "질병"은 생활기록부에 간다.
      if (note === '' && entry.reason === undefined) continue;
      const list = notes.get(entry.studentId) ?? [];
      list.push({
        date: record.date,
        status: entry.status,
        note,
        ...(entry.reason === undefined ? {} : { reason: entry.reason }),
      });
      notes.set(entry.studentId, list);
    }
  }

  return notes;
}

/**
 * 기간 안 학생별·상태별 분류 합계. 분류 없는 항목은 세지 않는다 — 합계는
 * rangeCounts가 이미 센다. 나이스의 "질병 결석 n" 칸에 그대로 옮겨 적는다.
 */
export function reasonCounts(
  records: readonly AttendanceRecord[],
  classId: string,
  from: string,
  to: string,
): Map<string, Record<AttendanceStatus, Partial<Record<AttendanceReason, number>>>> {
  const counts = new Map<string, Record<AttendanceStatus, Partial<Record<AttendanceReason, number>>>>();

  for (const record of records) {
    if (record.classId !== classId || record.date < from || record.date > to) continue;
    for (const entry of record.entries) {
      if (entry.reason === undefined) continue;
      const bucket = counts.get(entry.studentId) ?? { absent: {}, late: {}, early: {}, fieldTrip: {} };
      const byReason = bucket[entry.status];
      byReason[entry.reason] = (byReason[entry.reason] ?? 0) + 1;
      counts.set(entry.studentId, bucket);
    }
  }

  return counts;
}

/** `"2026-03-05"` → `"3/5"`. 표 한 칸에 들어가는 짧은 날짜. */
export function monthDay(date: string): string {
  const [, month = '', day = ''] = date.split('-');
  return `${Number(month)}/${Number(day)}`;
}
