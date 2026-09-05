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
 * 모듈 전역 표식. 같은 창에서 같은 교시에 두 번 울리지 않는다. 칠판 창은 딴
 * 창(딴 모듈)이라 이 표식을 못 나눈다 — 그래서 알림음은 셸(PeriodChime) 하나에만 둔다.
 */
let lastMark: ChimeMark | null = null;

/**
 * 손 한 번 안 댄 창의 오디오는 브라우저가 멈춰 둔다. 그 상태에서 소리를
 * 쌓아 두면 나중에 한꺼번에 터진다. 그런 창에서는 울리지 않는다.
 */
function audioAllowed(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return activation === undefined || activation.hasBeenActive;
}

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
    if (audioAllowed()) playChime();
  }, [on, state, today]);
}
