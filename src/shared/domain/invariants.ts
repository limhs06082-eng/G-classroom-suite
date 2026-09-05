import { createClassRoom, createDefaultPeriodTimes, createTerm } from './factories';
import {
  MAX_PERIOD,
  type ClassRoom,
  type Group,
  type PeriodTime,
  type Student,
  type SuiteData,
  type Term,
} from './types';

/** `"09:00"` 꼴을 분으로. 못 읽으면 null. */
function hmToMinutes(value: string): number | null {
  const match = /^([0-9]{1,2}):([0-9]{2})$/.exec(value.trim());
  if (match === null) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
}

/**
 * 이 줄을 시각으로 쓸 수 있는가.
 *
 * 끝이 시작보다 이르거나 같은 줄은 '지금' 카드가 통째로 건너뛴다.
 * 건너뛴 자리가 앞뒤 교시를 잇는 긴 틈이 되어 점심으로 오인되므로,
 * 조용히 넘기지 않고 여기서 거른다.
 */
function isSaneSpan(time: PeriodTime): boolean {
  const start = hmToMinutes(time.start);
  const end = hmToMinutes(time.end);
  return start !== null && end !== null && end > start;
}

/**
 * 도메인 불변조건 검사 및 자동 복구.
 *
 * localStorage 데이터는 브라우저 사고, 수동 편집, 이전 버전 마이그레이션으로
 * 언제든 깨질 수 있다. 앱이 깨진 데이터로 흰 화면을 띄우는 대신,
 * 최대한 살려서 열고 무엇을 고쳤는지 교사에게 알린다.
 *
 * 원칙:
 *   1. **학생을 삭제하지 않는다.** 1년치 기록의 주인이다.
 *      갈 곳이 없으면 복구용 학급을 만들어서라도 살린다.
 *   2. 파생 데이터(프로필, 모둠 소속)는 삭제해도 된다. 다시 만들 수 있다.
 *   3. 고친 내용은 전부 사용자에게 보고한다. 조용히 고치지 않는다.
 *
 * 설계 근거: 설계 문서 §6.2
 */

export type RepairCode =
  /** 저장소 계층(schema.ts)에서 쓰는 코드 */
  | 'MALFORMED_RECORD'
  | 'MISSING_SECTION'
  | 'SCHEMA_VERSION_AHEAD'
  /** 도메인 불변조건 코드 */
  | 'ORPHAN_CLASSROOM'
  | 'ORPHAN_STUDENT'
  | 'ORPHAN_GROUP'
  | 'DUPLICATE_STUDENT_NUMBER'
  | 'STUDENT_IN_MULTIPLE_GROUPS'
  | 'GROUP_MEMBER_NOT_FOUND'
  | 'INVALID_GROUP_LEADER'
  | 'ORPHAN_PROFILE'
  | 'DUPLICATE_PROFILE'
  | 'INVALID_ACTIVE_TERM'
  | 'INVALID_ACTIVE_CLASS'
  | 'ORPHAN_SEATING_STATE'
  | 'INVALID_SEAT_POSITION'
  | 'ORPHAN_SAVED_LAYOUT'
  | 'ORPHAN_TIMETABLE'
  | 'INVALID_PERIOD_TIME'
  | 'ORPHAN_DUTY_RECORD'
  | 'INVALID_DUTY_ASSIGNMENT'
  | 'ORPHAN_REWARD_RECORD'
  | 'ORPHAN_ASSIGNMENT_RECORD'
  /** 2판 기록(출결·알림장·하루 바꾸기·쿠폰·관찰)이 없는 학급·학생을 가리킬 때 */
  | 'ORPHAN_CLASS_RECORD';

export interface RepairLog {
  code: RepairCode;
  /** 교사가 읽을 한국어 설명 */
  message: string;
  /** warning은 교사가 확인해야 하는 것, info는 알리기만 하면 되는 것 */
  severity: 'info' | 'warning';
  entityIds: string[];
}

export interface RepairResult {
  data: SuiteData;
  repairs: RepairLog[];
}

const RECOVERY_TERM_SEMESTER = '복구된 기간';
const RECOVERY_CLASS_NAME = '미분류';

/** YYYY-MM-DD */
function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * 정렬 순서를 고정한다.
 * "첫 번째를 남긴다"는 복구 규칙이 실행할 때마다 다른 결과를 내면 안 된다.
 */
