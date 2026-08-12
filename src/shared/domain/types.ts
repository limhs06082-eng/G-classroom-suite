/**
 * 공통 도메인 모델.
 *
 * 원본 5개 앱은 학생·반·학기·모둠을 각자 다르게 정의했다.
 * 통합본에서는 이 파일이 유일한 정의이고, 모든 feature가 여기만 바라본다.
 *
 * 설계 근거: docs/superpowers/specs/2026-08-11-classroom-suite-design.md §6
 */

// ─────────────────────────────────────────────────────────────
// 학교 프로필
// ─────────────────────────────────────────────────────────────

export interface SchoolProfile {
  schoolName: string;
  /** NEIS 시도교육청코드 (급식·시간표 조회용) */
  officeCode?: string;
  /** NEIS 표준학교코드 */
  schoolCode?: string;
  teacherName: string;
}

// ─────────────────────────────────────────────────────────────
// 학기
// duty.OperationPeriod + assignment.Term 통합
// ─────────────────────────────────────────────────────────────

export type TermStatus = 'active' | 'ended' | 'archived';

export interface Term {
  id: string;
  /** "2026" */
  schoolYear: string;
  /** "1학기", "여름방학", "특별 운영 기간" */
  semester: string;
  /** "2026학년도 1학기" — 화면 표시용 전체 이름 */
  name: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  status: TermStatus;
  createdAt: string;
  archivedAt?: string;
}

// ─────────────────────────────────────────────────────────────
// 반
// seating.ClassRoom + assignment.ClassGroup 통합
//
// duty·reward는 원본에서 단일 학급을 전제했으나, 통합본은 다중 학급을 지원하고
// 전역 '활성 학급' 하나를 선택하는 방식으로 양쪽을 만족시킨다.
// 담임은 반을 하나만 만들고 이 개념을 인지하지 않는다.
// ─────────────────────────────────────────────────────────────

