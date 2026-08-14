import { PendingNote } from '../home/SummaryCard';
import { useReward } from './useReward';

/** 홈의 '학급 점수' 카드 본문. */
export function RewardSummary() {
  const reward = useReward();

  if (!reward.hasPresets) {
    return <PendingNote>점수 항목을 만들면 이번 주 현황이 여기 표시됩니다.</PendingNote>;
  }

  const achieved = reward.goals.filter((entry) => entry.isAchieved).length;
  const topGroup = [...reward.groups].sort(
    (a, b) => (reward.totals.groups.get(b.id) ?? 0) - (reward.totals.groups.get(a.id) ?? 0),
  )[0];

  return (
    <div>
      <p className="flex items-baseline gap-1">
        <span data-numeric className="text-2xl font-bold text-slate-900">{reward.totals.classTotal}</span>
        <span className="text-sm text-slate-500">점 · 우리 반</span>
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {topGroup === undefined
          ? `${reward.periodLabel} 기준`
          : `${reward.periodLabel} 1위 ${topGroup.name} ${reward.totals.groups.get(topGroup.id) ?? 0}점`}
        {reward.goals.length > 0 ? ` · 목표 ${achieved}/${reward.goals.length} 달성` : ''}
      </p>
    </div>
  );
}
