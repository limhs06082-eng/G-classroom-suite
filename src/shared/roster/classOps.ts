import { createClassRoom, createTerm } from '../domain/factories';
import type { SuiteData, Term } from '../domain/types';

/**
 * 학급·학기 조작.
 *
 * 전부 순수 함수다. 화면에 로직을 두면 검증할 수 없다.
 * rosterOps.ts와 같은 방침이고 같은 자료를 건드린다.
 *
 * 설계 근거: docs/superpowers/specs/2026-08-14-class-term-management-design.md
 */

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 학급 하나에 딸린 자료 수.
 *
 * 세는 항목과 deleteClassRoom이 지우는 항목은 **반드시 같아야 한다.**
 * 어긋나면 교사가 못 본 자료가 사라진다.
 */
export interface ClassDataCount {
  students: number;
  groups: number;
  seatingStates: number;
  savedLayouts: number;
  seatingProfiles: number;
  dutyProfiles: number;
  rewardProfiles: number;
  dutyRoles: number;
  dutyRounds: number;
  dutyCompletions: number;
  behaviorPresets: number;
  scoreEntries: number;
  scoreGoals: number;
  timetableEntries: number;
  assignments: number;
  submissions: number;
}

/** 그 학급 학생의 id 집합. 프로필 세 종류가 이것으로 딸려 온다. */
function studentIdsOf(data: SuiteData, classId: string): Set<string> {
  return new Set(
    data.students.filter((student) => student.classId === classId).map((student) => student.id),
  );
}

/** 그 학급 과제의 id 집합. submissions가 이것으로 딸려 온다. */
function assignmentIdsOf(data: SuiteData, classId: string): Set<string> {
  return new Set(data.assignments.filter((item) => item.classId === classId).map((item) => item.id));
}

export function countClassData(data: SuiteData, classId: string): ClassDataCount {
  const studentIds = studentIdsOf(data, classId);
  const assignmentIds = assignmentIdsOf(data, classId);

  const byClass = <T extends { classId: string }>(rows: readonly T[]): number =>
    rows.filter((row) => row.classId === classId).length;
  const byStudent = <T extends { studentId: string }>(rows: readonly T[]): number =>
    rows.filter((row) => studentIds.has(row.studentId)).length;

  return {
    students: studentIds.size,
    groups: byClass(data.groups),
    seatingStates: byClass(data.seatingStates),
    savedLayouts: byClass(data.savedLayouts),
    seatingProfiles: byStudent(data.seatingProfiles),
    dutyProfiles: byStudent(data.dutyProfiles),
    rewardProfiles: byStudent(data.rewardProfiles),
    dutyRoles: byClass(data.dutyRoles),
    dutyRounds: byClass(data.dutyRounds),
    dutyCompletions: byClass(data.dutyCompletions),
    behaviorPresets: byClass(data.behaviorPresets),
    scoreEntries: byClass(data.scoreEntries),
    scoreGoals: byClass(data.scoreGoals),
    timetableEntries: byClass(data.timetableEntries),
    assignments: assignmentIds.size,
    submissions: data.submissions.filter((row) => assignmentIds.has(row.assignmentId)).length,
  };
}

export function addClassRoom(
  data: SuiteData,
  input: { termId: string; name: string; grade?: number; classNo?: number },
  now: string = nowIso(),
): SuiteData {
  const name = input.name.trim();
  if (name === '') return data;
  if (!data.terms.some((term) => term.id === input.termId)) return data;

  const room = createClassRoom(
    {
      termId: input.termId,
      name,
      ...(input.grade === undefined ? {} : { grade: input.grade }),
      ...(input.classNo === undefined ? {} : { classNo: input.classNo }),
    },
    now,
  );

  return { ...data, classRooms: [...data.classRooms, room] };
}

export function updateClassRoom(
  data: SuiteData,
  classId: string,
  patch: { name?: string; grade?: number; classNo?: number },
  now: string = nowIso(),
): SuiteData {
  if (!data.classRooms.some((room) => room.id === classId)) return data;

  // 빈 이름으로는 고치지 않는다. 이름 없는 학급은 목록에서 찾을 수 없다.
  const name = patch.name?.trim();

  return {
    ...data,
    classRooms: data.classRooms.map((room) =>
      room.id !== classId
        ? room
        : {
            ...room,
            name: name === undefined || name === '' ? room.name : name,
            grade: patch.grade ?? room.grade,
            classNo: patch.classNo ?? room.classNo,
            updatedAt: now,
          },
    ),
  };
}

/**
 * 학급과 딸린 자료 16종을 지운다.
 *
 * 불변조건 검사의 고아 정리에 맡기지 않는다. 그쪽에 맡기면 정상 삭제인데도
 * "자료가 깨졌으니 고쳤다"는 복구 경보가 뜨고, 학생은 '복구된 학급'이라는
 * 낯선 반으로 옮겨진다.
 */
