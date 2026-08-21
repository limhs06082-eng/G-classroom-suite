import { useEffect, useState } from 'react';

import { getSessionRelay } from './QuizSessionRelay';
import type { QuizResponse } from './types';

/**
 * 세션 응답을 읽기만 하는 훅.
 *
 * 전자칠판이 쓴다. 칠판은 세션을 열거나 닫지 않고 현황만 본다.
 * 자동 채점은 교사 화면에서 한 번만 한다. 두 창이 같이 쓰면
 * 서로 알림을 주고받으며 돈다.
 */
export function useSessionResponses(code: string | null): QuizResponse[] {
  const relay = getSessionRelay();
  const [responses, setResponses] = useState<QuizResponse[]>([]);

  useEffect(() => {
    if (code === null || code === '') {
      setResponses([]);
      return;
    }
    return relay.watchResponses(code, setResponses);
  }, [relay, code]);

  return responses;
}