function byCreatedAtThenId<T extends { createdAt: string; id: string }>(a: T, b: T): number {
  return a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt);
}

export function validateAndRepair(input: SuiteData, now: string = new Date().toISOString()): RepairResult {
  const repairs: RepairLog[] = [];

  const terms: Term[] = [...input.terms];
  let classRooms: ClassRoom[] = [...input.classRooms];
  const students: Student[] = input.students.map((s) => ({ ...s }));
  let groups: Group[] = input.groups.map((g) => ({ ...g, studentIds: [...g.studentIds] }));

  // 복구용 학기·학급은 실제로 필요할 때만 만든다.
  let recoveryTerm: Term | null = null;
  let recoveryClass: ClassRoom | null = null;

  function ensureRecoveryTerm(): Term {
    if (recoveryTerm) return recoveryTerm;

    const existing = terms.find((t) => t.semester === RECOVERY_TERM_SEMESTER);
    if (existing) {
      recoveryTerm = existing;
      return existing;
    }

    const created = createTerm(
      {
        schoolYear: String(new Date(now).getFullYear()),
        semester: RECOVERY_TERM_SEMESTER,
        startDate: toDateOnly(now),
        endDate: toDateOnly(now),
      },
      now,
    );
    terms.push(created);
    recoveryTerm = created;
    return created;
  }

  function ensureRecoveryClass(): ClassRoom {
    if (recoveryClass) return recoveryClass;

    const existing = classRooms.find((c) => c.name === RECOVERY_CLASS_NAME);
    if (existing) {
      recoveryClass = existing;
      return existing;
    }

    // 살아 있는 학급이 있으면 그 학기에, 없으면 복구 학기를 만들어 붙인다.
    const hostTermId = classRooms[0]?.termId ?? input.activeTermId ?? terms[0]?.id ?? ensureRecoveryTerm().id;

    const created = createClassRoom({ termId: hostTermId, name: RECOVERY_CLASS_NAME }, now);
    classRooms.push(created);
    recoveryClass = created;
    return created;
  }

  // ── 1. ClassRoom.termId가 존재하는 Term을 가리키는가 ──────────
  {
    const termIds = new Set(terms.map((t) => t.id));
    const orphans = classRooms.filter((c) => !termIds.has(c.termId));

    if (orphans.length > 0) {
      const target = ensureRecoveryTerm();
      classRooms = classRooms.map((c) =>
        termIds.has(c.termId) ? c : { ...c, termId: target.id, updatedAt: now },
      );
      repairs.push({
        code: 'ORPHAN_CLASSROOM',
        severity: 'warning',
        entityIds: orphans.map((c) => c.id),
        message: `학기 정보가 없는 학급 ${orphans.length}개를 '${target.name}'으로 옮겼습니다. 설정에서 올바른 학기로 다시 지정해 주세요.`,
      });
    }
  }

  // ── 2. Student.classId가 존재하는 ClassRoom을 가리키는가 ──────
  //    학생은 절대 삭제하지 않는다. 갈 곳이 없으면 만들어서라도 살린다.
  {
    const classIds = new Set(classRooms.map((c) => c.id));
    const orphans = students.filter((s) => !classIds.has(s.classId));

    if (orphans.length > 0) {
      const target = ensureRecoveryClass();
      for (const student of students) {
        if (!classIds.has(student.classId)) {
          student.classId = target.id;
          student.updatedAt = now;
        }
      }
      repairs.push({
        code: 'ORPHAN_STUDENT',
        severity: 'warning',
        entityIds: orphans.map((s) => s.id),
        message: `학급 정보가 없는 학생 ${orphans.length}명을 '${target.name}' 학급으로 옮겼습니다. 기록은 그대로 남아 있습니다. 명단 관리에서 올바른 반으로 옮겨 주세요.`,
      });
    }
  }

  // ── 3. Group.classId가 존재하는 ClassRoom을 가리키는가 ────────
  //    모둠은 파생 데이터다. 소속 학생으로 학급을 추정하고, 그마저 없으면 버린다.
  {
    const classIds = new Set(classRooms.map((c) => c.id));
    const studentById = new Map(students.map((s) => [s.id, s]));
    const reassigned: string[] = [];
    const dropped: string[] = [];

    groups = groups.flatMap((group) => {
      if (classIds.has(group.classId)) return [group];

      const inferredClassId = group.studentIds
        .map((id) => studentById.get(id)?.classId)
        .find((classId): classId is string => classId !== undefined && classIds.has(classId));

      if (inferredClassId === undefined) {
        dropped.push(group.id);
        return [];
      }

      reassigned.push(group.id);
      return [{ ...group, classId: inferredClassId, updatedAt: now }];
    });

    if (reassigned.length > 0) {
      repairs.push({
        code: 'ORPHAN_GROUP',
        severity: 'info',
        entityIds: reassigned,
        message: `학급 정보가 없던 모둠 ${reassigned.length}개를 소속 학생의 학급으로 되돌렸습니다.`,
      });
    }
    if (dropped.length > 0) {
      repairs.push({
        code: 'ORPHAN_GROUP',
        severity: 'warning',
        entityIds: dropped,
        message: `학급과 학생이 모두 없는 빈 모둠 ${dropped.length}개를 정리했습니다.`,
      });
    }
  }

  // ── 4. 모둠 구성원이 실제 학생인가 ───────────────────────────
  {
    const studentIds = new Set(students.map((s) => s.id));
    const affected: string[] = [];

    groups = groups.map((group) => {
      const kept = group.studentIds.filter((id) => studentIds.has(id));
      if (kept.length === group.studentIds.length) return group;

      affected.push(group.id);
      return { ...group, studentIds: kept, updatedAt: now };
    });

    if (affected.length > 0) {
      repairs.push({
        code: 'GROUP_MEMBER_NOT_FOUND',
        severity: 'info',
        entityIds: affected,
        message: `모둠 ${affected.length}개에서 존재하지 않는 학생 참조를 정리했습니다.`,
      });
    }
  }

  // ── 5. 한 학생은 같은 반에서 최대 한 모둠에만 속한다 ───────────
  //    Group.studentIds[] 방향을 택한 대가. 타입으로 못 막으니 여기서 막는다.
  {
    const seen = new Map<string, string>(); // studentId → 최초로 차지한 groupId
    const affected = new Set<string>();

    // 생성 순서가 이른 모둠이 학생을 갖는다. 실행마다 결과가 같아야 한다.
    const ordered = [...groups].sort(byCreatedAtThenId);

    for (const group of ordered) {
      const kept: string[] = [];
      for (const studentId of group.studentIds) {
        const owner = seen.get(studentId);
        if (owner === undefined) {
          seen.set(studentId, group.id);
          kept.push(studentId);
        } else {
          affected.add(group.id);
        }
      }
      if (kept.length !== group.studentIds.length) {
        group.studentIds = kept;
        group.updatedAt = now;
      }
    }

    if (affected.size > 0) {
      repairs.push({
        code: 'STUDENT_IN_MULTIPLE_GROUPS',
        severity: 'warning',
        entityIds: [...affected],
        message: `여러 모둠에 중복으로 들어간 학생이 있어, 먼저 만든 모둠에만 남겼습니다. 모둠 편성을 확인해 주세요.`,
      });
    }
  }

  // ── 6. 모둠장은 그 모둠의 구성원이어야 한다 ──────────────────
  {
    const affected: string[] = [];

    groups = groups.map((group) => {
      if (group.leaderId === null || group.studentIds.includes(group.leaderId)) return group;

      affected.push(group.id);
      return { ...group, leaderId: null, updatedAt: now };
    });

    if (affected.length > 0) {
      repairs.push({
        code: 'INVALID_GROUP_LEADER',
        severity: 'info',
        entityIds: affected,
        message: `모둠 ${affected.length}개에서 구성원이 아닌 모둠장을 해제했습니다.`,
      });
    }
  }

  // ── 7. 학생 번호는 같은 반 안에서 유일하다 ────────────────────
  //    번호가 겹치면 정렬·명렬표·CSV 대조가 전부 어긋난다.
  {
    const renumbered: string[] = [];
    const byClass = new Map<string, Student[]>();

    for (const student of students) {
      const bucket = byClass.get(student.classId);
      if (bucket) bucket.push(student);
      else byClass.set(student.classId, [student]);
    }

    for (const bucket of byClass.values()) {
      const taken = new Set<number>();
      // 먼저 등록된 학생이 원래 번호를 지킨다.
      for (const student of [...bucket].sort(byCreatedAtThenId)) {
        if (!taken.has(student.number)) {
          taken.add(student.number);
          continue;
        }
        let next = 1;
        while (taken.has(next)) next += 1;
        taken.add(next);
        student.number = next;
        student.updatedAt = now;
        renumbered.push(student.id);
      }
    }

    if (renumbered.length > 0) {
      repairs.push({
        code: 'DUPLICATE_STUDENT_NUMBER',
        severity: 'warning',
        entityIds: renumbered,
        message: `번호가 겹친 학생 ${renumbered.length}명에게 비어 있는 번호를 새로 부여했습니다. 명단에서 번호를 확인해 주세요.`,
      });
    }
  }

  // ── 8. 기능별 프로필은 실제 학생을 가리키고 중복되지 않는다 ────
  const studentIdSet = new Set(students.map((s) => s.id));

  function cleanProfiles<T extends { studentId: string }>(
    list: readonly T[],
    label: string,
  ): { kept: T[]; orphanCount: number; duplicateCount: number } {
    const kept: T[] = [];
    const seen = new Set<string>();
    let orphanCount = 0;
    let duplicateCount = 0;

    for (const profile of list) {
      if (!studentIdSet.has(profile.studentId)) {
        orphanCount += 1;
        continue;
      }
      if (seen.has(profile.studentId)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(profile.studentId);
      kept.push(profile);
    }

    if (orphanCount > 0) {
      repairs.push({
        code: 'ORPHAN_PROFILE',
        severity: 'info',
        entityIds: [],
        message: `${label} 설정 ${orphanCount}건이 없는 학생을 가리켜 정리했습니다.`,
      });
    }
    if (duplicateCount > 0) {
      repairs.push({
        code: 'DUPLICATE_PROFILE',
        severity: 'info',
        entityIds: [],
        message: `${label} 설정 ${duplicateCount}건이 중복되어 정리했습니다.`,
      });
    }

    return { kept, orphanCount, duplicateCount };
  }

  const seatingProfiles = cleanProfiles(input.seatingProfiles, '자리배치').kept.map((profile) => {
    /*
     * '떨어뜨리기' 대상은 같은 반의 다른 학생이어야 한다. 전출생·다른 반·
     * 자기 자신이 남아 있으면 배치 알고리즘이 있지도 않은 짝을 피하느라
     * 헛돈다. 조용히 걸러도 되는 파생 자료라 알리지 않는다.
     */
    const owner = students.find((s) => s.id === profile.studentId);
    const avoidStudentIds = profile.avoidStudentIds.filter((id) => {
      const other = students.find((s) => s.id === id);
      return other !== undefined && id !== profile.studentId && other.classId === owner?.classId;
    });
    return avoidStudentIds.length === profile.avoidStudentIds.length
      ? profile
      : { ...profile, avoidStudentIds };
  });
  const dutyProfiles = cleanProfiles(input.dutyProfiles, '당번').kept;
  const rewardProfiles = cleanProfiles(input.rewardProfiles, '보상').kept;

  // ── 8-2. 자리 배치가 실제 학급·학생·좌석을 가리키는가 ─────────
  //     잘못된 배치를 그대로 두면 교실 그림에 학생이 겹쳐 그려지거나 사라진다.
  const seatingStates = (() => {
    const classIds = new Set(classRooms.map((c) => c.id));
    const studentById = new Map(students.map((s) => [s.id, s]));

    const droppedStates: string[] = [];
    const fixedStates: string[] = [];

    const kept = input.seatingStates.flatMap((state) => {
      if (!classIds.has(state.classId)) {
        droppedStates.push(state.classId);
        return [];
      }

      const usedSeats = new Set<string>();
      const usedStudents = new Set<string>();
      let changed = false;

      const positions = state.positions.filter((position) => {
        const student = studentById.get(position.studentId);
        const match = /^r(\d+)c(\d+)$/.exec(position.seatId);
        const row = match ? Number(match[1]) : 0;
        const col = match ? Number(match[2]) : 0;

        const valid =
          student !== undefined &&
          student.classId === state.classId &&
          match !== null &&
          row >= 1 &&
          row <= state.rows &&
          col >= 1 &&
          col <= state.cols &&
          !state.disabledSeatIds.includes(position.seatId) &&
          !usedSeats.has(position.seatId) &&
          !usedStudents.has(position.studentId);

        if (!valid) {
          changed = true;
          return false;
        }

        usedSeats.add(position.seatId);
        usedStudents.add(position.studentId);
        return true;
      });

      if (!changed) return [state];

      fixedStates.push(state.classId);
      return [{ ...state, positions, updatedAt: now }];
    });

    if (droppedStates.length > 0) {
      repairs.push({
        code: 'ORPHAN_SEATING_STATE',
        severity: 'info',
        entityIds: droppedStates,
        message: `없는 학급의 자리 배치 ${droppedStates.length}건을 정리했습니다.`,
      });
    }
    if (fixedStates.length > 0) {
      repairs.push({
        code: 'INVALID_SEAT_POSITION',
        severity: 'warning',
        entityIds: fixedStates,
        message: `자리 배치에서 잘못된 좌석 지정을 정리했습니다. 자리·모둠 화면에서 다시 배치해 주세요.`,
      });
    }

    return kept;
  })();

  // ── 8-2b. 저장한 자리표가 실제 학급을 가리키는가 ──────────────
  //     학급 삭제 연쇄(classOps.deleteClassRoom)에서 자리표를 빠뜨리면
  //     여기서 잡힌다. 제대로 지우면 이 규칙은 아무 일도 하지 않는다.
  const savedLayouts = (() => {
    const classIds = new Set(classRooms.map((c) => c.id));
    const dropped: string[] = [];

    const kept = input.savedLayouts.filter((layout) => {
      if (classIds.has(layout.classId)) return true;
      dropped.push(layout.id);
      return false;
    });

    if (dropped.length > 0) {
      repairs.push({
        code: 'ORPHAN_SAVED_LAYOUT',
        severity: 'info',
        entityIds: dropped,
        message: `없는 학급의 저장한 자리표 ${dropped.length}건을 정리했습니다.`,
      });
    }

    return kept;
  })();

  // ── 8-2c. 시간표가 실제 학급을 가리키는가 ────────────────────
  //     자리표와 같은 이유다. classOps.deleteClassRoom이 지우지만,
  //     빠뜨리면 교사가 못 보는 서른다섯 칸이 백업 파일에 영영 남는다.
  const timetableEntries = (() => {
    const classIds = new Set(classRooms.map((c) => c.id));
    const kept = input.timetableEntries.filter((entry) => classIds.has(entry.classId));
    const droppedCount = input.timetableEntries.length - kept.length;

    if (droppedCount > 0) {
      repairs.push({
        code: 'ORPHAN_TIMETABLE',
        severity: 'info',
        // 칸에는 id가 없다. (학급, 요일, 교시)가 열쇠라 가리킬 id가 없다.
        entityIds: [],
        message: `없는 학급의 시간표 ${droppedCount}칸을 정리했습니다.`,
      });
    }

    return kept;
  })();

  // ── 8-2d. 교시 시각이 온전한가 ───────────────────────────────
  //     스키마가 이미 채워 주지만, 백업 복원이 아닌 길(가져오기, 수리)로도
  //     자료가 들어온다. 중복된 교시가 있으면 '지금' 카드가 어느 쪽을 믿을지
  //     모른다 — 앞엣것을 남기고 나머지를 버린다.
  //
  //     시각 글자도 여기서 본다. 안 보면 못 읽는 줄이 '지금' 카드까지 가고,
  //     카드는 그 줄을 버린다. 그러면 그 자리에 60분짜리 구멍이 생겨
  //     **진짜 점심과 길이가 같아진다** — 09:55에 "점심"이라고 말하는 화면이
  //     된다. 실제로 그렇게 되는 것을 확인하고 여기에 그물을 놓았다.
  const periodTimes = (() => {
    const seen = new Set<number>();
    const kept: PeriodTime[] = [];
    for (const time of input.periodTimes) {
      if (seen.has(time.period)) continue;
      if (!Number.isInteger(time.period) || time.period < 1 || time.period > MAX_PERIOD) continue;
      if (!isSaneSpan(time)) continue;
      seen.add(time.period);
      kept.push(time);
    }

    /*
     * 1부터 이어져야 한다. 6·7교시를 안 쓰는 저학년 담임이 뒤에서 지운
     * 것은 이어짐을 안 깨지만, 중간이 빠진 것은 자료가 상했다는 뜻이다.
     */
    const ordered = [...kept].sort((a, b) => a.period - b.period);
    if (ordered.length === 0 || ordered.some((time, index) => time.period !== index + 1)) {
      // 반쪽짜리 일과는 '지금' 카드를 어느 교시에서 갑자기 말 못 하게 만든다.
      repairs.push({
        code: 'INVALID_PERIOD_TIME',
        severity: 'warning',
        // 교시 시각에는 id가 없다. 교시 번호가 열쇠라 가리킬 id가 없다.
        entityIds: [],
        message: '교시 시각이 온전하지 않아 기본 일과로 되돌렸습니다.',
      });
      return createDefaultPeriodTimes();
    }

    if (ordered.length !== input.periodTimes.length) {
      repairs.push({
        code: 'INVALID_PERIOD_TIME',
        severity: 'info',
        entityIds: [],
        message: '교시 시각에서 알아볼 수 없는 줄을 덜어 냈습니다. 설정 → 시간표에서 확인해 주세요.',
      });
    }

    // 카드가 앞에서부터 훑으므로 교시 순서를 여기서 고정해 둔다.
    return ordered;
  })();

  // ── 8-3. 역할·당번이 실제 학급·학생·역할을 가리키는가 ─────────
  //     잘못된 배정을 두면 오늘의 당번에 빈칸이나 유령 이름이 뜬다.
  const duty = (() => {
    const classIds = new Set(classRooms.map((c) => c.id));
    const studentById = new Map(students.map((s) => [s.id, s]));

    const droppedRoles: string[] = [];
    const dutyRoles = input.dutyRoles.flatMap((role) => {
      if (!classIds.has(role.classId)) {
        droppedRoles.push(role.id);
        return [];
      }

      // 다른 반 학생이나 없는 학생이 고정·제외 목록에 남아 있으면 정리한다.
      const belongs = (studentId: string): boolean =>
        studentById.get(studentId)?.classId === role.classId;

      const fixedStudentIds = role.fixedStudentIds.filter(belongs);
      const excludedStudentIds = role.excludedStudentIds.filter(belongs);

      if (
        fixedStudentIds.length === role.fixedStudentIds.length &&
        excludedStudentIds.length === role.excludedStudentIds.length
      ) {
        return [role];
      }
      return [{ ...role, fixedStudentIds, excludedStudentIds, updatedAt: now }];
    });

    const roleIdsByClass = new Map<string, Set<string>>();
    for (const role of dutyRoles) {
      const bucket = roleIdsByClass.get(role.classId) ?? new Set<string>();
      bucket.add(role.id);
      roleIdsByClass.set(role.classId, bucket);
    }

    const droppedRounds: string[] = [];
    const fixedRounds: string[] = [];

    const dutyRounds = input.dutyRounds.flatMap((round) => {
      if (!classIds.has(round.classId)) {
        droppedRounds.push(round.id);
        return [];
      }

      const validRoleIds = roleIdsByClass.get(round.classId) ?? new Set<string>();
      let changed = false;

      const assignments = round.assignments.flatMap((assignment) => {
        if (!validRoleIds.has(assignment.roleId)) {
          changed = true;
          return [];
        }

        const seen = new Set<string>();
        const studentIds = assignment.studentIds.filter((studentId) => {
          const ok =
            studentById.get(studentId)?.classId === round.classId && !seen.has(studentId);
          if (ok) seen.add(studentId);
          else changed = true;
          return ok;
        });

        return [{ ...assignment, studentIds }];
      });

      const lockedRoleIds = round.lockedRoleIds.filter((roleId) => {
        const ok = validRoleIds.has(roleId);
        if (!ok) changed = true;
        return ok;
      });

      if (!changed) return [round];

      fixedRounds.push(round.id);
      return [{ ...round, assignments, lockedRoleIds, updatedAt: now }];
    });

    const dutyCompletions = input.dutyCompletions
      .filter((completion) => classIds.has(completion.classId))
      .map((completion) => ({
        ...completion,
        completed: completion.completed.filter(
          (entry) => studentById.get(entry.studentId)?.classId === completion.classId,
        ),
        substitutions: completion.substitutions.filter(
          (entry) =>
            studentById.get(entry.originalStudentId)?.classId === completion.classId &&
            studentById.get(entry.substituteStudentId)?.classId === completion.classId,
        ),
      }));

    const droppedCompletions = input.dutyCompletions.length - dutyCompletions.length;

    if (droppedRoles.length + droppedRounds.length + droppedCompletions > 0) {
      repairs.push({
        code: 'ORPHAN_DUTY_RECORD',
        severity: 'info',
        entityIds: [...droppedRoles, ...droppedRounds],
        message: '없는 학급의 역할·당번 기록을 정리했습니다.',
      });
    }
    if (fixedRounds.length > 0) {
      repairs.push({
        code: 'INVALID_DUTY_ASSIGNMENT',
        severity: 'warning',
        entityIds: fixedRounds,
        message:
          '당번 배정에서 없는 역할이나 학생을 가리키던 부분을 정리했습니다. 역할·당번 화면에서 다시 배정해 주세요.',
      });
    }

    return { dutyRoles, dutyRounds, dutyCompletions };
  })();

  // ── 8-4. 보상·과제 기록이 실제 학급·학생을 가리키는가 ─────────
  const reward = (() => {
    const classIds = new Set(classRooms.map((c) => c.id));
    const studentById = new Map(students.map((s) => [s.id, s]));
    const groupIds = new Set(groups.map((g) => g.id));

    const behaviorPresets = input.behaviorPresets.filter((preset) => classIds.has(preset.classId));

    /** 점수·목표 대상이 아직 살아 있는가 */
    const targetAlive = (unit: string, targetId: string, classId: string): boolean => {
      if (unit === 'class') return true;
      if (unit === 'group') return groupIds.has(targetId);
      return studentById.get(targetId)?.classId === classId;
    };

    const scoreEntries = input.scoreEntries.filter(
      (entry) =>
        classIds.has(entry.classId) && targetAlive(entry.targetUnit, entry.targetId, entry.classId),
    );
    const scoreGoals = input.scoreGoals.filter(
      (goal) =>
        classIds.has(goal.classId) && targetAlive(goal.targetUnit, goal.targetId, goal.classId),
    );

    const dropped =
      input.behaviorPresets.length -
      behaviorPresets.length +
      (input.scoreEntries.length - scoreEntries.length) +
      (input.scoreGoals.length - scoreGoals.length);

    if (dropped > 0) {
      repairs.push({
        code: 'ORPHAN_REWARD_RECORD',
        severity: 'info',
        entityIds: [],
        message: `없어진 학급·학생·모둠을 가리키던 점수 기록 ${dropped}건을 정리했습니다.`,
      });
    }

    return { behaviorPresets, scoreEntries, scoreGoals };
  })();

  const assignmentData = (() => {
    const classIds = new Set(classRooms.map((c) => c.id));
    const studentById = new Map(students.map((s) => [s.id, s]));

    const assignments = input.assignments.filter((item) => classIds.has(item.classId));
    const assignmentClassById = new Map(assignments.map((item) => [item.id, item.classId]));

    // 같은 (과제, 학생) 조합이 둘이면 어느 상태가 맞는지 알 수 없다. 첫 것만 남긴다.
    const seen = new Set<string>();
    const submissions = input.submissions.filter((submission) => {
      const classId = assignmentClassById.get(submission.assignmentId);
      if (classId === undefined) return false;
      if (studentById.get(submission.studentId)?.classId !== classId) return false;

      const key = `${submission.assignmentId}:${submission.studentId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const dropped =
      input.assignments.length - assignments.length + (input.submissions.length - submissions.length);

    if (dropped > 0) {
      repairs.push({
        code: 'ORPHAN_ASSIGNMENT_RECORD',
        severity: 'info',
        entityIds: [],
        message: `없어진 학급·학생·과제를 가리키던 제출 기록 ${dropped}건을 정리했습니다.`,
      });
    }

    return { assignments, submissions };
  })();

  // ── 8-5. 2판 기록이 실제 학급·학생·모둠을 가리키는가 ──────────
  //     출결·알림장·하루 바꾸기·쿠폰은 학급을, 출결 항목·관찰·사용 기록은
  //     학생(또는 모둠)을 가리킨다. 유령 참조는 화면에 빈 이름으로 떠서
  //     한 건씩 세어 한 번에 알린다.
  const extra = (() => {
    const classIds = new Set(classRooms.map((c) => c.id));
    const studentById = new Map(students.map((s) => [s.id, s]));
    const groupIds = new Set(groups.map((g) => g.id));

    let dropped = 0;

    const attendanceRecords = input.attendanceRecords.flatMap((record) => {
      if (!classIds.has(record.classId)) {
        dropped += 1;
        return [];
      }
      const entries = record.entries.filter(
        (entry) => studentById.get(entry.studentId)?.classId === record.classId,
      );
      if (entries.length === record.entries.length) return [record];
      dropped += record.entries.length - entries.length;
      return [{ ...record, entries }];
    });

    const notices = input.notices.filter((notice) => {
      if (classIds.has(notice.classId)) return true;
      dropped += 1;
      return false;
    });

    const timetableOverrides = input.timetableOverrides.filter((override) => {
      if (classIds.has(override.classId)) return true;
      dropped += 1;
      return false;
    });

    const rewardItems = input.rewardItems.filter((item) => {
      if (classIds.has(item.classId)) return true;
      dropped += 1;
      return false;
    });

    const classEvents = input.classEvents.filter((event) => {
      if (classIds.has(event.classId)) return true;
      dropped += 1;
      return false;
    });

    const redemptions = input.redemptions.filter((redemption) => {
      const targetAlive =
        redemption.targetUnit === 'group'
          ? groupIds.has(redemption.targetId)
          : studentById.get(redemption.targetId)?.classId === redemption.classId;
      if (classIds.has(redemption.classId) && targetAlive) return true;
      dropped += 1;
      return false;
    });

    /*
     * 관찰 기록은 학생을 따라간다. 학생이 복구 학급으로 옮겨졌으면 기록도
     * 따라 옮긴다 — 학생을 지우지 않는 원칙과 같은 이유로, 관찰 기록은
     * 그 학생 1년의 일부라 학급이 어긋났다고 버리면 안 된다.
     */
    const observations = input.observations.flatMap((observation) => {
      const student = studentById.get(observation.studentId);
      if (student === undefined) {
        dropped += 1;
        return [];
      }
      if (student.classId === observation.classId) return [observation];
      return [{ ...observation, classId: student.classId }];
    });

    // 행동특성 의견도 관찰 기록처럼 학생을 따라간다. 알림(dropped) 앞에서 센다.
    const behaviorComments = input.behaviorComments.flatMap((comment) => {
      const student = studentById.get(comment.studentId);
      if (student === undefined) {
        dropped += 1;
        return [];
      }
      if (student.classId === comment.classId) return [comment];
      return [{ ...comment, classId: student.classId }];
    });

    if (dropped > 0) {
      repairs.push({
        code: 'ORPHAN_CLASS_RECORD',
        severity: 'info',
        entityIds: [],
        message: `없어진 학급·학생을 가리키던 출결·알림장·쿠폰·관찰·의견 기록 ${dropped}건을 정리했습니다.`,
      });
    }

    return {
      attendanceRecords,
      notices,
      timetableOverrides,
      rewardItems,
      redemptions,
      observations,
      classEvents,
      behaviorComments,
    };
  })();

  // ── 9. 활성 학기·학급이 실제로 존재하는가 ────────────────────
  let activeTermId = input.activeTermId;
  let activeClassId = input.activeClassId;

  if (activeTermId !== null && !terms.some((t) => t.id === activeTermId)) {
    activeTermId = terms.find((t) => t.status === 'active')?.id ?? terms[0]?.id ?? null;
    repairs.push({
      code: 'INVALID_ACTIVE_TERM',
      severity: 'info',
      entityIds: [],
      message: '선택돼 있던 학기가 없어져 다른 학기로 전환했습니다.',
    });
  }

  const selectableClasses =
    activeTermId === null ? classRooms : classRooms.filter((c) => c.termId === activeTermId);

  if (activeClassId !== null && !selectableClasses.some((c) => c.id === activeClassId)) {
    activeClassId = selectableClasses[0]?.id ?? null;
    repairs.push({
      code: 'INVALID_ACTIVE_CLASS',
      severity: 'info',
      entityIds: [],
      message: '선택돼 있던 학급이 없어져 다른 학급으로 전환했습니다.',
    });
  }

  return {
    data: {
      ...input,
      terms,
      classRooms,
      students,
      groups,
      seatingProfiles,
      dutyProfiles,
      rewardProfiles,
      seatingStates,
      savedLayouts,
      timetableEntries,
      periodTimes,
      dutyRoles: duty.dutyRoles,
      dutyRounds: duty.dutyRounds,
      dutyCompletions: duty.dutyCompletions,
      behaviorPresets: reward.behaviorPresets,
      scoreEntries: reward.scoreEntries,
      scoreGoals: reward.scoreGoals,
      assignments: assignmentData.assignments,
      submissions: assignmentData.submissions,
      attendanceRecords: extra.attendanceRecords,
      notices: extra.notices,
      timetableOverrides: extra.timetableOverrides,
      rewardItems: extra.rewardItems,
      redemptions: extra.redemptions,
      observations: extra.observations,
      classEvents: extra.classEvents,
      behaviorComments: extra.behaviorComments,
      activeTermId,
      activeClassId,
    },
    repairs,
  };
}
