import { describe, expect, it } from 'vitest';

import {
  LEGACY_KEYS,
  convertPlaceholders,
  importLegacy,
  scanLegacy,
} from '../../src/features/settings/legacyImport';
import { createEmptySuiteData, createTask } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';

const NOW = '2026-08-13T09:00:00.000Z';

/** 브라우저 없이 쓰는 localStorage 대역. */
function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(seed));

  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => map.delete(key),
    setItem: (key: string, value: string) => map.set(key, value),
  } as Storage;
}

const lessonSeed = JSON.stringify([
  {
    id: 'lt-1',
    title: '우리 동네 환경 문제',
    subject: '사회',
    createdAt: 1754000000000,
    updatedAt: 1754000000000,
    stages: [
      {
        id: 's-1',
        stageName: '도입',
        activityName: '오늘의 문제 만나기',
        instruction: '사진을 보고 문제를 찾아봅시다',
        activityType: 'whole',
        durationMinutes: 5,
      },
      {
        id: 's-2',
        stageName: '활동 1',
        activityName: '모둠 토의',
        instruction: '',
        activityType: 'group',
        durationMinutes: 12,
      },
      {
        id: 's-3',
        stageName: '정리',
        activityName: '',
        instruction: '',
        activityType: 'teacher',
        durationMinutes: 5,
      },
    ],
  },
]);

const quizSeed = JSON.stringify([
  {
    id: 'qs-1',
    title: '분수의 나눗셈',
    subject: '수학',
    createdAt: '2026-07-01T00:00:00.000Z',
    questions: [
      {
        id: 'q-1',
        type: 'multiple_choice',
        text: '가장 큰 수는?',
        options: [
          { id: 'o-a', text: '1/2' },
          { id: 'o-b', text: '2/3' },
          { id: 'o-c', text: '3/4' },
        ],
        correctAnswer: 'o-c',
        timeLimit: 30,
      },
      { id: 'q-2', type: 'ox', text: '분수는 나눌 수 있다', correctAnswer: 'O', timeLimit: 0 },
      { id: 'q-3', type: 'short_answer', text: '1/2 ÷ 1/4 = ?', correctAnswer: '2', timeLimit: 0 },
    ],
  },
]);

const taskSeed = JSON.stringify({
  schemaVersion: 2,
  tasks: [
    {
      id: 't-1',
      title: '생활기록부 마감',
      dueDate: '2026-08-20',
      priority: '높음',
      category: '생활기록부',
      checklist: [{ id: 'c-1', text: '교과 세특 확인', completed: true }],
      memo: '',
      isCompleted: false,
      createdAt: '2026-08-01',
    },
    {
      id: 't-2',
      title: '동아리 예산 정리',
      dueDate: '',
      priority: '보통',
      category: '동아리',
      checklist: [],
      memo: '영수증 첨부',
      isCompleted: true,
      createdAt: '2026-08-02',
    },
  ],
});

const messageSeed = JSON.stringify([
  {
    id: 'tpl-1',
    name: '준비물 안내',
    categoryId: 'supplies',
    shortText: '짧은 문구',
    normalText: '{{학교명}} {{학년}}학년 {{반}}반 담임 {{교사명}}입니다. 준비물은 {{준비물}}입니다.',
    detailedText: '자세한 문구',
    createdAt: 1753000000000,
  },
]);

function fullStorage(): Storage {
  return memoryStorage({
    [LEGACY_KEYS.lesson]: lessonSeed,
    [LEGACY_KEYS.quiz]: quizSeed,
    [LEGACY_KEYS.task]: taskSeed,
    [LEGACY_KEYS.message]: messageSeed,
  });
}

describe('scanLegacy', () => {
  it('원본이 하나도 없으면 빈 결과', () => {
    const scan = scanLegacy(memoryStorage());

    expect(scan.sources).toEqual([]);
    expect(scan.total).toBe(0);
  });

  it('쓰지 않은 앱은 목록에 넣지 않는다', () => {
    // 안 쓴 앱까지 늘어놓으면 무엇을 가져오는지 흐려진다.
    const scan = scanLegacy(memoryStorage({ [LEGACY_KEYS.quiz]: quizSeed }));

    expect(scan.sources).toHaveLength(1);
    expect(scan.sources[0]?.key).toBe(LEGACY_KEYS.quiz);
  });

  it('앱별 항목 수를 센다', () => {
    const scan = scanLegacy(fullStorage());

    expect(scan.sources.map((source) => source.count)).toEqual([1, 1, 2, 1]);
    expect(scan.total).toBe(5);
  });

  it('내용이 깨져 있어도 멈추지 않는다', () => {
    const scan = scanLegacy(memoryStorage({ [LEGACY_KEYS.lesson]: '{잘린 json' }));

    expect(scan.sources).toEqual([]);
  });

  it('훑기만으로는 아무것도 바꾸지 않는다', () => {
    const storage = fullStorage();
    scanLegacy(storage);

    expect(storage.getItem(LEGACY_KEYS.quiz)).toBe(quizSeed);
  });
});

