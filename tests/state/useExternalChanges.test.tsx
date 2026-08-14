import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isEditing, useExternalChanges } from '../../src/shared/state/useExternalChanges';

/** subscribe만 갖춘 최소 어댑터. 밖에서 변경을 밀어 넣을 수 있다. */
function fakeAdapter() {
  let listener: ((data: string) => void) | null = null;
  return {
    subscribe(next: (data: string) => void) {
      listener = next;
      return () => {
        listener = null;
      };
    },
    push(value: string) {
      listener?.(value);
    },
    get isSubscribed() {
      return listener !== null;
    },
  };
}

function Harness(props: {
  adapter: ReturnType<typeof fakeAdapter>;
  shouldIgnore: () => boolean;
  onApply: (data: string) => void;
  onDefer: () => void;
}) {
  useExternalChanges(props.adapter, {
    shouldIgnore: props.shouldIgnore,
    onApply: props.onApply,
    onDefer: props.onDefer,
  });
  return null;
}

describe('isEditing', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('열린 모달이 있으면 편집 중', () => {
    document.body.innerHTML = '<div role="dialog"></div>';
    expect(isEditing()).toBe(true);
  });

  it('입력칸에 커서가 있으면 편집 중', () => {
    document.body.innerHTML = '<input id="a" />';
    document.querySelector<HTMLInputElement>('#a')?.focus();
    expect(isEditing()).toBe(true);
  });

  it('둘 다 아니면 편집 중이 아니다', () => {
    document.body.innerHTML = '<button id="b"></button>';
    document.querySelector<HTMLButtonElement>('#b')?.focus();
    expect(isEditing()).toBe(false);
  });
});

describe('useExternalChanges', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('평소에는 즉시 반영한다', () => {
    const adapter = fakeAdapter();
    const onApply = vi.fn();
    render(
      <Harness adapter={adapter} shouldIgnore={() => false} onApply={onApply} onDefer={vi.fn()} />,
    );

    act(() => adapter.push('새 값'));

    expect(onApply).toHaveBeenCalledWith('새 값');
  });

  it('내 저장이 대기 중이면 무시한다', () => {
    // 내 것이 곧 나가고, 상대는 그것을 구독으로 받는다. 상태는 갈라지지 않는다.
    const adapter = fakeAdapter();
    const onApply = vi.fn();
    render(
      <Harness adapter={adapter} shouldIgnore={() => true} onApply={onApply} onDefer={vi.fn()} />,
    );

    act(() => adapter.push('새 값'));

    expect(onApply).not.toHaveBeenCalled();
  });

  it('편집 중이면 보류하고 한 번 알린다', () => {
    document.body.innerHTML = '<div role="dialog"></div>';
    const adapter = fakeAdapter();
    const onApply = vi.fn();
    const onDefer = vi.fn();
    render(
      <Harness adapter={adapter} shouldIgnore={() => false} onApply={onApply} onDefer={onDefer} />,
    );

    act(() => adapter.push('새 값'));

    expect(onApply).not.toHaveBeenCalled();
    expect(onDefer).toHaveBeenCalledTimes(1);
  });

  it('편집이 끝나면 적용한다', () => {
    document.body.innerHTML = '<div role="dialog"></div>';
    const adapter = fakeAdapter();
    const onApply = vi.fn();
    render(
      <Harness adapter={adapter} shouldIgnore={() => false} onApply={onApply} onDefer={vi.fn()} />,
    );

    act(() => adapter.push('새 값'));
    expect(onApply).not.toHaveBeenCalled();

    // 모달을 닫는다. 포커스 변화 없이 닫힐 수 있으므로 주기 확인이 잡아야 한다.
    document.body.innerHTML = '';
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onApply).toHaveBeenCalledWith('새 값');
  });

  it('보류 중 또 오면 마지막 것만 적용하고 알림은 한 번뿐이다', () => {
    document.body.innerHTML = '<div role="dialog"></div>';
    const adapter = fakeAdapter();
    const onApply = vi.fn();
    const onDefer = vi.fn();
    render(
      <Harness adapter={adapter} shouldIgnore={() => false} onApply={onApply} onDefer={onDefer} />,
    );

    act(() => adapter.push('첫 번째'));
    act(() => adapter.push('두 번째'));

    document.body.innerHTML = '';
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith('두 번째');
    expect(onDefer).toHaveBeenCalledTimes(1);
  });

  it('언마운트하면 구독을 해제한다', () => {
    const adapter = fakeAdapter();
    const { unmount } = render(
      <Harness adapter={adapter} shouldIgnore={() => false} onApply={vi.fn()} onDefer={vi.fn()} />,
    );

    expect(adapter.isSubscribed).toBe(true);
    unmount();
    expect(adapter.isSubscribed).toBe(false);
  });
});
