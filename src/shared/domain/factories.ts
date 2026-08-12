import {
  CURRENT_SCHEMA_VERSION,
  type ClassRoom,
  type DutyProfile,
  type Gender,
  type Group,
  type RewardProfile,
  type ScoreCycle,
  type SeatingProfile,
  type SeatingState,
  type Student,
  type SuiteData,
  type Term,
} from './types';

/**
 * 엔티티 생성 헬퍼.
 *
 * 모든 생성 함수는 `now`를 주입받는다. 테스트에서 시각을 고정하기 위해서다.
 * 원본 앱들은 `new Date().toISOString()`을 곳곳에 직접 호출해 테스트가 불가능했다.
 */

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 구형 브라우저 폴백. 충돌 가능성은 학급 규모에서 무시할 수 있다.
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────

export function createTerm(
  input: Pick<Term, 'schoolYear' | 'semester' | 'startDate' | 'endDate'> &
    Partial<Pick<Term, 'id' | 'name' | 'status'>>,
  now: string = nowIso(),
): Term {
  return {
    id: input.id ?? createId(),
    schoolYear: input.schoolYear,
    semester: input.semester,
    name: input.name ?? `${input.schoolYear}학년도 ${input.semester}`,
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.status ?? 'active',
    createdAt: now,
  };
}

export function createClassRoom(
  input: Pick<ClassRoom, 'termId' | 'name'> &
    Partial<Pick<ClassRoom, 'id' | 'grade' | 'classNo'>>,
  now: string = nowIso(),
): ClassRoom {
  return {
    id: input.id ?? createId(),
    termId: input.termId,
    name: input.name,
    ...(input.grade === undefined ? {} : { grade: input.grade }),
    ...(input.classNo === undefined ? {} : { classNo: input.classNo }),
    createdAt: now,
    updatedAt: now,
  };
}

export function createStudent(
  input: Pick<Student, 'classId' | 'number' | 'name'> &
    Partial<Pick<Student, 'id' | 'status'>>,
  now: string = nowIso(),
): Student {
  return {
    id: input.id ?? createId(),
    classId: input.classId,
    number: input.number,
    name: input.name,
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  };
}

export function createGroup(
  input: Pick<Group, 'classId' | 'name' | 'color'> &
    Partial<Pick<Group, 'id' | 'studentIds' | 'leaderId'>>,
  now: string = nowIso(),
): Group {
  return {
    id: input.id ?? createId(),
    classId: input.classId,
    name: input.name,
    color: input.color,
    studentIds: input.studentIds ?? [],
    leaderId: input.leaderId ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

// ─────────────────────────────────────────────────────────────
// 기능별 프로필 — 학생이 생기면 기본값으로 함께 만들어 둔다.
// 프로필이 없어도 동작해야 하지만, 미리 만들어 두면 UI가 단순해진다.
// ─────────────────────────────────────────────────────────────

export function createSeatingProfile(studentId: string, gender: Gender = 'none'): SeatingProfile {
  return { studentId, gender, tags: [], note: '', isLocked: false, isGroupLocked: false };
}

export function createDutyProfile(studentId: string, order: number): DutyProfile {
  return {
    studentId,
    order,
    excludedRoleIds: [],
    excludedWeekdays: [],
    excludedDates: [],
    exclusionPeriods: [],
  };
}

export function createRewardProfile(studentId: string, nickname = ''): RewardProfile {
  return { studentId, nickname };
}

// ─────────────────────────────────────────────────────────────

/** 교실 기본 크기. 25명 안팎의 학급이 여유 있게 들어간다. */
export const DEFAULT_SEAT_ROWS = 5;
export const DEFAULT_SEAT_COLS = 6;

export function createSeatingState(classId: string, now: string = nowIso()): SeatingState {
  return {
    classId,
    rows: DEFAULT_SEAT_ROWS,
    cols: DEFAULT_SEAT_COLS,
    disabledSeatIds: [],
    positions: [],
    updatedAt: now,
  };
}

export const DEFAULT_SCORE_CYCLE: ScoreCycle = {
  weeklyStartDay: 1, // 월요일 시작 — 학교 주간 운영에 맞춘다
  weeklyStartDayApplyMode: 'next_period',
  monthlyType: '1st_to_end',
  monthlyStartDay: 1,
  showLifetimeCumulative: false,
};

/** 최초 실행 시의 빈 데이터. 설정 마법사를 거치기 전 상태다. */
export function createEmptySuiteData(): SuiteData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: { schoolName: '', teacherName: '' },
    terms: [],
    classRooms: [],
    students: [],
    groups: [],
    seatingProfiles: [],
    dutyProfiles: [],
    rewardProfiles: [],
    seatingStates: [],
    scoreCycle: { ...DEFAULT_SCORE_CYCLE },
    activeTermId: null,
    activeClassId: null,
  };
}
