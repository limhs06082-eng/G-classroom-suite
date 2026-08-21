import {
  createLessonTemplate,
  createMessageTemplate,
  createQuestion,
  createQuizSet,
  createStage,
  createTask,
} from '../../shared/domain/factories';
import {
  TASK_AREAS,
  type ActivityMode,
  type LessonPhase,
  type LessonStage,
  type LessonTemplate,
  type MessageCategory,
  type MessageTemplate,
  type QuizQuestion,
  type QuizSet,
  type TaskArea,
  type TaskItem,
  type TaskPriority,
  type TaskStep,
  type SuiteData,
} from '../../shared/domain/types';

/**
 * 원본 4개 앱에서 자료 가져오기.
 *
 * 연수 전에 원본 앱을 이미 써 본 교사를 위한 1회성 통로다.
 * 원본은 같은 브라우저의 다른 키에 자료를 남겨 두었으므로 그 키를 읽어 옮긴다.
 *
 * 원칙:
 *   - **원본 키는 절대 지우지 않는다.** 옮기기가 잘못돼도 되돌아갈 곳이 있어야 한다.
 *   - 지금 자료를 지우지 않고 **더한다**.
 *   - 원본 id를 접두사와 함께 그대로 쓴다. 두 번 눌러도 두 벌이 생기지 않는다.
 *   - 읽어 낼 수 없는 값은 조용히 지어내지 않는다. 비워 두고 화면에서 드러나게 한다.
 */

export const LEGACY_KEYS = {
  lesson: 'class_board_templates_v1',
  quiz: 'quizSets',
  /*
   * 원본 업무 앱에는 `_v1` 키도 있지만 읽지 않는다.
   * 원본 앱은 열릴 때마다 v1을 v2로 옮겨 쓰므로, 가져올 만한 자료가 있다면 v2에 있다.
   * 형식을 모르는 v1을 짐작으로 읽으면 조용히 틀린 업무가 생긴다.
   */
  task: 'teacher_task_checklist_app_data_v2',
  message: 'school_template_customs',
} as const;

const LABELS: Record<string, string> = {
  [LEGACY_KEYS.lesson]: '수업 활동 진행판 — 수업 흐름',
  [LEGACY_KEYS.quiz]: '형성평가·퀴즈 — 문제 세트',
  [LEGACY_KEYS.task]: '회의·업무 체크리스트 — 업무',
  [LEGACY_KEYS.message]: '문서·문구 템플릿 — 내가 만든 문구',
};

/** 옮길 때 붙이는 접두사. 통합본에서 새로 만든 자료와 섞이지 않게 한다. */
const ID_PREFIX = {
  lesson: 'legacy-lesson-',
  stage: 'legacy-stage-',
  quiz: 'legacy-quiz-',
  question: 'legacy-q-',
  task: 'legacy-task-',
  step: 'legacy-step-',
  message: 'legacy-msg-',
} as const;

export interface LegacySource {
  key: string;
  /** 화면에 보여 줄 원본 앱 이름 */
  label: string;
  count: number;
}

export interface LegacyScan {
  sources: LegacySource[];
  total: number;
}

// ── 읽기 도우미 ────────────────────────────────────────────────

