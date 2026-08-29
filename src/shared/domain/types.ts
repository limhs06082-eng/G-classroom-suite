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
  /**
   * 학교 도로명 주소. 날씨 지역을 여기서 뽑는다.
   *
   * 교사가 직접 치지 않는다 — 학교를 고를 때 NEIS가 준 것을 그대로 담는다.
   * 없어도 앱은 돈다(날씨만 안 뜬다). 그래서 선택 항목이다.
   */
  schoolAddress?: string;
  teacherName: string;
  /**
   * 가정 통신 문구에 넣을 학년·반. "3", "2"처럼 숫자만 담는다.
   *
   * ClassRoom.grade·classNo는 number라서 학급마다 다르고, 이쪽은 문구에
   * 그대로 끼워 넣는 글자다. 비어 있으면 화면이 활성 학급 값으로 채워 준다.
   */
  grade: string;
  classNo: string;
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

export const SEATING_PERSPECTIVES = ['student', 'teacher'] as const;

/**
 * 자리표를 어느 방향으로 볼지.
 *
 * 'student'는 학생이 앉아서 보는 방향(칠판이 위), 'teacher'는 교탁에서
 * 학생들을 마주 본 방향(칠판이 아래, 좌우도 뒤집힌다)이다.
 */
export type SeatingPerspective = (typeof SEATING_PERSPECTIVES)[number];

export interface SeatingState {
  classId: string;
  rows: number;
  cols: number;
  /** 책상이 없거나 쓰지 않는 자리 */
  disabledSeatIds: string[];
  positions: StudentPosition[];
  /** 교사 화면에서만 쓴다. 전자칠판은 학생이 보는 화면이라 항상 학생 시점이다. */
  perspective: SeatingPerspective;
  updatedAt: string;
}

/**
 * 이름 붙여 저장해 둔 자리표.
 *
 * 교실 크기까지가 한 벌이다. 크기를 빼면 불러왔을 때 저장할 때와 다른
 * 그림이 나온다. 보는 방향(perspective)은 넣지 않는다 — 그건 배치가
 * 아니라 읽는 방향이라 자리표에 딸릴 이유가 없다.
 */
