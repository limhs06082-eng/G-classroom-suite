import { useEffect, useSyncExternalStore } from 'react';

import {
  isPeriodChimeOn,
  shouldChime,
  subscribePeriodChime,
  type ChimeMark,
} from '../../shared/fx/periodChime';
import { playChime } from '../../shared/fx/sound';
import type { NowState } from '../now/nowCore';

/*
 * 모듈 전역 표식. 홈의 '지금' 카드와 오늘 보드가 같이 떠 있어도(교사 화면 +
 * 학급 TV가 같은 창일 때) 같은 교시에 두 번 울리지 않는다.
 */
let lastMark: ChimeMark | null = null;

/** 시험용. */
export function resetPeriodChimeMark(): void {
  lastMark = null;
}

/** 수업이 곧 끝나면 종을 한 번. 설정이 켜져 있을 때만. */
export function usePeriodChime(state: NowState, today: string): void {
  const on = useSyncExternalStore(subscribePeriodChime, isPeriodChimeOn, isPeriodChimeOn);

  useEffect(() => {
    if (!on) return;
    const mark = shouldChime(state, today, lastMark);
    if (mark === null) return;
    lastMark = mark;
    playChime();
  }, [on, state, today]);
}
