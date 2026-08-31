import { describe, expect, it, vi } from 'vitest';

import {
  isMuted,
  playChime,
  playCoin,
  playDing,
  playFanfare,
  playPop,
  playTick,
  setMuted,
  subscribeMuted,
} from '../../src/shared/fx/sound';

describe('음소거 스토어', () => {
  it('기본은 소리 켬이고, 끄면 localStorage에 남는다', () => {
    setMuted(false);
    expect(isMuted()).toBe(false);

    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(window.localStorage.getItem('gboard:sound-muted')).toBe('1');

    setMuted(false);
  });

  it('바뀔 때 구독자에게 알린다', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMuted(listener);

    setMuted(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setMuted(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('효과음 — 오디오가 없는 환경', () => {
  it('jsdom(AudioContext 없음)에서 어떤 소리도 던지지 않는다', () => {
    // 소리가 나는지가 아니라 죽지 않는지를 본다. 오디오가 막힌 교실
    // 컴퓨터에서도 앱은 그대로 돌아야 한다.
    setMuted(false);
    expect(() => {
      playDing();
      playCoin();
      playPop();
      playTick();
      playFanfare();
      playChime();
    }).not.toThrow();
  });
});
