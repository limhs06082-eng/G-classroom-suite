import { describe, expect, it } from 'vitest';

import {
  BACKUP_REMINDER_DAYS,
  evaluateBackupReminder,
} from '../../src/features/home/backupReminder';

const NOW = '2026-03-20T09:00:00.000Z';

function daysAgo(days: number): string {
  return new Date(Date.parse(NOW) - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('evaluateBackupReminder', () => {
  it('지킬 데이터가 없으면 권하지 않는다', () => {
    // 빈 앱에서 백업하라는 말은 소음이다.
    expect(evaluateBackupReminder(null, 0, NOW)).toEqual({ show: false });
    expect(evaluateBackupReminder(daysAgo(365), 0, NOW)).toEqual({ show: false });
  });

  it('학생이 있는데 한 번도 백업하지 않았으면 권한다', () => {
    expect(evaluateBackupReminder(null, 25, NOW)).toEqual({ show: true, kind: 'never', days: 0 });
  });

  it('최근에 백업했으면 조르지 않는다', () => {
    expect(evaluateBackupReminder(daysAgo(1), 25, NOW)).toEqual({ show: false });
    expect(evaluateBackupReminder(daysAgo(BACKUP_REMINDER_DAYS - 1), 25, NOW)).toEqual({ show: false });
  });

  it('기준일이 지나면 며칠 지났는지와 함께 권한다', () => {
    expect(evaluateBackupReminder(daysAgo(BACKUP_REMINDER_DAYS), 25, NOW)).toEqual({
      show: true,
      kind: 'stale',
      days: BACKUP_REMINDER_DAYS,
    });
    expect(evaluateBackupReminder(daysAgo(60), 25, NOW)).toEqual({
      show: true,
      kind: 'stale',
      days: 60,
    });
  });

  it('시계가 뒤로 가도 조르지 않는다', () => {
    // 시간대 변경이나 기기 시각 오류로 미래 시각이 기록될 수 있다.
    expect(evaluateBackupReminder(daysAgo(-5), 25, NOW)).toEqual({ show: false });
  });

  it('시각을 읽을 수 없으면 백업한 적 없는 것으로 본다', () => {
    // 안전한 쪽으로 판단한다. 백업을 권해서 손해 볼 일은 없다.
    expect(evaluateBackupReminder('알 수 없는 값', 25, NOW)).toEqual({
      show: true,
      kind: 'never',
      days: 0,
    });
  });
});
