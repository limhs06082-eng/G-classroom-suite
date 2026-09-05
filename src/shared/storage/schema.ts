import {
  createDefaultPeriodTimes,
  createEmptySuiteData,
  DEFAULT_SCORE_CYCLE,
  DEFAULT_SEAT_COLS,
  DEFAULT_SEAT_ROWS,
} from '../domain/factories';
import { validateAndRepair, type RepairLog } from '../domain/invariants';
import {
  CURRENT_SCHEMA_VERSION,
  ROLE_CATEGORIES,
  MAX_PERIOD,
  MAX_SEAT_COLS,
  MAX_SEAT_ROWS,
  MIN_SEAT_COLS,
  MIN_SEAT_ROWS,
  SEATING_PERSPECTIVES,
  type ClassRoom,
  type Assignment,
  type AssignmentStatus,
  type BehaviorPreset,
  type Submission,
  type SubmissionStatus,
  type DutyCompletion,
  type DutyProfile,
  type DutyRole,
  type DutyRound,
  type RoleCycle,
  type DutyRoundStatus,
  type Gender,
  type Group,
  type PeriodTime,
  type RewardProfile,
  type SavedLayout,
  type ScoreCycle,
  type ScoreEntry,
  type ScoreGoal,
  type ScoreTargetUnit,
  type SeatingProfile,
  type SeatingState,
  type Student,
  type StudentStatus,
  type SuiteData,
  type Term,
  type TermStatus,
  type TimetableEntry,
  // 도구함에서 옮겨 온 것
  MESSAGE_CATEGORIES,
  TASK_AREAS,
  // 2판에서 늘어난 것
  ATTENDANCE_REASONS,
  ATTENDANCE_STATUSES,
  type AttendanceReason,
  type BehaviorComment,
  type HomeCardSize,
  type HomeLayout,
  type AttendanceRecord,
  type AttendanceStatus,
  type ClassEvent,
  type DailyNotice,
  type ObservationEntry,
  type Redemption,
  type RedemptionTargetUnit,
  type RewardItem,
  type TimetableOverride,
  type ActivityMode,
  type LessonPhase,
  type LessonRun,
  type LessonStage,
  type LessonTemplate,
  type MessageTemplate,
  type QuestionType,
  type QuizQuestion,
  type QuizResult,
  type QuizRun,
  type QuizSet,
  type TaskItem,
  type TaskPriority,
  type TaskStep,
} from '../domain/types';

import { isValidPin } from '../lock/lockOps';

// ─────────────────────────────────────────────────────────────
// 아래 해석기는 2단계 도구함에서 옮겨 왔다.
// 헬퍼(isRecord·str·num…)는 양쪽 구현이 글자까지 같아 suite 것을 그대로 쓴다.
// ─────────────────────────────────────────────────────────────

const PHASES: readonly LessonPhase[] = ['intro', 'activity', 'wrapup'];
const MODES: readonly ActivityMode[] = ['individual', 'pair', 'group', 'whole'];
const QUESTION_TYPES: readonly QuestionType[] = ['choice', 'ox', 'short'];
const PRIORITIES: readonly TaskPriority[] = ['high', 'normal', 'low'];

// ── 엔티티 해석 ────────────────────────────────────────────────

function parseStage(raw: unknown): LessonStage | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  if (id === null) return null;

  return {
    id,
    phase: oneOf(raw['phase'], PHASES, 'activity'),
    title: str(raw['title'], '이름 없는 단계'),
    guide: str(raw['guide']),
    // 음수 분은 타이머를 즉시 끝내 버린다.
    minutes: Math.max(0, Math.round(num(raw['minutes'], 0))),
    mode: oneOf(raw['mode'], MODES, 'whole'),
  };
}

function parseLessonTemplate(raw: unknown, now: string): LessonTemplate | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  if (id === null) return null;

  return {
    id,
    title: str(raw['title'], '이름 없는 수업'),
    subject: str(raw['subject']),
    stages: asArray(raw['stages']).flatMap((s) => {
      const stage = parseStage(s);
      return stage === null ? [] : [stage];
    }),
    createdAt: str(raw['createdAt'], now),
    updatedAt: str(raw['updatedAt'], now),
  };
}

function parseLessonRun(raw: unknown, templates: readonly LessonTemplate[]): LessonRun | null {
  if (!isRecord(raw)) return null;
  const templateId = requiredStr(raw['templateId']);
  if (templateId === null) return null;

  // 없어진 수업을 가리키면 진행 상태를 버린다. 그대로 두면 빈 화면이 뜬다.
  const template = templates.find((item) => item.id === templateId);
  if (template === undefined) return null;

  const stageIndex = Math.round(num(raw['stageIndex'], 0));

  return {
    templateId,
    stageIndex: Math.max(0, Math.min(stageIndex, Math.max(0, template.stages.length - 1))),
    doneStageIds: strArray(raw['doneStageIds']),
    startedAt: str(raw['startedAt']),
  };
}

function parseQuestion(raw: unknown): QuizQuestion | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  if (id === null) return null;

  const type = oneOf(raw['type'], QUESTION_TYPES, 'choice');

  return {
    id,
    type,
    text: str(raw['text']),
    choices: strArray(raw['choices']),
    answer: str(raw['answer']),
    explanation: str(raw['explanation']),
    timeLimitSec: Math.max(0, Math.round(num(raw['timeLimitSec'], 0))),
    // 0점짜리 문제는 점수판을 이상하게 만든다.
    points: Math.max(1, Math.round(num(raw['points'], 1))),
  };
}

