import { describe, expect, it } from 'vitest';

import {
  balanceOf,
  lifetimeEarned,
  redeem,
  revokeRedemption,
  totalRedeemed,
} from '../../src/features/reward/redemptionCore';
import { createRedemption, createScoreEntry } from '../../src/shared/domain/factories';
import type { Redemption, ScoreEntry } from '../../src/shared/domain/types';

const CLASS = 'class-1';
const NOW = '2026-08-29T09:00:00.000Z';

function entries(): ScoreEntry[] {
  return [
    createScoreEntry({ id: 'e-1', classId: CLASS, targetUnit: 'student', targetId: 'stu-1', points: 10, reason: '' }, NOW),
    createScoreEntry({ id: 'e-2', classId: CLASS, targetUnit: 'student', targetId: 'stu-1', points: 5, reason: '' }, NOW),
    { ...createScoreEntry({ id: 'e-3', classId: CLASS, targetUnit: 'student', targetId: 'stu-1', points: 100, reason: '' }, NOW), revokedAt: NOW },
    createScoreEntry({ id: 'e-4', classId: CLASS, targetUnit: 'student', targetId: 'stu-1', points: -2, reason: '지도' }, NOW),
    createScoreEntry({ id: 'e-5', classId: CLASS, targetUnit: 'group', targetId: 'g-1', points: 7, reason: '' }, NOW),
  ];
}

describe('잔액 계산', () => {
  it('통산 획득은 되돌린 기록을 빼고 합산한다', () => {
    // 10 + 5 - 2 (revoked 100은 제외, 모둠 것도 제외)
    expect(lifetimeEarned(entries(), 'student', 'stu-1')).toBe(13);
  });

  it('사용 합계도 되돌린 것을 뺀다', () => {
    const redemptions: Redemption[] = [
      createRedemption({ id: 'r-1', classId: CLASS, targetUnit: 'student', targetId: 'stu-1', itemName: '자리 선택권', cost: 10 }, NOW),
      { ...createRedemption({ id: 'r-2', classId: CLASS, targetUnit: 'student', targetId: 'stu-1', itemName: '자유 시간', cost: 15 }, NOW), revokedAt: NOW },
    ];

    expect(totalRedeemed(redemptions, 'student', 'stu-1')).toBe(10);
    expect(balanceOf(entries(), redemptions, 'student', 'stu-1')).toBe(3);
  });
});

describe('redeem', () => {
  it('잔액이 모자라면 거부한다', () => {
    const result = redeem(entries(), [], {
      classId: CLASS,
      targetUnit: 'student',
      targetId: 'stu-1',
      itemName: '자유 시간 10분',
      cost: 15,
    });

    expect(result.ok).toBe(false);
  });

  it('잔액이 되면 사용 기록이 붙는다', () => {
    const result = redeem(entries(), [], {
      classId: CLASS,
      targetUnit: 'student',
      targetId: 'stu-1',
      itemName: '자리 선택권',
      cost: 10,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.redemptions).toHaveLength(1);
      expect(result.redemptions[0]?.itemName).toBe('자리 선택권');
      expect(balanceOf(entries(), result.redemptions, 'student', 'stu-1')).toBe(3);
    }
  });
});

describe('revokeRedemption', () => {
  it('지우지 않고 되돌린 시각만 찍는다', () => {
    const redemptions = [
      createRedemption({ id: 'r-1', classId: CLASS, targetUnit: 'student', targetId: 'stu-1', itemName: '자리 선택권', cost: 10 }, NOW),
    ];

    const next = revokeRedemption(redemptions, 'r-1', NOW);

    expect(next).toHaveLength(1);
    expect(next[0]?.revokedAt).toBe(NOW);
    expect(balanceOf(entries(), next, 'student', 'stu-1')).toBe(13);
  });
});
