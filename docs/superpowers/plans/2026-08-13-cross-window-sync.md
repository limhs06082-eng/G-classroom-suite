# 창·기기 간 동기화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 칠판 창과 메인 창(나아가 여러 기기)이 서로의 변경을 즉시 받아, 낡은 사본으로 상대 변경을 덮어쓰는 일이 없게 한다.

**Architecture:** `StorageAdapter`에 `subscribe(listener)` 하나를 더한다. `LocalStorageAdapter`는 브라우저 `storage` 이벤트로 구현하고(자기 탭에는 오지 않으므로 자기 쓰기를 거를 필요가 없다), Provider가 구독을 걸어 외부 변경을 화면에 반영한다. feature 코드는 바뀌지 않는다. 나중에 `FirestoreAdapter`는 같은 메서드를 `onSnapshot`으로 채우면 된다.

**Tech Stack:** TypeScript 5.8 (`strict`, `noUncheckedIndexedAccess`), React 19, Vitest + jsdom + @testing-library/react

**설계 문서:** [`../specs/2026-08-13-cross-window-sync-design.md`](../specs/2026-08-13-cross-window-sync-design.md)

## Global Constraints

- 두 저장소에 같은 변경이 들어간다. `G-classroom-suite`가 먼저, `G-teacher-toolkit`이 그 다음이다. `shared/storage`와 `shared/ui`는 복사본이라 양쪽을 함께 손봐야 한다.
- **기능 코드는 localStorage를 직접 부르지 않는다.** 전부 어댑터를 거친다.
- **필수 환경변수를 만들지 않는다.** fork 직후 설정 없이 배포·동작해야 한다.
- 저장소의 내용은 신뢰하지 않는다. 다른 창이 보낸 값도 기존 파서로 검증한다.
- 각 태스크는 해당 저장소에서 `npm run verify`(타입 검사 → 테스트 → 빌드)를 통과해야 커밋한다.
- 타입 이름만 다르다: suite는 `SuiteData`, toolkit은 `ToolkitData`.

## File Structure

| 파일 | 책임 | 저장소 |
|---|---|---|
| `src/shared/storage/StorageAdapter.ts` | 인터페이스에 `subscribe` 추가 | 둘 다 (수정) |
| `src/shared/storage/LocalStorageAdapter.ts` | `storage` 이벤트로 구현 | 둘 다 (수정) |
| `src/shared/state/useExternalChanges.ts` | 편집 중 판정 + 보류 정책 | 둘 다 (신규) |
| Provider | 구독을 걸고 화면에 반영 | suite `src/shared/roster/SuiteDataProvider.tsx`, toolkit `src/shared/state/ToolkitDataProvider.tsx` (수정) |
| `tests/helpers/stubAdapter.ts` | 새 메서드 채우기 | 둘 다 (수정) |
| `docs/firebase-guide.md` | 잘못된 절 교체 | suite (수정) |

`useExternalChanges.ts`를 따로 두는 이유: Provider는 이미 200줄이 넘고 저장·디바운스·복구를 담당한다. 보류 정책까지 넣으면 한 파일이 두 가지 일을 하게 된다. 훅으로 떼면 정책만 따로 테스트할 수 있다.

**suite에도 `src/shared/state/` 디렉터리를 새로 만든다.** Provider가 `roster/`에 있는 것은 1단계의 흔적이고, 이 훅은 명단과 무관하다. Provider를 옮기는 것은 이 작업의 범위가 아니므로 훅만 제자리에 둔다.

---

## Task 1: suite — 어댑터에 구독 추가

**Files:**
- Modify: `src/shared/storage/StorageAdapter.ts`
- Modify: `src/shared/storage/LocalStorageAdapter.ts`
- Modify: `tests/helpers/stubAdapter.ts`
- Create: `tests/storage/subscribe.test.ts`

