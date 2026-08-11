import type { BackupItem } from './StorageAdapter';

/**
 * 백업 보관 정책.
 *
 * localStorage 총량은 브라우저당 5~10MB뿐이다. 백업을 무한정 쌓으면
 * 정작 본 데이터를 저장하지 못하는 사고가 난다. 그래서 상한을 강제한다.
 *
 * 정책은 순수 함수로 분리했다. 저장소 구현과 무관하게 테스트할 수 있고,
 * 나중에 FirestoreAdapter에서도 같은 규칙을 재사용한다.
 *
 * 설계 근거: 설계 문서 §7.3
 */

export const RETENTION = {
  /** 최근 자동 스냅샷 보관 개수 */
  autoRecent: 10,
  /** 그보다 오래된 것 중 하루에 하나씩 보관할 일수 */
  autoDailyDays: 7,
  /** 위험 작업 직전 백업 보관 개수 */
  guardRecent: 5,
  /** 전체 개수 상한 */
  maxTotal: 20,
  /** 전체 용량 상한 (2MB) */
  maxTotalBytes: 2 * 1024 * 1024,
} as const;

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** YYYY-MM-DD */
function dateOf(item: BackupItem): string {
  return item.createdAt.slice(0, 10);
}

/** 최신 우선. 같은 시각이면 id로 고정해 실행마다 결과가 같게 한다. */
function newestFirst(a: BackupItem, b: BackupItem): number {
  return a.createdAt === b.createdAt
    ? b.id.localeCompare(a.id)
    : b.createdAt.localeCompare(a.createdAt);
}

export interface RetentionResult {
  kept: BackupItem[];
  removed: BackupItem[];
}

export function applyRetention(backups: readonly BackupItem[]): RetentionResult {
  const sorted = [...backups].sort(newestFirst);

  const guards = sorted.filter((b) => b.kind === 'guard');
  const autos = sorted.filter((b) => b.kind === 'auto');

  const keepIds = new Set<string>();

  // 위험 작업 백업은 무조건 최근 것부터 확보한다. 되돌리기의 마지막 보루다.
  for (const item of guards.slice(0, RETENTION.guardRecent)) {
    keepIds.add(item.id);
  }

  // 자동 스냅샷: 최근 N개
  for (const item of autos.slice(0, RETENTION.autoRecent)) {
    keepIds.add(item.id);
  }

  // 그보다 오래된 것은 날짜별 대표 1개씩만 남긴다.
  // 어제 실수한 걸 오늘 알아채는 경우를 위해 며칠치 흔적은 남겨 둔다.
  const seenDates = new Set<string>();
  for (const item of autos.slice(RETENTION.autoRecent)) {
    if (seenDates.size >= RETENTION.autoDailyDays && !seenDates.has(dateOf(item))) break;
    if (seenDates.has(dateOf(item))) continue;
    seenDates.add(dateOf(item));
    keepIds.add(item.id);
  }

  let kept = sorted.filter((b) => keepIds.has(b.id));

  // 개수·용량 상한. 넘치면 오래된 auto부터 버리고, 그래도 넘치면 오래된 guard를 버린다.
  const dropOldestExpendable = (): boolean => {
    for (let i = kept.length - 1; i >= 0; i -= 1) {
      if (kept[i]?.kind === 'auto') {
        kept.splice(i, 1);
        return true;
      }
    }
    if (kept.length > 0) {
      kept.pop();
      return true;
    }
    return false;
  };

  const totalBytes = (): number => kept.reduce((sum, b) => sum + b.sizeBytes, 0);

  while (
    (kept.length > RETENTION.maxTotal || totalBytes() > RETENTION.maxTotalBytes) &&
    kept.length > 0
  ) {
    if (!dropOldestExpendable()) break;
  }

  const keptIds = new Set(kept.map((b) => b.id));
  const removed = sorted.filter((b) => !keptIds.has(b.id));

  return { kept, removed };
}