export interface SavedLayout {
  id: string;
  classId: string;
  name: string;
  rows: number;
  cols: number;
  disabledSeatIds: string[];
  positions: StudentPosition[];
  createdAt: string;
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
// 과제 제출 현황 (features/assignment)
//
// 원본은 과제 하나가 여러 학급을 대상으로 할 수 있었다(targetClassIds).
// 통합본은 학급 하나에 속하는 것으로 단순화했다. 담임이 주 사용자이고,
// 여러 반을 맡는 경우에는 헤더의 학급 전환으로 오가면 된다.
// ─────────────────────────────────────────────────────────────

export type SubmissionStatus = 'unsubmitted' | 'submitted' | 'supplement' | 'completed';
export type AssignmentStatus = 'active' | 'closed' | 'archived';

export interface Assignment {
  id: string;
  classId: string;
  title: string;
  description: string;
  /** YYYY-MM-DD. 기한이 없으면 빈 문자열. */
  dueDate: string;
  status: AssignmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  assignmentId: string;
  studentId: string;
  status: SubmissionStatus;
  /** 보완 사유 등 */
  note: string;
  updatedAt: string;
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
  /**
   * 월 주기 기준.
   *
   * 원본에는 'teacher_manual'(교사가 직접 주기를 끊는 방식)과
   * weeklyStartDayApplyMode('다음 주기부터 적용')도 있었지만 걷어냈다.
   *
   * 전자는 주기 관리 화면이 통째로 필요하고, 후자는 "언제 바꿨는지"를
   * 저장할 필드가 없어 화면만 붙이면 거짓말하는 설정이 된다.
   * 지키지 못할 선택지를 타입에 남겨 두면 다음 사람이 "화면만 붙이면 되겠네"라고
   * 읽고 같은 함정에 빠진다.
   *
   * 되살릴 근거: docs/superpowers/specs/2026-08-14-missing-input-screens-design.md §3.1
   */
  monthlyType: '1st_to_end' | 'specific_day';
  /** 1~31 */
  monthlyStartDay: number;
  showLifetimeCumulative: boolean;
}

// ─────────────────────────────────────────────────────────────
// 아래는 2단계 도구함(G-teacher-toolkit)에서 옮겨 왔다.
//
// 두 앱을 하나로 합치면서 그대로 가져온 것이고, 학급 자료(위쪽)와 달리
// 학급에 매이지 않는다. 수업 흐름·문제 세트·업무·문구는 학급이 바뀌어도
// 그대로 쓴다.
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// 수업 진행판 (features/lesson)
// ─────────────────────────────────────────────────────────────

export type LessonPhase = 'intro' | 'activity' | 'wrapup';
export type ActivityMode = 'individual' | 'pair' | 'group' | 'whole';

export interface LessonStage {
  id: string;
  phase: LessonPhase;
  title: string;
  /** 학생에게 보여 줄 안내 문구 */
  guide: string;
  /** 이 단계에 배정한 분. 0이면 타이머를 쓰지 않는다. */
  minutes: number;
  mode: ActivityMode;
}

export interface LessonTemplate {
  id: string;
  title: string;
  subject: string;
  stages: LessonStage[];
  createdAt: string;
  updatedAt: string;
}

/** 지금 진행 중인 수업. 새로고침해도 이어지도록 저장한다. */
export interface LessonRun {
  templateId: string;
  /** 현재 단계 인덱스 */
  stageIndex: number;
  /** 완료 표시한 단계 id */
  doneStageIds: string[];
  startedAt: string;
}

// ─────────────────────────────────────────────────────────────
// 형성평가·퀴즈 (features/quiz)
// ─────────────────────────────────────────────────────────────

export type QuestionType = 'choice' | 'ox' | 'short';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  text: string;
  /** 객관식 보기. OX·단답형에서는 비어 있다. */
  choices: string[];
  /**
   * 정답.
   * - choice: 정답 보기의 인덱스를 문자열로
   * - ox: 'O' 또는 'X'
   * - short: 인정하는 답 (여러 개면 쉼표로 나눠 저장)
   */
  answer: string;
  explanation: string;
  /** 이 문제의 제한 시간(초). 0이면 제한 없음. */
  timeLimitSec: number;
  points: number;
}

export interface QuizSet {
  id: string;
  title: string;
  subject: string;
  questions: QuizQuestion[];
  createdAt: string;
  updatedAt: string;
}

/** 한 번 진행한 결과. 문항별 정답 여부를 남겨 분석에 쓴다. */
export interface QuizResult {
  id: string;
  quizSetId: string;
  /** 팀 이름 → 점수. 개인이 아니라 팀 단위로 진행하는 것이 기본이다. */
  teamScores: Record<string, number>;
  /** 문제 id → 맞힌 팀 수 */
  correctByQuestion: Record<string, number>;
  totalTeams: number;
  playedAt: string;
}

/**
 * 진행 중인 퀴즈.
 *
 * 전자칠판은 새 창으로 열린다. 화면 안 state로 두면 칠판에서 아무것도 보이지 않는다.
 * 수업 중 퀴즈는 칠판이 주 화면이므로 진행 상태를 저장한다.
 */
export interface QuizRun {
  quizSetId: string;
  questionIndex: number;
  /** 문제 id → 맞힌 팀 이름 */
  correctTeamsByQuestion: Record<string, string[]>;
  /**
   * 교사가 칠판에서 직접 정오를 누른 (문제 id → 모둠 이름[]).
   *
   * 학생 응답 자동 채점이 여기 있는 자리는 건드리지 않는다.
   * 한 번 누르면 껐다 켜도 영구히 교사 것이다.
   * "교사가 오답으로 되돌린 것"과 "아직 안 본 것"은 다르다.
   */
  manualTeamsByQuestion: Record<string, string[]>;
  /**
   * 열려 있는 학생 응답 세션의 6자 코드. 없으면 null.
   *
   * 세션 자료 자체는 여기 두지 않지만 **가리키는 코드는 둔다.**
   * 전자칠판이 별도 창이라, 이것이 없으면 칠판은 세션을 찾을 길이 없다.
   */
  sessionCode: string | null;
  /** 정답을 공개했는지 */
  revealed: boolean;
  teams: string[];
  startedAt: string;
}

