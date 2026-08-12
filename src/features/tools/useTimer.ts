import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 타이머·스톱워치.
 *
 * 원본 dashboard는 setInterval로 남은 초를 직접 깎았다. 탭이 백그라운드로
 * 가면 브라우저가 타이머를 늦추기 때문에 수업 시간이 실제보다 길게 남는다.
 * 여기서는 **끝날 시각을 기억하고 현재 시각과의 차이를 매번 계산**한다.
 * 화면을 잠시 가려 두어도 시간이 정확하다.
 */

export type TimerState = 'idle' | 'running' | 'paused' | 'finished';

export interface Timer {
  state: TimerState;
  /** 남은 밀리초 */
  remainingMs: number;
  totalMs: number;
  start: (durationMs: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  addTime: (deltaMs: number) => void;
}

const TICK_MS = 200;

export function useTimer(onFinish?: () => void): Timer {
  const [state, setState] = useState<TimerState>('idle');
  const [totalMs, setTotalMs] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);

  /** 끝날 시각(에폭 ms). 실행 중일 때만 의미가 있다. */
  const endAtRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    if (state !== 'running') return;

    const tick = (): void => {
      const endAt = endAtRef.current;
      if (endAt === null) return;

      const left = Math.max(0, endAt - Date.now());
      setRemainingMs(left);

      if (left === 0) {
        setState('finished');
        endAtRef.current = null;
        finishRef.current?.();
      }
    };

    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [state]);

  const start = useCallback((durationMs: number): void => {
    setTotalMs(durationMs);
    setRemainingMs(durationMs);
    endAtRef.current = Date.now() + durationMs;
    setState('running');
  }, []);

  const pause = useCallback((): void => {
    const endAt = endAtRef.current;
    if (endAt === null) return;

    setRemainingMs(Math.max(0, endAt - Date.now()));
    endAtRef.current = null;
    setState('paused');
  }, []);

  const resume = useCallback((): void => {
    setState((current) => {
      if (current !== 'paused') return current;
      endAtRef.current = Date.now() + remainingMs;
      return 'running';
    });
  }, [remainingMs]);

  const reset = useCallback((): void => {
    endAtRef.current = null;
    setRemainingMs(0);
    setTotalMs(0);
    setState('idle');
  }, []);

  /** 진행 중에 시간을 더하거나 뺀다. 활동이 길어질 때 자주 쓴다. */
  const addTime = useCallback((deltaMs: number): void => {
    setTotalMs((current) => Math.max(0, current + deltaMs));

    const endAt = endAtRef.current;
    if (endAt === null) {
      setRemainingMs((current) => Math.max(0, current + deltaMs));
      return;
    }

    endAtRef.current = Math.max(Date.now(), endAt + deltaMs);
    setRemainingMs(Math.max(0, endAtRef.current - Date.now()));
    setState((current) => (current === 'finished' && deltaMs > 0 ? 'running' : current));
  }, []);

  return { state, remainingMs, totalMs, start, pause, resume, reset, addTime };
}

/** 밀리초를 분:초로. 한 시간이 넘으면 시:분:초. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (value: number): string => String(value).padStart(2, '0');

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