function readJson(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw === null || raw === '' ? null : JSON.parse(raw);
  } catch {
    // 원본이 남긴 값이 깨져 있어도 앱이 멈추면 안 된다. 그 앱만 없는 것으로 본다.
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nonNegativeInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

/** 원본마다 만든 시각을 숫자로도 문자열로도 남겼다. 읽히는 대로 받는다. */
function toIso(value: unknown, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return fallback;
}

function prefixedId(prefix: string, raw: unknown, index: number): string {
  const id = str(raw).trim();
  return `${prefix}${id === '' ? `auto-${index}` : id}`;
}

// ── 수업 진행판 ────────────────────────────────────────────────

const MODE_BY_ACTIVITY_TYPE: Record<string, ActivityMode> = {
  // 원본의 '교사 설명'은 통합본에 따로 없다. 전체 활동으로 본다.
  teacher: 'whole',
  individual: 'individual',
  pair: 'pair',
  group: 'group',
  whole: 'whole',
};

const INTRO_WORDS = ['도입', '동기', '시작', '준비'];
const WRAPUP_WORDS = ['정리', '마무리', '평가', '차시'];

/**
 * 원본에는 단계 구분(도입·활동·정리)이 없고 자유 문자열 이름만 있다.
 * 이름으로 짐작하고, 짐작이 안 되면 활동으로 둔다.
 * 잘못 짚어도 교사가 화면에서 바로 고칠 수 있는 값이다.
 */
function toPhase(stageName: string): LessonPhase {
  if (INTRO_WORDS.some((word) => stageName.includes(word))) return 'intro';
  if (WRAPUP_WORDS.some((word) => stageName.includes(word))) return 'wrapup';
  return 'activity';
}

function toStage(raw: Record<string, unknown>, index: number): LessonStage {
  const stageName = str(raw['stageName']).trim();
  const activityName = str(raw['activityName']).trim();

  return createStage({
    id: prefixedId(ID_PREFIX.stage, raw['id'], index),
    phase: toPhase(stageName),
    title: activityName === '' ? (stageName === '' ? `단계 ${index + 1}` : stageName) : activityName,
    guide: str(raw['instruction']).trim(),
    minutes: nonNegativeInt(raw['durationMinutes'], 0),
    mode: MODE_BY_ACTIVITY_TYPE[str(raw['activityType'])] ?? 'whole',
  });
}

function toLessonTemplate(
  raw: Record<string, unknown>,
  index: number,
  now: string,
): LessonTemplate {
  const title = str(raw['title']).trim();
  const createdAt = toIso(raw['createdAt'], now);

  return {
    ...createLessonTemplate(
      {
        id: prefixedId(ID_PREFIX.lesson, raw['id'], index),
        title: title === '' ? `수업 흐름 ${index + 1}` : title,
        subject: str(raw['subject']).trim(),
        stages: records(raw['stages']).map(toStage),
      },
      now,
    ),
    createdAt,
    updatedAt: toIso(raw['updatedAt'], createdAt),
  };
}

// ── 퀴즈 ──────────────────────────────────────────────────────

const TYPE_BY_LEGACY: Record<string, QuizQuestion['type']> = {
  multiple_choice: 'choice',
  ox: 'ox',
  short_answer: 'short',
};

/**
 * 원본 객관식은 정답을 **보기 id**로, 통합본은 **보기 순번**으로 저장한다.
 * 짝이 되는 보기를 찾지 못하면 정답을 비워 둔다.
 * 아무 보기나 정답으로 찍으면 수업 중에 조용히 틀린 채점이 나간다.
 */
function toQuestion(raw: Record<string, unknown>, index: number): QuizQuestion {
  const type = TYPE_BY_LEGACY[str(raw['type'])] ?? 'short';
  const correctAnswer = str(raw['correctAnswer']).trim();
  const options = records(raw['options']);

  let choices: string[] = [];
  let answer = '';

  if (type === 'choice') {
    choices = options.map((option) => str(option['text']));
    const found = options.findIndex((option) => str(option['id']) === correctAnswer);
    answer = found === -1 ? '' : String(found);
  } else if (type === 'ox') {
    const upper = correctAnswer.toUpperCase();
    // O도 X도 아니면 비워 둔다. 반반 확률로 찍어 주는 것보다 낫다.
    answer = upper === 'O' || upper === 'X' ? upper : '';
  } else {
    answer = correctAnswer;
  }

  return createQuestion({
    id: prefixedId(ID_PREFIX.question, raw['id'], index),
    type,
    text: str(raw['text']).trim(),
    choices,
    answer,
    explanation: str(raw['explanation']).trim(),
    timeLimitSec: nonNegativeInt(raw['timeLimit'], 0),
    points: 1,
  });
}

function toQuizSet(raw: Record<string, unknown>, index: number, now: string): QuizSet {
  const title = str(raw['title']).trim();
  const createdAt = toIso(raw['createdAt'], now);

  return {
    ...createQuizSet(
      {
        id: prefixedId(ID_PREFIX.quiz, raw['id'], index),
        title: title === '' ? `문제 세트 ${index + 1}` : title,
        subject: str(raw['subject']).trim(),
        questions: records(raw['questions']).map(toQuestion),
      },
      now,
    ),
    createdAt,
    updatedAt: toIso(raw['updatedAt'], createdAt),
  };
}

// ── 업무 체크리스트 ────────────────────────────────────────────

const PRIORITY_BY_LEGACY: Record<string, TaskPriority> = {
  높음: 'high',
  보통: 'normal',
  낮음: 'low',
};

const KNOWN_AREAS: readonly string[] = TASK_AREAS;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toStep(raw: Record<string, unknown>, index: number): TaskStep {
  return {
    id: prefixedId(ID_PREFIX.step, raw['id'], index),
    text: str(raw['text']).trim(),
    done: raw['completed'] === true,
  };
}

function toTask(raw: Record<string, unknown>, index: number, now: string): TaskItem {
  const title = str(raw['title']).trim();
  const category = str(raw['category']).trim();
  const isKnownArea = KNOWN_AREAS.includes(category);
  const memo = str(raw['memo']).trim();
  const dueDate = str(raw['dueDate']).trim();
  const createdAt = toIso(raw['createdAt'], now);

  return {
    ...createTask(
      {
        id: prefixedId(ID_PREFIX.task, raw['id'], index),
        title: title === '' ? `업무 ${index + 1}` : title,
        area: isKnownArea ? (category as TaskArea) : '기타',
        dueDate: DATE_PATTERN.test(dueDate) ? dueDate : '',
        priority: PRIORITY_BY_LEGACY[str(raw['priority'])] ?? 'normal',
        steps: records(raw['checklist']).map(toStep),
        /*
         * 통합본에 없는 분류는 메모 맨 앞에 남긴다.
         * 교사가 직접 지은 분류를 말없이 '기타'로 지워 버리면 안 된다.
         */
        memo: isKnownArea || category === '' ? memo : `[${category}] ${memo}`.trim(),
      },
      now,
    ),
    done: raw['isCompleted'] === true,
    createdAt,
    updatedAt: now,
  };
}

// ── 문구 템플릿 ────────────────────────────────────────────────

const CATEGORY_BY_LEGACY: Record<string, MessageCategory> = {
  parent_msg: '학부모 문자',
  supplies: '준비물 안내',
  absence: '결석·미제출',
  consultation: '상담 안내',
  event: '행사 안내',
  staff: '교직원 공지',
  // 원본의 '회의'는 통합본에 따로 없다. 교직원 공지에 넣는다.
  meeting: '교직원 공지',
  gratitude: '감사 인사',
};

const PLACEHOLDER_RENAMES: Record<string, string> = {
  학교명: '학교',
  교사명: '교사',
};

/**
 * 자리표시자 문법을 맞춘다.
 *
 * 원본은 `{{학교명}}`, 통합본은 `{학교}`를 쓴다. 그대로 두면
 * 치환되지 않은 `{{학교명}}`이 학부모에게 그대로 나간다.
 * 통합본에 짝이 없는 이름은 이름만 살려 둔다. 그래야 문구 화면이
 * "채우지 못한 자리표시자"로 세어 경고할 수 있다.
 */
export function convertPlaceholders(body: string): string {
  return body.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_whole, rawName: string) => {
    const name = rawName.trim();
    return `{${PLACEHOLDER_RENAMES[name] ?? name}}`;
  });
}