describe('importLegacy — 수업 흐름', () => {
  const template = importLegacy(createEmptySuiteData(), fullStorage(), NOW).data
    .lessonTemplates[0];

  it('제목과 과목을 옮긴다', () => {
    expect(template?.title).toBe('우리 동네 환경 문제');
    expect(template?.subject).toBe('사회');
  });

  it('단계 이름으로 도입·활동·정리를 짚는다', () => {
    // 원본에는 단계 구분이 없다. 이름으로 짐작하고 못 짚으면 활동으로 둔다.
    expect(template?.stages.map((stage) => stage.phase)).toEqual(['intro', 'activity', 'wrapup']);
  });

  it('활동 이름이 비면 단계 이름을 제목으로 쓴다', () => {
    expect(template?.stages[2]?.title).toBe('정리');
  });

  it('원본에 없는 교사 설명은 전체 활동으로 본다', () => {
    expect(template?.stages.map((stage) => stage.mode)).toEqual(['whole', 'group', 'whole']);
  });

  it('배정 시간을 옮긴다', () => {
    expect(template?.stages.map((stage) => stage.minutes)).toEqual([5, 12, 5]);
  });
});

describe('importLegacy — 퀴즈', () => {
  const set = importLegacy(createEmptySuiteData(), fullStorage(), NOW).data.quizSets[0];

  it('문제 유형 이름을 바꾼다', () => {
    expect(set?.questions.map((question) => question.type)).toEqual(['choice', 'ox', 'short']);
  });

  it('객관식 정답을 보기 id에서 순번으로 바꾼다', () => {
    expect(set?.questions[0]?.choices).toEqual(['1/2', '2/3', '3/4']);
    expect(set?.questions[0]?.answer).toBe('2');
  });

  it('짝이 되는 보기를 못 찾으면 정답을 비운다', () => {
    // 아무 보기나 찍어 두면 수업 중에 조용히 틀린 채점이 나간다.
    const broken = JSON.stringify([
      {
        id: 'qs-x',
        title: '깨진 세트',
        questions: [
          {
            id: 'q-x',
            type: 'multiple_choice',
            text: '?',
            options: [{ id: 'o-a', text: '가' }],
            correctAnswer: '사라진-보기',
          },
        ],
      },
    ]);

    const result = importLegacy(
      createEmptySuiteData(),
      memoryStorage({ [LEGACY_KEYS.quiz]: broken }),
      NOW,
    );

    expect(result.data.quizSets[0]?.questions[0]?.answer).toBe('');
  });

  it('OX가 O도 X도 아니면 비운다', () => {
    const broken = JSON.stringify([
      {
        id: 'qs-x',
        title: '깨진 세트',
        questions: [{ id: 'q-x', type: 'ox', text: '?', correctAnswer: '참' }],
      },
    ]);

    const result = importLegacy(
      createEmptySuiteData(),
      memoryStorage({ [LEGACY_KEYS.quiz]: broken }),
      NOW,
    );

    expect(result.data.quizSets[0]?.questions[0]?.answer).toBe('');
  });

  it('제한 시간을 옮긴다', () => {
    expect(set?.questions[0]?.timeLimitSec).toBe(30);
  });

  it('퀴즈 결과는 가져오지 않는다', () => {
    // 원본은 개인 응답을, 통합본은 팀별 정답 수를 남긴다. 없는 팀 수를 지어낼 수 없다.
    const storage = fullStorage();
    storage.setItem('quizResults', JSON.stringify([{ id: 'r-1', score: 80 }]));

    expect(importLegacy(createEmptySuiteData(), storage, NOW).data.quizResults).toEqual([]);
  });
});

