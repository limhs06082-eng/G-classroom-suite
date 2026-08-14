import { useEffect, useRef } from 'react';

/**
 * 다른 창·기기의 변경을 언제 화면에 반영할지 정하는 훅.
 *
 * 기본은 즉시 반영이다. 칠판은 입력이 없으므로 항상 여기에 해당하고,
 * 수업 중 칠판이 따라오지 않으면 쓸모가 없다.
 * 다만 교사가 입력하는 중이면 글자가 사라지므로 미뤘다가 적용한다.
 *
 * 설계 근거: docs/superpowers/specs/2026-08-13-cross-window-sync-design.md §6
 */

/** 편집이 끝났는지 다시 보는 간격. 모달은 포커스 변화 없이 닫힐 수 있다. */
const RECHECK_MS = 400;

/** 열린 모달이 있거나 입력칸에 커서가 있으면 편집 중으로 본다. */
export function isEditing(): boolean {
  // Modal이 이미 role="dialog"를 달고 있어 컴포넌트를 고칠 필요가 없다.
  if (document.querySelector('[role="dialog"]') !== null) return true;

  const active = document.activeElement;
  if (active === null) return false;

  if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return true;

  /*
   * === true로 못 박는다. lib.dom은 isContentEditable을 boolean으로 적어 두지만
   * 그 속성을 구현하지 않는 환경(jsdom 등)에서는 undefined가 나온다.
   * 타입 정의는 명세를 기술하지, 지금 돌아가는 구현을 기술하지 않는다.
   */
  return active instanceof HTMLElement && active.isContentEditable === true;
}

interface Options<T> {
  /** 지금은 반영하지 않는다 (내 저장이 대기 중) */
  shouldIgnore: () => boolean;
  /** 화면에 반영한다 */
  onApply: (data: T) => void;
  /** 보류에 들어갔다. 교사에게 한 번 알린다. */
  onDefer: () => void;
}

interface Subscribable<T> {
  subscribe(listener: (data: T) => void): () => void;
}

export function useExternalChanges<T>(adapter: Subscribable<T>, options: Options<T>): void {
  /*
   * 콜백은 렌더마다 새로 만들어진다. 의존성에 넣으면 구독이 매 렌더 끊겼다 붙는다.
   * 최신 것을 ref로 들고, 효과는 어댑터에만 의존한다.
   */
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    /** 편집이 끝나면 적용할 값. 쌓지 않고 마지막 것만 남긴다. */
    let deferred: { value: T } | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    function tryApply(): void {
      if (deferred === null || isEditing()) return;

      const { value } = deferred;
      deferred = null;
      stopWaiting();
      optionsRef.current.onApply(value);
    }

    function stopWaiting(): void {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      document.removeEventListener('focusout', tryApply);
    }

    function startWaiting(): void {
      if (timer !== null) return;
      // focusout이 입력칸을 벗어나는 대부분을 잡고, 주기 확인이 모달 닫기를 잡는다.
      document.addEventListener('focusout', tryApply);
      timer = setInterval(tryApply, RECHECK_MS);
    }

    const unsubscribe = adapter.subscribe((data: T) => {
      if (optionsRef.current.shouldIgnore()) return;

      if (isEditing()) {
        const isFirst = deferred === null;
        deferred = { value: data };
        startWaiting();
        if (isFirst) optionsRef.current.onDefer();
        return;
      }

      optionsRef.current.onApply(data);
    });

    return () => {
      unsubscribe();
      stopWaiting();
    };
  }, [adapter]);
}