**Interfaces:**
- Consumes: `parseSuiteData(raw, now) => { data: SuiteData; repairs: RepairLog[] }` (`src/shared/storage/schema.ts`), `STORAGE_KEYS.data` (`'classroom-suite:v1:data'`)
- Produces: `StorageAdapter.subscribe(listener: (data: SuiteData) => void): () => void`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `tests/storage/subscribe.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmptySuiteData } from '../../src/shared/domain/factories';
import { LocalStorageAdapter, STORAGE_KEYS } from '../../src/shared/storage/LocalStorageAdapter';
import { serializeSuiteData } from '../../src/shared/storage/schema';

/** jsdom은 localStorage 쓰기에 storage 이벤트를 쏘지 않는다. 직접 만든다. */
function fireStorage(key: string | null, newValue: string | null): void {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
}

describe('LocalStorageAdapter.subscribe', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('다른 탭의 저장을 파싱해서 전달한다', () => {
    const adapter = new LocalStorageAdapter();
    const listener = vi.fn();
    adapter.subscribe(listener);

    fireStorage(STORAGE_KEYS.data, serializeSuiteData(createEmptySuiteData()));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ students: [] });
  });

  it('데이터 키가 아니면 부르지 않는다', () => {
    // 백업·메타가 바뀔 때 화면을 갈아 끼울 이유가 없다.
    const adapter = new LocalStorageAdapter();
    const listener = vi.fn();
    adapter.subscribe(listener);

    fireStorage(STORAGE_KEYS.backups, '[]');
    fireStorage(STORAGE_KEYS.meta, '{}');

    expect(listener).not.toHaveBeenCalled();
  });

  it('깨진 JSON이면 부르지 않는다', () => {
    // 멀쩡한 화면을 망가진 데이터로 덮지 않는다.
    const adapter = new LocalStorageAdapter();
    const listener = vi.fn();
    adapter.subscribe(listener);

    fireStorage(STORAGE_KEYS.data, '{잘린 json');

    expect(listener).not.toHaveBeenCalled();
  });

  it('키가 지워졌으면 부르지 않는다', () => {
    // 전체 초기화한 창이 스스로 새로고침한다. 이쪽까지 빈 화면으로 만들지 않는다.
    const adapter = new LocalStorageAdapter();
    const listener = vi.fn();
    adapter.subscribe(listener);

    fireStorage(STORAGE_KEYS.data, null);

    expect(listener).not.toHaveBeenCalled();
  });

  it('해제하면 더는 오지 않는다', () => {
    const adapter = new LocalStorageAdapter();
    const listener = vi.fn();
    const unsubscribe = adapter.subscribe(listener);

    unsubscribe();
    fireStorage(STORAGE_KEYS.data, serializeSuiteData(createEmptySuiteData()));

    expect(listener).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/storage/subscribe.test.ts`
Expected: FAIL — `adapter.subscribe is not a function`

- [ ] **Step 3: 인터페이스에 메서드를 더한다**

`src/shared/storage/StorageAdapter.ts`의 `getLastExportedAt` 선언 바로 아래에 추가:

```ts
  /**
   * 다른 창·기기가 자료를 바꾸면 부른다. 해제 함수를 돌려준다.
   *
   * 칠판은 target="_blank"로 별도 앱 인스턴스로 뜬다. 이 통로가 없으면
   * 각 창이 자기 메모리 사본을 들고 문서 전체를 통째로 덮어써서,
   * 서로 다른 곳을 고쳐도 한쪽이 조용히 사라진다.
   *
   * FirestoreAdapter는 이것을 onSnapshot으로 채운다.
   * 설계 근거: docs/superpowers/specs/2026-08-13-cross-window-sync-design.md
   */
  subscribe(listener: (data: SuiteData) => void): () => void;
```

- [ ] **Step 4: LocalStorageAdapter에 구현한다**

`src/shared/storage/LocalStorageAdapter.ts`의 클래스 안, `getLastExportedAt` 메서드 아래에 추가:

