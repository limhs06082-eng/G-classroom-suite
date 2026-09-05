import { describe, expect, it } from 'vitest';

import {
  EMPTY_LAYOUT,
  loadLayout,
  moveCard,
  resolveOrder,
  saveLayout,
  setHidden,
  visibleCards,
} from '../../src/features/home/homeLayout';

const DEFAULTS = ['now', 'attendance', 'duty', 'seating'];

describe('홈 카드 배치', () => {
  it('저장된 것이 없으면 기본 순서다', () => {
    expect(resolveOrder(DEFAULTS, EMPTY_LAYOUT)).toEqual(DEFAULTS);
  });

  it('저장된 순서를 앞에, 모르는 카드는 기본 순서로 뒤에 둔다', () => {
    // 'ghost'는 이제 없는 카드 — 조용히 버린다. 'seating'은 새로 생긴 카드처럼 뒤에 붙는다.
    const layout = { order: ['duty', 'ghost', 'now'], hidden: [] };
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

  it('localStorage에 남고, 깨진 값은 빈 배치로 읽힌다', () => {
    saveLayout({ order: ['duty'], hidden: ['seating'] });
    expect(loadLayout()).toEqual({ order: ['duty'], hidden: ['seating'] });

    window.localStorage.setItem('gboard:home-layout', '{not json');
    expect(loadLayout()).toEqual(EMPTY_LAYOUT);
  });
});
