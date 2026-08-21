import { describe, expect, it } from 'vitest';

import { createEmptySuiteData, createLessonTemplate, createStage } from '../../src/shared/domain/factories';
import { parseSuiteData, serializeSuiteData } from '../../src/shared/storage/schema';

const NOW = '2026-08-12T09:00:00.000Z';

describe('parseSuiteData', () => {
  it('객체가 아니면 빈 상태로 시작하고 알린다', () => {
    const { data, repairs } = parseSuiteData('아무 문자열', NOW);

    expect(data.lessonTemplates).toEqual([]);
    expect(repairs[0]?.severity).toBe('warning');
  });

  it('빠진 항목은 기본값으로 채운다', () => {
    const { data } = parseSuiteData({ schemaVersion: 1 }, NOW);

    expect(data.profile.schoolName).toBe('');
    expect(data.tasks).toEqual([]);
    expect(data.lessonRun).toBeNull();
  });

  it('손상된 항목만 버리고 나머지는 살린다', () => {
    const { data, repairs } = parseSuiteData(
      {
        schemaVersion: 1,
        tasks: [
          { id: 't-1', title: '평가 계획 제출' },
          { title: 'id가 없어 버려짐' },
          null,
        ],
      },
      NOW,
    );

    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0]?.title).toBe('평가 계획 제출');
    expect(repairs.some((r) => r.message.includes('업무'))).toBe(true);
  });

  it('배열이어야 할 곳에 다른 값이 와도 견딘다', () => {
    const { data } = parseSuiteData({ schemaVersion: 1, quizSets: '문제들', tasks: 42 }, NOW);

    expect(data.quizSets).toEqual([]);
    expect(data.tasks).toEqual([]);
  });

  it('더 새로운 스키마 버전이면 경고한다', () => {
    const { repairs } = parseSuiteData({ schemaVersion: 99 }, NOW);

    expect(repairs.some((r) => r.message.includes('v99'))).toBe(true);
  });

  it('음수 시간이나 0점을 범위 안으로 끌어온다', () => {
    // 음수 분은 타이머를 즉시 끝내고, 0점 문제는 점수판을 이상하게 만든다.
    const { data } = parseSuiteData(
      {
        schemaVersion: 1,
        lessonTemplates: [{ id: 'l-1', title: '수업', stages: [{ id: 's-1', minutes: -5 }] }],
        quizSets: [{ id: 'q-1', title: '퀴즈', questions: [{ id: 'qq-1', points: 0 }] }],
      },
      NOW,
    );

    expect(data.lessonTemplates[0]?.stages[0]?.minutes).toBe(0);
    expect(data.quizSets[0]?.questions[0]?.points).toBe(1);
  });

  describe('진행 중인 수업', () => {
    const template = createLessonTemplate(
      { id: 'l-1', title: '수학', stages: [createStage({ phase: 'intro', title: '도입', id: 's-1' })] },
      NOW,
    );

    it('없어진 수업을 가리키면 진행 상태를 버린다', () => {
      // 그대로 두면 빈 화면이 뜬다.
      const { data } = parseSuiteData(
        { schemaVersion: 1, lessonTemplates: [template], lessonRun: { templateId: '없음' } },
        NOW,
      );

      expect(data.lessonRun).toBeNull();
    });

    it('단계 번호가 범위를 넘으면 끌어온다', () => {
      const { data } = parseSuiteData(
        {
          schemaVersion: 1,
          lessonTemplates: [template],
          lessonRun: { templateId: 'l-1', stageIndex: 99 },
        },
        NOW,
      );

      expect(data.lessonRun?.stageIndex).toBe(0);
    });
  });

  it('저장했다 다시 읽으면 같은 내용이 나온다', () => {
    const original = {
      ...createEmptySuiteData(),
      profile: { schoolName: '한빛초', teacherName: '임한솔', grade: '3', classNo: '2' },
      lessonTemplates: [
        createLessonTemplate(
          { id: 'l-1', title: '수학 3단원', stages: [createStage({ phase: 'intro', title: '도입', id: 's-1' })] },
          NOW,
        ),
      ],
    };

    const { data } = parseSuiteData(JSON.parse(serializeSuiteData(original)), NOW);

    expect(data.profile).toEqual(original.profile);
    expect(data.lessonTemplates).toEqual(original.lessonTemplates);
  });
});
