import { describe, expect, it } from 'vitest';

import { createEmptySuiteData } from '../../src/shared/domain/factories';
import { CURRENT_SCHEMA_VERSION } from '../../src/shared/domain/types';
import { parseSuiteData, serializeSuiteData } from '../../src/shared/storage/schema';

/*
 * 홈 카드 배치가 자료에 들어갔다. 백업에 따라가고 다른 기기에서도 같은
 * 배치를 본다 — 그러려면 저장했다 읽어도 같아야 하고, 이 칸이 없는 옛 백업도
 * 조용히 열려야 한다.
 */
describe('홈 배치 스키마', () => {
  it('저장했다 읽으면 순서·숨김·크기가 그대로다', () => {
    const data = {
      ...createEmptySuiteData(),
      homeLayout: { order: ['duty', 'now'], hidden: ['meal'], sizes: { seating: 2 as const } },
    };

    const { data: parsed } = parseSuiteData(JSON.parse(serializeSuiteData(data)));

    expect(parsed.homeLayout).toEqual({ order: ['duty', 'now'], hidden: ['meal'], sizes: { seating: 2 } });
  });

  it('칸이 없는 옛 백업은 빈 배치로, 알림 없이 열린다', () => {
    const { homeLayout: _dropped, ...withoutLayout } = createEmptySuiteData();

    const { data: parsed, repairs } = parseSuiteData(withoutLayout);

    expect(parsed.homeLayout).toEqual({ order: [], hidden: [], sizes: {} });
    expect(repairs).toEqual([]);
  });

  it('엉뚱한 크기 값과 문자열이 아닌 id는 버린다', () => {
    const raw = {
      ...createEmptySuiteData(),
      homeLayout: { order: ['now', 3, null], hidden: 'meal', sizes: { now: 7, duty: 'x', meal: 3, roster: 1 } },
    };

    const { data: parsed } = parseSuiteData(raw);

    expect(parsed.homeLayout).toEqual({ order: ['now'], hidden: [], sizes: { meal: 3 } });
  });

  it('3판이다 — 2판 앱이 열면 경고가 뜨도록', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
  });
});
