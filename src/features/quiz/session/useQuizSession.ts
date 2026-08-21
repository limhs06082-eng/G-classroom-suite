import { useCallback, useEffect, useRef, useState } from 'react';

import type { QuizSet } from '../../../shared/domain/types';
import { getSessionRelay } from './QuizSessionRelay';
import { openQuestionIdsFor, toSessionQuestions } from './sessionCore';
import type { QuizResponse, QuizSessionMode, QuizSessionView } from './types';

/**
 * 교사 쪽 세션 상태.
 *
 * 세션 코드는 이 훅 안에만 산다. ToolkitData에 넣지 않는다.
 * 새로고침하면 세션이 끊기지만, 임시 통로라 그래도 된다.
 */

/** 세 시간. 수업 한 차시를 훨씬 넘고, 잊고 닫아도 오래 남지 않는다. */
const SESSION_HOURS = 3;

export interface StartOptions {
  set: QuizSet;
  mode: QuizSessionMode;
  questionIndex: number;
  teams: string[];
}

export interface QuizSessionState {
  isAvailable: boolean;
  code: string | null;
  session: QuizSessionView | null;
  responses: QuizResponse[];
  start: (options: StartOptions) => Promise<void>;
  stop: () => Promise<void>;
  /** 교사가 문제를 넘기면 부른다. 학생 주도 모드에서는 아무 일도 하지 않는다. */
  syncOpenQuestions: (set: QuizSet, questionIndex: number) => Promise<void>;
}

/** 이 브라우저를 가리키는 고정 id. 만료 청소가 남의 세션을 지우지 않게 한다. */
function ownerKey(): string {
  const key = 'teacher-toolkit:v1:session-owner';
  try {
    const saved = window.localStorage.getItem(key);
    if (saved !== null && saved !== '') return saved;
    const made = `owner-${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(key, made);
    return made;
  } catch {
    return 'owner-local';
  }
}

export function useQuizSession(): QuizSessionState {
  const relay = getSessionRelay();

  const [code, setCode] = useState<string | null>(null);
  const [session, setSession] = useState<QuizSessionView | null>(null);
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const modeRef = useRef<QuizSessionMode>('teacher');

  // 앱을 열 때 만료된 내 세션을 지운다. Cloud Functions를 못 쓴다.
  useEffect(() => {
    void relay.sweepExpired(ownerKey());
  }, [relay]);

  useEffect(() => {
    if (code === null) return;

    const stopSession = relay.watchSession(code, setSession);
    const stopResponses = relay.watchResponses(code, setResponses);
    return () => {
      stopSession();
      stopResponses();
    };
  }, [relay, code]);

  const start = useCallback(
    async ({ set, mode, questionIndex, teams }: StartOptions): Promise<void> => {
      modeRef.current = mode;

      const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
      const { code: made } = await relay.open({
        ownerKey: ownerKey(),
        quizSetId: set.id,
        title: set.title,
        mode,
        openQuestionIds: openQuestionIdsFor(set, mode, questionIndex),
        questions: toSessionQuestions(set),
        teams,
        expiresAt,
      });

      setCode(made);
    },
    [relay],
  );

  const stop = useCallback(async (): Promise<void> => {
    if (code !== null) await relay.close(code);
    setCode(null);
    setSession(null);
    setResponses([]);
  }, [relay, code]);

  const syncOpenQuestions = useCallback(
    async (set: QuizSet, questionIndex: number): Promise<void> => {
      if (code === null || modeRef.current === 'student') return;
      await relay.update(code, {
        openQuestionIds: openQuestionIdsFor(set, 'teacher', questionIndex),
      });
    },
    [relay, code],
  );

  return {
    isAvailable: relay.isAvailable,
    code,
    session,
    responses,
    start,
    stop,
    syncOpenQuestions,
  };
}