function toMessageTemplate(
  raw: Record<string, unknown>,
  index: number,
  now: string,
): MessageTemplate {
  const name = str(raw['name']).trim();
  // 길이별로 세 벌을 갖고 있다. 기본 분량을 가져오고, 없으면 있는 것을 쓴다.
  const body = [raw['normalText'], raw['detailedText'], raw['shortText']]
    .map((value) => str(value).trim())
    .find((value) => value !== '');

  return {
    ...createMessageTemplate(
      {
        id: prefixedId(ID_PREFIX.message, raw['id'], index),
        category: CATEGORY_BY_LEGACY[str(raw['categoryId'])] ?? '기타',
        title: name === '' ? `문구 ${index + 1}` : name,
        body: convertPlaceholders(body ?? ''),
        isBuiltIn: false,
      },
      now,
    ),
    createdAt: toIso(raw['createdAt'], now),
  };
}

// ── 훑기 ──────────────────────────────────────────────────────

/** 원본 앱별로 가져올 수 있는 항목 목록. 아무것도 바꾸지 않는다. */
function collect(storage: Storage): {
  lesson: Array<Record<string, unknown>>;
  quiz: Array<Record<string, unknown>>;
  task: Array<Record<string, unknown>>;
  message: Array<Record<string, unknown>>;
  present: Set<string>;
} {
  const present = new Set<string>();
  const raw: Record<'lesson' | 'quiz' | 'task' | 'message', unknown> = {
    lesson: null,
    quiz: null,
    task: null,
    message: null,
  };

  for (const [name, key] of Object.entries(LEGACY_KEYS) as Array<
    ['lesson' | 'quiz' | 'task' | 'message', string]
  >) {
    const value = readJson(storage, key);
    if (value === null) continue;
    present.add(key);
    raw[name] = value;
  }

  const taskData = raw.task;

  return {
    lesson: records(raw.lesson),
    quiz: records(raw.quiz),
    // 업무 앱만 배열이 아니라 통째 객체를 저장한다.
    task: records(isRecord(taskData) ? taskData['tasks'] : null),
    message: records(raw.message),
    present,
  };
}