```ts
  /**
   * 다른 탭의 저장을 받는다.
   *
   * storage 이벤트는 자기 탭에서는 발생하지 않는다.
   * 그래서 "내가 쓴 것을 내가 다시 받는" 문제를 따로 거를 필요가 없다.
   */
  subscribe(listener: (data: SuiteData) => void): () => void {
    const handle = (event: StorageEvent): void => {
      // 데이터 키만 본다. 백업·메타가 바뀔 때 화면을 갈아 끼울 이유가 없다.
      if (event.key !== STORAGE_KEYS.data) return;

      // 다른 창이 키를 지웠다(전체 초기화). 그 창이 스스로 새로고침하므로
      // 이쪽 창까지 빈 화면으로 만들지 않는다.
      if (event.newValue === null) return;

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(event.newValue);
      } catch {
        // 멀쩡한 화면을 망가진 데이터로 덮지 않는다.
        return;
      }

      /*
       * 고친 내용(repairs)은 알리지 않는다. 저장한 쪽에서 이미 겪고 알린 것이고,
       * 같은 안내를 창마다 띄우면 소음이 된다.
       */
      listener(parseSuiteData(parsedJson, this.clock()).data);
    };

    window.addEventListener('storage', handle);
    return () => window.removeEventListener('storage', handle);
  }
```

- [ ] **Step 5: 테스트 스텁을 채운다**

`tests/helpers/stubAdapter.ts`의 `getLastExportedAt` 줄 아래에 추가:

```ts
    subscribe: () => () => {},
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npm run verify`
Expected: 타입 검사 0건, 기존 테스트 전부 + 새 5개 통과, 빌드 성공

- [ ] **Step 7: 커밋**

```bash
git add src/shared/storage/StorageAdapter.ts src/shared/storage/LocalStorageAdapter.ts tests/helpers/stubAdapter.ts tests/storage/subscribe.test.ts
git commit -m "feat(storage): 어댑터에 다른 창·기기 변경 구독 추가"
```

---

## Task 2: suite — 편집 중 판정과 보류 정책

**Files:**
- Create: `src/shared/state/useExternalChanges.ts`
- Create: `tests/state/useExternalChanges.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `subscribe(listener) => () => void`
- Produces:
  - `isEditing(): boolean`
  - `useExternalChanges<T>(adapter: { subscribe(l: (data: T) => void): () => void }, options: { shouldIgnore: () => boolean; onApply: (data: T) => void; onDefer: () => void }): void`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `tests/state/useExternalChanges.test.tsx`:

```tsx
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
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/state/useExternalChanges.test.tsx`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 훅을 만든다**

Create `src/shared/state/useExternalChanges.ts`:

```ts
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
  return active instanceof HTMLElement && active.isContentEditable;
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
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm run verify`
Expected: 타입 검사 0건, 새 테스트 10개 포함 전부 통과, 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add src/shared/state/useExternalChanges.ts tests/state/useExternalChanges.test.tsx
git commit -m "feat(state): 외부 변경 반영 정책 훅"
```

---

## Task 3: suite — Provider 연결과 회귀 테스트

**Files:**
- Modify: `src/shared/roster/SuiteDataProvider.tsx`
- Modify: `tests/roster/SuiteDataProvider.test.tsx`
- Modify: `docs/firebase-guide.md`

**Interfaces:**
- Consumes: Task 1 `adapter.subscribe`, Task 2 `useExternalChanges`
- Produces: 없음 (화면 동작만 바뀐다)

- [ ] **Step 1: 실패하는 회귀 테스트를 쓴다**

`tests/roster/SuiteDataProvider.test.tsx` 끝에 추가한다.

기존 파일은 컨텍스트 값을 화면에 그려 `screen`으로 읽는 `Harness` 방식을 쓴다.
여기서는 `update`를 직접 불러야 하므로 컨텍스트 값을 그대로 잡아 두는 탐침을 따로 둔다.
기존 `Harness`는 건드리지 않는다.

