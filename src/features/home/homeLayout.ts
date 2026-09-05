/**
 * 홈 카드 배치 — 순서·숨김·크기.
 *
 * 교사마다 아침에 먼저 보는 카드가 다르다. 담임은 출결, 전담은 시간표.
 * 배치는 학급 자료가 아니라 **이 기기의 취향**이라 테마처럼 localStorage에
 * 산다(백업에 안 들어간다).
 *
 * 순수 함수는 알려진 카드 id 목록을 받는다. 저장된 순서에 없는 새 카드는
 * 원래 자리(기본 순서)를 지키고, 이제 없는 카드 id는 조용히 버린다 —
 * 판이 바뀌어 카드가 늘고 줄어도 저장된 배치가 깨지지 않는다.
 */

/** 그리드 칸 수. 1이 기본, 3이면 한 줄 전부(큰 화면 기준). */
export type HomeCardSize = 1 | 2 | 3;

export interface HomeLayout {
  /** 보이는 순서. 여기 없는 카드는 기본 순서대로 뒤에 붙는다. */
  order: string[];
  hidden: string[];
  /** 카드별 칸 수. 없으면 1이라 1은 저장하지 않는다. */
  sizes: Record<string, HomeCardSize>;
}

const STORAGE_KEY = 'gboard:home-layout';

export const EMPTY_LAYOUT: HomeLayout = { order: [], hidden: [], sizes: {} };

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

function isSize(value: unknown): value is HomeCardSize {
  return value === 1 || value === 2 || value === 3;
}

export function loadLayout(): HomeLayout {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return EMPTY_LAYOUT;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_LAYOUT;
    const record = parsed as Record<string, unknown>;
    const strings = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

    const sizes: Record<string, HomeCardSize> = {};
    const rawSizes = record['sizes'];
    if (typeof rawSizes === 'object' && rawSizes !== null) {
      for (const [id, value] of Object.entries(rawSizes as Record<string, unknown>)) {
        if (isSize(value) && value !== 1) sizes[id] = value;
      }
    }

    return { order: strings(record['order']), hidden: strings(record['hidden']), sizes };
  } catch {
    return EMPTY_LAYOUT;
  }
}

export function saveLayout(layout: HomeLayout): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // 저장이 안 되는 환경이면 이 세션 동안만 유지된다.
  }
}