function parseQuizSet(raw: unknown, now: string): QuizSet | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  if (id === null) return null;

  return {
    id,
    title: str(raw['title'], '이름 없는 문제 세트'),
    subject: str(raw['subject']),
    questions: asArray(raw['questions']).flatMap((q) => {
      const question = parseQuestion(q);
      return question === null ? [] : [question];
    }),
    createdAt: str(raw['createdAt'], now),
    updatedAt: str(raw['updatedAt'], now),
  };
}

function parseNumberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};

  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) result[key] = raw;
  }
  return result;
}

function parseQuizResult(raw: unknown, now: string): QuizResult | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const quizSetId = requiredStr(raw['quizSetId']);
  if (id === null || quizSetId === null) return null;

  return {
    id,
    quizSetId,
    teamScores: parseNumberRecord(raw['teamScores']),
    correctByQuestion: parseNumberRecord(raw['correctByQuestion']),
    totalTeams: Math.max(0, Math.round(num(raw['totalTeams'], 0))),
    playedAt: str(raw['playedAt'], now),
  };
}

function parseStringArrayRecord(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) return {};

  const result: Record<string, string[]> = {};
  for (const [key, raw] of Object.entries(value)) result[key] = strArray(raw);
  return result;
}

function parseQuizRun(raw: unknown, sets: readonly QuizSet[]): QuizRun | null {
  if (!isRecord(raw)) return null;
  const quizSetId = requiredStr(raw['quizSetId']);
  if (quizSetId === null) return null;

  // 없어진 문제 세트를 가리키면 진행 상태를 버린다. 그대로 두면 빈 화면이 뜬다.
  const set = sets.find((item) => item.id === quizSetId);
  if (set === undefined) return null;

  const index = Math.round(num(raw['questionIndex'], 0));

  return {
    quizSetId,
    questionIndex: Math.max(0, Math.min(index, Math.max(0, set.questions.length - 1))),
    correctTeamsByQuestion: parseStringArrayRecord(raw['correctTeamsByQuestion']),
    manualTeamsByQuestion: parseStringArrayRecord(raw['manualTeamsByQuestion']),
    sessionCode: requiredStr(raw['sessionCode']),
    revealed: bool(raw['revealed'], false),
    teams: strArray(raw['teams']),
    startedAt: str(raw['startedAt']),
  };
}

function parseStep(raw: unknown): TaskStep | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  if (id === null) return null;

  return { id, text: str(raw['text']), done: bool(raw['done'], false) };
}

function parseTask(raw: unknown, now: string): TaskItem | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  if (id === null) return null;

  return {
    id,
    title: str(raw['title'], '이름 없는 업무'),
    area: oneOf(raw['area'], TASK_AREAS, '기타'),
    dueDate: str(raw['dueDate']),
    priority: oneOf(raw['priority'], PRIORITIES, 'normal'),
    steps: asArray(raw['steps']).flatMap((s) => {
      const step = parseStep(s);
      return step === null ? [] : [step];
    }),
    memo: str(raw['memo']),
    done: bool(raw['done'], false),
    createdAt: str(raw['createdAt'], now),
    updatedAt: str(raw['updatedAt'], now),
  };
}

function parseMessageTemplate(raw: unknown, now: string): MessageTemplate | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  if (id === null) return null;

  return {
    id,
    category: oneOf(raw['category'], MESSAGE_CATEGORIES, '기타'),
    title: str(raw['title'], '이름 없는 문구'),
    body: str(raw['body']),
    isBuiltIn: bool(raw['isBuiltIn'], false),
    createdAt: str(raw['createdAt'], now),
  };
}

/**
 * 저장된 원시 데이터를 SuiteData로 해석한다.
 *
 * 이 함수의 전제는 "저장소의 내용은 신뢰할 수 없다"이다.
 * 브라우저 사고, 손으로 편집한 백업 파일, 이전 버전 스키마 어느 쪽이든
 * 흰 화면 대신 최대한 살려서 연다. 살리지 못한 항목은 개수를 세어 보고한다.
 *
 * 순서: 형태 해석(여기) → 참조 무결성 복구(validateAndRepair)
 */

// ── 원시값 헬퍼 ────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/** 빈 문자열을 허용하지 않는 필수 문자열. 없으면 null을 돌려 레코드를 버리게 한다. */
function requiredStr(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function numArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    : [];
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** 배열이 아닌 값이 들어오면 빈 배열로 취급한다. */
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// ── 엔티티 해석 ────────────────────────────────────────────────

const TERM_STATUSES: readonly TermStatus[] = ['active', 'ended', 'archived'];
const STUDENT_STATUSES: readonly StudentStatus[] = ['active', 'inactive'];
const GENDERS: readonly Gender[] = ['male', 'female', 'other', 'none'];
const ROLE_CYCLES: readonly RoleCycle[] = ['daily', 'weekly', 'biweekly', 'monthly'];
const ROUND_STATUSES: readonly DutyRoundStatus[] = ['draft', 'active', 'ended'];
const SCORE_UNITS: readonly ScoreTargetUnit[] = ['student', 'group', 'class'];
const ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = ['active', 'closed', 'archived'];
const SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
  'unsubmitted',
  'submitted',
  'supplement',
  'completed',
];

function parseTerm(raw: unknown, now: string): Term | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  if (id === null) return null;

  const schoolYear = str(raw['schoolYear'], String(new Date(now).getFullYear()));
  const semester = str(raw['semester'], '1학기');

  return {
    id,
    schoolYear,
    semester,
    name: str(raw['name'], `${schoolYear}학년도 ${semester}`),
    startDate: str(raw['startDate']),
    endDate: str(raw['endDate']),
    status: oneOf(raw['status'], TERM_STATUSES, 'active'),
    createdAt: str(raw['createdAt'], now),
    ...(typeof raw['archivedAt'] === 'string' ? { archivedAt: raw['archivedAt'] } : {}),
  };
}

