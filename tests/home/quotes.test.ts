import { describe, expect, it } from 'vitest';

import { QUOTES, quoteOfDay, type Quote } from '../../src/features/home/quotes';

describe('quoteOfDay', () => {
  it('같은 날에는 같은 명언이 나온다', () => {
    // 새로 고칠 때마다 바뀌면 '아까 그 문장 뭐였지'를 다시 찾을 수 없다.
    expect(quoteOfDay('2026-08-16')).toEqual(quoteOfDay('2026-08-16'));
  });

  it('다음 날에는 다음 명언이 나온다', () => {
    expect(quoteOfDay('2026-08-16')).not.toEqual(quoteOfDay('2026-08-17'));
  });

  it('offset으로 다음 것을 볼 수 있다', () => {
    expect(quoteOfDay('2026-08-16', 1)).toEqual(quoteOfDay('2026-08-17'));
  });

  it('목록을 한 바퀴 돌면 처음으로 돌아온다', () => {
    const today = '2026-08-16';

    expect(quoteOfDay(today, QUOTES.length)).toEqual(quoteOfDay(today));
  });

  it('offset이 음수여도 목록 안에서 고른다', () => {
    const picked = quoteOfDay('2026-01-01', -5);

    expect(QUOTES).toContainEqual(picked);
  });

  it('읽을 수 없는 날짜에도 하나를 돌려준다', () => {
    const picked = quoteOfDay('아무거나');

    expect(picked.text).not.toBe('');
    expect(QUOTES).toContainEqual(picked);
  });

  it('없는 날짜(2월 30일)도 하나를 돌려준다', () => {
    expect(QUOTES).toContainEqual(quoteOfDay('2026-02-30'));
  });

  it('목록이 하나뿐이어도 깨지지 않는다', () => {
    const only: Quote[] = [{ text: '하나뿐' }];

    expect(quoteOfDay('2026-08-16', 0, only).text).toBe('하나뿐');
    expect(quoteOfDay('2026-08-16', 7, only).text).toBe('하나뿐');
  });

  it('목록이 비어도 빈 문장을 내지 않는다', () => {
    expect(quoteOfDay('2026-08-16', 0, []).text).not.toBe('');
  });
});

describe('QUOTES', () => {
  it('충분히 많아 한 달 안에 반복되지 않는다', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(30);
  });

  it('같은 문장이 겹치지 않는다', () => {
    const texts = QUOTES.map((quote) => quote.text);

    expect(new Set(texts).size).toBe(texts.length);
  });

  it('빈 문장이 없다', () => {
    for (const quote of QUOTES) {
      expect(quote.text.trim()).not.toBe('');
    }
  });
});