// ─────────────────────────────────────────────────────────────
// 업무 체크리스트 (features/task)
// ─────────────────────────────────────────────────────────────

export const TASK_AREAS = [
  '학기 초',
  '평가',
  '체험학습',
  '학부모 상담',
  '생활기록부',
  '학교 행사',
  '방학',
  '기타',
] as const;
export type TaskArea = (typeof TASK_AREAS)[number];

export type TaskPriority = 'high' | 'normal' | 'low';

export interface TaskStep {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  area: TaskArea;
  /** YYYY-MM-DD. 없으면 빈 문자열 */
  dueDate: string;
  priority: TaskPriority;
  steps: TaskStep[];
  /** 회의 안건·전달 사항 메모 */
  memo: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// 문구 템플릿 (features/message)
// ─────────────────────────────────────────────────────────────

export const MESSAGE_CATEGORIES = [
  '학부모 문자',
  '준비물 안내',
  '결석·미제출',
  '상담 안내',
  '행사 안내',
  '교직원 공지',
  '감사 인사',
  '기타',
] as const;
export type MessageCategory = (typeof MESSAGE_CATEGORIES)[number];

export type MessageTone = 'plain' | 'polite' | 'formal';
export type MessageLength = 'short' | 'normal' | 'detailed';

export interface MessageTemplate {
  id: string;
  category: MessageCategory;
  title: string;
  /** {학교} {학년} {반} {교사} {날짜} {장소} 를 치환한다 */
  body: string;
  /** 기본 제공 문구인지. 기본 문구는 지울 수 없고 숨기기만 한다. */
  isBuiltIn: boolean;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// 시간표 (features/timetable)
//
// NEIS에서 받아 오지 않고 교사가 손으로 채운다. 열쇠 없이 부르면 한 번에
// 다섯 행만 와서 6교시가 늘 잘리기 때문이다. docs 설계 문서에 확인 내용을 적었다.
// ─────────────────────────────────────────────────────────────

/** 시간표에 둘 수 있는 가장 늦은 교시. 초등은 6교시가 흔하고 7교시를 쓰는 학교가 있다. */
export const MAX_PERIOD = 7;

/**
 * 한 교시의 시각.
 *
 * **`classId`가 없다.** 3학년 2반과 5학년 1반의 2교시 시작 시각이 다를 리
 * 없다. 시간표는 학급마다 한 벌이지만 일과는 학교 하나다.
 *
 * 시각은 `"09:00"` 꼴의 24시간 글자다. 분으로 저장하지 않는 까닭은
 * 백업 파일을 사람이 열어 봤을 때 읽히기 때문이다.
 */
export interface PeriodTime {
  /** 1 ~ MAX_PERIOD */
  period: number;
  start: string;
  end: string;
}

/**
 * 시간표 한 칸.
 *
 * id를 두지 않는다. `(classId, weekday, period)`가 자연키이고, 한 칸에 두
 * 과목이 있을 수 없으므로 id는 중복을 허용하는 구멍만 된다.
 *
 * **없는 교시는 항목 자체가 없다.** 빈 글자로 두지 않는다. 그래서 요일마다
 * 몇 교시인지 따로 묻지 않아도 된다 — 금요일에 넷만 채우면 금요일은 4교시다.
 */
export interface TimetableEntry {
  classId: string;
  /** 1(월) ~ 5(금). 초등 시간표에 주말은 없다. */
  weekday: number;
  /** 1 ~ MAX_PERIOD */
  period: number;
  subject: string;
}

// ─────────────────────────────────────────────────────────────
// 출결 (features/attendance)
//
// **기록이 없는 학생이 출석이다.** 과제의 "기록 없음 = 미제출"과 같은
// 원칙이다. 서른 명 중 스물아홉이 출석인 날, 스물아홉 줄을 만들지 않는다.
// ─────────────────────────────────────────────────────────────

export const ATTENDANCE_STATUSES = ['absent', 'late', 'early', 'fieldTrip'] as const;
/** 결석 · 지각 · 조퇴 · 체험학습 */
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface AttendanceEntry {
  studentId: string;
  status: AttendanceStatus;
  /** 사유. 비어 있어도 된다. */
  note: string;
}

/** 날짜·학급마다 하나. DutyCompletion과 같은 자연키다. */
export interface AttendanceRecord {
  classId: string;
  /** YYYY-MM-DD */
  date: string;
  entries: AttendanceEntry[];
}

// ─────────────────────────────────────────────────────────────
// 알림장 (features/notice)
//
// 종례 때 칠판에 띄우는 그날의 전달 사항. 날짜·학급마다 하나다.
// 내일까지인 과제는 여기 담지 않는다 — 과제 자료가 이미 말하고 있는 것을
// 베껴 두면 한쪽만 고쳐지는 날이 온다. 화면이 그때그때 계산해 보여 준다.
// ─────────────────────────────────────────────────────────────

export interface NoticeItem {
  id: string;
  text: string;
}

export interface DailyNotice {
  classId: string;
  /** YYYY-MM-DD */
  date: string;
  items: NoticeItem[];
}

// ─────────────────────────────────────────────────────────────
// 시간표 하루 바꾸기 (features/timetable)
//
// 행사·보강으로 그날만 교시가 바뀔 때. 주간 시간표(TimetableEntry)는
// 건드리지 않는다 — 다음 주에는 원래대로 돌아와야 하기 때문이다.
//
// subject가 빈 글자면 "그날 그 교시가 없다"이다. 항목 자체가 없는 것은
// "바뀐 것이 없다"이고, 그때는 주간 시간표가 그대로 보인다.
// 지난 날짜의 항목은 불러올 때 조용히 버린다. 만료이지 복구가 아니다.
// ─────────────────────────────────────────────────────────────

export interface TimetableOverride {
  classId: string;
  /** YYYY-MM-DD */
  date: string;
  /** 1 ~ MAX_PERIOD */
  period: number;
  subject: string;
}

// ─────────────────────────────────────────────────────────────
// 보상 사용 — 쿠폰 (features/reward)
//
// 점수를 모으기만 하고 쓸 곳이 없으면 순환이 끊긴다. 쿠폰(RewardItem)을
// 정의해 두고, 사용(Redemption)을 기록한다.
//
// **지도(음수 ScoreEntry)와 섞지 않는다.** 자리 선택권으로 점수를 쓴 것과
// 약속을 어겨 점수가 깎인 것이 같은 목록에 보이면 안 된다.
// 잔액은 저장하지 않는다 — 통산 획득에서 사용을 빼서 매번 계산한다.
// ─────────────────────────────────────────────────────────────

export interface RewardItem {
  id: string;
  classId: string;
  /** "자리 선택권", "자유 시간 10분" */
  name: string;
  /** 필요한 점수. 1 이상. */
  cost: number;
  isActive: boolean;
  order: number;
  createdAt: string;
}

/** 쿠폰 대상. 학급 전체가 점수를 쓰는 일은 없어 class는 뺀다. */
export type RedemptionTargetUnit = 'student' | 'group';

export interface Redemption {
  id: string;
  classId: string;
  occurredAt: string;
  targetUnit: RedemptionTargetUnit;
  /** studentId · groupId */
  targetId: string;
  /** 사용한 시점의 쿠폰 이름. 쿠폰을 지워도 기록은 읽혀야 한다. */
  itemName: string;
  cost: number;
  /** 되돌린 시각. ScoreEntry.revokedAt과 같은 원칙 — 지우지 않고 표시한다. */
  revokedAt?: string;
}

// ─────────────────────────────────────────────────────────────
// 관찰 기록 (shared/roster)
//
// 학생별 날짜 있는 메모의 타임라인. 학기말 생활기록부·상담 준비가
// 이 기록을 시간순으로 꺼내 쓴다. SeatingProfile.note(한 칸 메모)와 달리
// 쌓인다.
// ─────────────────────────────────────────────────────────────

export interface ObservationEntry {
  id: string;
  classId: string;
  studentId: string;
  /** YYYY-MM-DD — 관찰한 날. 적은 날(createdAt)과 다를 수 있다. */
  date: string;
  text: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// 전체 데이터 루트
//
// 기능별 데이터(좌석 배치, 역할, 과제, 점수 기록)는 각 feature를
// 이식하는 7~10단계에서 이 인터페이스에 추가된다.
// ─────────────────────────────────────────────────────────────

/**
 * 2판: 출결·알림장·시간표 하루 바꾸기·쿠폰·관찰 기록이 늘었다.
 * 1판 앱이 2판 백업을 열면 이 필드들을 잃으므로, 버전을 올려
 * SCHEMA_VERSION_AHEAD 경고가 뜨게 한다.
 */
export const CURRENT_SCHEMA_VERSION = 2;

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