function parseClassRoom(raw: unknown, now: string): ClassRoom | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const termId = requiredStr(raw['termId']);
  if (id === null || termId === null) return null;

  return {
    id,
    termId,
    name: str(raw['name'], '이름 없는 학급'),
    ...(typeof raw['grade'] === 'number' ? { grade: raw['grade'] } : {}),
    ...(typeof raw['classNo'] === 'number' ? { classNo: raw['classNo'] } : {}),
    createdAt: str(raw['createdAt'], now),
    updatedAt: str(raw['updatedAt'], now),
  };
}

function parseStudent(raw: unknown, now: string): Student | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const classId = requiredStr(raw['classId']);
  if (id === null || classId === null) return null;

  // 이름이 비어도 학생을 버리지 않는다. 번호로라도 식별할 수 있어야 한다.
  return {
    id,
    classId,
    number: num(raw['number'], 0),
    name: str(raw['name']),
    status: oneOf(raw['status'], STUDENT_STATUSES, 'active'),
    ...(typeof raw['statusChangedAt'] === 'string' ? { statusChangedAt: raw['statusChangedAt'] } : {}),
    ...(typeof raw['statusMemo'] === 'string' ? { statusMemo: raw['statusMemo'] } : {}),
    createdAt: str(raw['createdAt'], now),
    updatedAt: str(raw['updatedAt'], now),
  };
}

function parseGroup(raw: unknown, now: string): Group | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const classId = requiredStr(raw['classId']);
  if (id === null || classId === null) return null;

  return {
    id,
    classId,
    name: str(raw['name'], '이름 없는 모둠'),
    color: str(raw['color'], '#94a3b8'),
    studentIds: strArray(raw['studentIds']),
    leaderId: typeof raw['leaderId'] === 'string' ? raw['leaderId'] : null,
    createdAt: str(raw['createdAt'], now),
    updatedAt: str(raw['updatedAt'], now),
  };
}

function parseSeatingProfile(raw: unknown): SeatingProfile | null {
  if (!isRecord(raw)) return null;
  const studentId = requiredStr(raw['studentId']);
  if (studentId === null) return null;

  return {
    studentId,
    gender: oneOf(raw['gender'], GENDERS, 'none'),
    tags: strArray(raw['tags']),
    note: str(raw['note']),
    isLocked: bool(raw['isLocked'], false),
    isGroupLocked: bool(raw['isGroupLocked'], false),
    avoidStudentIds: strArray(raw['avoidStudentIds']),
  };
}

function parseDutyProfile(raw: unknown): DutyProfile | null {
  if (!isRecord(raw)) return null;
  const studentId = requiredStr(raw['studentId']);
  if (studentId === null) return null;

  const periods = asArray(raw['exclusionPeriods']).flatMap((p) => {
    if (!isRecord(p)) return [];
    const id = requiredStr(p['id']);
    if (id === null) return [];
    return [
      {
        id,
        startDate: str(p['startDate']),
        endDate: str(p['endDate']),
        reason: str(p['reason']),
      },
    ];
  });

  return {
    studentId,
    order: num(raw['order'], 0),
    excludedRoleIds: strArray(raw['excludedRoleIds']),
    excludedWeekdays: numArray(raw['excludedWeekdays']),
    excludedDates: strArray(raw['excludedDates']),
    exclusionPeriods: periods,
    ...(typeof raw['fixedRoleId'] === 'string' ? { fixedRoleId: raw['fixedRoleId'] } : {}),
  };
}

function parseRewardProfile(raw: unknown): RewardProfile | null {
  if (!isRecord(raw)) return null;
  const studentId = requiredStr(raw['studentId']);
  if (studentId === null) return null;

  return { studentId, nickname: str(raw['nickname']) };
}

function parseSeatingState(raw: unknown, now: string): SeatingState | null {
  if (!isRecord(raw)) return null;
  const classId = requiredStr(raw['classId']);
  if (classId === null) return null;

  const positions = asArray(raw['positions']).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const studentId = requiredStr(entry['studentId']);
    const seatIdValue = requiredStr(entry['seatId']);
    if (studentId === null || seatIdValue === null) return [];
    return [{ studentId, seatId: seatIdValue }];
  });

  // 교실 크기가 망가지면 화면이 아예 그려지지 않는다. 범위 안으로 끌어온다.
  const clamp = (value: unknown, fallback: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, Math.round(num(value, fallback))));

  return {
    classId,
    rows: clamp(raw['rows'], DEFAULT_SEAT_ROWS, MIN_SEAT_ROWS, MAX_SEAT_ROWS),
    cols: clamp(raw['cols'], DEFAULT_SEAT_COLS, MIN_SEAT_COLS, MAX_SEAT_COLS),
    disabledSeatIds: strArray(raw['disabledSeatIds']),
    positions,
    perspective: oneOf(raw['perspective'], SEATING_PERSPECTIVES, 'student'),
    updatedAt: str(raw['updatedAt'], now),
  };
}

/**
 * 교사 잠금.
 *
 * 망가진 PIN은 빈 값으로 둔다. 그리고 **PIN이 없으면 잠금도 반드시 푼다.**
 * 둘이 어긋나면 열 수 있는 값이 없는 잠긴 화면이 되어, 자료를 초기화하는 것
 * 말고는 앱을 다시 쓸 길이 없다.
 */
