import {
  createDutyProfile,
  createRewardProfile,
  createSeatingProfile,
  createStudent,
} from '../domain/factories';
import type { Student, SuiteData } from '../domain/types';
import type { ParsedRosterRow } from './parseRosterText';

/**
 * 학생 명단 조작.
 *
 * 전부 순수 함수다. 화면에 로직을 두면 검증할 수 없고, 5개 기능이
 * 같은 명단을 공유하는 이 프로젝트에서 명단 조작 버그는 전부에 번진다.
 *
 * 지켜야 할 원칙: **학생을 지우지 않는다.**
 * 전출·장기결석은 status를 'inactive'로 바꿀 뿐이고 기록은 그대로 남는다.
 */

function nowIso(): string {
  return new Date().toISOString();
}

/** 새 학생에게는 기능별 프로필도 함께 만들어 둔다. 없어도 동작하지만 화면이 단순해진다. */
function withProfiles(data: SuiteData, students: Student[]): SuiteData {
  const existingSeating = new Set(data.seatingProfiles.map((p) => p.studentId));
  const existingDuty = new Set(data.dutyProfiles.map((p) => p.studentId));
  const existingReward = new Set(data.rewardProfiles.map((p) => p.studentId));

  return {
    ...data,
    seatingProfiles: [
      ...data.seatingProfiles,
      ...students.filter((s) => !existingSeating.has(s.id)).map((s) => createSeatingProfile(s.id)),
    ],
    dutyProfiles: [
      ...data.dutyProfiles,
      ...students
        .filter((s) => !existingDuty.has(s.id))
        .map((s) => createDutyProfile(s.id, s.number)),
    ],
    rewardProfiles: [
      ...data.rewardProfiles,
      ...students.filter((s) => !existingReward.has(s.id)).map((s) => createRewardProfile(s.id)),
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// 개별 조작
// ─────────────────────────────────────────────────────────────

export function addStudent(
  data: SuiteData,
  classId: string,
  input: { number: number; name: string },
  now: string = nowIso(),
): SuiteData {
  const student = createStudent({ classId, number: input.number, name: input.name }, now);
  return withProfiles({ ...data, students: [...data.students, student] }, [student]);
}

export function updateStudent(
  data: SuiteData,
  studentId: string,
  patch: Partial<Pick<Student, 'number' | 'name'>>,
  now: string = nowIso(),
): SuiteData {
  return {
    ...data,
    students: data.students.map((student) =>
      student.id === studentId ? { ...student, ...patch, updatedAt: now } : student,
    ),
  };
}

/**
 * 전출·복귀 처리.
 *
 * 삭제가 아니다. 지난 학기의 당번 이력, 받은 점수, 제출한 과제가 모두 남는다.
 * 전학 온 학생이 다시 돌아오는 경우도 실제로 있다.
 */
export function setStudentStatus(
  data: SuiteData,
  studentId: string,
  status: Student['status'],
  memo?: string,
  now: string = nowIso(),
): SuiteData {
  return {
    ...data,
    students: data.students.map((student) =>
      student.id === studentId
        ? {
            ...student,
            status,
            statusChangedAt: now,
            updatedAt: now,
            ...(memo === undefined ? {} : { statusMemo: memo }),
          }
        : student,
    ),
  };
}

/**
 * 완전 삭제.
 *
 * 잘못 입력한 학생을 지우는 용도로만 쓴다. 화면에서는 전출 처리를 먼저 권해야 한다.
 * 모둠 소속과 기능별 프로필은 불변조건 검사가 정리한다.
 */
export function deleteStudent(data: SuiteData, studentId: string): SuiteData {
  return { ...data, students: data.students.filter((student) => student.id !== studentId) };
}

// ─────────────────────────────────────────────────────────────
// 명단 가져오기
// ─────────────────────────────────────────────────────────────

export type ImportMode =
  /** 명단 전체를 새로 세운다. 목록에 없는 기존 학생은 전출 처리된다(삭제 아님). */
  | 'replace'
  /** 새 학생만 추가한다. 기존 학생은 건드리지 않는다. */
  | 'add';

export interface ImportPlan {
  added: ParsedRosterRow[];
  /** 같은 사람으로 판단해 번호·이름을 갱신할 학생 */
  updated: Array<{ student: Student; row: ParsedRosterRow }>;
  /** replace 모드에서 목록에 없어 전출 처리될 학생 */
  deactivated: Student[];
  /** 이미 전출 상태였는데 목록에 다시 나타나 복귀시킬 학생 */
  reactivated: Student[];
}

/**
 * 같은 사람인지 판단한다.
 *
 * 1) 번호와 이름이 모두 같으면 확실히 같은 사람
 * 2) 이름이 같고 그 이름이 양쪽에서 유일하면 같은 사람 (번호만 바뀐 경우)
 * 3) 그 외에는 새 학생으로 본다
 *
 * 번호만 같고 이름이 다른 경우를 같은 사람으로 보지 않는 것이 중요하다.
 * 학년이 바뀌면 번호는 얼마든지 재사용된다.
 */
export function planRosterImport(
  data: SuiteData,
  classId: string,
  rows: readonly ParsedRosterRow[],
  mode: ImportMode,
): ImportPlan {
  const existing = data.students.filter((student) => student.classId === classId);

  const nameCountExisting = new Map<string, number>();
  for (const student of existing) {
    nameCountExisting.set(student.name, (nameCountExisting.get(student.name) ?? 0) + 1);
  }
  const nameCountIncoming = new Map<string, number>();
  for (const row of rows) {
    nameCountIncoming.set(row.name, (nameCountIncoming.get(row.name) ?? 0) + 1);
  }

  const matchedIds = new Set<string>();
  const added: ParsedRosterRow[] = [];
  const updated: Array<{ student: Student; row: ParsedRosterRow }> = [];
  const reactivated: Student[] = [];

  for (const row of rows) {
    const exact = existing.find(
      (student) =>
        !matchedIds.has(student.id) && student.number === row.number && student.name === row.name,
    );

    const byUniqueName =
      exact ??
      (nameCountExisting.get(row.name) === 1 && nameCountIncoming.get(row.name) === 1
        ? existing.find((student) => !matchedIds.has(student.id) && student.name === row.name)
        : undefined);

    const match = byUniqueName;

    if (match === undefined) {
      added.push(row);
      continue;
    }

    matchedIds.add(match.id);
    if (match.number !== row.number || match.name !== row.name) {
      updated.push({ student: match, row });
    }
    if (match.status === 'inactive') {
      reactivated.push(match);
    }
  }

  const deactivated =
    mode === 'replace'
      ? existing.filter((student) => !matchedIds.has(student.id) && student.status === 'active')
      : [];

  return { added, updated, deactivated, reactivated };
}

export function applyRosterImport(
  data: SuiteData,
  classId: string,
  rows: readonly ParsedRosterRow[],
  mode: ImportMode,
  now: string = nowIso(),
): SuiteData {
  const plan = planRosterImport(data, classId, rows, mode);

  const updatedById = new Map(plan.updated.map(({ student, row }) => [student.id, row]));
  const deactivatedIds = new Set(plan.deactivated.map((student) => student.id));
  const reactivatedIds = new Set(plan.reactivated.map((student) => student.id));

  const students = data.students.map((student) => {
    if (student.classId !== classId) return student;

    const row = updatedById.get(student.id);
    let next = student;

    if (row !== undefined) {
      next = { ...next, number: row.number, name: row.name, updatedAt: now };
    }
    if (deactivatedIds.has(student.id)) {
      next = {
        ...next,
        status: 'inactive',
        statusChangedAt: now,
        statusMemo: '명단 가져오기에서 제외됨',
        updatedAt: now,
      };
    }
    if (reactivatedIds.has(student.id)) {
      next = { ...next, status: 'active', statusChangedAt: now, updatedAt: now };
    }
    return next;
  });

  const created = plan.added.map((row) =>
    createStudent({ classId, number: row.number, name: row.name }, now),
  );

  return withProfiles({ ...data, students: [...students, ...created] }, created);
}
