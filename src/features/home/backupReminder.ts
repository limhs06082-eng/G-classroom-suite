/**
 * 백업 권유 판단.
 *
 * localStorage는 브라우저 캐시를 한 번 지우면 전부 사라진다.
 * 3월에 입력한 명단과 1년치 기록이 그렇게 날아가면 앱이 실패한 게 아니라 사고다.
 * 그래서 홈에서 주기적으로 내보내기를 권한다.
 *
 * 설계 근거: 설계 문서 §7.3
 */

export const BACKUP_REMINDER_DAYS = 14;

export type BackupReminder =
  | { show: false }
  /** 한 번도 내보낸 적이 없다 */
  | { show: true; kind: 'never'; days: 0 }
  /** 마지막 내보내기가 오래됐다 */
  | { show: true; kind: 'stale'; days: number };

export function evaluateBackupReminder(
  lastExportedAt: string | null,
  studentCount: number,
  now: string,
): BackupReminder {
  // 지킬 데이터가 없으면 권하지 않는다. 빈 앱에서 백업하라는 말은 소음이다.
  if (studentCount === 0) return { show: false };

  if (lastExportedAt === null) return { show: true, kind: 'never', days: 0 };

  const elapsed = Date.parse(now) - Date.parse(lastExportedAt);
  if (!Number.isFinite(elapsed)) return { show: true, kind: 'never', days: 0 };

  const days = Math.floor(elapsed / (24 * 60 * 60 * 1000));
  // 시계가 뒤로 간 경우(시간대 변경 등)에는 조르지 않는다.
  if (days < BACKUP_REMINDER_DAYS) return { show: false };

  return { show: true, kind: 'stale', days };
}
