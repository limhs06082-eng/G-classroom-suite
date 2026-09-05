/**
 * 홈 카드 배치 — 순서와 숨김.
 *
 * 교사마다 아침에 먼저 보는 카드가 다르다. 담임은 출결, 전담은 시간표.
 * 배치는 학급 자료가 아니라 **이 기기의 취향**이라 테마처럼 localStorage에
 * 산다(백업에 안 들어간다).
 *
 * 순수 함수는 알려진 카드 id 목록을 받는다. 저장된 순서에 없는 새 카드는
 * 원래 자리(기본 순서)를 지키고, 이제 없는 카드 id는 조용히 버린다 —
 * 판이 바뀌어 카드가 늘고 줄어도 저장된 배치가 깨지지 않는다.
 */

export interface HomeLayout {
  /** 보이는 순서. 여기 없는 카드는 기본 순서대로 뒤에 붙는다. */
  order: string[];
  hidden: string[];
}

const STORAGE_KEY = 'gboard:home-layout';

export const EMPTY_LAYOUT: HomeLayout = { order: [], hidden: [] };

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

export function setHidden(layout: HomeLayout, id: string, hidden: boolean): HomeLayout {
  const without = layout.hidden.filter((item) => item !== id);
  return { ...layout, hidden: hidden ? [...without, id] : without };
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
    return { order: strings(record['order']), hidden: strings(record['hidden']) };
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
