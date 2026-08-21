import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createEmptySuiteData } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider, useSuite } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

/** 진행 중인 퀴즈가 있는 상태. 칠판이 문제를 넘긴 뒤를 흉내낸다. */
function withRun(questionIndex: number): SuiteData {
  return {
    ...createEmptySuiteData(),
    quizRun: {
      quizSetId: 'qs-1',
      questionIndex,
      correctTeamsByQuestion: {},
      manualTeamsByQuestion: {},
      sessionCode: null,
      revealed: false,
      teams: ['1모둠'],
      startedAt: '2026-08-13T00:00:00.000Z',
    },
  };
}

function renderProvider(adapter: ReturnType<typeof stubAdapter>) {
  const seen: { current: ReturnType<typeof useSuite> | null } = { current: null };

  function Probe() {
    seen.current = useSuite();
    return null;
  }

  render(
    <ToastProvider>
      <SuiteDataProvider adapter={adapter}>
        <Probe />
      </SuiteDataProvider>
    </ToastProvider>,
  );

  return seen;
}

/**
 * 모달이 열린 상태를 흉내낸다. 닫는 함수를 돌려준다.
 *
 * document.body.innerHTML을 비우면 testing-library가 만든 렌더 컨테이너까지
 * 함께 사라져 언마운트 때 React가 자기 노드를 찾지 못한다.
 * 내가 넣은 것만 정확히 뺀다.
 */
function openDialog(): () => void {
  const element = document.createElement('div');
  element.setAttribute('role', 'dialog');
  document.body.appendChild(element);
  return () => element.remove();
}

/** 밖에서 외부 변경을 밀어 넣을 수 있는 스텁 */
function pushableAdapter() {
  const box: { push: ((data: SuiteData) => void) | null } = { push: null };
  const adapter = stubAdapter({
    subscribe: (listener) => {
      box.push = listener;
      return () => {
        box.push = null;
      };
    },
  });
  return { adapter, box };
}

describe('SuiteDataProvider — 다른 창의 변경', () => {
  it('칠판이 넘긴 문제가 메인 창의 다음 저장에 되돌아가지 않는다', async () => {
    /*
     * 원래 버그다. 칠판에서 다음 문제로 넘긴 뒤 메인 창에서 문제 세트를
     * 하나 만들면, 메인 창의 낡은 사본이 문제 번호를 0으로 되돌렸다.
     */
    const { adapter, box } = pushableAdapter();
    const seen = renderProvider(adapter);

    /*
     * load()가 비동기다. 이걸 흘려보내지 않고 외부 변경을 밀어 넣으면
     * 뒤늦게 끝난 load가 그것을 덮어 테스트가 간헐적으로 실패한다.
     */
    await act(async () => {});
    expect(box.push).not.toBeNull();

    // 칠판이 2번 문제로 넘겼다
    act(() => box.push?.(withRun(1)));
    await waitFor(() => expect(seen.current?.data.quizRun?.questionIndex).toBe(1));

    // 메인 창에서 퀴즈와 무관한 작업을 한다
    act(() =>
      seen.current?.update((current) => ({
        ...current,
        messageFavorites: [...current.messageFavorites, 'm-1'],
      })),
    );

    expect(seen.current?.data.quizRun?.questionIndex).toBe(1);
    expect(seen.current?.data.messageFavorites).toEqual(['m-1']);
  });

  it('내 저장이 대기 중이면 다른 창의 변경을 무시한다', async () => {
    /*
     * 훅 테스트만으로는 부족하다. Provider가 shouldIgnore를 엉뚱하게 배선해도
     * 훅 테스트는 그대로 통과한다. 배선 자체를 여기서 확인한다.
     */
    const { adapter, box } = pushableAdapter();
    const seen = renderProvider(adapter);

    await act(async () => {});
    expect(box.push).not.toBeNull();

    // update가 저장 대기 상태를 만든다 (600ms 디바운스 안)
    act(() => seen.current?.update((current) => ({ ...current, messageFavorites: ['mine'] })));
    act(() => box.push?.(withRun(1)));

    expect(seen.current?.data.quizRun).toBeNull();
    expect(seen.current?.data.messageFavorites).toEqual(['mine']);
  });

  it('편집 중이면 미뤘다가 편집이 끝나면 반영한다', async () => {
    const closeDialog = openDialog();

    const { adapter, box } = pushableAdapter();
    const seen = renderProvider(adapter);

    await act(async () => {});
    expect(box.push).not.toBeNull();

    /*
     * 가짜 타이머는 여기서부터 켠다. 렌더·load보다 먼저 켜면
     * 프라미스와 타이머가 얽혀 무엇을 기다리는지 알기 어려워진다.
     */
    vi.useFakeTimers();
    try {
      act(() => box.push?.(withRun(1)));
      expect(seen.current?.data.quizRun).toBeNull();

      closeDialog();
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(seen.current?.data.quizRun?.questionIndex).toBe(1);
    } finally {
      vi.useRealTimers();
      closeDialog();
    }
  });
});
