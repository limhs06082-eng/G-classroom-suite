import { describe, expect, it } from 'vitest';

import { createEmptySuiteData } from '../../src/shared/domain/factories';
import { MAX_PERIOD } from '../../src/shared/domain/types';
import { parseSuiteData, serializeSuiteData } from '../../src/shared/storage/schema';

const NOW = '2026-08-27T09:00:00.000Z';

describe('교시 시각 — 저장과 복원', () => {
  it('기본값이 일곱 줄로 채워져 있다', () => {
    // 비어 있으면 '지금' 카드가 처음부터 안 뜬다.
    expect(createEmptySuiteData().periodTimes).toHaveLength(MAX_PERIOD);
  });

  it('1교시는 09:00에 시작해 09:40에 끝난다', () => {
    const first = createEmptySuiteData().periodTimes[0];

    expect(first?.start).toBe('09:00');
    expect(first?.end).toBe('09:40');
  });

  it('점심때가 5교시 앞에 있다', () => {
    const times = createEmptySuiteData().periodTimes;

    // 4교시 끝(12:10)과 5교시 시작(13:10) 사이가 하루에서 가장 긴 틈이다.
    expect(times[3]?.end).toBe('12:10');
    expect(times[4]?.start).toBe('13:10');
  });

  it('고쳐 둔 시각이 왕복해도 남는다', () => {
    const data = createEmptySuiteData();
    data.periodTimes = data.periodTimes.map((time) =>
      time.period === 1 ? { ...time, start: '08:40', end: '09:20' } : time,
    );

    // parseSuiteData는 글자가 아니라 이미 JSON.parse된 값을 받는다.
    const back = parseSuiteData(JSON.parse(serializeSuiteData(data)), NOW);

    expect(back.data.periodTimes[0]?.start).toBe('08:40');
  });

  it('이 판 이전 백업에는 없는 칸이라 기본값으로 채운다', () => {
    const old = JSON.parse(serializeSuiteData(createEmptySuiteData())) as Record<string, unknown>;
    delete old['periodTimes'];

    const back = parseSuiteData(old, NOW);

    expect(back.data.periodTimes).toHaveLength(MAX_PERIOD);
  });

  it('한 줄이라도 깨졌으면 일곱 줄을 통째로 되돌린다', () => {
    const raw = JSON.parse(serializeSuiteData(createEmptySuiteData())) as Record<string, unknown>;
    (raw['periodTimes'] as unknown[])[2] = { period: 3, start: '뭐라고?', end: '10:40' };

    const back = parseSuiteData(raw, NOW);

    /*
     * 반쪽짜리 일과는 카드가 3교시에서 갑자기 말을 못 하게 만든다.
     * 조용히 틀리느니 전부 기본값이 낫다 — 틀린 것이 눈에 보인다.
     */
    expect(back.data.periodTimes).toHaveLength(MAX_PERIOD);
    expect(back.data.periodTimes[2]?.start).toBe('10:40');
  });
});
