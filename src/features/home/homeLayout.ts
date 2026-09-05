/**
 * 홈 카드 배치 — 순서·숨김·크기의 순수 함수.
 *
 * 교사마다 아침에 먼저 보는 카드가 다르다. 담임은 출결, 전담은 시간표.
 * 배치는 `SuiteData.homeLayout`에 산다 — 백업에 따라가고 교실 PC와 집
 * 노트북이 같은 배치를 본다. (0.14까지는 이 기기의 localStorage였다.
 * 그 배치는 자료가 비어 있을 때 한 번 들여오고 지운다.)
 *
 * 순수 함수는 알려진 카드 id 목록을 받는다. 저장된 순서에 없는 새 카드는
 * 원래 자리(기본 순서)를 지키고, 이제 없는 카드 id는 조용히 버린다 —
 * 판이 바뀌어 카드가 늘고 줄어도 저장된 배치가 깨지지 않는다.
 */

import type { HomeCardSize, HomeLayout } from '../../shared/domain/types';

export type { HomeCardSize, HomeLayout };

const LEGACY_STORAGE_KEY = 'gboard:home-layout';

export const EMPTY_LAYOUT: HomeLayout = { order: [], hidden: [], sizes: {} };

export function isEmptyLayout(layout: HomeLayout): boolean {
  return (
    layout.order.length === 0 && layout.hidden.length === 0 && Object.keys(layout.sizes).length === 0
  );
}

/** 기본 순서(defaults)에 저장된 순서(layout.order)를 얹어 실제 순서를 만든다. */
export function resolveOrder(defaults: readonly string[], layout: HomeLayout): string[] {
  const known = new Set(defaults);
  const saved = layout.order.filter((id) => known.has(id));
  const rest = defaults.filter((id) => !saved.includes(id));

  /*
   * 저장된 것을 앞에, 나머지를 기본 순서로 뒤에. 새 판에서 카드가 늘면
   * 그 카드는 맨 뒤가 아니라 **기본 순서의 이웃 다음**에 끼워야 자연스럽지만,
   * 그 규칙은 복잡한 데 비해 얻는 것이 적다. 교사가 한 번 옮기면 끝이다.
   */
  return [...saved, ...rest];
}

export function visibleCards(defaults: readonly string[], layout: HomeLayout): string[] {
  const hidden = new Set(layout.hidden);
  return resolveOrder(defaults, layout).filter((id) => !hidden.has(id));
}

/** 카드를 한 칸 앞/뒤로. 끝이면 그대로. */
export function moveCard(
  defaults: readonly string[],
  layout: HomeLayout,
  id: string,
  delta: -1 | 1,
): HomeLayout {
  const order = resolveOrder(defaults, layout);
  const index = order.indexOf(id);
  const target = index + delta;
  if (index === -1 || target < 0 || target >= order.length) return layout;

  const next = [...order];
  const a = next[index];
  const b = next[target];
  if (a === undefined || b === undefined) return layout;
  next[index] = b;
  next[target] = a;
  return { ...layout, order: next };
}

/**
 * 끌어서 놓기 — `id`를 `targetId` 자리로.
 *
 * 앞으로 끌면 그 카드 **앞**에, 뒤로 끌면 그 카드 **뒤**에 선다. 정렬 목록의
 * 흔한 규칙이고, 그래야 "저 카드 자리에 놓는다"는 손의 느낌과 맞는다.
 */
export function moveCardTo(
  defaults: readonly string[],
  layout: HomeLayout,
  id: string,
  targetId: string,
): HomeLayout {
  if (id === targetId) return layout;
  const order = resolveOrder(defaults, layout);
  const from = order.indexOf(id);
  const to = order.indexOf(targetId);
  if (from === -1 || to === -1) return layout;

  const without = order.filter((item) => item !== id);
  const targetIndex = without.indexOf(targetId);
  const insertAt = from < to ? targetIndex + 1 : targetIndex;
  return { ...layout, order: [...without.slice(0, insertAt), id, ...without.slice(insertAt)] };
}

export function setHidden(layout: HomeLayout, id: string, hidden: boolean): HomeLayout {
  const without = layout.hidden.filter((item) => item !== id);
  return { ...layout, hidden: hidden ? [...without, id] : without };
}

export function sizeOf(layout: HomeLayout, id: string): HomeCardSize {
  return layout.sizes[id] ?? 1;
}

/** 한 칸 넓히거나 좁힌다. 1~3 밖이면 그대로. 1로 돌아오면 키를 지운다. */
export function resize(layout: HomeLayout, id: string, delta: -1 | 1): HomeLayout {
  const next = sizeOf(layout, id) + delta;
  if (next < 1 || next > 3) return layout;

  const { [id]: _dropped, ...rest } = layout.sizes;
  return { ...layout, sizes: next === 1 ? rest : { ...rest, [id]: next as HomeCardSize } };
}

/**
 * 0.14까지 이 기기에 남긴 배치. 비었거나 깨졌으면 null.
 *
 * 한 번 들여오고 나면 `clearLegacyLayout()`으로 지운다 — 새로 고칠 때마다
 * 자료를 덮어쓰면 다른 기기에서 옮긴 배치가 되돌아간다.
 */
export function readLegacyLayout(): HomeLayout | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const strings = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

    const sizes: Record<string, HomeCardSize> = {};
    const rawSizes = record['sizes'];
    if (typeof rawSizes === 'object' && rawSizes !== null) {
      for (const [id, value] of Object.entries(rawSizes as Record<string, unknown>)) {
        if (value === 2 || value === 3) sizes[id] = value;
      }
    }

    const layout = { order: strings(record['order']), hidden: strings(record['hidden']), sizes };
    return isEmptyLayout(layout) ? null : layout;
  } catch {
    return null;
  }
}

export function clearLegacyLayout(): void {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // 지울 수 없는 환경이면 다음에 또 읽겠지만, 자료가 차 있으면 무시된다.
  }
}