export interface ClassRoom {
  id: string;
  termId: string;
  /** "3학년 2반" */
  name: string;
  grade?: number;
  classNo?: number;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// 학생 — 단일 원본
//
// 원본 4개 앱의 Student 타입에서 공통 코어만 남기고,
// 기능별 필드는 아래 프로필로 분리했다.
// ─────────────────────────────────────────────────────────────

/** 'inactive'는 전출·장기결석 등. 기존 기록은 유지하고 신규 배정에서만 제외한다. */
export type StudentStatus = 'active' | 'inactive';

export interface Student {
  id: string;
  classId: string;
  /** 학급 내 학생 번호. 같은 반에서 유일해야 한다. */
  number: number;
  name: string;
  status: StudentStatus;
  statusChangedAt?: string;
  /** 전출·장기결석 사유 메모 */
  statusMemo?: string;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// 모둠
// seating.Group을 상위집합으로 채택.
// reward의 Student.groupId는 폐기하고 Group.studentIds[]로 통일했다.
//
// 대가: 배열 방향은 "한 학생 = 한 모둠"을 타입으로 보장하지 못한다.
// 따라서 invariants.ts의 STUDENT_IN_MULTIPLE_GROUPS 검사로 강제한다.
// ─────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  classId: string;
  name: string;
  /** Tailwind 토큰이 아닌 임의 색상값. 모둠 색은 교사가 자유롭게 정한다. */
  color: string;
  studentIds: string[];
  leaderId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// 기능별 학생 프로필
// 코어 Student를 건드리지 않고 기능별 부가정보를 확장한다.
// ─────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female' | 'other' | 'none';

/** ← G-seat-group-maker */
export interface SeatingProfile {
  studentId: string;
  gender: Gender;
  /** 배치 조건에 쓰는 특성 태그 */
  tags: string[];
  note: string;
  /** 자리 고정. 재배치해도 이 학생은 자리를 지킨다. */
  isLocked: boolean;
  /**
   * 모둠 고정. 자리 고정과 다른 개념이다.
   * 시력 때문에 앞자리로 고정한 학생과, 모둠을 그대로 두고 싶은 학생은 다르다.
   */
  isGroupLocked: boolean;
}

export interface ExclusionPeriod {
  id: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  reason: string;
}

/** ← G-class-duty-manager */
export interface DutyProfile {
  studentId: string;
  /** 순환 배정 순서 */
  order: number;
  excludedRoleIds: string[];
  /** 0=일 … 6=토 */
  excludedWeekdays: number[];
  /** YYYY-MM-DD 목록 */
  excludedDates: string[];
  exclusionPeriods: ExclusionPeriod[];
  /** 특정 역할 고정 담당자 */
  fixedRoleId?: string;
  roleSpecificExclusions?: Record<string, { weekdays?: number[]; dates?: string[] }>;
}

/** ← G-class-reward */
export interface RewardProfile {
  studentId: string;
  nickname: string;
}

// ─────────────────────────────────────────────────────────────
// 자리 배치 (features/seating)
//
// 좌석 자체는 rows·cols에서 계산으로 만들기 때문에 저장하지 않는다.
// 저장할 것은 교실 모양과 누가 어디 앉는지뿐이다.
// ─────────────────────────────────────────────────────────────

export interface StudentPosition {
  studentId: string;
  /** `r{row}c{col}` 형식 */
  seatId: string;
}

export interface SeatingState {
  classId: string;
  rows: number;
  cols: number;
  /** 책상이 없거나 쓰지 않는 자리 */
  disabledSeatIds: string[];
  positions: StudentPosition[];
  updatedAt: string;
}

export const MIN_SEAT_ROWS = 1;
export const MAX_SEAT_ROWS = 12;
export const MIN_SEAT_COLS = 1;
export const MAX_SEAT_COLS = 12;

// ─────────────────────────────────────────────────────────────
// 역할·당번 (features/duty)
// ─────────────────────────────────────────────────────────────

export const ROLE_CATEGORIES = [
  '청소구역',
  '급식',
  '칠판',
  '기기 관리',
  '학급 운영',
  '기타',
] as const;
export type RoleCategory = (typeof ROLE_CATEGORIES)[number];

export type RoleCycle = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface DutyRole {
  id: string;
  classId: string;
  name: string;
  category: RoleCategory;
  description: string;
  /** 이 역할에 필요한 인원 */
  neededCount: number;
  cycle: RoleCycle;
  /** 이 역할이 필요한 요일. 비어 있으면 매일. 0=일 … 6=토 */
  activeDays: number[];
  isActive: boolean;
  /** 항상 이 역할을 맡는 학생 */
  fixedStudentIds: string[];
  /** 이 역할에서 빼는 학생 */
  excludedStudentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RoleAssignment {
  roleId: string;
  studentIds: string[];
}

export type DutyRoundStatus = 'draft' | 'active' | 'ended';

/**
 * 한 차례의 당번 배정.
 *
 * 원본의 AssignmentRecord에 해당한다. 주간·격주·월간 어느 주기든
 * "언제부터 언제까지 누가 무엇을 맡는가" 한 덩어리로 본다.
 */
export interface DutyRound {
  id: string;
  classId: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD, 포함 */
  endDate: string;
  /** "2026년 8월 2주차" */
  label: string;
  status: DutyRoundStatus;
  assignments: RoleAssignment[];
  /** 다시 배정해도 그대로 둘 역할 */
  lockedRoleIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** 그날 누가 역할을 수행했는지. 날짜·학급마다 하나. */
export interface DutyCompletion {
  classId: string;
  /** YYYY-MM-DD */
  date: string;
  completed: Array<{ roleId: string; studentId: string }>;
  /** 결석 등으로 그날만 대신한 경우 */
  substitutions: Array<{ roleId: string; originalStudentId: string; substituteStudentId: string }>;
}

// ─────────────────────────────────────────────────────────────
// 활동·보상 (features/reward)
//
// 원본은 누적 점수와 거래 로그를 둘 다 저장했다. 되돌리기·수정에서
// 둘이 어긋나면 화면의 점수와 기록이 달라지고, 어느 쪽이 맞는지 알 수 없다.
// 통합본은 **기록이 유일한 원본**이고 점수는 매번 합산해서 만든다.
// 한 해 기록이 수천 건이어도 합산 비용은 무시할 수 있다.
// ─────────────────────────────────────────────────────────────

export type ScoreTargetUnit = 'student' | 'group' | 'class';

export interface BehaviorPreset {
  id: string;
  classId: string;
  /** "도움 주기", "정리 정돈" */
  name: string;
  /** 양수는 칭찬, 음수는 지도 */
  defaultPoints: number;
  /** 이 항목을 어디에 줄 수 있는가 */
  targetUnit: ScoreTargetUnit;
  color: string;
  isActive: boolean;
  order: number;
  createdAt: string;
}

export interface ScoreEntry {
  id: string;
  classId: string;
  /** 점수를 준 시각 */
  occurredAt: string;
  targetUnit: ScoreTargetUnit;
  /** studentId · groupId · classId */
  targetId: string;
  points: number;
  /** 프리셋 이름이거나 교사가 직접 적은 사유 */
  reason: string;
  presetId?: string;
  /**
   * 되돌린 시각.
   *
   * 기록을 지우지 않고 표시만 한다. 지워 버리면 "왜 점수가 줄었지"를
   * 나중에 확인할 수 없다.
   */
  revokedAt?: string;
}

export interface ScoreGoal {
  id: string;
  classId: string;
  title: string;
  targetUnit: ScoreTargetUnit;
  /** studentId · groupId · classId */
  targetId: string;
  targetPoints: number;
  /** 달성하면 무엇을 하는지 */
  reward: string;
  /** YYYY-MM-DD */
  startDate: string;
  achievedAt?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// 점수 주기
// reward.PeriodSettings의 개명.
// 원본의 이름은 '학기(Period)'와 혼동되어 사고를 부른다.
// 이것은 학기가 아니라 "점수를 언제 리셋하는가"이다.
// ─────────────────────────────────────────────────────────────

export interface ScoreCycle {
  /** 0=일 … 6=토 */
  weeklyStartDay: number;
  weeklyStartDayApplyMode: 'next_period' | 'recalculate_current';
  monthlyType: '1st_to_end' | 'specific_day' | 'teacher_manual';
  /** 1~31 */
  monthlyStartDay: number;
  showLifetimeCumulative: boolean;
}

// ─────────────────────────────────────────────────────────────
// 전체 데이터 루트
//
// 기능별 데이터(좌석 배치, 역할, 과제, 점수 기록)는 각 feature를
// 이식하는 7~10단계에서 이 인터페이스에 추가된다.
// ─────────────────────────────────────────────────────────────

export const CURRENT_SCHEMA_VERSION = 1;

export interface SuiteData {
  schemaVersion: number;
  profile: SchoolProfile;

  terms: Term[];
  classRooms: ClassRoom[];
  students: Student[];
  groups: Group[];

  seatingProfiles: SeatingProfile[];
  dutyProfiles: DutyProfile[];
  rewardProfiles: RewardProfile[];

  /** 학급마다 최대 하나. 자리 배치를 한 번도 안 한 학급은 없을 수도 있다. */
  seatingStates: SeatingState[];

  dutyRoles: DutyRole[];
  dutyRounds: DutyRound[];
  dutyCompletions: DutyCompletion[];

  behaviorPresets: BehaviorPreset[];
  scoreEntries: ScoreEntry[];
  scoreGoals: ScoreGoal[];

  scoreCycle: ScoreCycle;

  /** 화면 전역에서 선택된 학기·반. 존재하지 않는 id면 복구 대상이다. */
  activeTermId: string | null;
  activeClassId: string | null;
}
