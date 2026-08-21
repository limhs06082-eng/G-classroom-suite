import type { SuiteData } from '../domain/types';

/**
 * 두 앱으로 나뉘어 있던 시절의 자료를 이어받는다.
 *
 * 예전에는 `학급 운영`과 `수업·업무 도구함`이 각자 배포되고 각자 브라우저
 * 저장소를 썼다. 합치면서 저장소 키가 하나가 됐는데, 그전에 쓰던 교사의
 * 자료가 두 열쇠에 나뉘어 남아 있다.
 *
 * **덮어쓰지 않는다.** 새 열쇠에 이미 자료가 있으면 아무것도 하지 않는다.
 * 이어받기는 처음 한 번, 새 자료가 없을 때만 일어난다.
 */

/** 나뉘어 있던 시절의 저장소 키. */
export const SPLIT_APP_KEYS = {
  suite: 'classroom-suite:v1:data',
  toolkit: 'teacher-toolkit:v1:data',
} as const;

/** 도구함에서 온 몫. 학급에 매이지 않아 학급 자료와 겹치지 않는다. */
const TOOLKIT_FIELDS = [
  'lessonTemplates',
  'lessonRun',
  'quizSets',
  'quizResults',
  'quizRun',
  'tasks',
  'messageTemplates',
  'messageFavorites',
  'messageHidden',
  'quizTeams',
] as const;

export interface AdoptResult {
  data: SuiteData;
  /** 도구함 쪽에서 실제로 가져온 것이 있었는가 */
  adopted: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 도구함 자료를 학급 자료 위에 얹는다.
 *
 * 학급 쪽 필드는 건드리지 않는다. 도구함에는 없던 것들이다.
 * 학교 이름처럼 양쪽에 있는 값은 **학급 쪽을 남긴다** — 그쪽이 더 오래
 * 쓰였고 NEIS 코드처럼 도구함에 없는 것도 함께 들어 있다.
 */
export function adoptToolkitData(base: SuiteData, toolkitRaw: unknown): AdoptResult {
  if (!isRecord(toolkitRaw)) return { data: base, adopted: false };

  const picked: Record<string, unknown> = {};
  for (const field of TOOLKIT_FIELDS) {
    if (field in toolkitRaw) picked[field] = toolkitRaw[field];
  }

  // 학년·반은 도구함에만 있던 값이라 비어 있을 때만 받는다.
  const profile = isRecord(toolkitRaw['profile']) ? toolkitRaw['profile'] : {};
  const grade = typeof profile['grade'] === 'string' ? profile['grade'] : '';
  const classNo = typeof profile['classNo'] === 'string' ? profile['classNo'] : '';

  const nextProfile = {
    ...base.profile,
    grade: base.profile.grade === '' ? grade : base.profile.grade,
    classNo: base.profile.classNo === '' ? classNo : base.profile.classNo,
  };

  const changedProfile =
    nextProfile.grade !== base.profile.grade || nextProfile.classNo !== base.profile.classNo;

  if (Object.keys(picked).length === 0 && !changedProfile) {
    return { data: base, adopted: false };
  }

  // 여기서 나온 값은 아직 날것이다. 부르는 쪽이 parseSuiteData에 넘겨 다듬는다.
  return {
    data: { ...base, ...picked, profile: nextProfile } as SuiteData,
    adopted: true,
  };
}