export function scanLegacy(storage: Storage): LegacyScan {
  const found = collect(storage);

  const counts: Array<[string, number]> = [
    [LEGACY_KEYS.lesson, found.lesson.length],
    [LEGACY_KEYS.quiz, found.quiz.length],
    [LEGACY_KEYS.task, found.task.length],
    [LEGACY_KEYS.message, found.message.length],
  ];

  const sources: LegacySource[] = counts
    // 키 자체가 없는 앱은 줄에서 뺀다. 안 쓴 앱까지 늘어놓으면 무엇을 가져오는지 흐려진다.
    .filter(([key]) => found.present.has(key))
    .map(([key, count]) => ({ key, label: LABELS[key] ?? key, count }));

  return { sources, total: sources.reduce((sum, source) => sum + source.count, 0) };
}

// ── 옮기기 ────────────────────────────────────────────────────

export interface LegacyImportResult {
  data: SuiteData;
  /** 새로 더해진 항목 수. 이미 가져온 것은 세지 않는다. */
  imported: number;
}

/** 이미 있는 id는 건너뛴다. 두 번 눌러도 두 벌이 생기지 않는다. */
function appendNew<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const known = new Set(existing.map((item) => item.id));
  return [...existing, ...incoming.filter((item) => !known.has(item.id))];
}

/**
 * 원본 자료를 지금 자료에 더한다.
 *
 * 퀴즈 결과(`quizResults`)는 가져오지 않는다. 원본은 개인 응답 기록을,
 * 통합본은 팀별 정답 수를 남긴다. 없는 팀 수를 지어내야 하는데
 * 그러면 정답률 통계가 통째로 거짓말이 된다. 문제 세트만 옮기고 기록은 새로 쌓는다.
 */
export function importLegacy(
  data: SuiteData,
  storage: Storage,
  now: string = new Date().toISOString(),
): LegacyImportResult {
  const found = collect(storage);

  const lessonTemplates = found.lesson.map((raw, index) => toLessonTemplate(raw, index, now));
  const quizSets = found.quiz.map((raw, index) => toQuizSet(raw, index, now));
  const tasks = found.task.map((raw, index) => toTask(raw, index, now));
  const messageTemplates = found.message.map((raw, index) => toMessageTemplate(raw, index, now));

  const next: SuiteData = {
    ...data,
    lessonTemplates: appendNew(data.lessonTemplates, lessonTemplates),
    quizSets: appendNew(data.quizSets, quizSets),
    tasks: appendNew(data.tasks, tasks),
    messageTemplates: appendNew(data.messageTemplates, messageTemplates),
  };

  const imported =
    next.lessonTemplates.length -
    data.lessonTemplates.length +
    (next.quizSets.length - data.quizSets.length) +
    (next.tasks.length - data.tasks.length) +
    (next.messageTemplates.length - data.messageTemplates.length);

  return { data: next, imported };
}
