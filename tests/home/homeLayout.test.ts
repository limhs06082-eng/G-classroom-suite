import { describe, expect, it } from 'vitest';

import {
  clearLegacyLayout,
  EMPTY_LAYOUT,
  isCollapsed,
  isEmptyLayout,
  moveCard,
  moveCardTo,
  readLegacyLayout,
  resize,
  resolveOrder,
  setCollapsed,
  setHidden,
  sizeOf,
  visibleCards,
} from '../../src/features/home/homeLayout';

const DEFAULTS = ['now', 'attendance', 'duty', 'seating'];

describe('홈 카드 배치', () => {
  it('저장된 것이 없으면 기본 순서다', () => {
    expect(resolveOrder(DEFAULTS, EMPTY_LAYOUT)).toEqual(DEFAULTS);
  });

  it('저장된 순서를 앞에, 모르는 카드는 기본 순서로 뒤에 둔다', () => {
    // 'ghost'는 이제 없는 카드 — 조용히 버린다. 'seating'은 새로 생긴 카드처럼 뒤에 붙는다.
    const layout = { order: ['duty', 'ghost', 'now'], hidden: [], sizes: {}, collapsed: [] };
    expect(resolveOrder(DEFAULTS, layout)).toEqual(['duty', 'now', 'attendance', 'seating']);
  });

  it('숨긴 카드는 보이는 목록에서 빠진다', () => {
    const layout = setHidden(EMPTY_LAYOUT, 'duty', true);
    expect(visibleCards(DEFAULTS, layout)).toEqual(['now', 'attendance', 'seating']);
    expect(visibleCards(DEFAULTS, setHidden(layout, 'duty', false))).toEqual(DEFAULTS);
  });

  it('카드를 옮기고, 끝에서는 그대로다', () => {
    const moved = moveCard(DEFAULTS, EMPTY_LAYOUT, 'duty', -1);
    expect(resolveOrder(DEFAULTS, moved)).toEqual(['now', 'duty', 'attendance', 'seating']);
    expect(moveCard(DEFAULTS, EMPTY_LAYOUT, 'now', -1)).toBe(EMPTY_LAYOUT);
  });

  it('예전 기기 배치(localStorage)를 한 번 읽고 지운다 — 깨졌거나 비었으면 null', () => {
    window.localStorage.setItem(
      'gboard:home-layout',
      JSON.stringify({ order: ['duty'], hidden: ['seating'], sizes: { now: 2 } }),
    );
    expect(readLegacyLayout()).toEqual({ order: ['duty'], hidden: ['seating'], sizes: { now: 2 }, collapsed: [] });

    clearLegacyLayout();
    expect(window.localStorage.getItem('gboard:home-layout')).toBeNull();
    expect(readLegacyLayout()).toBeNull();

    window.localStorage.setItem('gboard:home-layout', '{not json');
    expect(readLegacyLayout()).toBeNull();

    window.localStorage.setItem('gboard:home-layout', JSON.stringify({ order: [], hidden: [] }));
    expect(readLegacyLayout()).toBeNull();
    clearLegacyLayout();
  });

  it('빈 배치를 안다', () => {
    expect(isEmptyLayout(EMPTY_LAYOUT)).toBe(true);
    expect(isEmptyLayout(resize(EMPTY_LAYOUT, 'now', 1))).toBe(false);
    expect(isEmptyLayout(setHidden(EMPTY_LAYOUT, 'now', true))).toBe(false);
    expect(isEmptyLayout(setCollapsed(EMPTY_LAYOUT, 'now', true))).toBe(false);
  });

  it('크기는 1~3칸. 카드별 기본값이 있고, 사용자가 정한 값은 1이라도 저장한다', () => {
    const defaults = { notice: 2 as const };
    expect(sizeOf(EMPTY_LAYOUT, 'now')).toBe(1);
    expect(sizeOf(EMPTY_LAYOUT, 'notice', defaults)).toBe(2);

    const wide = resize(EMPTY_LAYOUT, 'now', 1);
    expect(sizeOf(wide, 'now')).toBe(2);
    // 3에서는 더 못 넓힌다, 1에서는 더 못 좁힌다 — 같은 객체.
    expect(sizeOf(resize(resize(wide, 'now', 1), 'now', 1), 'now')).toBe(3);
    expect(resize(EMPTY_LAYOUT, 'now', -1)).toBe(EMPTY_LAYOUT);

    // 기본 2칸인 카드를 1칸으로 좁히면 1이 저장되어 기본값을 이긴다.
    const narrowed = resize(EMPTY_LAYOUT, 'notice', -1, defaults);
    expect(narrowed.sizes).toEqual({ notice: 1 });
    expect(sizeOf(narrowed, 'notice', defaults)).toBe(1);
  });

  it('접었다 편다', () => {
    const folded = setCollapsed(EMPTY_LAYOUT, 'duty', true);
    expect(isCollapsed(folded, 'duty')).toBe(true);
    expect(isCollapsed(folded, 'now')).toBe(false);
    expect(setCollapsed(folded, 'duty', false).collapsed).toEqual([]);
  });

  it('떨어뜨린 자리로 옮긴다 — 앞으로 끌면 그 앞에, 뒤로 끌면 그 뒤에', () => {
    expect(resolveOrder(DEFAULTS, moveCardTo(DEFAULTS, EMPTY_LAYOUT, 'seating', 'attendance'))).toEqual([
      'now',
      'seating',
      'attendance',
      'duty',
    ]);
    expect(resolveOrder(DEFAULTS, moveCardTo(DEFAULTS, EMPTY_LAYOUT, 'now', 'duty'))).toEqual([
      'attendance',
      'duty',
      'now',
      'seating',
    ]);
    expect(moveCardTo(DEFAULTS, EMPTY_LAYOUT, 'now', 'now')).toBe(EMPTY_LAYOUT);
    expect(moveCardTo(DEFAULTS, EMPTY_LAYOUT, 'ghost', 'now')).toBe(EMPTY_LAYOUT);
  });

  it('예전 배치의 엉뚱한 크기 값은 버린다', () => {
    window.localStorage.setItem(
      'gboard:home-layout',
      JSON.stringify({ sizes: { now: 7, duty: 'x', meal: 3 } }),
    );
    expect(readLegacyLayout()?.sizes).toEqual({ meal: 3 });
    clearLegacyLayout();
  });
});