```tsx
describe('SuiteDataProvider — 다른 창의 변경', () => {
  /** 컨텍스트 값을 그대로 잡아 둔다. update를 직접 불러야 한다. */
  function renderProbe(adapter: StorageAdapter) {
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

  it('다른 창의 변경을 화면에 반영한다', async () => {
    const { adapter, box } = pushableAdapter();
    const seen = renderProbe(adapter);

    /*
     * load()가 비동기다. 이걸 흘려보내지 않고 외부 변경을 밀어 넣으면
     * 뒤늦게 끝난 load가 그것을 덮어 테스트가 간헐적으로 실패한다.
     */
    await act(async () => {});
    expect(box.push).not.toBeNull();

    act(() => box.push?.({ ...createEmptySuiteData(), activeClassId: 'c-1' }));

    await waitFor(() => expect(seen.current?.data.activeClassId).toBe('c-1'));
  });

  it('반영한 뒤 update가 낡은 값에서 출발하지 않는다', async () => {
    // 이것이 원래 버그다. 칠판이 넘긴 값을 메인 창의 다음 저장이 되돌렸다.
    const { adapter, box } = pushableAdapter();
    const seen = renderProbe(adapter);

    await act(async () => {});
    expect(box.push).not.toBeNull();

    act(() => box.push?.({ ...createEmptySuiteData(), activeClassId: 'c-1' }));
    await waitFor(() => expect(seen.current?.data.activeClassId).toBe('c-1'));

    act(() => seen.current?.update((current) => ({ ...current, activeTermId: 't-1' })));

    // 외부에서 온 activeClassId가 살아 있어야 한다.
    expect(seen.current?.data.activeClassId).toBe('c-1');
    expect(seen.current?.data.activeTermId).toBe('t-1');
  });
});
```

임포트는 파일 맨 위에 이미 전부 있다(`act`, `render`, `waitFor`, `createEmptySuiteData`,
`SuiteData`, `stubAdapter`, `StorageAdapter`, `SuiteDataProvider`, `useSuite`, `ToastProvider`).
새로 더할 임포트는 없다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/roster/SuiteDataProvider.test.tsx`
Expected: FAIL — 두 번째 테스트에서 `activeClassId`가 `null`(외부 변경이 반영되지 않음)

- [ ] **Step 3: Provider에 구독을 건다**

`src/shared/roster/SuiteDataProvider.tsx`:

임포트에 추가

```tsx
import { useExternalChanges } from '../state/useExternalChanges';
```

`guard` 정의 아래, `beforeunload` 효과 위에 추가

```tsx
  /*
   * 칠판은 별도 창으로 뜬다. 이 구독이 없으면 각 창이 자기 사본을 들고
   * 문서 전체를 덮어써서, 서로 다른 곳을 고쳐도 한쪽이 조용히 사라진다.
   */
  useExternalChanges<SuiteData>(adapter, {
    // 내 것이 곧 나가고 상대가 그것을 구독으로 받는다. 상태는 갈라지지 않는다.
    shouldIgnore: () => pendingRef.current !== null,
    onApply: (next) => {
      // 둘 다 갱신해야 한다. dataRef만 낡으면 다음 update가 같은 문제를 되풀이한다.
      dataRef.current = next;
      setData(next);
    },
    onDefer: () =>
      toast.info('다른 창에서 바뀐 내용이 있습니다. 지금 하시던 편집을 마치면 반영됩니다.'),
  });
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm run verify`
Expected: 전부 통과

- [ ] **Step 5: firebase-guide.md의 틀린 절을 교체한다**

`docs/firebase-guide.md`의 `## 아직 정하지 못한 것` 절 전체를 아래로 바꾼다:

