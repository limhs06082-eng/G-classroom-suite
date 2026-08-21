import { describe, expect, it } from 'vitest';

import { createEmptySuiteData, createScoreEntry, createStudent } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import {
  DOCUMENT_LIMIT_BYTES,
  formatBytes,
  measureDataSize,
} from '../../src/shared/storage/dataSize';

const NOW = '2026-08-21T09:00:00.000Z';

function withScores(count: number): SuiteData {
  return {
    ...createEmptySuiteData(),
    scoreEntries: Array.from({ length: count }, (_, i) =>
      createScoreEntry(
        {
          id: `se-${i}`,
          classId: 'c-1',
          targetUnit: 'student',
          targetId: 's-1',
          points: 1,
          reason: '도움 주기',
        },
        NOW,
      ),
    ),
  };
}

describe('measureDataSize', () => {
  it('빈 자료는 조용하다', () => {
    const report = measureDataSize(createEmptySuiteData());

    expect(report.level).toBe('ok');
    expect(report.bytes).toBeGreaterThan(0);
    expect(report.ratio).toBeLessThan(0.01);
  });

  it('자료가 늘면 크기도 는다', () => {
    const small = measureDataSize(withScores(10)).bytes;
    const big = measureDataSize(withScores(100)).bytes;

    expect(big).toBeGreaterThan(small);
  });

  it('무엇이 자리를 차지하는지 큰 순서로 알려 준다', () => {
    const report = measureDataSize(withScores(200));
    const first = report.slices[0];

    expect(first?.label).toBe('점수 기록');
    expect(first?.share).toBeGreaterThan(0.5);
  });

  it('비어 있는 항목은 목록에 넣지 않는다', () => {
    // 목록만 길어지고 교사가 정리할 것이 없다.
    const report = measureDataSize(withScores(5));

    expect(report.slices.every((slice) => slice.bytes > 2)).toBe(true);
    expect(report.slices.some((slice) => slice.label === '퀴즈 결과')).toBe(false);
  });

  it('500KB를 넘으면 지켜볼 때가 된다', () => {
    const data = { ...createEmptySuiteData(), messageHidden: ['x'.repeat(520 * 1024)] };

    expect(measureDataSize(data).level).toBe('watch');
  });

  it('900KB를 넘으면 지금 정리해야 한다', () => {
    const data = { ...createEmptySuiteData(), messageHidden: ['x'.repeat(920 * 1024)] };

    expect(measureDataSize(data).level).toBe('warn');
  });

  it('한도를 넘으면 비율이 1을 넘는다 — 100%에서 멈추지 않는다', () => {
    // 얼마나 넘었는지 보여 줘야 교사가 얼마나 지울지 가늠한다.
    const data = { ...createEmptySuiteData(), messageHidden: ['x'.repeat(1200 * 1024)] };
    const report = measureDataSize(data);

    expect(report.ratio).toBeGreaterThan(1);
    expect(report.bytes).toBeGreaterThan(DOCUMENT_LIMIT_BYTES);
  });

  it('학생만 있으면 학생·학급이 가장 크다', () => {
    const data = {
      ...createEmptySuiteData(),
      students: Array.from({ length: 30 }, (_, i) =>
        createStudent({ id: `s-${i}`, classId: 'c-1', number: i + 1, name: `학생${i}` }, NOW),
      ),
    };

    expect(measureDataSize(data).slices[0]?.label).toBe('학생·학급');
  });
});

describe('formatBytes', () => {
  it('작으면 바이트로', () => {
    expect(formatBytes(512)).toBe('512B');
  });

  it('KB는 반올림해서', () => {
    expect(formatBytes(1024)).toBe('1KB');
    expect(formatBytes(1536)).toBe('2KB');
  });

  it('MB는 소수 한 자리', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0MB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5MB');
  });
});
