import type { NowState } from '../../features/now/nowCore';

/**
 * 교시 끝 알림음 — 기기 설정. 기본은 **꺼짐**.
 *
 * 학교 종이 이미 울리는 교실에서 소리가 겹치면 잡음이라, NowCard는 처음부터
 * 글자색으로만 알렸다. 소리를 원하는 교실도 있어 설정으로 둔다. 전체
 * 음소거(gboard:sound-muted)가 켜져 있으면 playChime 자체가 조용하다.
 */
export const PERIOD_CHIME_KEY = 'gboard:period-chime';

/** 이 분 이하로 남으면 울린다. NowCard의 "곧 끝남" 기준과 같다. */
export const CHIME_BEFORE_MINUTES = 5;

type Listener = () => void;
const listeners = new Set<Listener>();
let cached: boolean | null = null;

function readOn(): boolean {
  try {
    return window.localStorage.getItem(PERIOD_CHIME_KEY) === '1';
  } catch {
    return false;
  }
}

export function isPeriodChimeOn(): boolean {
  cached ??= readOn();
  return cached;
}

export function setPeriodChimeOn(next: boolean): void {
  cached = next;
  try {
    window.localStorage.setItem(PERIOD_CHIME_KEY, next ? '1' : '0');
  } catch {
    // 저장이 안 되는 환경이면 이 세션 동안만 유지된다.
  }
  for (const listener of listeners) listener();
}

export function subscribePeriodChime(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export interface ChimeMark {
  date: string;
  period: number;
}

/**
 * 울려야 하면 표식을 돌려주고, 아니면 null.
 *
 * 수업 중에 남은 분이 기준 이하로 들어선 첫 분에 한 번. 같은 날 같은 교시는
 * 다시 울리지 않는다 — 홈과 오늘 보드가 같이 떠 있어도 표식을 나눠 가지면
 * 한 번이다.
 */
export function shouldChime(
  state: NowState,
  today: string,
  last: ChimeMark | null,
  before: number = CHIME_BEFORE_MINUTES,
): ChimeMark | null {
  if (state.kind !== 'lesson') return null;
  if (state.minutesLeft > before) return null;
  if (last !== null && last.date === today && last.period === state.period) return null;
  return { date: today, period: state.period };
}