export function deleteClassRoom(data: SuiteData, classId: string): SuiteData {
  const removed = data.classRooms.find((room) => room.id === classId);
  if (removed === undefined) return data;

  // 마지막 학급은 지우지 않는다. 0개가 되면 모든 화면이 빈 상태가 된다.
  if (data.classRooms.length <= 1) return data;

  const studentIds = studentIdsOf(data, classId);
  const assignmentIds = assignmentIdsOf(data, classId);

  const keepClass = <T extends { classId: string }>(rows: readonly T[]): T[] =>
    rows.filter((row) => row.classId !== classId);
  const keepStudent = <T extends { studentId: string }>(rows: readonly T[]): T[] =>
    rows.filter((row) => !studentIds.has(row.studentId));

  const classRooms = data.classRooms.filter((room) => room.id !== classId);

  // 지운 학급을 보고 있었으면 다른 학급으로 옮긴다. 같은 학기를 먼저 찾는다.
  const nextActive =
    data.activeClassId !== classId
      ? data.activeClassId
      : (classRooms.find((room) => room.termId === removed.termId)?.id ??
        classRooms[0]?.id ??
        null);

  return {
    ...data,
    classRooms,
    students: keepClass(data.students),
    groups: keepClass(data.groups),
    seatingStates: keepClass(data.seatingStates),
    savedLayouts: keepClass(data.savedLayouts),
    seatingProfiles: keepStudent(data.seatingProfiles),
    dutyProfiles: keepStudent(data.dutyProfiles),
    rewardProfiles: keepStudent(data.rewardProfiles),
    dutyRoles: keepClass(data.dutyRoles),
    dutyRounds: keepClass(data.dutyRounds),
    dutyCompletions: keepClass(data.dutyCompletions),
    behaviorPresets: keepClass(data.behaviorPresets),
    scoreEntries: keepClass(data.scoreEntries),
    scoreGoals: keepClass(data.scoreGoals),
    timetableEntries: keepClass(data.timetableEntries),
    assignments: data.assignments.filter((item) => item.classId !== classId),
    submissions: data.submissions.filter((row) => !assignmentIds.has(row.assignmentId)),
    activeClassId: nextActive,
  };
}

// ── 학기 ──────────────────────────────────────────────────────

/**
 * 학기 삭제는 만들지 않는다.
 *
 * 학기를 지우면 그 안 학급이 전부 딸려 오고, 그건 16개 배열 × 학급 수다.
 * 위험 대비 값이 없다. 대신 보관으로 목록에서 치운다.
 */
export function addTerm(
  data: SuiteData,
  input: {
    schoolYear: string;
    semester: string;
    name?: string;
    startDate: string;
    endDate: string;
  },
  now: string = nowIso(),
): SuiteData {
  const term = createTerm(
    {
      schoolYear: input.schoolYear,
      semester: input.semester,
      startDate: input.startDate,
      endDate: input.endDate,
      ...(input.name === undefined || input.name.trim() === '' ? {} : { name: input.name.trim() }),
    },
    now,
  );

  return { ...data, terms: [...data.terms, term] };
}

export function updateTerm(
  data: SuiteData,
  termId: string,
  patch: { name?: string; startDate?: string; endDate?: string },
  _now: string = nowIso(),
): SuiteData {
  if (!data.terms.some((term) => term.id === termId)) return data;
  const name = patch.name?.trim();

  return {
    ...data,
    terms: data.terms.map((term) =>
      term.id !== termId
        ? term
        : {
            ...term,
            name: name === undefined || name === '' ? term.name : name,
            startDate: patch.startDate ?? term.startDate,
            endDate: patch.endDate ?? term.endDate,
          },
    ),
  };
}

/** 보관은 목록에서 치우는 것이지 지우는 것이 아니다. 자료는 그대로 남는다. */
export function setTermArchived(
  data: SuiteData,
  termId: string,
  archived: boolean,
  now: string = nowIso(),
): SuiteData {
  if (!data.terms.some((term) => term.id === termId)) return data;

  // 지금 쓰는 학기를 치우면 화면이 빈 상태가 된다.
  if (archived && data.activeTermId === termId) return data;

  return {
    ...data,
    terms: data.terms.map((term) => {
      if (term.id !== termId) return term;
      if (archived) return { ...term, archivedAt: now };

      // archivedAt은 optional이다. "보관 안 함"은 키를 빼서 표현한다.
      const { archivedAt: _dropped, ...rest } = term;
      return rest;
    }),
  };
}

/** 보관하지 않은 학기. 학급 목록과 전환기에서 이것만 쓴다. */
export function visibleTerms(data: SuiteData): Term[] {
  return data.terms.filter((term) => term.archivedAt === undefined);
}