```markdown
## 여러 기기에서 함께 쓸 때

앱은 다른 창·기기의 변경을 **구독해서 바로 화면에 반영합니다.**
교실 PC에서 점수를 주면 노트북 화면도 따라 바뀝니다.

`FirestoreAdapter`를 만들 때 `subscribe`를 반드시 함께 구현하세요.

```ts
subscribe(listener: (data: SuiteData) => void): () => void {
  return onSnapshot(this.docRef, (snapshot) => {
    // Firestore는 자기가 쓴 것도 되돌려 준다. 이것을 거르지 않으면
    // 저장할 때마다 자기 자신을 되받아 무한 반영이 일어난다.
    if (snapshot.metadata.hasPendingWrites) return;

    const raw = snapshot.data();
    if (raw === undefined) return;
    listener(parseSuiteData(raw).data);
  });
}
```

문서가 하나뿐이라 리스너도 하나입니다. 무료 한도를 걱정하지 않아도 됩니다.

**남는 한계:** 거의 같은 순간에 양쪽에서 같은 것을 고치면 마지막에 저장한 쪽이 이깁니다.
상대 변경이 즉시 화면에 뜨므로 바로 알아차릴 수 있습니다.
```

- [ ] **Step 6: 브라우저에서 원래 버그가 사라졌는지 확인한다**

`npm run dev`로 띄우고 설계 문서 §1.1 표를 그대로 재현한다.
칠판 창에서 무언가를 바꾼 뒤 메인 창에서 다른 작업을 했을 때,
칠판의 변경이 **되돌아가지 않고** 메인 화면에도 반영되는지 본다.

- [ ] **Step 7: 커밋**

```bash
git add src/shared/roster/SuiteDataProvider.tsx tests/roster/SuiteDataProvider.test.tsx docs/firebase-guide.md
git commit -m "feat(state): 다른 창 변경을 화면에 반영"
```

---

## Task 4: toolkit — 어댑터와 훅 이식

**저장소를 `G-teacher-toolkit`으로 옮겨 진행한다.**

**Files:**
- Modify: `src/shared/storage/StorageAdapter.ts`
- Modify: `src/shared/storage/LocalStorageAdapter.ts`
- Modify: `tests/helpers/stubAdapter.ts`
- Create: `src/shared/state/useExternalChanges.ts`
- Create: `tests/storage/subscribe.test.ts`
- Create: `tests/state/useExternalChanges.test.tsx`

**Interfaces:**
- Consumes: `parseToolkitData(raw, now) => { data: ToolkitData; repairs: RepairLog[] }`, `STORAGE_KEYS.data` (`'teacher-toolkit:v1:data'`)
- Produces: Task 1·2와 같되 타입이 `ToolkitData`

- [ ] **Step 1: Task 1과 2의 파일을 그대로 옮긴다**

여기서는 코드를 다시 싣지 않고 **복사**를 지시한다. 두 저장소의 `shared` 계층이
복사본이라는 것이 설계 방침이고, 계획서에 코드를 두 벌 적어 두면 그 두 벌이
먼저 어긋난다. Task 1과 2를 열어 그 코드를 그대로 가져온다.

suite에서 만든 네 파일을 복사하고 다음만 바꾼다.

| 바꿀 것 | suite | toolkit |
|---|---|---|
| 데이터 타입 | `SuiteData` | `ToolkitData` |
| 파서 | `parseSuiteData` | `parseToolkitData` |
| 직렬화 | `serializeSuiteData` | `serializeToolkitData` |
| 빈 데이터 | `createEmptySuiteData` | `createEmptyToolkitData` |

`useExternalChanges.ts`는 **한 글자도 바뀌지 않는다.** 제네릭이라 타입에 매이지 않는다.

`tests/storage/subscribe.test.ts`의 첫 단언은 toolkit 모델에 맞춰 바꾼다:

```ts
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ quizSets: [] });
```

- [ ] **Step 2: 복사한 파일 머리에 출처를 적는다**

`useExternalChanges.ts` 맨 위에 이 저장소의 다른 복사본과 같은 형식으로 넣는다:

