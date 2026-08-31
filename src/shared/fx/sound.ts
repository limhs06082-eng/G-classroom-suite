/**
 * 효과음.
 *
 * 파일을 싣지 않고 **WebAudio로 그 자리에서 합성**한다. 오디오 파일은
 * 번들을 키우고 CSP·경로 문제를 부르는데, 교실 효과음은 짧은 합성음으로
 * 충분하다 — 스마트폰 알림음이 다 이렇게 만든 소리다.
 *
 * 원칙:
 * - **실패해도 조용하다.** 오디오가 없는 환경(jsdom, 정책으로 막힌
 *   webview)에서는 아무 일도 안 하고 앱은 그대로 돈다.
 * - **음소거가 우선한다.** 툴바의 스피커 단추 하나로 전부 꺼진다. 설정은
 *   테마처럼 이 기기의 취향이라 localStorage에 산다(백업에 안 들어간다).
 * - **지도(음수 점수)에는 소리를 붙이지 않는다.** 교실에서 학생을 향해
 *   울리는 부정적 효과음은 도구가 아니라 망신이다.
 */

const MUTE_KEY = 'gboard:sound-muted';

type Listener = () => void;
const listeners = new Set<Listener>();

let muted: boolean | null = null;

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  muted ??= readMuted();
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    window.localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    // 저장이 안 되는 환경이면 이 세션 동안만 유지된다.
  }
  for (const listener of listeners) listener();
}

/** 툴바 스피커 단추가 useSyncExternalStore로 쓴다. */
export function subscribeMuted(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ─────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (isMuted()) return null;
  try {
    ctx ??= new AudioContext();
    // 사용자 입력 전에 만들어졌으면 suspended일 수 있다. 소리는 전부
    // 클릭에서 시작되므로 여기서 깨우면 된다.
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface Note {
  /** Hz */
  freq: number;
  /** 시작 시점(초, 지금부터) */
  at: number;
  /** 길이(초) */
  duration: number;
  type?: OscillatorType;
  /** 0~1 */
  gain?: number;
}

function play(notes: Note[]): void {
  const context = audio();
  if (context === null) return;

  const now = context.currentTime;
  for (const note of notes) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = note.type ?? 'sine';
    osc.frequency.setValueAtTime(note.freq, now + note.at);

    const peak = note.gain ?? 0.12;
    gain.gain.setValueAtTime(0, now + note.at);
    // 딱 소리(클릭 노이즈)가 안 나게 아주 짧게 올렸다가 지수로 줄인다.
    gain.gain.linearRampToValueAtTime(peak, now + note.at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + note.at + note.duration);

    osc.connect(gain).connect(context.destination);
    osc.start(now + note.at);
    osc.stop(now + note.at + note.duration + 0.05);
  }
}

/** 점수 줄 때. 짧고 밝은 한 음. */
export function playDing(): void {
  play([{ freq: 1318.5 /* E6 */, at: 0, duration: 0.18 }]);
}

/** 쿠폰 쓸 때. 동전 두 닢. */
export function playCoin(): void {
  play([
    { freq: 987.8 /* B5 */, at: 0, duration: 0.08, type: 'square', gain: 0.06 },
    { freq: 1318.5 /* E6 */, at: 0.08, duration: 0.22, type: 'square', gain: 0.06 },
  ]);
}

/** 완료 체크. 낮고 짧은 팝. */
export function playPop(): void {
  play([{ freq: 523.3 /* C5 */, at: 0, duration: 0.1, type: 'triangle', gain: 0.1 }]);
}

/** 뽑기 룰렛이 도는 동안의 째깍. 돌 때마다 한 번씩 부른다. */
export function playTick(): void {
  play([{ freq: 2200, at: 0, duration: 0.03, type: 'square', gain: 0.03 }]);
}

/** 뽑기 결과·목표 달성. 올라가는 세 음 + 화음. */
export function playFanfare(): void {
  play([
    { freq: 523.3 /* C5 */, at: 0, duration: 0.15, type: 'triangle' },
    { freq: 659.3 /* E5 */, at: 0.12, duration: 0.15, type: 'triangle' },
    { freq: 784.0 /* G5 */, at: 0.24, duration: 0.15, type: 'triangle' },
    { freq: 1046.5 /* C6 */, at: 0.36, duration: 0.45, type: 'triangle', gain: 0.14 },
    { freq: 1318.5 /* E6 */, at: 0.36, duration: 0.45, type: 'triangle', gain: 0.08 },
  ]);
}

/** 타이머 종료. 종 두 번 — 길게 울리되 크지 않게. */
export function playChime(): void {
  play([
    { freq: 1046.5 /* C6 */, at: 0, duration: 0.9, gain: 0.1 },
    { freq: 1568.0 /* G6 */, at: 0.35, duration: 1.1, gain: 0.08 },
  ]);
}
