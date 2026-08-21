import type { QuestionType } from '../../../shared/domain/types';

/**
 * 학생 응답 수집 세션의 자료형.
 *
 * 세션과 응답은 ToolkitData에 넣지 않는다. 학생이 쓰는 자료이고,
 * 수업이 끝나면 버리며, 백업 파일에 들어갈 이유가 없다.
 */

export type QuizSessionMode = 'teacher' | 'student';

/**
 * 학생에게 보내는 문제.
 *
 * **정답과 해설이 없다.** 학생이 세션 문서를 그대로 읽으므로
 * 정답이 같이 가면 주소창만으로 답이 보인다.
 */
export interface QuizSessionQuestion {
  id: string;
  type: QuestionType;
  text: string;
  choices: string[];
}

export interface QuizSessionInit {
  ownerKey: string;
  quizSetId: string;
  title: string;
  mode: QuizSessionMode;
  openQuestionIds: string[];
  questions: QuizSessionQuestion[];
  teams: string[];
  /** ISO. 이 시각이 지나면 청소 대상이다. */
  expiresAt: string;
}

/** 학생 화면이 보는 세션 상태 */
export interface QuizSessionView {
  code: string;
  title: string;
  mode: QuizSessionMode;
  openQuestionIds: string[];
  questions: QuizSessionQuestion[];
  teams: string[];
  open: boolean;
}

export interface QuizSessionPatch {
  openQuestionIds?: string[];
  teams?: string[];
  open?: boolean;
}

export interface QuizResponseInput {
  questionId: string;
  /** 모둠 이름이 아니라 순번. 이름은 교사가 바꿀 수 있다. */
  teamIndex: number;
  answer: string;
}

export interface QuizResponse extends QuizResponseInput {
  submittedAt: string;
}
