import {
  CURRENT_SCHEMA_VERSION,
  type ClassRoom,
  type Assignment,
  type BehaviorPreset,
  type Submission,
  type DutyCompletion,
  type DutyProfile,
  type DutyRole,
  type DutyRound,
  type Gender,
  type Group,
  type RewardProfile,
  type ScoreCycle,
  type ScoreEntry,
  type ScoreGoal,
  type ScoreTargetUnit,
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
    perspective: 'student',
    updatedAt: now,
  };
}

/**
 * 처음 만들 때 제안하는 역할 묶음.
 *
 * 빈 화면에서 역할을 처음부터 만들게 하면 대부분 포기한다.
 * 실제 학급에서 흔한 것만 골라 기본으로 깔아 준다. 교사가 지우거나 고치면 된다.
 */
export const STARTER_ROLES: ReadonlyArray<
  Pick<DutyRole, 'name' | 'category' | 'neededCount' | 'cycle'>
> = [
  { name: '칠판 지우기', category: '칠판', neededCount: 2, cycle: 'weekly' },
  { name: '교실 바닥', category: '청소구역', neededCount: 4, cycle: 'weekly' },
  { name: '복도·계단', category: '청소구역', neededCount: 2, cycle: 'weekly' },
  { name: '급식 배식 도우미', category: '급식', neededCount: 2, cycle: 'weekly' },
  { name: '우유·재활용', category: '학급 운영', neededCount: 2, cycle: 'weekly' },
];

export function createDutyRole(
  input: Pick<DutyRole, 'classId' | 'name' | 'category' | 'neededCount' | 'cycle'> &
    Partial<Pick<DutyRole, 'id' | 'description' | 'activeDays' | 'isActive'>>,
  now: string = nowIso(),
): DutyRole {
  return {
    id: input.id ?? createId(),
    classId: input.classId,
    name: input.name,
    category: input.category,
    description: input.description ?? '',
    neededCount: input.neededCount,
    cycle: input.cycle,
    activeDays: input.activeDays ?? [],
    isActive: input.isActive ?? true,
    fixedStudentIds: [],
    excludedStudentIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createDutyRound(
  input: Pick<DutyRound, 'classId' | 'startDate' | 'endDate' | 'label'> &
    Partial<Pick<DutyRound, 'id' | 'status' | 'assignments' | 'lockedRoleIds'>>,
  now: string = nowIso(),
): DutyRound {
  return {
    id: input.id ?? createId(),
    classId: input.classId,
    startDate: input.startDate,
    endDate: input.endDate,
    label: input.label,
    status: input.status ?? 'active',
    assignments: input.assignments ?? [],
    lockedRoleIds: input.lockedRoleIds ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createDutyCompletion(classId: string, date: string): DutyCompletion {
  return { classId, date, completed: [], substitutions: [] };
}

/**
 * 처음 만들 때 제안하는 행동 항목.
 *
 * 빈 화면에서 항목을 처음부터 만들게 하면 수업 중에 쓸 수 없다.
 * 칭찬 위주로 깔고, 지도 항목은 하나만 둔다.
 */
export const STARTER_PRESETS: ReadonlyArray<
  Pick<BehaviorPreset, 'name' | 'defaultPoints' | 'targetUnit' | 'color'>
> = [
  { name: '도움 주기', defaultPoints: 1, targetUnit: 'student', color: 'emerald' },
  { name: '발표·참여', defaultPoints: 1, targetUnit: 'student', color: 'sky' },
  { name: '정리 정돈', defaultPoints: 1, targetUnit: 'student', color: 'teal' },
  { name: '모둠 협력', defaultPoints: 2, targetUnit: 'group', color: 'purple' },
  { name: '학급 목표 달성', defaultPoints: 5, targetUnit: 'class', color: 'amber' },
  { name: '약속 지키기 지도', defaultPoints: -1, targetUnit: 'student', color: 'orange' },
];

export function createBehaviorPreset(
  input: Pick<BehaviorPreset, 'classId' | 'name' | 'defaultPoints' | 'targetUnit' | 'color'> &
    Partial<Pick<BehaviorPreset, 'id' | 'isActive' | 'order'>>,
  now: string = nowIso(),
): BehaviorPreset {
  return {
    id: input.id ?? createId(),
    classId: input.classId,
    name: input.name,
    defaultPoints: input.defaultPoints,
    targetUnit: input.targetUnit,
    color: input.color,
    isActive: input.isActive ?? true,
    order: input.order ?? 0,
    createdAt: now,
  };
}

export function createScoreEntry(
  input: Pick<ScoreEntry, 'classId' | 'targetUnit' | 'targetId' | 'points' | 'reason'> &
    Partial<Pick<ScoreEntry, 'id' | 'presetId' | 'occurredAt'>>,
  now: string = nowIso(),
): ScoreEntry {
  return {
    id: input.id ?? createId(),
    classId: input.classId,
    occurredAt: input.occurredAt ?? now,
    targetUnit: input.targetUnit,
    targetId: input.targetId,
    points: input.points,
    reason: input.reason,
    ...(input.presetId === undefined ? {} : { presetId: input.presetId }),
  };
}

export function createScoreGoal(
  input: Pick<ScoreGoal, 'classId' | 'title' | 'targetUnit' | 'targetId' | 'targetPoints'> &
    Partial<Pick<ScoreGoal, 'id' | 'reward' | 'startDate'>>,
  now: string = nowIso(),
): ScoreGoal {
  return {
    id: input.id ?? createId(),
    classId: input.classId,
    title: input.title,
    targetUnit: input.targetUnit,
    targetId: input.targetId,
    targetPoints: input.targetPoints,
    reward: input.reward ?? '',
    startDate: input.startDate ?? now.slice(0, 10),
    createdAt: now,
  };
}

export const CLASS_TARGET_ID = 'class';

export function targetIdFor(unit: ScoreTargetUnit, id: string): string {
  return unit === 'class' ? CLASS_TARGET_ID : id;
}

export function createAssignment(
  input: Pick<Assignment, 'classId' | 'title'> &
    Partial<Pick<Assignment, 'id' | 'description' | 'dueDate' | 'status'>>,
  now: string = nowIso(),
): Assignment {
  return {
    id: input.id ?? createId(),
    classId: input.classId,
    title: input.title,
    description: input.description ?? '',
    dueDate: input.dueDate ?? '',
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  };
}

export function createSubmission(
  assignmentId: string,
  studentId: string,
  status: Submission['status'] = 'unsubmitted',
  now: string = nowIso(),
): Submission {
  return { assignmentId, studentId, status, note: '', updatedAt: now };
}

export const DEFAULT_SCORE_CYCLE: ScoreCycle = {
  weeklyStartDay: 1, // 월요일 시작 — 학교 주간 운영에 맞춘다
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
    dutyRoles: [],
    dutyRounds: [],
    dutyCompletions: [],
    behaviorPresets: [],
    scoreEntries: [],
    scoreGoals: [],
    assignments: [],
    submissions: [],
    scoreCycle: { ...DEFAULT_SCORE_CYCLE },
    activeTermId: null,
    activeClassId: null,
  };
}
