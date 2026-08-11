import { describe, expect, it } from 'vitest';

import { applyRetention, byteLength, RETENTION } from '../../src/shared/storage/backup';
import type { BackupItem, BackupKind } from '../../src/shared/storage/StorageAdapter';

function item(
  id: string,
  createdAt: string,
  kind: BackupKind = 'auto',
  sizeBytes = 1000,
): BackupItem {
  return { id, createdAt, kind, reason: 'test', sizeBytes, payload: '{}' };
}

/** 같은 날 시:분을 달리해 n개 생성 (최신이 앞) */
function sameDay(date: string, count: number, kind: BackupKind = 'auto'): BackupItem[] {
  return Array.from({ length: count }, (_, i) =>
    item(`${kind}-${date}-${i}`, `${date}T${String(23 - i).padStart(2, '0')}:00:00.000Z`, kind),
  );
}

describe('applyRetention', () => {
  it('상한 안에서는 아무것도 버리지 않는다', () => {
    const backups = sameDay('2026-03-02', 5);
    const { kept, removed } = applyRetention(backups);

    expect(kept).toHaveLength(5);
    expect(removed).toEqual([]);
  });

  it('최근 자동 스냅샷을 정해진 개수만큼 지킨다', () => {
    const backups = sameDay('2026-03-02', 14);
    const { kept } = applyRetention(backups);

    const keptIds = kept.map((b) => b.id);
    for (const recent of backups.slice(0, RETENTION.autoRecent)) {
      expect(keptIds).toContain(recent.id);
    }
  });

  it('오래된 것은 날짜별로 하나씩만 남긴다', () => {
    // 하루 3개씩 6일치 = 18개
    const days = ['2026-03-07', '2026-03-06', '2026-03-05', '2026-03-04', '2026-03-03', '2026-03-02'];
    const backups = days.flatMap((d) => sameDay(d, 3));

    const { kept } = applyRetention(backups);

    // 최근 10개 구간 밖의 날짜는 하루 1개로 줄어야 한다
    const oldDays = days.slice(4); // 최근 10개(약 3.3일)를 넘어선 날짜
    for (const day of oldDays) {
      const perDay = kept.filter((b) => b.createdAt.startsWith(day));
      expect(perDay.length).toBeLessThanOrEqual(1);
    }
  });

  it('위험 작업 백업(guard)을 자동 스냅샷보다 먼저 지킨다', () => {
    const guards = sameDay('2026-03-01', 3, 'guard');
    const autos = sameDay('2026-03-02', 30, 'auto');

    const { kept } = applyRetention([...autos, ...guards]);
    const keptIds = new Set(kept.map((b) => b.id));

    for (const guard of guards) {
      expect(keptIds.has(guard.id)).toBe(true);
    }
    expect(kept.length).toBeLessThanOrEqual(RETENTION.maxTotal);
  });

  it('전체 개수 상한을 넘지 않는다', () => {
    const backups = [
      ...sameDay('2026-03-07', 12),
      ...sameDay('2026-03-06', 12),
      ...sameDay('2026-03-05', 12),
    ];
    const { kept } = applyRetention(backups);

    expect(kept.length).toBeLessThanOrEqual(RETENTION.maxTotal);
  });

  it('용량 상한을 넘으면 오래된 것부터 버린다', () => {
    // 1개당 500KB × 8개 = 4MB → 2MB 상한을 넘는다
    const big = Array.from({ length: 8 }, (_, i) =>
      item(`big-${i}`, `2026-03-0${i + 1}T09:00:00.000Z`, 'auto', 500 * 1024),
    );

    const { kept, removed } = applyRetention(big);
    const total = kept.reduce((sum, b) => sum + b.sizeBytes, 0);

    expect(total).toBeLessThanOrEqual(RETENTION.maxTotalBytes);
    expect(removed.length).toBeGreaterThan(0);
    // 남은 것은 최신 쪽이어야 한다
    expect(kept.map((b) => b.id)).toContain('big-7');
  });

  it('입력 순서가 달라도 같은 결과를 낸다', () => {
    const backups = [...sameDay('2026-03-07', 8), ...sameDay('2026-03-06', 8)];

    const a = applyRetention(backups).kept.map((b) => b.id);
    const b = applyRetention([...backups].reverse()).kept.map((b) => b.id);

    expect(a).toEqual(b);
  });

  it('kept와 removed를 합치면 원본 개수와 같다', () => {
    const backups = [...sameDay('2026-03-07', 15), ...sameDay('2026-03-01', 15, 'guard')];
    const { kept, removed } = applyRetention(backups);

    expect(kept.length + removed.length).toBe(backups.length);
    expect(new Set([...kept, ...removed].map((b) => b.id)).size).toBe(backups.length);
  });

  it('빈 목록도 처리한다', () => {
    expect(applyRetention([])).toEqual({ kept: [], removed: [] });
  });
});

describe('byteLength', () => {
  it('한글은 UTF-8 3바이트로 센다', () => {
    // 문자 수(2)와 바이트 수(6)가 다르다. 용량 상한 계산이 어긋나면 안 된다.
    expect('학생'.length).toBe(2);
    expect(byteLength('학생')).toBe(6);
  });

  it('ASCII는 1바이트', () => {
    expect(byteLength('abc')).toBe(3);
  });
});
