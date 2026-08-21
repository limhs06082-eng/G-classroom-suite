import { LocalSessionRelay } from './LocalSessionRelay';
import type {
  QuizResponse,
  QuizResponseInput,
  QuizSessionInit,
  QuizSessionPatch,
  QuizSessionView,
} from './types';

export type {
  QuizResponse,
  QuizResponseInput,
  QuizSessionInit,
  QuizSessionPatch,
  QuizSessionView,
} from './types';

/**
 * 학생 응답 통로.
 *
 * StorageAdapter와 나란한 두 번째 이음매다.
 * 이것이 있는 이유는 Firebase를 붙일 때 화면 코드를 고치지 않기 위해서다.
 *
 * 설계 근거: docs/superpowers/specs/2026-08-14-quiz-live-responses-design.md §3
 */
export interface QuizSessionRelay {
  /** 학생 폰이 들어올 수 있는가. false면 화면이 안내로 바뀐다. */
  readonly isAvailable: boolean;

  open(init: QuizSessionInit): Promise<{ code: string }>;
  update(code: string, patch: QuizSessionPatch): Promise<void>;
  close(code: string): Promise<void>;
  /** 만료된 내 세션을 지운다. Cloud Functions를 못 쓰므로 청소는 여기서 한다. */
  sweepExpired(ownerKey: string): Promise<void>;

  /** 교사 화면용. 해제 함수를 돌려준다. */
  watchResponses(code: string, listener: (rows: QuizResponse[]) => void): () => void;
  /** 학생 화면용. 세션이 없어졌으면 null. */
  watchSession(code: string, listener: (view: QuizSessionView | null) => void): () => void;
  submit(code: string, input: QuizResponseInput): Promise<void>;
}

/*
 * 교체 지점.
 *
 * Firebase를 붙일 때 AI 스튜디오 에이전트가 고칠 곳은 여기 한 곳이다.
 * ToolkitDataProvider처럼 props로 주입하지 않는 이유는 학생 화면(/join)이
 * 그 공급자 바깥에 있기 때문이다.
 */
let current: QuizSessionRelay | null = null;

export function getSessionRelay(): QuizSessionRelay {
  current ??= new LocalSessionRelay();
  return current;
}

export function setSessionRelay(relay: QuizSessionRelay): void {
  current = relay;
}