function parseLock(root: Record<string, unknown>): { lockPin: string; isLocked: boolean } {
  const raw = str(root['lockPin']);
  const lockPin = isValidPin(raw) ? raw : '';

  return { lockPin, isLocked: lockPin !== '' && root['isLocked'] === true };
}

function parseTimetableEntry(raw: unknown): TimetableEntry | null {
  if (!isRecord(raw)) return null;

  const classId = requiredStr(raw['classId']);
  const subject = requiredStr(raw['subject']);
  if (classId === null || subject === null) return null;

  const weekday = Math.round(num(raw['weekday'], 0));
  const period = Math.round(num(raw['period'], 0));

  /*
   * 범위를 벗어난 칸은 버린다. 화면이 1~5요일 × 1~7교시만 그리므로 그런
   * 칸은 어디에도 안 보이면서 파일만 키우고, 나중에 범위를 넓히면 유령처럼
   * 되살아난다.
   */
  if (weekday < 1 || weekday > 5) return null;
  if (period < 1 || period > MAX_PERIOD) return null;

  return { classId, weekday, period, subject };
}

/** `"09:00"` 꼴인가. 아니면 null. */
function parseHm(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (match === null) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  // `"9:05"`처럼 한 자리로 적어 둔 파일도 받아들이고 두 자리로 고쳐 돌려준다.
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parsePeriodTime(raw: unknown): PeriodTime | null {
  if (!isRecord(raw)) return null;

  const period = num(raw['period'], NaN);
  if (!Number.isInteger(period) || period < 1 || period > MAX_PERIOD) return null;

  const start = parseHm(raw['start']);
  const end = parseHm(raw['end']);
  if (start === null || end === null) return null;

  return { period, start, end };
}

function parseSavedLayout(raw: unknown, now: string): SavedLayout | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const classId = requiredStr(raw['classId']);
  if (id === null || classId === null) return null;

  const positions = asArray(raw['positions']).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const studentId = requiredStr(entry['studentId']);
    const seatIdValue = requiredStr(entry['seatId']);
    if (studentId === null || seatIdValue === null) return [];
    return [{ studentId, seatId: seatIdValue }];
  });

  const clamp = (value: unknown, fallback: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, Math.round(num(value, fallback))));

  return {
    id,
    classId,
    name: str(raw['name'], '이름 없는 자리표'),
    rows: clamp(raw['rows'], DEFAULT_SEAT_ROWS, MIN_SEAT_ROWS, MAX_SEAT_ROWS),
    cols: clamp(raw['cols'], DEFAULT_SEAT_COLS, MIN_SEAT_COLS, MAX_SEAT_COLS),
    disabledSeatIds: strArray(raw['disabledSeatIds']),
    positions,
    createdAt: str(raw['createdAt'], now),
  };
}

function parseDutyRole(raw: unknown, now: string): DutyRole | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const classId = requiredStr(raw['classId']);
  if (id === null || classId === null) return null;

  return {
    id,
    classId,
    name: str(raw['name'], '이름 없는 역할'),
    category: oneOf(raw['category'], ROLE_CATEGORIES, '기타'),
    description: str(raw['description']),
    // 인원이 0이면 아무도 배정되지 않아 역할이 조용히 사라진다.
    neededCount: Math.max(1, Math.round(num(raw['neededCount'], 1))),
    cycle: oneOf(raw['cycle'], ROLE_CYCLES, 'weekly'),
    activeDays: numArray(raw['activeDays']).filter((d) => d >= 0 && d <= 6),
    isActive: bool(raw['isActive'], true),
    fixedStudentIds: strArray(raw['fixedStudentIds']),
    excludedStudentIds: strArray(raw['excludedStudentIds']),
    createdAt: str(raw['createdAt'], now),
    updatedAt: str(raw['updatedAt'], now),
  };
}

function parseDutyRound(raw: unknown, now: string): DutyRound | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const classId = requiredStr(raw['classId']);
  if (id === null || classId === null) return null;

  const assignments = asArray(raw['assignments']).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const roleId = requiredStr(entry['roleId']);
    if (roleId === null) return [];
    return [{ roleId, studentIds: strArray(entry['studentIds']) }];
  });

  return {
    id,
    classId,
    startDate: str(raw['startDate']),
    endDate: str(raw['endDate']),
    label: str(raw['label'], '당번'),
    status: oneOf(raw['status'], ROUND_STATUSES, 'active'),
    assignments,
    lockedRoleIds: strArray(raw['lockedRoleIds']),
    createdAt: str(raw['createdAt'], now),
    updatedAt: str(raw['updatedAt'], now),
  };
}

function parseDutyCompletion(raw: unknown): DutyCompletion | null {
  if (!isRecord(raw)) return null;
  const classId = requiredStr(raw['classId']);
  const date = requiredStr(raw['date']);
  if (classId === null || date === null) return null;

  const completed = asArray(raw['completed']).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const roleId = requiredStr(entry['roleId']);
    const studentId = requiredStr(entry['studentId']);
    if (roleId === null || studentId === null) return [];
    return [{ roleId, studentId }];
  });

  const substitutions = asArray(raw['substitutions']).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const roleId = requiredStr(entry['roleId']);
    const originalStudentId = requiredStr(entry['originalStudentId']);
    const substituteStudentId = requiredStr(entry['substituteStudentId']);
    if (roleId === null || originalStudentId === null || substituteStudentId === null) return [];
    return [{ roleId, originalStudentId, substituteStudentId }];
  });

  return { classId, date, completed, substitutions };
}