describe('importLegacy — 업무', () => {
  const tasks = importLegacy(createEmptySuiteData(), fullStorage(), NOW).data.tasks;

  it('중요도 이름을 바꾼다', () => {
    expect(tasks.map((task) => task.priority)).toEqual(['high', 'normal']);
  });

  it('아는 분류는 그대로 쓴다', () => {
    expect(tasks[0]?.area).toBe('생활기록부');
    expect(tasks[0]?.memo).toBe('');
  });

  it('모르는 분류는 기타로 옮기되 메모에 남긴다', () => {
    // 교사가 직접 지은 분류를 말없이 지워 버리면 안 된다.
    expect(tasks[1]?.area).toBe('기타');
    expect(tasks[1]?.memo).toBe('[동아리] 영수증 첨부');
  });

  it('하위 단계와 완료 여부를 옮긴다', () => {
    expect(tasks[0]?.steps[0]?.text).toBe('교과 세특 확인');
    expect(tasks[0]?.steps[0]?.done).toBe(true);
    expect(tasks[1]?.done).toBe(true);
  });

  it('형식이 아닌 마감일은 버린다', () => {
    const broken = JSON.stringify({
      tasks: [{ id: 't-x', title: '기한 이상', dueDate: '내일', checklist: [] }],
    });

    const result = importLegacy(
      createEmptySuiteData(),
      memoryStorage({ [LEGACY_KEYS.task]: broken }),
      NOW,
    );

    expect(result.data.tasks[0]?.dueDate).toBe('');
  });
});

describe('importLegacy — 문구', () => {
  const template = importLegacy(createEmptySuiteData(), fullStorage(), NOW).data
    .messageTemplates[0];

  it('분류를 통합본 이름으로 바꾼다', () => {
    expect(template?.category).toBe('준비물 안내');
  });

  it('기본 분량 문구를 본문으로 쓴다', () => {
    expect(template?.body.startsWith('{학교}')).toBe(true);
  });

  it('자리표시자 문법을 맞춘다', () => {
    // {{학교명}} 그대로 두면 치환되지 않은 채 학부모에게 나간다.
    expect(convertPlaceholders('{{학교명}} {{교사명}}')).toBe('{학교} {교사}');
  });

  it('통합본에 짝이 없는 자리표시자는 이름만 살린다', () => {
    // 문구 화면이 "채우지 못한 자리표시자"로 세어 경고할 수 있어야 한다.
    expect(convertPlaceholders('준비물은 {{준비물}}입니다')).toBe('준비물은 {준비물}입니다');
  });

  it('가져온 문구는 기본 제공 문구가 아니다', () => {
    expect(template?.isBuiltIn).toBe(false);
  });
});

describe('importLegacy — 안전 장치', () => {
  it('원본 키를 지우지 않는다', () => {
    const storage = fullStorage();
    importLegacy(createEmptySuiteData(), storage, NOW);

    expect(storage.getItem(LEGACY_KEYS.lesson)).toBe(lessonSeed);
    expect(storage.getItem(LEGACY_KEYS.quiz)).toBe(quizSeed);
    expect(storage.getItem(LEGACY_KEYS.task)).toBe(taskSeed);
    expect(storage.getItem(LEGACY_KEYS.message)).toBe(messageSeed);
  });

  it('지금 자료를 지우지 않고 더한다', () => {
    const current: SuiteData = {
      ...createEmptySuiteData(),
      tasks: [createTask({ id: 'mine', title: '내가 만든 업무' }, NOW)],
      profile: { schoolName: '한빛초', teacherName: '임한솔', grade: '3', classNo: '2' },
    };

    const result = importLegacy(current, fullStorage(), NOW);

    expect(result.data.tasks.map((task) => task.id)).toContain('mine');
    expect(result.data.tasks).toHaveLength(3);
    expect(result.data.profile.schoolName).toBe('한빛초');
  });

  it('두 번 가져와도 두 벌이 생기지 않는다', () => {
    const storage = fullStorage();
    const once = importLegacy(createEmptySuiteData(), storage, NOW);
    const twice = importLegacy(once.data, storage, NOW);

    expect(once.imported).toBe(5);
    expect(twice.imported).toBe(0);
    expect(twice.data.tasks).toHaveLength(2);
    expect(twice.data.quizSets).toHaveLength(1);
  });

  it('가져올 게 없으면 0을 돌려준다', () => {
    const result = importLegacy(createEmptySuiteData(), memoryStorage(), NOW);

    expect(result.imported).toBe(0);
    expect(result.data).toEqual(createEmptySuiteData());
  });

  it('내용이 깨져 있어도 나머지를 가져온다', () => {
    const storage = memoryStorage({
      [LEGACY_KEYS.lesson]: '{잘린 json',
      [LEGACY_KEYS.quiz]: quizSeed,
    });

    const result = importLegacy(createEmptySuiteData(), storage, NOW);

    expect(result.data.lessonTemplates).toEqual([]);
    expect(result.data.quizSets).toHaveLength(1);
  });

  it('배열이 아닌 값이 들어 있어도 멈추지 않는다', () => {
    const storage = memoryStorage({ [LEGACY_KEYS.lesson]: '{"templates":[]}' });

    expect(() => importLegacy(createEmptySuiteData(), storage, NOW)).not.toThrow();
    expect(scanLegacy(storage).total).toBe(0);
  });
});
