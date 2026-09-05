import { useEffect } from 'react';

/** 글자를 받는 곳이면 `?`는 글자다. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

/**
 * `?`(Shift+/)로 단축키 도움을 연다.
 *
 * 입력칸 안, 한글 조합 중, 다른 대화상자가 열려 있을 때는 아무 일도 안 한다 —
 * 알림장에 "준비물?"을 치다가 도움창이 튀어나오면 단축키가 아니라 방해다.
 */
export function useHelpKey(onOpen: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return undefined;

    const handleKey = (event: KeyboardEvent): void => {
      if (event.key !== '?' || event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target) || document.querySelector('[role="dialog"]') !== null) return;
      event.preventDefault();
      onOpen();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onOpen, enabled]);
}
