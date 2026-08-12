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

  scoreCycle: ScoreCycle;

  /** 화면 전역에서 선택된 학기·반. 존재하지 않는 id면 복구 대상이다. */
  activeTermId: string | null;
  activeClassId: string | null;
}
