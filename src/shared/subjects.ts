/**
 * 과목.
 *
 * `LessonTemplate.subject`와 `QuizSet.subject`가 쓴다. legacyImport가 원본에서
 * 이 값을 가져오는데 오랫동안 보여 주는 곳이 없었다.
 *
 * 목록은 고르기를 돕는 것이지 가두는 것이 아니다. 방과후·동아리·상담처럼
 * 교과가 아닌 것도 교사가 직접 칠 수 있어야 한다.
 */

/** 초등 교과. datalist에 넣어 고르기를 돕는다. */
export const COMMON_SUBJECTS: readonly string[] = [
  '국어',
  '수학',
  '사회',
  '과학',
  '영어',
  '체육',
  '음악',
  '미술',
  '실과',
  '도덕',
  '창체',
] as const;

export const MAX_SUBJECT_LENGTH = 12;

/**
 * 저장하기 직전에 다듬는다.
 *
 * **빈 값을 막지 않는다.** 과목이 없는 수업 흐름(학급 회의, 상담 주간)이 정상이다.
 * 이름과 규칙이 다르다 — 이름은 비면 안 고치고, 과목은 비우면 지운다.
 */
export function normalizeSubject(value: string): string {
  return value.trim().slice(0, MAX_SUBJECT_LENGTH);
}
