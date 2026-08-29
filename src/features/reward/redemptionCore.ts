import { createRedemption } from '../../shared/domain/factories';
import type { Redemption, RedemptionTargetUnit, ScoreEntry } from '../../shared/domain/types';
import { isCounted } from './rewardCore';

/**
 * 쿠폰(보상 사용) 판단.
 *
 * 잔액은 저장하지 않는다 — **통산 획득 − 사용**을 매번 계산한다. 점수와
 * 같은 원칙이라, 되돌리기와 잔액이 어긋날 수 없다.
 *
 * 잔액은 화면의 기간 탭(이번 주·이번 달)과 무관하게 통산이다. 지난달에
 * 모은 점수로 이번 달에 쿠폰을 쓰는 것이 자연스럽다 — 기간은 "요즘 누가
 * 잘하나"를 보는 눈금이지 통장이 아니다.
 *
 * 그 대상에게 직접 준 점수만 잔액이 된다. 모둠 점수 화면(computeScores)은
 * 소속 학생 점수를 합쳐 보여 주지만, 그 합을 잔액으로 쓰면 학생이 제
 * 점수를 쓸 때 모둠 잔액도 함께 줄어야 하는 이중 차감 문제가 생긴다.
 */

export function lifetimeEarned(
  entries: readonly ScoreEntry[],
  unit: RedemptionTargetUnit,
  targetId: string,
): number {
  return entries
    .filter((entry) => isCounted(entry) && entry.targetUnit === unit && entry.targetId === targetId)
    .reduce((sum, entry) => sum + entry.points, 0);
}

export function totalRedeemed(
  redemptions: readonly Redemption[],
  unit: RedemptionTargetUnit,
  targetId: string,
): number {
  return redemptions
    .filter(
      (redemption) =>
        redemption.revokedAt === undefined &&
        redemption.targetUnit === unit &&
        redemption.targetId === targetId,
    )
    .reduce((sum, redemption) => sum + redemption.cost, 0);
}

export function balanceOf(
  entries: readonly ScoreEntry[],
  redemptions: readonly Redemption[],
  unit: RedemptionTargetUnit,
  targetId: string,
): number {
  return lifetimeEarned(entries, unit, targetId) - totalRedeemed(redemptions, unit, targetId);
}

export type RedeemResult =
  | { ok: true; redemptions: Redemption[] }
  | { ok: false; reason: 'insufficient' };

/**
 * 쿠폰을 쓴다. 잔액이 모자라면 거부한다.
 *
 * 화면이 버튼을 미리 잠가도 이 검사는 남는다 — 다른 창에서 점수를
 * 되돌리는 사이에 잔액이 줄 수 있고, 마지막 관문은 계산 쪽이어야 한다.
 */
export function redeem(
  entries: readonly ScoreEntry[],
  redemptions: readonly Redemption[],
  input: {
    classId: string;
    targetUnit: RedemptionTargetUnit;
    targetId: string;
    itemName: string;
    cost: number;
  },
  now?: string,
): RedeemResult {
  if (balanceOf(entries, redemptions, input.targetUnit, input.targetId) < input.cost) {
    return { ok: false, reason: 'insufficient' };
  }

  return {
    ok: true,
    redemptions: [...redemptions, createRedemption(input, now ?? new Date().toISOString())],
  };
}

/** 되돌리기. 기록을 지우지 않고 시각만 찍는다 — ScoreEntry.revokedAt과 같은 원칙. */
export function revokeRedemption(
  redemptions: readonly Redemption[],
  redemptionId: string,
  now: string = new Date().toISOString(),
): Redemption[] {
  return redemptions.map((redemption) =>
    redemption.id === redemptionId ? { ...redemption, revokedAt: now } : redemption,
  );
}