function parseBehaviorPreset(raw: unknown, now: string): BehaviorPreset | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const classId = requiredStr(raw['classId']);
  if (id === null || classId === null) return null;

  return {
    id,
    classId,
    name: str(raw['name'], '이름 없는 항목'),
    defaultPoints: Math.round(num(raw['defaultPoints'], 1)),
    targetUnit: oneOf(raw['targetUnit'], SCORE_UNITS, 'student'),
    color: str(raw['color'], 'slate'),
    isActive: bool(raw['isActive'], true),
    order: num(raw['order'], 0),
    createdAt: str(raw['createdAt'], now),
  };
}

function parseScoreEntry(raw: unknown, now: string): ScoreEntry | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const classId = requiredStr(raw['classId']);
  const targetId = requiredStr(raw['targetId']);
  if (id === null || classId === null || targetId === null) return null;

  // 점수가 숫자가 아니면 합계가 NaN이 되어 화면 전체가 망가진다.
  const points = num(raw['points'], 0);
  if (!Number.isFinite(points)) return null;

  return {
    id,
    classId,
    occurredAt: str(raw['occurredAt'], now),
    targetUnit: oneOf(raw['targetUnit'], SCORE_UNITS, 'student'),
    targetId,
    points: Math.round(points),
    reason: str(raw['reason']),
    ...(typeof raw['presetId'] === 'string' ? { presetId: raw['presetId'] } : {}),
    ...(typeof raw['revokedAt'] === 'string' ? { revokedAt: raw['revokedAt'] } : {}),
  };
}

function parseScoreGoal(raw: unknown, now: string): ScoreGoal | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const classId = requiredStr(raw['classId']);
  const targetId = requiredStr(raw['targetId']);
  if (id === null || classId === null || targetId === null) return null;

  return {
    id,
    classId,
    title: str(raw['title'], '이름 없는 목표'),
    targetUnit: oneOf(raw['targetUnit'], SCORE_UNITS, 'class'),
    targetId,
    targetPoints: Math.round(num(raw['targetPoints'], 1)),
    reward: str(raw['reward']),
    startDate: str(raw['startDate'], now.slice(0, 10)),
    ...(typeof raw['achievedAt'] === 'string' ? { achievedAt: raw['achievedAt'] } : {}),
    createdAt: str(raw['createdAt'], now),
  };
}

function parseAssignment(raw: unknown, now: string): Assignment | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const classId = requiredStr(raw['classId']);
  if (id === null || classId === null) return null;

  return {
    id,
    classId,
    title: str(raw['title'], '이름 없는 과제'),
    description: str(raw['description']),
    dueDate: str(raw['dueDate']),
    status: oneOf(raw['status'], ASSIGNMENT_STATUSES, 'active'),
    createdAt: str(raw['createdAt'], now),
    updatedAt: str(raw['updatedAt'], now),
  };
}

function parseSubmission(raw: unknown, now: string): Submission | null {
  if (!isRecord(raw)) return null;
  const assignmentId = requiredStr(raw['assignmentId']);
  const studentId = requiredStr(raw['studentId']);
  if (assignmentId === null || studentId === null) return null;

  return {
    assignmentId,
    studentId,
    status: oneOf(raw['status'], SUBMISSION_STATUSES, 'unsubmitted'),
    note: str(raw['note']),
    updatedAt: str(raw['updatedAt'], now),
  };
}

function parseBehaviorComment(raw: unknown, now: string): BehaviorComment | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const classId = requiredStr(raw['classId']);
  const studentId = requiredStr(raw['studentId']);
  if (id === null || classId === null || studentId === null) return null;

  return { id, classId, studentId, text: str(raw['text']), updatedAt: str(raw['updatedAt'], now) };
}

/**
 * 홈 카드 배치. 칸이 없는 옛 백업은 빈 배치다 — 고칠 것이 아니라 그냥
 * 없는 것이라 repairs에 남기지 않는다. 크기는 2·3만 담는다(1은 기본값).
 */
function parseHomeLayout(raw: unknown): HomeLayout {
  const empty: HomeLayout = { order: [], hidden: [], sizes: {} };
  if (!isRecord(raw)) return empty;

  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

  const sizes: Record<string, HomeCardSize> = {};
  const rawSizes = raw['sizes'];
  if (isRecord(rawSizes)) {
    for (const [id, value] of Object.entries(rawSizes)) {
      if (value === 2 || value === 3) sizes[id] = value;
    }
  }

  return { order: strings(raw['order']), hidden: strings(raw['hidden']), sizes };
}

function parseScoreCycle(raw: unknown): ScoreCycle {
  if (!isRecord(raw)) return { ...DEFAULT_SCORE_CYCLE };

  return {
    weeklyStartDay: num(raw['weeklyStartDay'], DEFAULT_SCORE_CYCLE.weeklyStartDay),
    /*
     * 걷어낸 weeklyStartDayApplyMode와 teacher_manual은 여기서 읽지 않는다.
     * 아는 키만 읽어 새 객체를 만드는 구조라 옛 저장 자료의 값은 자동으로 버려진다.
     * 화면에 그 선택지가 있던 적이 없으므로 복구 알림도 띄우지 않는다.
     */
    monthlyType: oneOf(
      raw['monthlyType'],
      ['1st_to_end', 'specific_day'] as const,
      DEFAULT_SCORE_CYCLE.monthlyType,
    ),
    monthlyStartDay: num(raw['monthlyStartDay'], DEFAULT_SCORE_CYCLE.monthlyStartDay),
    showLifetimeCumulative: bool(
      raw['showLifetimeCumulative'],
      DEFAULT_SCORE_CYCLE.showLifetimeCumulative,
    ),
  };
}