```ts
/*
 * G-classroom-suite에서 가져온 공통 계층입니다.
 * 두 저장소가 각각 fork되므로 패키지로 빼지 않고 복사해 씁니다.
 * 고칠 일이 생기면 양쪽을 함께 손봐야 합니다.
 */
```

- [ ] **Step 3: 통과를 확인한다**

Run: `npm run verify`
Expected: 타입 검사 0건, 기존 115개 + 새 15개 통과, 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add src/shared/storage/StorageAdapter.ts src/shared/storage/LocalStorageAdapter.ts src/shared/state/useExternalChanges.ts tests/helpers/stubAdapter.ts tests/storage/subscribe.test.ts tests/state/useExternalChanges.test.tsx
git commit -m "feat(storage,state): 창 간 변경 구독 이식"
```

---

## Task 5: toolkit — Provider 연결과 칠판 회귀 테스트

**Files:**
- Modify: `src/shared/state/ToolkitDataProvider.tsx`
- Create: `tests/state/ToolkitDataProvider.test.tsx`

**Interfaces:**
- Consumes: Task 4의 `useExternalChanges`, `adapter.subscribe`
- Produces: 없음

- [ ] **Step 1: 원래 버그를 그대로 옮긴 실패 테스트를 쓴다**

Create `tests/state/ToolkitDataProvider.test.tsx`:

```tsx
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createEmptyToolkitData } from '../../src/shared/domain/factories';
import type { ToolkitData } from '../../src/shared/domain/types';
import { ToolkitDataProvider, useToolkit } from '../../src/shared/state/ToolkitDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

/** 진행 중인 퀴즈가 있는 상태. 칠판이 문제를 넘긴 뒤를 흉내낸다. */
function withRun(questionIndex: number): ToolkitData {
  return {
    ...createEmptyToolkitData(),
    quizRun: {
      quizSetId: 'qs-1',
      questionIndex,
      correctTeamsByQuestion: {},
      revealed: false,
      teams: ['1모둠'],
      startedAt: '2026-08-13T00:00:00.000Z',
    },
  };
}

function renderProvider(adapter: ReturnType<typeof stubAdapter>) {
  const seen: { current: ReturnType<typeof useToolkit> | null } = { current: null };

  function Probe() {
    seen.current = useToolkit();
    return null;
  }

  render(
    <ToastProvider>
      <ToolkitDataProvider adapter={adapter}>
        <Probe />
      </ToolkitDataProvider>
    </ToastProvider>,
  );

  return seen;
}

