import { describe, expect, it } from 'vitest';

import { createEmptySuiteData } from '../../src/shared/domain/factories';
import { adoptToolkitData } from '../../src/shared/storage/adoptSplitApps';

/** 두 앱으로 나뉘어 있던 시절의 도구함 자료 한 벌. */
function oldToolkit(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    profile: { schoolName: '도구함 학교', teacherName: '임한솔', grade: '3', classNo: '2' },
    lessonTemplates: [{ id: 'tpl-1', title: '3단원', subject: '수학', stages: [] }],
    lessonRun: null,
    quizSets: [{ id: 'set-1', title: '확인 문제', subject: '', questions: [] }],
    quizResults: [],
    quizRun: null,
    tasks: [{ id: 'task-1', title: '가정통신문 배부' }],
    messageTemplates: [],
    messageFavorites: ['fav-1'],
    messageHidden: [],
    quizTeams: ['1모둠', '2모둠', '3모둠', '4모둠', '5모둠', '6모둠'],
  };
}

describe('adoptToolkitData', () => {
  it('도구함 몫을 가져온다', () => {
    const { data, adopted } = adoptToolkitData(createEmptySuiteData(), oldToolkit());

    expect(adopted).toBe(true);
    expect(data.lessonTemplates).toHaveLength(1);
    expect(data.quizSets).toHaveLength(1);
    expect(data.tasks).toHaveLength(1);
    expect(data.messageFavorites).toEqual(['fav-1']);
    expect(data.quizTeams).toHaveLength(6);
  });

  it('학년·반이 비어 있으면 도구함 것을 받는다', () => {
    const { data } = adoptToolkitData(createEmptySuiteData(), oldToolkit());

    expect(data.profile.grade).toBe('3');
    expect(data.profile.classNo).toBe('2');
  });

  it('학급 쪽 학교 정보는 덮어쓰지 않는다', () => {
    /*
     * 학교 이름은 양쪽에 있다. 학급 쪽이 더 오래 쓰였고 NEIS 코드처럼
     * 도구함에 없는 것도 함께 들어 있어 그쪽을 남긴다.
     */
    const base = {
      ...createEmptySuiteData(),
      profile: {
        schoolName: '학급 학교',
        teacherName: '임한솔',
        officeCode: 'B10',
        schoolCode: '7010084',
        grade: '5',
        classNo: '1',
      },
    };

    const { data } = adoptToolkitData(base, oldToolkit());

    expect(data.profile.schoolName).toBe('학급 학교');
    expect(data.profile.officeCode).toBe('B10');
    expect(data.profile.grade).toBe('5');
    expect(data.profile.classNo).toBe('1');
  });

  it('학급 자료는 건드리지 않는다', () => {
    const base = createEmptySuiteData();
    const { data } = adoptToolkitData(base, oldToolkit());

    expect(data.students).toBe(base.students);
    expect(data.classRooms).toBe(base.classRooms);
    expect(data.scoreEntries).toBe(base.scoreEntries);
  });

  it('도구함 자료가 없으면 아무것도 안 한다', () => {
    const base = createEmptySuiteData();

    expect(adoptToolkitData(base, null).data).toBe(base);
    expect(adoptToolkitData(base, null).adopted).toBe(false);
    expect(adoptToolkitData(base, 'ㅁㄴㅇㄹ').adopted).toBe(false);
    expect(adoptToolkitData(base, []).adopted).toBe(false);
  });

  it('빈 객체는 이어받을 것이 없다', () => {
    expect(adoptToolkitData(createEmptySuiteData(), {}).adopted).toBe(false);
  });

  it('일부만 있어도 있는 것만 가져온다', () => {
    const { data, adopted } = adoptToolkitData(createEmptySuiteData(), {
      tasks: [{ id: 't-1', title: '하나' }],
    });

    expect(adopted).toBe(true);
    expect(data.tasks).toHaveLength(1);
    expect(data.quizSets).toEqual([]);
  });
});