  /** 저장해 둔 자리표. 학급마다 여러 개일 수 있다. */
  savedLayouts: SavedLayout[];

  dutyRoles: DutyRole[];
  dutyRounds: DutyRound[];
  dutyCompletions: DutyCompletion[];

  behaviorPresets: BehaviorPreset[];
  scoreEntries: ScoreEntry[];
  scoreGoals: ScoreGoal[];

  assignments: Assignment[];
  submissions: Submission[];

  /** 학급마다 한 벌. 학기가 바뀌어 학급을 새로 만들면 시간표도 새로 시작한다. */
  timetableEntries: TimetableEntry[];

  /** 학교의 일과. 늘 MAX_PERIOD줄이고, 비어 있는 일이 없다. */
  periodTimes: PeriodTime[];

  scoreCycle: ScoreCycle;

  /** 화면 전역에서 선택된 학기·반. 존재하지 않는 id면 복구 대상이다. */
  activeTermId: string | null;
  activeClassId: string | null;

  /**
   * 교사 잠금 PIN 4자리. 빈 문자열이면 잠금을 쓰지 않는다.
   *
   * 보안이 아니다. 여기 그대로 저장되고 개발자 도구를 열면 보인다.
   * 학생이 지나가다 실수로 누르는 것을 막는 장치다.
   */

