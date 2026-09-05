import { createId } from '../ids';
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
  // 도구함에서 옮겨 온 것
  type LessonStage,
  type LessonTemplate,
  type MessageTemplate,
  type PeriodTime,
  type QuizQuestion,
  type QuizSet,
  type TaskItem,
  // 2판에서 늘어난 것
  type AttendanceRecord,
  type ClassEvent,
  type DailyNotice,
  type ObservationEntry,
  type Redemption,
  type RedemptionTargetUnit,
  type RewardItem,
} from './types';

/**
 * 엔티티 생성 헬퍼.
 *
 * 모든 생성 함수는 `now`를 주입받는다. 테스트에서 시각을 고정하기 위해서다.
 * 원본 앱들은 `new Date().toISOString()`을 곳곳에 직접 호출해 테스트가 불가능했다.
 */

export { createId } from '../ids';

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────

export function createTerm(
  input: Pick<Term, 'schoolYear' | 'semester' | 'startDate' | 'endDate'> &
    Partial<Pick<Term, 'id' | 'name' | 'status' | 'isSample'>>,
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
    ...(input.isSample === true ? { isSample: true as const } : {}),
  };
}

export function createClassRoom(
  input: Pick<ClassRoom, 'termId' | 'name'> &
    Partial<Pick<ClassRoom, 'id' | 'grade' | 'classNo' | 'isSample'>>,
  now: string = nowIso(),
): ClassRoom {
  return {
    id: input.id ?? createId(),
    termId: input.termId,
    name: input.name,
    ...(input.grade === undefined ? {} : { grade: input.grade }),
    ...(input.classNo === undefined ? {} : { classNo: input.classNo }),
    ...(input.isSample === true ? { isSample: true as const } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function createStudent(
  input: Pick<Student, 'classId' | 'number' | 'name'> &
    Partial<Pick<Student, 'id' | 'status' | 'birthday'>>,
  now: string = nowIso(),
): Student {
  return {
    id: input.id ?? createId(),
    classId: input.classId,
    number: input.number,
    name: input.name,
    status: input.status ?? 'active',
    ...(input.birthday === undefined || input.birthday === '' ? {} : { birthday: input.birthday }),
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
  return { studentId, gender, tags: [], note: '', isLocked: false, isGroupLocked: false, avoidStudentIds: [] };
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

// ─────────────────────────────────────────────────────────────
// 아래는 2단계 도구함에서 옮겨 왔다.
// ─────────────────────────────────────────────────────────────

// ── 수업 진행판 ────────────────────────────────────────────────

export function createStage(
  input: Pick<LessonStage, 'phase' | 'title'> & Partial<Omit<LessonStage, 'phase' | 'title'>>,
): LessonStage {
  return {
    id: input.id ?? createId(),
    phase: input.phase,
    title: input.title,
    guide: input.guide ?? '',
    minutes: input.minutes ?? 0,
    mode: input.mode ?? 'whole',
  };
}

export function createLessonTemplate(
  input: Pick<LessonTemplate, 'title'> & Partial<Pick<LessonTemplate, 'id' | 'subject' | 'stages'>>,
  now: string = nowIso(),
): LessonTemplate {
  return {
    id: input.id ?? createId(),
    title: input.title,
    subject: input.subject ?? '',
    stages: input.stages ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 처음 만들 때 제안하는 수업 흐름.
 *
 * 빈 화면에서 단계를 처음부터 짜게 하면 수업 직전에 쓸 수 없다.
 * 도입·활동·정리 뼈대를 깔아 주고 교사가 고치게 한다.
 */
export function starterLessonStages(): LessonStage[] {
  return [
    createStage({ phase: 'intro', title: '동기 유발', guide: '오늘 배울 내용을 함께 살펴봅니다', minutes: 5, mode: 'whole' }),
    createStage({ phase: 'intro', title: '학습 목표 확인', guide: '', minutes: 3, mode: 'whole' }),
    createStage({ phase: 'activity', title: '활동 1', guide: '', minutes: 12, mode: 'individual' }),
    createStage({ phase: 'activity', title: '활동 2', guide: '', minutes: 12, mode: 'group' }),
    createStage({ phase: 'wrapup', title: '정리·발표', guide: '', minutes: 6, mode: 'whole' }),
    createStage({ phase: 'wrapup', title: '차시 예고', guide: '', minutes: 2, mode: 'whole' }),
  ];
}

// ── 퀴즈 ──────────────────────────────────────────────────────

export function createQuestion(
  input: Pick<QuizQuestion, 'type' | 'text'> & Partial<Omit<QuizQuestion, 'type' | 'text'>>,
): QuizQuestion {
  return {
    id: input.id ?? createId(),
    type: input.type,
    text: input.text,
    choices: input.choices ?? (input.type === 'choice' ? ['', '', '', ''] : []),
    answer: input.answer ?? (input.type === 'ox' ? 'O' : input.type === 'choice' ? '0' : ''),
    explanation: input.explanation ?? '',
    timeLimitSec: input.timeLimitSec ?? 0,
    points: input.points ?? 1,
  };
}

export function createQuizSet(
  input: Pick<QuizSet, 'title'> & Partial<Pick<QuizSet, 'id' | 'subject' | 'questions'>>,
  now: string = nowIso(),
): QuizSet {
  return {
    id: input.id ?? createId(),
    title: input.title,
    subject: input.subject ?? '',
    questions: input.questions ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

// ── 업무 ──────────────────────────────────────────────────────

export function createTask(
  input: Pick<TaskItem, 'title'> &
    Partial<Pick<TaskItem, 'id' | 'area' | 'dueDate' | 'priority' | 'steps' | 'memo'>>,
  now: string = nowIso(),
): TaskItem {
  return {
    id: input.id ?? createId(),
    title: input.title,
    area: input.area ?? '기타',
    dueDate: input.dueDate ?? '',
    priority: input.priority ?? 'normal',
    steps: input.steps ?? [],
    memo: input.memo ?? '',
    done: false,
    createdAt: now,
    updatedAt: now,
  };
}

// ── 문구 템플릿 ────────────────────────────────────────────────

export function createMessageTemplate(
  input: Pick<MessageTemplate, 'category' | 'title' | 'body'> &
    Partial<Pick<MessageTemplate, 'id' | 'isBuiltIn'>>,
  now: string = nowIso(),
): MessageTemplate {
  return {
    id: input.id ?? createId(),
    category: input.category,
    title: input.title,
    body: input.body,
    isBuiltIn: input.isBuiltIn ?? false,
    createdAt: now,
  };
}

// ── 교시 시각 ──────────────────────────────────────────────────

/**
 * 초등 일반 일과 일곱 줄.
 *
 * **빈 채로 두지 않는다.** 비워 두고 채우라고 하면 '지금' 카드가 처음부터
 * 안 뜨고, 그러면 이 기능이 있다는 것조차 모르고 지나간다. 틀린 학교는
 * 고치면 되고, 고칠 곳이 어디인지는 카드가 알려 준다.
 *
 * 09:00 시작, 40분 수업, 10분 쉬는 시간, 점심 12:10~13:10.
 */
export function createDefaultPeriodTimes(): PeriodTime[] {
  const starts = ['09:00', '09:50', '10:40', '11:30', '13:10', '14:00', '14:50'];

  return starts.map((start, index) => ({
    period: index + 1,
    start,
    end: addMinutes(start, 40),
  }));
}

/** `"09:00"` + 40 → `"09:40"`. 자정을 넘길 일이 없어 되감지 않는다. */
function addMinutes(hm: string, minutes: number): string {
  const [h = '0', m = '0'] = hm.split(':');
  const total = Number(h) * 60 + Number(m) + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ── 2판에서 늘어난 것 ──────────────────────────────────────────

export function createAttendanceRecord(classId: string, date: string): AttendanceRecord {
  return { classId, date, entries: [] };
}

export function createDailyNotice(classId: string, date: string): DailyNotice {
  return { classId, date, items: [] };
}

/**
 * 처음 만들 때 제안하는 쿠폰 묶음.
 *
 * 역할·행동 항목과 같은 이유다 — 빈 화면에서 처음부터 만들게 하면
 * 기능이 있는 줄도 모르고 지나간다. 실제 교실에서 흔한 것만 골랐다.
 */
export const STARTER_REWARD_ITEMS: ReadonlyArray<Pick<RewardItem, 'name' | 'cost'>> = [
  { name: '자리 선택권', cost: 10 },
  { name: '자유 시간 10분', cost: 15 },
  { name: '숙제 하루 연기권', cost: 20 },
];

export function createRewardItem(
  input: Pick<RewardItem, 'classId' | 'name' | 'cost'> &
    Partial<Pick<RewardItem, 'id' | 'isActive' | 'order'>>,
  now: string = nowIso(),
): RewardItem {
  return {
    id: input.id ?? createId(),
    classId: input.classId,
    name: input.name,
    // 0점짜리 쿠폰은 잔액과 무관하게 무한히 쓸 수 있어 목록을 망가뜨린다.
    cost: Math.max(1, Math.round(input.cost)),
    isActive: input.isActive ?? true,
    order: input.order ?? 0,
    createdAt: now,
  };
}

export function createRedemption(
  input: {
    classId: string;
    targetUnit: RedemptionTargetUnit;
    targetId: string;
    itemName: string;
    cost: number;
  } & Partial<Pick<Redemption, 'id' | 'occurredAt'>>,
  now: string = nowIso(),
): Redemption {
  return {
    id: input.id ?? createId(),
    classId: input.classId,
    occurredAt: input.occurredAt ?? now,
    targetUnit: input.targetUnit,
    targetId: input.targetId,
    itemName: input.itemName,
    cost: Math.max(1, Math.round(input.cost)),
  };
}

export function createObservation(
  input: Pick<ObservationEntry, 'classId' | 'studentId' | 'text'> &
    Partial<Pick<ObservationEntry, 'id' | 'date' | 'kind' | 'followUpDate'>>,
  now: string = nowIso(),
): ObservationEntry {
  return {
    id: input.id ?? createId(),
    classId: input.classId,
    studentId: input.studentId,
    date: input.date ?? now.slice(0, 10),
    text: input.text,
    createdAt: now,
    ...(input.kind === 'counsel' ? { kind: 'counsel' as const } : {}),
    ...(input.kind === 'counsel' && input.followUpDate !== undefined && input.followUpDate !== ''
      ? { followUpDate: input.followUpDate }
      : {}),
  };
}

export function createClassEvent(
  input: Pick<ClassEvent, 'classId' | 'date' | 'title'> & Partial<Pick<ClassEvent, 'id' | 'note'>>,
  now: string = nowIso(),
): ClassEvent {
  return {
    id: input.id ?? createId(),
    classId: input.classId,
    date: input.date,
    title: input.title,
    note: input.note ?? '',
    createdAt: now,
  };
}

/** 최초 실행 시의 빈 데이터. 설정 마법사를 거치기 전 상태다. */
export function createEmptySuiteData(): SuiteData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: { schoolName: '', teacherName: '', grade: '', classNo: '' },
    terms: [],
    classRooms: [],
    students: [],
    groups: [],
    seatingProfiles: [],
    dutyProfiles: [],
    rewardProfiles: [],
    seatingStates: [],
    savedLayouts: [],
    dutyRoles: [],
    dutyRounds: [],
    dutyCompletions: [],
    behaviorPresets: [],
    scoreEntries: [],
    scoreGoals: [],
    assignments: [],
    submissions: [],
    timetableEntries: [],
    periodTimes: createDefaultPeriodTimes(),
    scoreCycle: { ...DEFAULT_SCORE_CYCLE },
    activeTermId: null,
    activeClassId: null,
    lessonTemplates: [],
    lessonRun: null,
    quizSets: [],
    quizResults: [],
    quizRun: null,
    tasks: [],
    messageTemplates: [],
    messageFavorites: [],
    messageHidden: [],
    quizTeams: [],
    lockPin: '',
    isLocked: false,
    attendanceRecords: [],
    notices: [],
    timetableOverrides: [],
    rewardItems: [],
    redemptions: [],
    observations: [],
    classEvents: [],
    homeLayout: { order: [], hidden: [], sizes: {} },
    behaviorComments: [],
  };
}
