import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalSessionRelay } from '../../src/features/quiz/session/LocalSessionRelay';
import { MemorySessionRelay } from '../../src/features/quiz/session/MemorySessionRelay';
import type { QuizSessionRelay } from '../../src/features/quiz/session/QuizSessionRelay';
import type { QuizSessionInit } from '../../src/features/quiz/session/types';

const NOW = '2026-08-14T09:00:00.000Z';
const LATER = '2026-08-14T12:00:00.000Z';

function init(overrides: Partial<QuizSessionInit> = {}): QuizSessionInit {
  return {
    ownerKey: 'owner-1',
    quizSetId: 'qs-1',
    title: '퀴즈',
    mode: 'teacher',
    openQuestionIds: ['q1'],
    questions: [{ id: 'q1', type: 'ox', text: '문제', choices: [] }],
    teams: ['1모둠', '2모둠'],
    expiresAt: LATER,
    ...overrides,
  };
}

/** 두 구현이 같은 계약을 지켜야 한다. 같은 테스트를 둘 다에 돌린다. */
function contractTests(name: string, make: () => QuizSessionRelay) {
  describe(name, () => {
    it('세션을 열면 6자 코드를 돌려준다', async () => {
      const { code } = await make().open(init());

      expect(code).toMatch(/^[0-9A-Z]{6}$/);
    });

    it('연 세션을 학생 쪽에서 볼 수 있다', async () => {
      const relay = make();
      const { code } = await relay.open(init());

      const seen = vi.fn();
      relay.watchSession(code, seen);

      expect(seen).toHaveBeenCalled();
      expect(seen.mock.calls.at(-1)?.[0]).toMatchObject({ code, open: true, title: '퀴즈' });
    });

    it('제출한 답이 교사 쪽에 도착한다', async () => {
      const relay = make();
      const { code } = await relay.open(init());

      const seen = vi.fn();
      relay.watchResponses(code, seen);
      await relay.submit(code, { questionId: 'q1', teamIndex: 0, answer: 'O' });

      expect(seen.mock.calls.at(-1)?.[0]).toEqual([
        expect.objectContaining({ questionId: 'q1', teamIndex: 0, answer: 'O' }),
      ]);
    });

    it('같은 모둠이 다시 내면 마지막 답만 남는다', async () => {
      const relay = make();
      const { code } = await relay.open(init());

      await relay.submit(code, { questionId: 'q1', teamIndex: 0, answer: 'O' });
      await relay.submit(code, { questionId: 'q1', teamIndex: 0, answer: 'X' });

      const seen = vi.fn();
      relay.watchResponses(code, seen);

      const rows = seen.mock.calls.at(-1)?.[0] as Array<{ answer: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.answer).toBe('X');
    });

    it('닫힌 세션에는 제출할 수 없다', async () => {
      const relay = make();
      const { code } = await relay.open(init());
      await relay.update(code, { open: false });

      await expect(
        relay.submit(code, { questionId: 'q1', teamIndex: 0, answer: 'O' }),
      ).rejects.toThrow();
    });

    it('없는 코드를 보면 null이 온다', async () => {
      const relay = make();
      const seen = vi.fn();
      relay.watchSession('ZZZZZZ', seen);

      expect(seen).toHaveBeenCalledWith(null);
    });

    it('세션을 지우면 학생 쪽에 null이 온다', async () => {
      const relay = make();
      const { code } = await relay.open(init());

      const seen = vi.fn();
      relay.watchSession(code, seen);
      await relay.close(code);

      expect(seen.mock.calls.at(-1)?.[0]).toBeNull();
    });

    it('열린 문제를 바꾸면 학생 쪽이 따라온다', async () => {
      const relay = make();
      const { code } = await relay.open(init());

      const seen = vi.fn();
      relay.watchSession(code, seen);
      await relay.update(code, { openQuestionIds: ['q2'] });

      expect(seen.mock.calls.at(-1)?.[0]).toMatchObject({ openQuestionIds: ['q2'] });
    });

    it('해제하면 더는 오지 않는다', async () => {
      const relay = make();
      const { code } = await relay.open(init());

      const seen = vi.fn();
      const stop = relay.watchResponses(code, seen);
      const before = seen.mock.calls.length;

      stop();
      await relay.submit(code, { questionId: 'q1', teamIndex: 0, answer: 'O' });

      expect(seen.mock.calls.length).toBe(before);
    });

    it('만료된 내 세션만 지운다', async () => {
      const relay = make();
      const mine = await relay.open(init({ expiresAt: '2020-01-01T00:00:00.000Z' }));
      const alive = await relay.open(init());
      const other = await relay.open(
        init({ ownerKey: 'owner-2', expiresAt: '2020-01-01T00:00:00.000Z' }),
      );

      await relay.sweepExpired('owner-1');

      const check = (code: string): unknown => {
        const seen = vi.fn();
        const stop = relay.watchSession(code, seen);
        stop();
        return seen.mock.calls.at(-1)?.[0];
      };

      expect(check(mine.code)).toBeNull();
      expect(check(alive.code)).not.toBeNull();
      expect(check(other.code)).not.toBeNull();
    });
  });
}

contractTests('MemorySessionRelay', () => new MemorySessionRelay(() => NOW));

describe('LocalSessionRelay 고유', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('학생 폰은 받을 수 없다고 알린다', () => {
    expect(new LocalSessionRelay(window.localStorage, () => NOW).isAvailable).toBe(false);
  });
});

contractTests('LocalSessionRelay', () => {
  window.localStorage.clear();
  return new LocalSessionRelay(window.localStorage, () => NOW);
});
