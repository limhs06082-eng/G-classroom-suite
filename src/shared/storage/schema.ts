import {
  createEmptySuiteData,
  DEFAULT_SCORE_CYCLE,
  DEFAULT_SEAT_COLS,
  DEFAULT_SEAT_ROWS,
} from '../domain/factories';
import { validateAndRepair, type RepairLog } from '../domain/invariants';
import {
  CURRENT_SCHEMA_VERSION,
  ROLE_CATEGORIES,
  MAX_SEAT_COLS,
  MAX_SEAT_ROWS,
  MIN_SEAT_COLS,
  MIN_SEAT_ROWS,
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
  type RewardProfile,
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
} from '../domain/types';

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
    updatedAt: str(raw['updatedAt'], now),
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

function parseScoreCycle(raw: unknown): ScoreCycle {
  if (!isRecord(raw)) return { ...DEFAULT_SCORE_CYCLE };

  return {
    weeklyStartDay: num(raw['weeklyStartDay'], DEFAULT_SCORE_CYCLE.weeklyStartDay),
    weeklyStartDayApplyMode: oneOf(
      raw['weeklyStartDayApplyMode'],
      ['next_period', 'recalculate_current'] as const,
      DEFAULT_SCORE_CYCLE.weeklyStartDayApplyMode,
    ),
    monthlyType: oneOf(
      raw['monthlyType'],
      ['1st_to_end', 'specific_day', 'teacher_manual'] as const,
      DEFAULT_SCORE_CYCLE.monthlyType,
    ),
    monthlyStartDay: num(raw['monthlyStartDay'], DEFAULT_SCORE_CYCLE.monthlyStartDay),
    showLifetimeCumulative: bool(
      raw['showLifetimeCumulative'],
      DEFAULT_SCORE_CYCLE.showLifetimeCumulative,
    ),
  };
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

  const shaped: SuiteData = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: {
      schoolName: str(profileRaw['schoolName']),
      teacherName: str(profileRaw['teacherName']),
      ...(typeof profileRaw['officeCode'] === 'string' ? { officeCode: profileRaw['officeCode'] } : {}),
      ...(typeof profileRaw['schoolCode'] === 'string' ? { schoolCode: profileRaw['schoolCode'] } : {}),
    },
    terms: parseList('terms', '학기', (r) => parseTerm(r, now)),
    classRooms: parseList('classRooms', '학급', (r) => parseClassRoom(r, now)),
    students: parseList('students', '학생', (r) => parseStudent(r, now)),
    groups: parseList('groups', '모둠', (r) => parseGroup(r, now)),
    seatingProfiles: parseList('seatingProfiles', '자리배치 설정', parseSeatingProfile),
    dutyProfiles: parseList('dutyProfiles', '당번 설정', parseDutyProfile),
    rewardProfiles: parseList('rewardProfiles', '보상 설정', parseRewardProfile),
    seatingStates: parseList('seatingStates', '자리 배치', (r) => parseSeatingState(r, now)),
    dutyRoles: parseList('dutyRoles', '역할', (r) => parseDutyRole(r, now)),
    dutyRounds: parseList('dutyRounds', '당번 배정', (r) => parseDutyRound(r, now)),
    dutyCompletions: parseList('dutyCompletions', '당번 수행 기록', parseDutyCompletion),
    behaviorPresets: parseList('behaviorPresets', '행동 항목', (r) => parseBehaviorPreset(r, now)),
    scoreEntries: parseList('scoreEntries', '점수 기록', (r) => parseScoreEntry(r, now)),
    scoreGoals: parseList('scoreGoals', '공동 목표', (r) => parseScoreGoal(r, now)),
    assignments: parseList('assignments', '과제', (r) => parseAssignment(r, now)),
    submissions: parseList('submissions', '제출 현황', (r) => parseSubmission(r, now)),
    scoreCycle: parseScoreCycle(root['scoreCycle']),
    activeTermId: typeof root['activeTermId'] === 'string' ? root['activeTermId'] : null,
    activeClassId: typeof root['activeClassId'] === 'string' ? root['activeClassId'] : null,
  };

  const repaired = validateAndRepair(shaped, now);

  return { data: repaired.data, repairs: [...repairs, ...repaired.repairs] };
}

/** 내보내기용 직렬화. NEIS·Gemini 키는 별도 저장소에 있어 여기 포함되지 않는다. */
export function serializeSuiteData(data: SuiteData): string {
  return JSON.stringify({ ...data, schemaVersion: CURRENT_SCHEMA_VERSION }, null, 2);
}
