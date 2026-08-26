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

/**
 * 1~2학년 교과.
 *
 * 통합교과(바른 생활·슬기로운 생활·즐거운 생활)가 사회·과학·영어·체육·
 * 음악·미술 자리를 대신한다. 저학년 담임에게 `사회`·`실과` 단추를 내미는 것은
 * 도움이 아니라 잡음이다.
 */
const LOWER_SUBJECTS: readonly string[] = [
  '국어',
  '수학',
  '바른생활',
  '슬기로운생활',
  '즐거운생활',
  '창체',
] as const;

/** 3~4학년 교과. 도덕이 여기서 시작하고 실과는 아직 없다. */
const MIDDLE_SUBJECTS: readonly string[] = [
  '국어',
  '수학',
  '사회',
  '과학',
  '영어',
  '체육',
  '음악',
  '미술',
  '도덕',
  '창체',
] as const;

/**
 * 학년에 맞는 교과.
 *
 * 학급을 만들 때 받은 학년을 그대로 쓴다. 모르면(학년을 안 적었으면)
 * 고학년 목록을 준다 — `COMMON_SUBJECTS`가 그것이고, 이 기능이 생기기 전
 * 모든 학급이 보던 목록이다. 바뀌는 것이 없어야 안전한 쪽이다.
 *
 * **가두지 않는다.** 학교마다 다른 과목이 있고(방과후, 스포츠클럽,
 * 원어민 영어), 그건 직접 입력해 단추로 만든다.
 */
export function subjectsForGrade(grade: number | undefined): readonly string[] {
  if (grade === 1 || grade === 2) return LOWER_SUBJECTS;
  if (grade === 3 || grade === 4) return MIDDLE_SUBJECTS;
  return COMMON_SUBJECTS;
}

/** 과목 색 눈금의 개수. `index.css`의 `--color-subject-1..12`와 짝이다. */
export const SUBJECT_TINT_COUNT = 12;

/**
 * 과목마다 정해 둔 색 번호.
 *
 * 한 학년에서 함께 쓰이는 과목끼리는 반드시 달라야 하지만, **함께 쓰이지
 * 않는 것끼리는 겹쳐도 된다.** 바른생활(저학년)과 도덕(중·고학년)이 같은
 * 3번인 까닭이 그것이다 — 한 표에 같이 놓일 일이 없다. 그렇게 아껴서 열둘로
 * 열넷을 덮는다. 색을 더 늘리면 그만큼 서로 비슷해져 찾기가 되려 어려워진다.
 */
const SUBJECT_TINT: Record<string, number> = {
  국어: 1,
  수학: 2,
  바른생활: 3,
  도덕: 3,
  슬기로운생활: 4,
  실과: 4,
  즐거운생활: 5,
  사회: 6,
  과학: 7,
  영어: 8,
  체육: 9,
  음악: 10,
  미술: 11,
  창체: 12,
};

/**
 * 이 과목을 칠할 색 번호(1~12).
 *
 * 목록에 없는 과목은 글자에서 뽑는다. 뽑는 값이 늘 같아야 한다 — 앱을 껐다
 * 켤 때마다 '스포츠클럽'의 색이 바뀌면 색으로 찾는다는 것 자체가 무너진다.
 * 그래서 무작위도, 순서 번호도 아닌 **글자 자체**에서 뽑는다.
 */
export function subjectTint(subject: string): number {
  const fixed = SUBJECT_TINT[subject];
  if (fixed !== undefined) return fixed;

  let sum = 0;
  for (const ch of subject) sum += ch.codePointAt(0) ?? 0;
  return (sum % SUBJECT_TINT_COUNT) + 1;
}