// ── 2판에서 늘어난 것 ──────────────────────────────────────────

const REDEMPTION_UNITS: readonly RedemptionTargetUnit[] = ['student', 'group'];

function parseAttendanceRecord(raw: unknown): AttendanceRecord | null {
  if (!isRecord(raw)) return null;
  const classId = requiredStr(raw['classId']);
  const date = requiredStr(raw['date']);
  if (classId === null || date === null) return null;

  const entries = asArray(raw['entries']).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const studentId = requiredStr(entry['studentId']);
    const status = entry['status'];
    // 알 수 없는 상태는 항목째 버린다. 기본값으로 바꾸면 지각이 결석이 되는
    // 식으로 조용히 틀린다 — 없는 항목은 그냥 '출석'이라 버리는 쪽이 안전하다.
    if (
      studentId === null ||
      typeof status !== 'string' ||
      !(ATTENDANCE_STATUSES as readonly string[]).includes(status)
    ) {
      return [];
    }
    // 분류는 상태와 달라서, 모르는 값이면 항목은 두고 분류만 버린다 — 없어도 뜻이 남는다.
    const reason = entry['reason'];
    const hasReason =
      typeof reason === 'string' && (ATTENDANCE_REASONS as readonly string[]).includes(reason);
    return [
      {
        studentId,
        status: status as AttendanceStatus,
        note: str(entry['note']),
        ...(hasReason ? { reason: reason as AttendanceReason } : {}),
      },
    ];
  });

  return {
    classId,
    date,
    entries,
    ...(typeof raw['confirmedAt'] === 'string' ? { confirmedAt: raw['confirmedAt'] } : {}),
  };
}

function parseDailyNotice(raw: unknown): DailyNotice | null {
  if (!isRecord(raw)) return null;
  const classId = requiredStr(raw['classId']);
  const date = requiredStr(raw['date']);
  if (classId === null || date === null) return null;

  const items = asArray(raw['items']).flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = requiredStr(item['id']);
    const itemText = requiredStr(item['text']);
    // 빈 글줄은 보드에 빈 줄만 만든다.
    if (id === null || itemText === null) return [];
    return [{ id, text: itemText }];
  });

  return { classId, date, items };
}

function parseTimetableOverride(raw: unknown): TimetableOverride | null {
  if (!isRecord(raw)) return null;
  const classId = requiredStr(raw['classId']);
  const date = requiredStr(raw['date']);
  if (classId === null || date === null) return null;

  const period = Math.round(num(raw['period'], 0));
  if (period < 1 || period > MAX_PERIOD) return null;

  // subject 빈 글자는 "그날 그 교시가 없다"라는 뜻이라 requiredStr을 안 쓴다.
  return { classId, date, period, subject: str(raw['subject']) };
}

function parseRewardItem(raw: unknown, now: string): RewardItem | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const classId = requiredStr(raw['classId']);
  if (id === null || classId === null) return null;

  return {
    id,
    classId,
    name: str(raw['name'], '이름 없는 쿠폰'),
    // 0점짜리 쿠폰은 잔액과 무관하게 무한히 쓸 수 있다.
    cost: Math.max(1, Math.round(num(raw['cost'], 1))),
    isActive: bool(raw['isActive'], true),
    order: num(raw['order'], 0),
    createdAt: str(raw['createdAt'], now),
  };
}

function parseRedemption(raw: unknown, now: string): Redemption | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const classId = requiredStr(raw['classId']);
  const targetId = requiredStr(raw['targetId']);
  if (id === null || classId === null || targetId === null) return null;

  return {
    id,
    classId,
    occurredAt: str(raw['occurredAt'], now),
    targetUnit: oneOf(raw['targetUnit'], REDEMPTION_UNITS, 'student'),
    targetId,
    itemName: str(raw['itemName'], '이름 없는 쿠폰'),
    cost: Math.max(1, Math.round(num(raw['cost'], 1))),
    ...(typeof raw['revokedAt'] === 'string' ? { revokedAt: raw['revokedAt'] } : {}),
  };
}

function parseObservation(raw: unknown, now: string): ObservationEntry | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const classId = requiredStr(raw['classId']);
  const studentId = requiredStr(raw['studentId']);
  if (id === null || classId === null || studentId === null) return null;

  return {
    id,
    classId,
    studentId,
    date: str(raw['date'], now.slice(0, 10)),
    text: str(raw['text']),
    createdAt: str(raw['createdAt'], now),
  };
}

function parseClassEvent(raw: unknown, now: string): ClassEvent | null {
  if (!isRecord(raw)) return null;
  const id = requiredStr(raw['id']);
  const classId = requiredStr(raw['classId']);
  const date = requiredStr(raw['date']);
  if (id === null || classId === null || date === null) return null;

  return {
    id,
    classId,
    date,
    title: str(raw['title'], '이름 없는 일정'),
    note: str(raw['note']),
    createdAt: str(raw['createdAt'], now),
  };
}

/**
 * (classId, date)가 자연키인 목록에서 겹치는 것을 버린다.
 *
 * 같은 날 기록이 둘이면 화면이 어느 쪽을 믿을지 모른다. 겹침은 상한
 * 파일에서만 생기므로(화면은 항상 한 날짜에 하나만 만든다) 첫 것을
 * 남기는 것으로 충분하다.
 */
