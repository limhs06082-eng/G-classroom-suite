import { Plus, RotateCcw, Ticket, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { createRewardItem, STARTER_REWARD_ITEMS } from '../../shared/domain/factories';
import type { RedemptionTargetUnit, RewardItem } from '../../shared/domain/types';
import { useActiveClass, useRoster, useSuite } from '../../shared/roster/SuiteDataProvider';
import { Badge, Button, cx, EmptyState, Modal, useToast } from '../../shared/ui';
import { groupColorStyle } from '../seating/groupColors';
import { balanceOf, redeem, revokeRedemption } from './redemptionCore';

/**
 * 쿠폰 탭 — 모은 점수를 쓰는 곳.
 *
 * 점수 주기와 같은 두 번 조작이다: 쿠폰을 고르고 → 학생(모둠)을 누른다.
 * 잔액은 통산 획득 − 사용이라 기간 탭과 무관하다(redemptionCore 참고).
 *
 * 지도(음수 점수)와 다른 목록이다. 자리 선택권으로 점수를 쓴 것과 약속을
 * 어겨 깎인 것이 한 목록에 섞이면 기록이 벌처럼 읽힌다.
 */
export function CouponsTab() {
  const { data, update } = useSuite();
  const activeClass = useActiveClass();
  const roster = useRoster();
  const toast = useToast();

  const classId = activeClass?.id ?? '';
  const items = data.rewardItems
    .filter((item) => item.classId === classId && item.isActive)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
  const groups = data.groups.filter((group) => group.classId === classId);
  const recent = data.redemptions
    .filter((redemption) => redemption.classId === classId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 20);

  const [selected, setSelected] = useState<RewardItem | null>(null);
  const [unit, setUnit] = useState<RedemptionTargetUnit>('student');
  const [addOpen, setAddOpen] = useState(false);

  const seedStarters = (): void => {
    update((suite) => ({
      ...suite,
      rewardItems: [
        ...suite.rewardItems,
        ...STARTER_REWARD_ITEMS.map((starter, index) =>
          createRewardItem({ classId, ...starter, order: index }),
        ),
      ],
    }));
    toast.success(`기본 쿠폰 ${STARTER_REWARD_ITEMS.length}개를 담았습니다.`);
  };

  const removeItem = (item: RewardItem): void => {
    // 사용 기록은 itemName을 제 안에 들고 있어 쿠폰을 지워도 읽힌다.
    update((suite) => ({
      ...suite,
      rewardItems: suite.rewardItems.filter((row) => row.id !== item.id),
    }));
    if (selected?.id === item.id) setSelected(null);
    // 삭제 버튼이 선택 버튼 바로 옆이라 오탭이 잦은 자리다. 돌아올 길을 준다.
    toast.warning(`'${item.name}' 쿠폰을 지웠습니다.`, {
      actionLabel: '실행 취소',
      onAction: () =>
        update((suite) => ({ ...suite, rewardItems: [...suite.rewardItems, item] })),
    });
  };

  const spend = (targetId: string, label: string): void => {
    if (selected === null) return;

    const result = redeem(data.scoreEntries, data.redemptions, {
      classId,
      targetUnit: unit,
      targetId,
      itemName: selected.name,
      cost: selected.cost,
    });

    if (!result.ok) {
      toast.warning(`${label}의 점수가 모자랍니다. (${selected.name} ${selected.cost}점)`);
      return;
    }

    update((suite) => ({ ...suite, redemptions: result.redemptions }));
    const newest = result.redemptions[result.redemptions.length - 1];
    toast.info(`${label} — ${selected.name} 사용 (−${selected.cost}점)`, {
      actionLabel: '실행 취소',
      onAction: () => {
        if (newest !== undefined) {
          update((suite) => ({
            ...suite,
            redemptions: revokeRedemption(suite.redemptions, newest.id),
          }));
        }
      },
    });
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Ticket}
        title="아직 쿠폰이 없습니다"
        description="자리 선택권·자유 시간처럼 점수로 바꿀 수 있는 보상을 정해 두면, 모은 점수를 쓰는 재미가 생깁니다."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={seedStarters}>
              기본 쿠폰 담기
            </Button>
            <Button variant="secondary" icon={Plus} onClick={() => setAddOpen(true)}>
              직접 만들기
            </Button>
            <AddCouponModal open={addOpen} classId={classId} onClose={() => setAddOpen(false)} />
          </div>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">1. 쿠폰 고르기</h2>
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setAddOpen(true)}>
            쿠폰 추가
          </Button>
        </div>

        <ul className="flex flex-wrap gap-2">
          {items.map((item) => {
            const active = selected?.id === item.id;
            return (
              <li key={item.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setSelected(active ? null : item)}
                  aria-pressed={active}
                  className={cx(
                    'flex h-10 items-center gap-2 rounded-l-control border border-r-0 px-3 text-sm font-medium',
                    active
                      ? 'border-reward-500 bg-reward-50 text-reward-700'
                      : 'border-slate-200 bg-surface text-slate-800 hover:border-slate-300',
                  )}
                >
                  {item.name}
                  <span data-numeric className="text-xs text-slate-500">
                    {item.cost}점
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item)}
                  aria-label={`${item.name} 쿠폰 삭제`}
                  className="flex h-10 items-center rounded-r-control border border-slate-200 px-2 text-slate-300 hover:text-danger-500"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            2. {selected === null ? '쿠폰을 고르면 쓸 수 있습니다' : `${selected.name} 쓸 사람 누르기`}
          </h2>
          <div className="ml-auto flex gap-1">
            <Button
              size="sm"
              variant={unit === 'student' ? 'primary' : 'ghost'}
              aria-pressed={unit === 'student'}
              onClick={() => setUnit('student')}
            >
              학생
            </Button>
            <Button
              size="sm"
              variant={unit === 'group' ? 'primary' : 'ghost'}
              aria-pressed={unit === 'group'}
              onClick={() => setUnit('group')}
              disabled={groups.length === 0}
            >
              모둠
            </Button>
          </div>
        </div>

        {unit === 'student' ? (
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {roster.map((student) => {
              const balance = balanceOf(data.scoreEntries, data.redemptions, 'student', student.id);
              const short = selected !== null && balance < selected.cost;
              return (
                <li key={student.id}>
                  <button
                    type="button"
                    disabled={selected === null || short}
                    onClick={() => spend(student.id, student.name)}
                    // '왜 안 눌리지'에 답한다 — 안 고른 것과 잔액 부족은 다른 이유다.
                    title={
                      short && selected !== null
                        ? `잔액 ${balance}점 — ${selected.name}은 ${selected.cost}점이 필요합니다`
                        : undefined
                    }
                    className={cx(
                      'flex h-11 w-full items-center gap-2 rounded-control border px-2.5 text-left text-sm',
                      'border-slate-200 bg-surface text-slate-800 enabled:hover:border-reward-500',
                      'disabled:opacity-50',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{student.name}</span>
                    <span
                      data-numeric
                      className={cx('shrink-0 text-xs', short ? 'font-semibold text-danger-700' : 'text-slate-500')}
                    >
                      {balance}점
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
            {groups.map((group) => {
              const balance = balanceOf(data.scoreEntries, data.redemptions, 'group', group.id);
              const short = selected !== null && balance < selected.cost;
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    disabled={selected === null || short}
                    onClick={() => spend(group.id, group.name)}
                    title={
                      short && selected !== null
                        ? `잔액 ${balance}점 — ${selected.name}은 ${selected.cost}점이 필요합니다`
                        : undefined
                    }
                    className={cx(
                      'flex h-11 w-full items-center gap-2 rounded-control border px-2.5 text-left text-sm',
                      'border-slate-200 bg-surface text-slate-800 enabled:hover:border-reward-500',
                      'disabled:opacity-50',
                    )}
                  >
                    <span
                      className={cx('size-2.5 shrink-0 rounded-full', groupColorStyle(group.color).dot)}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{group.name}</span>
                    <span
                      data-numeric
                      className={cx('shrink-0 text-xs', short ? 'font-semibold text-danger-700' : 'text-slate-500')}
                    >
                      {balance}점
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-2 text-xs text-slate-400">
          잔액은 전체 기간의 획득에서 사용을 뺀 것입니다. 위 기간 단추와 무관합니다.
        </p>
      </section>

      {recent.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">사용 기록</h2>
          <ul className="flex flex-col gap-1">
            {recent.map((redemption) => {
              const targetName =
                redemption.targetUnit === 'group'
                  ? groups.find((group) => group.id === redemption.targetId)?.name ?? '모둠'
                  : roster.find((student) => student.id === redemption.targetId)?.name ?? '학생';
              const revoked = redemption.revokedAt !== undefined;

              return (
                <li
                  key={redemption.id}
                  className={cx(
                    'flex items-center gap-2 rounded-control border border-slate-200 px-3 py-1.5 text-sm',
                    revoked && 'opacity-50',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-slate-800">
                    {targetName} — {redemption.itemName}
                  </span>
                  <span data-numeric className="shrink-0 text-xs text-slate-500">
                    −{redemption.cost}점 · {redemption.occurredAt.slice(0, 10)}
                  </span>
                  {revoked ? (
                    <Badge tone="neutral">되돌림</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={RotateCcw}
                      iconOnly
                      aria-label={`${targetName}의 ${redemption.itemName} 사용 되돌리기`}
                      onClick={() =>
                        update((suite) => ({
                          ...suite,
                          redemptions: revokeRedemption(suite.redemptions, redemption.id),
                        }))
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <AddCouponModal open={addOpen} classId={classId} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function AddCouponModal({
  open,
  classId,
  onClose,
}: {
  open: boolean;
  classId: string;
  onClose: () => void;
}) {
  const { update } = useSuite();
  const [name, setName] = useState('');
  const [cost, setCost] = useState('10');

  const add = (): void => {
    const trimmed = name.trim();
    const parsed = Number.parseInt(cost, 10);
    if (trimmed === '' || !Number.isFinite(parsed) || parsed < 1) return;

    update((suite) => ({
      ...suite,
      rewardItems: [
        ...suite.rewardItems,
        createRewardItem({ classId, name: trimmed, cost: parsed, order: suite.rewardItems.length }),
      ],
    }));
    setName('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="쿠폰 추가"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" disabled={name.trim() === ''} onClick={add}>
            추가
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="block text-sm">
          <span className="text-slate-700">쿠폰 이름</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="자리 선택권"
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">필요한 점수</span>
          <input
            type="number"
            min={1}
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>
      </div>
    </Modal>
  );
}