  // ── 도구함에서 옮겨 온 것 ──────────────────────────────────
  // 학급에 매이지 않는다. classId를 갖지 않는 것이 그 표시다.

  lessonTemplates: LessonTemplate[];
  lessonRun: LessonRun | null;
  quizSets: QuizSet[];
  quizResults: QuizResult[];
  quizRun: QuizRun | null;
  tasks: TaskItem[];
  messageTemplates: MessageTemplate[];
  /** 즐겨찾기한 템플릿 id */
  messageFavorites: string[];
  /** 숨긴 기본 템플릿 id */
  messageHidden: string[];
  /**
   * 퀴즈 모둠 이름.
   *
   * 비어 있으면 화면이 기본값(1모둠~4모둠)을 쓴다. 모둠 구성은 한 학기 내내
   * 거의 같아서 퀴즈를 시작할 때마다 묻지 않고 여기 저장해 둔다.
   */
  quizTeams: string[];
  lockPin: string;
  /** 지금 잠겨 있는가. 새로 고쳐도 남아야 하므로 저장한다. */
  isLocked: boolean;

  // ── 2판에서 늘어난 것 ──────────────────────────────────────

  /** 출결. 날짜·학급마다 최대 하나. 기록 없는 학생이 출석이다. */
  attendanceRecords: AttendanceRecord[];
  /** 알림장. 날짜·학급마다 최대 하나. */
  notices: DailyNotice[];
  /** 시간표 하루 바꾸기. 지난 날짜는 불러올 때 만료된다. */
  timetableOverrides: TimetableOverride[];
  rewardItems: RewardItem[];
  redemptions: Redemption[];
  observations: ObservationEntry[];
}