function dedupeByClassDate<T extends { classId: string; date: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((record) => {
    const key = `${record.classId}:${record.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── 진입점 ────────────────────────────────────────────────────

export interface ParseResult {
  data: SuiteData;
  repairs: RepairLog[];
}

/** 잘라낸 레코드 수를 모아 한 번에 보고한다. 항목마다 알리면 소음이 된다. */
function reportDropped(repairs: RepairLog[], label: string, dropped: number): void {
  if (dropped <= 0) return;
  repairs.push({
    code: 'MALFORMED_RECORD',
    severity: 'warning',
    entityIds: [],
    message: `${label} ${dropped}건이 손상되어 있어 불러오지 못했습니다.`,
  });
}

export function parseSuiteData(raw: unknown, now: string = new Date().toISOString()): ParseResult {
  const repairs: RepairLog[] = [];

  if (!isRecord(raw)) {
    repairs.push({
      code: 'MISSING_SECTION',
      severity: 'warning',
      entityIds: [],
      message: '저장된 데이터의 형식을 알아볼 수 없어 빈 상태로 시작합니다.',
    });
    return { data: createEmptySuiteData(), repairs };
  }

  // 매개변수는 클로저 안에서 좁혀진 타입을 유지하지 못한다. 상수로 고정한다.
  const root: Record<string, unknown> = raw;

  const version = num(root['schemaVersion'], CURRENT_SCHEMA_VERSION);
  if (version > CURRENT_SCHEMA_VERSION) {
    // 더 새 버전에서 만든 데이터. 모르는 필드는 잃을 수 있으니 반드시 알린다.
    repairs.push({
      code: 'SCHEMA_VERSION_AHEAD',
      severity: 'warning',
      entityIds: [],
      message: `이 앱보다 새로운 버전(v${version})에서 저장한 데이터입니다. 일부 정보가 빠질 수 있으니 앱을 최신으로 업데이트한 뒤 다시 열어 주세요.`,
    });
  }

  function parseList<T>(key: string, label: string, fn: (raw: unknown) => T | null): T[] {
    const source = asArray(root[key]);
    const parsed = source.map(fn);
    reportDropped(repairs, label, parsed.filter((v) => v === null).length);
    return parsed.filter((v): v is T => v !== null);
  }

  const profileRaw = isRecord(root['profile']) ? root['profile'] : {};

  // 진행 상태가 가리키는 대상을 확인하려면 목록이 먼저 있어야 한다.
  const lessonTemplates = parseList('lessonTemplates', '수업 흐름', (r) =>
    parseLessonTemplate(r, now),
  );
  const quizSets = parseList('quizSets', '문제 세트', (r) => parseQuizSet(r, now));

  /*
   * 한 줄이라도 못 읽으면 일곱 줄을 통째로 기본값으로 되돌린다.
   *
   * 반쪽짜리 일과는 '지금' 카드가 4교시에서 갑자기 말을 못 하게 만든다.
   * 그건 조용히 틀리는 쪽이라 차라리 전부 기본값이 낫다 — 틀렸다는 것이
   * 눈에 보이고 고칠 데도 분명하다.
   *
   * **없을 때와 있는데 못 읽을 때를 가른다.** 이 판 이전 백업에는 이 칸이
   * 아예 없으므로 그때는 조용히 채운다 — 안 그러면 기존 사용자 전원이
   * 앱을 열 때마다 경고를 한 번씩 본다.
   *
   * 있는데 못 읽은 것은 다르다. 08:40으로 고쳐 둔 일과가 통째로 09:00으로
   * 되돌아가는데 아무도 안 알려 주면, 선생님은 '지금' 카드가 하루 종일
   * 틀린 말을 하는 까닭을 알 길이 없다. 이 저장소의 복구 원칙이
   * "조용히 고치지 않는다"인 것이 이 때문이다.
   */
  const rawTimes = root['periodTimes'];
  const readTimes = asArray(rawTimes)
    .map(parsePeriodTime)
    .filter((t): t is PeriodTime => t !== null);

  /*
   * 교시는 **1부터 이어져야** 한다. 학교 일과가 그런 모양이고, 그래서
   * 이어지지 않는다는 것은 중간이 빠졌다는 뜻이다 — 교사가 지운 것과
   * 자료가 상한 것을 이 규칙 하나로 가른다. 뒤에서 지우는 것(6·7교시를
   * 안 쓰는 저학년)은 이어짐을 안 깨므로 그대로 남는다.
   */
  const ordered = [...readTimes].sort((a, b) => a.period - b.period);
  const contiguous =
    ordered.length > 0 && ordered.every((time, index) => time.period === index + 1);

  let periodTimes = ordered;
  if (!contiguous) {
    periodTimes = createDefaultPeriodTimes();
    if (rawTimes !== undefined) {
      repairs.push({
        code: 'INVALID_PERIOD_TIME',
        severity: 'warning',
        entityIds: [],
        message: '교시 시각을 알아볼 수 없어 기본 일과로 되돌렸습니다. 설정 → 시간표에서 확인해 주세요.',
      });
    }
  }

  const shaped: SuiteData = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: {
      schoolName: str(profileRaw['schoolName']),
      teacherName: str(profileRaw['teacherName']),
      ...(typeof profileRaw['officeCode'] === 'string' ? { officeCode: profileRaw['officeCode'] } : {}),
      ...(typeof profileRaw['schoolCode'] === 'string' ? { schoolCode: profileRaw['schoolCode'] } : {}),
      /*
       * 주소는 **글자일 때만** 담는다. 다른 선택 항목과 같은 꼴이지만 여기는
       * 걸린 적이 있는 자리다 — 이 값을 받는 regionOfAddress()가 곧바로
       * .trim()을 부르므로, 숫자나 객체가 그대로 통과하면 머리띠를 그리는
       * 순간 화면 전체가 죽는다. 상한 백업 한 줄이 앱을 못 열게 만든다.
       */
      ...(typeof profileRaw['schoolAddress'] === 'string'
        ? { schoolAddress: profileRaw['schoolAddress'] }
        : {}),
      // 도구함에서 옮겨 온 것. 가정 통신 문구에 그대로 끼워 넣는 글자다.
      grade: str(profileRaw['grade']),
      classNo: str(profileRaw['classNo']),
    },
    terms: parseList('terms', '학기', (r) => parseTerm(r, now)),
    classRooms: parseList('classRooms', '학급', (r) => parseClassRoom(r, now)),
    students: parseList('students', '학생', (r) => parseStudent(r, now)),
    groups: parseList('groups', '모둠', (r) => parseGroup(r, now)),
    seatingProfiles: parseList('seatingProfiles', '자리배치 설정', parseSeatingProfile),
    dutyProfiles: parseList('dutyProfiles', '당번 설정', parseDutyProfile),
    rewardProfiles: parseList('rewardProfiles', '보상 설정', parseRewardProfile),
    seatingStates: parseList('seatingStates', '자리 배치', (r) => parseSeatingState(r, now)),
    savedLayouts: parseList('savedLayouts', '저장한 자리표', (r) => parseSavedLayout(r, now)),
    dutyRoles: parseList('dutyRoles', '역할', (r) => parseDutyRole(r, now)),
    dutyRounds: parseList('dutyRounds', '당번 배정', (r) => parseDutyRound(r, now)),
    dutyCompletions: parseList('dutyCompletions', '당번 수행 기록', parseDutyCompletion),
    behaviorPresets: parseList('behaviorPresets', '행동 항목', (r) => parseBehaviorPreset(r, now)),
    scoreEntries: parseList('scoreEntries', '점수 기록', (r) => parseScoreEntry(r, now)),
    scoreGoals: parseList('scoreGoals', '공동 목표', (r) => parseScoreGoal(r, now)),
    assignments: parseList('assignments', '과제', (r) => parseAssignment(r, now)),
    submissions: parseList('submissions', '제출 현황', (r) => parseSubmission(r, now)),
    timetableEntries: parseList('timetableEntries', '시간표', parseTimetableEntry),
    periodTimes,
    scoreCycle: parseScoreCycle(root['scoreCycle']),
    homeLayout: parseHomeLayout(root['homeLayout']),
    activeTermId: typeof root['activeTermId'] === 'string' ? root['activeTermId'] : null,
    activeClassId: typeof root['activeClassId'] === 'string' ? root['activeClassId'] : null,
    ...parseLock(root),

    // ── 도구함에서 옮겨 온 것 ────────────────────────────────
    // lessonRun·quizRun은 목록을 먼저 읽어야 가리키는 대상을 확인할 수 있다.
    lessonTemplates,
    lessonRun: parseLessonRun(root['lessonRun'], lessonTemplates),
    quizSets,
    quizResults: parseList('quizResults', '퀴즈 결과', (r) => parseQuizResult(r, now)),
    quizRun: parseQuizRun(root['quizRun'], quizSets),
    tasks: parseList('tasks', '업무', (r) => parseTask(r, now)),
    messageTemplates: parseList('messageTemplates', '문구 템플릿', (r) =>
      parseMessageTemplate(r, now),
    ),
    messageFavorites: strArray(root['messageFavorites']),
    messageHidden: strArray(root['messageHidden']),
    quizTeams: strArray(root['quizTeams']),

    // ── 2판에서 늘어난 것 ────────────────────────────────────
    attendanceRecords: dedupeByClassDate(
      parseList('attendanceRecords', '출결 기록', parseAttendanceRecord),
    ),
    notices: dedupeByClassDate(parseList('notices', '알림장', parseDailyNotice)),
    /*
     * 지난 날짜의 하루 바꾸기는 해석한 뒤에 버린다. 복구가 아니라 **만료**다 —
     * 어제의 보강은 어제로 끝났고, 남겨 두면 파일만 해마다 자란다. 그래서
     * '손상'으로 세지도, 알리지도 않는다. YYYY-MM-DD 글자 비교로 충분하다
     * (ISO 날짜는 사전순 = 시간순).
     */
    timetableOverrides: parseList(
      'timetableOverrides',
      '시간표 하루 바꾸기',
      parseTimetableOverride,
    ).filter((override) => override.date >= now.slice(0, 10)),
    rewardItems: parseList('rewardItems', '쿠폰', (r) => parseRewardItem(r, now)),
    redemptions: parseList('redemptions', '쿠폰 사용 기록', (r) => parseRedemption(r, now)),
    observations: parseList('observations', '관찰 기록', (r) => parseObservation(r, now)),
    behaviorComments: parseList('behaviorComments', '행동특성 의견', (r) =>
      parseBehaviorComment(r, now),
    ),
    classEvents: parseList('classEvents', '학급 일정', (r) => parseClassEvent(r, now)),
  };

  const repaired = validateAndRepair(shaped, now);

  return { data: repaired.data, repairs: [...repairs, ...repaired.repairs] };
}

/** 내보내기용 직렬화. NEIS·Gemini 키는 별도 저장소에 있어 여기 포함되지 않는다. */
export function serializeSuiteData(data: SuiteData): string {
  return JSON.stringify({ ...data, schemaVersion: CURRENT_SCHEMA_VERSION }, null, 2);
}