describe('ToolkitDataProvider — 다른 창의 변경', () => {
  it('칠판이 넘긴 문제가 메인 창의 다음 저장에 되돌아가지 않는다', async () => {
    /*
     * 원래 버그다. 칠판에서 다음 문제로 넘긴 뒤 메인 창에서 문제 세트를
     * 하나 만들면, 메인 창의 낡은 사본이 문제 번호를 0으로 되돌렸다.
     */
    let push: ((data: ToolkitData) => void) | null = null;
    const adapter = stubAdapter({
      subscribe: (listener) => {
        push = listener;
        return () => {
          push = null;
        };
      },
    });

    const seen = renderProvider(adapter);

    /*
     * load()가 비동기다. 이걸 흘려보내지 않고 외부 변경을 밀어 넣으면
     * 뒤늦게 끝난 load가 그것을 덮어 테스트가 간헐적으로 실패한다.
     */
    await act(async () => {});
    expect(push).not.toBeNull();

    // 칠판이 2번 문제로 넘겼다
    act(() => push?.(withRun(1)));
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
    let push: ((data: ToolkitData) => void) | null = null;
    const adapter = stubAdapter({
      subscribe: (listener) => {
        push = listener;
        return () => {
          push = null;
        };
      },
    });

    const seen = renderProvider(adapter);
    await act(async () => {});

    // update가 저장 대기 상태를 만든다 (600ms 디바운스 안)
    act(() =>
      seen.current?.update((current) => ({ ...current, messageFavorites: ['mine'] })),
    );
    act(() => push?.(withRun(1)));

    expect(seen.current?.data.quizRun).toBeNull();
    expect(seen.current?.data.messageFavorites).toEqual(['mine']);
  });

  it('편집 중이면 미뤘다가 편집이 끝나면 반영한다', async () => {
    document.body.innerHTML = '<div role="dialog"></div>';

    let push: ((data: ToolkitData) => void) | null = null;
    const adapter = stubAdapter({
      subscribe: (listener) => {
        push = listener;
        return () => {
          push = null;
        };
      },
    });

    const seen = renderProvider(adapter);
    await act(async () => {});
    expect(push).not.toBeNull();

    /*
     * 가짜 타이머는 여기서부터 켠다. 렌더·load보다 먼저 켜면
     * 프라미스와 타이머가 얽혀 무엇을 기다리는지 알기 어려워진다.
     */
    vi.useFakeTimers();
    try {
      act(() => push?.(withRun(1)));
      expect(seen.current?.data.quizRun).toBeNull();

      document.body.innerHTML = '';
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(seen.current?.data.quizRun?.questionIndex).toBe(1);
    } finally {
      vi.useRealTimers();
      document.body.innerHTML = '';
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/state/ToolkitDataProvider.test.tsx`
Expected: FAIL — 첫 테스트에서 `quizRun`이 `null`(외부 변경이 반영되지 않음)

- [ ] **Step 3: Provider에 구독을 건다**

`src/shared/state/ToolkitDataProvider.tsx`:

임포트에 추가

```tsx
import { useExternalChanges } from './useExternalChanges';
```

`guard` 정의 아래, `beforeunload` 효과 위에 추가

```tsx
  /*
   * 칠판은 별도 창으로 뜬다. 이 구독이 없으면 각 창이 자기 사본을 들고
   * 문서 전체를 덮어써서, 서로 다른 곳을 고쳐도 한쪽이 조용히 사라진다.
   */
  useExternalChanges<ToolkitData>(adapter, {
    // 내 것이 곧 나가고 상대가 그것을 구독으로 받는다. 상태는 갈라지지 않는다.
    shouldIgnore: () => pendingRef.current !== null,
    onApply: (next) => {
      // 둘 다 갱신해야 한다. dataRef만 낡으면 다음 update가 같은 문제를 되풀이한다.
      dataRef.current = next;
      setData(next);
    },
    onDefer: () =>
      toast.info('다른 창에서 바뀐 내용이 있습니다. 지금 하시던 편집을 마치면 반영됩니다.'),
  });
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm run verify`
Expected: 전부 통과

- [ ] **Step 5: 브라우저에서 설계 문서 §1.1 표를 재현한다**

`npm run dev` → 문제 세트와 진행 중인 퀴즈를 만들고 칠판을 새 창으로 연다.

| 확인할 것 | 기대 |
|---|---|
| 칠판에서 `다음 문제` | 메인 창의 진행 표시도 따라 바뀐다 |
| 메인에서 `문제 세트 만들기` | 칠판이 넘긴 문제 번호가 **유지된다** |
| 칠판 새로고침 | 넘긴 문제 그대로 |

- [ ] **Step 6: 커밋**

```bash
git add src/shared/state/ToolkitDataProvider.tsx tests/state/ToolkitDataProvider.test.tsx
git commit -m "feat(state): 다른 창 변경을 화면에 반영"
```

---

## 완료 확인

- [ ] 두 저장소 각각 `npm run verify` 통과
- [ ] 두 저장소 각각 브라우저에서 §1.1 표 재현 — 세 번째 줄이 되돌아가지 않음
- [ ] `docs/firebase-guide.md`에 `hasPendingWrites` 주의사항이 들어감
- [ ] 두 저장소 push
