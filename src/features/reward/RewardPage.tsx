import { CalendarRange, Eraser, Monitor, Plus, RotateCcw, Sparkles, Target, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { BehaviorPreset, ScoreGoal, ScoreTargetUnit } from '../../shared/domain/types';
import { useActiveClass } from '../../shared/roster/SuiteDataProvider';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  cx,
  EmptyState,
  Modal,
  Tabs,
  useToast,
} from '../../shared/ui';
import { groupColorStyle } from '../seating/groupColors';
import { GoalCelebration } from './GoalCelebration';
import { goalTargetLabel, type CyclePeriod } from './rewardCore';
import { useReward } from './useReward';

type RewardTab = 'score' | 'goals' | 'log';

const PERIODS: Array<{ id: CyclePeriod; label: string }> = [
  { id: 'weekly', label: '이번 주' },
  { id: 'monthly', label: '이번 달' },
  { id: 'all', label: '전체' },
];

/**
 * 활동·보상 화면.
 *
 * 수업 중에 쓰는 화면이라 "항목 고르고 → 대상 누르기" 두 번으로 끝나야 한다.
 * 잘못 누른 점수는 알림의 실행 취소로 즉시 되돌린다.
 */
export default function RewardPage() {
  const activeClass = useActiveClass();
  const reward = useReward();
  const toast = useToast();

  const [tab, setTab] = useState<RewardTab>('score');
  const [selectedPreset, setSelectedPreset] = useState<BehaviorPreset | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [celebrating, setCelebrating] = useState<ScoreGoal[]>([]);

  if (activeClass === null) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          title="학급을 먼저 만들어 주세요"
          description="학급과 명단이 있어야 점수를 줄 수 있습니다."
          action={
            <Link
              to="/setup"
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              처음 설정 시작하기
            </Link>
          }
        />
      </Card>
    );
  }

  if (reward.roster.length === 0) {
    return (
      <Card title="활동·보상" icon={Sparkles} accentClass="text-reward-500">
        <EmptyState
          icon={Users}
          title="학생 명단이 비어 있습니다"
          description="명단을 등록하면 바로 점수를 줄 수 있습니다."
          action={
            <Link
              to="/roster"
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              명단 등록하기
            </Link>
          }
        />
      </Card>
    );
  }

  const handleAward = (targetId: string, label: string): void => {
    if (selectedPreset === null) return;

    const result = reward.award(selectedPreset, targetId);
    if (result === null) return;

    const points = selectedPreset.defaultPoints;
    toast.info(`${label} ${points > 0 ? `+${points}` : points}점 (${selectedPreset.name})`, {
      actionLabel: '실행 취소',
      onAction: () => reward.revoke(result.entryId),
    });

    // 이 점수로 목표를 넘겼으면 축하 화면을 띄운다.
    if (result.achieved.length > 0) setCelebrating(result.achieved);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">활동·보상</h1>
        <Badge tone="brand">우리 반 {reward.totals.classTotal}점</Badge>

        <div className="flex gap-1">
          {PERIODS.map(({ id, label }) => (
            <Button
              key={id}
              size="sm"
              variant={reward.period === id ? 'primary' : 'ghost'}
              aria-pressed={reward.period === id}
              onClick={() => reward.setPeriod(id)}
            >
              {label}
            </Button>
          ))}
        </div>

        <Link
          to="/board/reward"
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-control border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Monitor className="size-4" aria-hidden />
          전자칠판
        </Link>
      </div>

      <Tabs
        items={[
          { id: 'score', label: '점수 주기' },
          { id: 'goals', label: '공동 목표', count: reward.goals.length },
          { id: 'log', label: '기록', count: reward.recentEntries.length },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as RewardTab)}
      >
        {tab === 'score' ? (
          <ScoreTab
            reward={reward}
            selectedPreset={selectedPreset}
            onSelectPreset={setSelectedPreset}
            onAward={handleAward}
            onAddPreset={() => setPresetOpen(true)}
          />
        ) : null}

        {tab === 'goals' ? <GoalsTab reward={reward} onAdd={() => setGoalOpen(true)} /> : null}

        {tab === 'log' ? <LogTab reward={reward} onClear={() => setConfirmClear(true)} /> : null}
      </Tabs>

      <GoalCelebration
        goals={celebrating}
        targetLabel={(goal) =>
          goalTargetLabel(goal, {
            studentName: (id) => reward.studentById.get(id)?.name,
            groupName: (id) => reward.groups.find((group) => group.id === id)?.name,
          })
        }
        onClose={() => setCelebrating([])}
      />

      <AddPresetModal
        open={presetOpen}
        onClose={() => setPresetOpen(false)}
        onAdd={(input) => {
          reward.addPreset(input);
          setPresetOpen(false);
          toast.success(`${input.name} 항목을 만들었습니다.`);
        }}
      />

      <AddGoalModal
        open={goalOpen}
        reward={reward}
        onClose={() => setGoalOpen(false)}
        onAdd={(input) => {
          reward.addGoal(input);
          setGoalOpen(false);
          toast.success('공동 목표를 만들었습니다.');
        }}
      />

      <ConfirmDialog
        open={confirmClear}
        title="점수 기록을 모두 지울까요?"
        description="이 학급의 점수 기록이 전부 사라지고 모든 점수가 0이 됩니다. 행동 항목과 목표는 남습니다. 지우기 직전 상태는 자동으로 백업됩니다."
        destructive
        confirmLabel="기록 지우기"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          void (async () => {
            await reward.clearEntries();
            setConfirmClear(false);
            toast.info('점수 기록을 지웠습니다.');
          })();
        }}
      />
    </div>
  );
}

function ScoreTab({
  reward,
  selectedPreset,
  onSelectPreset,
  onAward,
  onAddPreset,
}: {
  reward: ReturnType<typeof useReward>;
  selectedPreset: BehaviorPreset | null;
  onSelectPreset: (preset: BehaviorPreset | null) => void;
  onAward: (targetId: string, label: string) => void;
  onAddPreset: () => void;
}) {
  const toast = useToast();

  if (!reward.hasPresets) {
    return (
      <EmptyState
        icon={Sparkles}
        title="아직 행동 항목이 없습니다"
        description="칭찬·지도 항목을 기본으로 깔아 드립니다. 이름과 점수는 나중에 고치면 됩니다."
        action={
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                const count = reward.seedStarterPresets();
                toast.success(`기본 항목 ${count}개를 만들었습니다.`);
              }}
            >
              기본 항목 만들기
            </Button>
            <Button icon={Plus} onClick={onAddPreset}>
              직접 추가
            </Button>
          </div>
        }
      />
    );
  }

  const unit = selectedPreset?.targetUnit ?? null;

  return (
    <div className="flex flex-col gap-4">
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">1. 항목 고르기</h2>
          <Button size="sm" variant="ghost" icon={Plus} onClick={onAddPreset}>
            항목 추가
          </Button>
        </div>

        <ul className="flex flex-wrap gap-2">
          {reward.presets.map((preset) => {
            const selected = selectedPreset?.id === preset.id;
            const style = groupColorStyle(preset.color);

            return (
              <li key={preset.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectPreset(selected ? null : preset)}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-control border px-3 py-2 text-sm',
                    selected ? 'border-brand-500 bg-brand-50 font-medium text-brand-700' : style.card,
                  )}
                >
                  {preset.name}
                  <span
                    className={cx(
                      'font-mono text-xs',
                      preset.defaultPoints >= 0 ? 'text-success-700' : 'text-danger-700',
                    )}
                  >
                    {preset.defaultPoints > 0 ? `+${preset.defaultPoints}` : preset.defaultPoints}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          2.{' '}
          {selectedPreset === null
            ? '항목을 먼저 골라 주세요'
            : unit === 'class'
              ? '우리 반에 주기'
              : unit === 'group'
                ? '모둠 누르기'
                : '학생 누르기'}
        </h2>

        {selectedPreset === null ? (
          <p className="text-sm text-slate-500">
            항목을 고르면 줄 대상이 여기에 나타납니다.
          </p>
        ) : unit === 'class' ? (
          <Button
            variant="primary"
            size="lg"
            onClick={() => onAward('class', '우리 반')}
          >
            우리 반에 {selectedPreset.defaultPoints > 0 ? '+' : ''}
            {selectedPreset.defaultPoints}점 주기
          </Button>
        ) : unit === 'group' ? (
          reward.groups.length === 0 ? (
            <EmptyState
              title="아직 모둠이 없습니다"
              description="자리·모둠 화면에서 모둠을 편성하면 여기서 점수를 줄 수 있습니다."
              action={
                <Link
                  to="/seating"
                  className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
                >
                  모둠 편성하러 가기
                </Link>
              }
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {reward.groups.map((group) => {
                const style = groupColorStyle(group.color);
                return (
                  <li key={group.id}>
                    <button
                      type="button"
                      onClick={() => onAward(group.id, group.name)}
                      className={cx(
                        'flex w-full items-center gap-2 rounded-card border p-3 text-left hover:brightness-95',
                        style.card,
                      )}
                    >
                      <span className={cx('size-3 shrink-0 rounded-full', style.dot)} aria-hidden />
                      <span className={cx('min-w-0 flex-1 truncate font-medium', style.text)}>
                        {group.name}
                      </span>
                      <span className="shrink-0 font-mono text-lg font-bold text-slate-900">
                        {reward.totals.groups.get(group.id) ?? 0}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {reward.roster.map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => onAward(student.id, student.name)}
                  className="flex w-full items-center gap-1.5 rounded-card border border-slate-200 bg-white p-2.5 text-left hover:bg-slate-50"
                >
                  <span className="font-mono text-xs text-slate-400">{student.number}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{student.name}</span>
                  <span className="shrink-0 font-mono text-sm font-bold text-slate-900">
                    {reward.totals.students.get(student.id) ?? 0}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CycleSettings reward={reward} />
    </div>
  );
}

/**
 * 점수 주기 설정.
 *
 * 원본에는 '교사가 직접 주기를 끊는' 방식과 '주 시작일을 다음 주기부터 적용'도
 * 있었지만 걷어냈다. 전자는 주기 관리 화면이 통째로 필요하고, 후자는
 * 언제 바꿨는지를 저장할 자리가 없어 골라도 즉시 적용되는 거짓말이 된다.
 */
function CycleSettings({ reward }: { reward: ReturnType<typeof useReward> }) {
  const { cycle, setCycle } = reward;

  return (
    <Card title="점수 주기" icon={CalendarRange}>
      <div className="flex flex-col gap-3">
        <div>
          <span className="text-sm text-slate-700">한 달을 세는 기준</span>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={cycle.monthlyType === '1st_to_end' ? 'primary' : 'secondary'}
              aria-pressed={cycle.monthlyType === '1st_to_end'}
              onClick={() => setCycle({ monthlyType: '1st_to_end' })}
            >
              1일~말일
            </Button>
            <Button
              size="sm"
              variant={cycle.monthlyType === 'specific_day' ? 'primary' : 'secondary'}
              aria-pressed={cycle.monthlyType === 'specific_day'}
              onClick={() => setCycle({ monthlyType: 'specific_day' })}
            >
              지정한 날부터
            </Button>

            {cycle.monthlyType === 'specific_day' ? (
              <label className="flex items-center gap-1 text-sm text-slate-700">
                <input
                  type="number"
                  min={1}
                  max={28}
                  aria-label="월 시작일"
                  value={cycle.monthlyStartDay}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (!Number.isFinite(parsed)) return;
                    setCycle({ monthlyStartDay: Math.min(Math.max(1, parsed), 28) });
                  }}
                  className="h-8 w-16 rounded-control border border-slate-300 px-2"
                />
                일
              </label>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            `이번 달` 점수를 어디서부터 셀지 정합니다. 29~31일은 없는 달이 있어 고를 수 없습니다.
          </p>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <Button
            size="sm"
            variant={cycle.showLifetimeCumulative ? 'primary' : 'secondary'}
            aria-pressed={cycle.showLifetimeCumulative}
            onClick={() => setCycle({ showLifetimeCumulative: !cycle.showLifetimeCumulative })}
          >
            {cycle.showLifetimeCumulative ? '통산 점수 보이는 중' : '통산 점수 보기'}
          </Button>
          <p className="mt-1 text-sm text-slate-500">
            켜면 위 기간 단추에 관계없이 `전체` 누적 점수를 함께 볼 수 있습니다.
          </p>
        </div>
      </div>
    </Card>
  );
}

function GoalsTab({
  reward,
  onAdd,
}: {
  reward: ReturnType<typeof useReward>;
  onAdd: () => void;
}) {
  if (reward.goals.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="아직 공동 목표가 없습니다"
        description="'우리 반 100점 모으면 영화 보기'처럼 목표를 정하면 진행률이 여기 표시됩니다."
        action={
          <Button variant="primary" icon={Plus} onClick={onAdd}>
            목표 만들기
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button icon={Plus} onClick={onAdd} className="self-start">
        목표 추가
      </Button>

      <ul className="flex flex-col gap-3">
        {reward.goals.map(({ goal, current, ratio, isAchieved, remaining }) => (
          <li
            key={goal.id}
            className={cx(
              'rounded-card border p-3',
              isAchieved ? 'border-success-200 bg-success-50' : 'border-slate-200 bg-white',
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                {goal.title}
              </h3>
              {isAchieved ? <Badge tone="success">달성</Badge> : null}
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                iconOnly
                aria-label={`${goal.title} 삭제`}
                onClick={() => reward.deleteGoal(goal.id)}
              />
            </div>

            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              <span
                className={cx('block h-full', isAchieved ? 'bg-success-500' : 'bg-reward-500')}
                style={{ width: `${Math.round(ratio * 100)}%` }}
              />
            </div>

            <p className="mt-1.5 text-sm text-slate-600">
              {current} / {goal.targetPoints}점
              {isAchieved ? null : ` · ${remaining}점 남음`}
              {goal.reward === '' ? null : ` · 보상: ${goal.reward}`}
            </p>

            {/*
              숫자가 어디서 왔는지 화면이 말해야 한다.
              위의 기간 버튼을 눌러도 이 숫자가 안 바뀌는 이유이기도 하다.
            */}
            <p className="mt-0.5 text-xs text-slate-400">
              {goal.startDate}부터 센 점수입니다
              {goal.achievedAt === undefined ? '' : ` · ${goal.achievedAt.slice(0, 10)} 달성`}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LogTab({
  reward,
  onClear,
}: {
  reward: ReturnType<typeof useReward>;
  onClear: () => void;
}) {
  if (reward.recentEntries.length === 0) {
    return <EmptyState title="아직 기록이 없습니다" description="점수를 주면 여기에 남습니다." />;
  }

  const label = (entry: (typeof reward.recentEntries)[number]): string => {
    if (entry.targetUnit === 'class') return '우리 반';
    if (entry.targetUnit === 'group') {
      return reward.groups.find((group) => group.id === entry.targetId)?.name ?? '(없는 모둠)';
    }
    return reward.studentById.get(entry.targetId)?.name ?? '(없는 학생)';
  };

  return (
    <div className="flex flex-col gap-3">
      <Button icon={Eraser} variant="ghost" onClick={onClear} className="self-start">
        기록 모두 지우기
      </Button>

      <ul className="flex flex-col gap-1">
        {reward.recentEntries.map((entry) => {
          const revoked = entry.revokedAt !== undefined;

          return (
            <li
              key={entry.id}
              className={cx(
                'flex items-center gap-2 rounded-control border px-2.5 py-1.5 text-sm',
                revoked ? 'border-slate-100 bg-slate-50 text-slate-400' : 'border-slate-200 bg-white',
              )}
            >
              <span className="w-28 shrink-0 truncate text-slate-500">
                {entry.occurredAt.slice(5, 16).replace('T', ' ')}
              </span>
              <span className={cx('w-20 shrink-0 truncate', revoked && 'line-through')}>
                {label(entry)}
              </span>
              <span className={cx('min-w-0 flex-1 truncate text-slate-500', revoked && 'line-through')}>
                {entry.reason}
              </span>
              <span
                className={cx(
                  'w-10 shrink-0 text-right font-mono',
                  revoked ? 'text-slate-400' : entry.points >= 0 ? 'text-success-700' : 'text-danger-700',
                )}
              >
                {entry.points > 0 ? `+${entry.points}` : entry.points}
              </span>

              {revoked ? (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={RotateCcw}
                  iconOnly
                  aria-label="되돌린 기록 복구"
                  onClick={() => reward.restore(entry.id)}
                />
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  iconOnly
                  aria-label="이 기록 되돌리기"
                  onClick={() => reward.revoke(entry.id)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AddPresetModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (input: Pick<BehaviorPreset, 'name' | 'defaultPoints' | 'targetUnit' | 'color'>) => void;
}) {
  const [name, setName] = useState('');
  const [points, setPoints] = useState('1');
  const [targetUnit, setTargetUnit] = useState<ScoreTargetUnit>('student');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="행동 항목 추가"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            disabled={name.trim() === ''}
            onClick={() => {
              const parsed = Number.parseInt(points, 10);
              onAdd({
                name: name.trim(),
                defaultPoints: Number.isFinite(parsed) ? parsed : 1,
                targetUnit,
                color: 'sky',
              });
              setName('');
            }}
          >
            추가
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="block text-sm">
          <span className="text-slate-700">항목 이름</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="도움 주기"
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>

        <div className="flex gap-3">
          <label className="block flex-1 text-sm">
            <span className="text-slate-700">점수</span>
            <input
              type="number"
              value={points}
              onChange={(event) => setPoints(event.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
            />
            <span className="mt-1 block text-slate-500">음수를 넣으면 지도 항목이 됩니다.</span>
          </label>

          <label className="block flex-1 text-sm">
            <span className="text-slate-700">대상</span>
            <select
              value={targetUnit}
              onChange={(event) => setTargetUnit(event.target.value as ScoreTargetUnit)}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-2"
            >
              <option value="student">학생</option>
              <option value="group">모둠</option>
              <option value="class">학급 전체</option>
            </select>
          </label>
        </div>
      </div>
    </Modal>
  );
}

function AddGoalModal({
  open,
  reward,
  onClose,
  onAdd,
}: {
  open: boolean;
  reward: ReturnType<typeof useReward>;
  onClose: () => void;
  onAdd: (input: {
    title: string;
    targetUnit: ScoreTargetUnit;
    targetId: string;
    targetPoints: number;
    reward: string;
  }) => void;
}) {
  const [title, setTitle] = useState('');
  const [targetUnit, setTargetUnit] = useState<ScoreTargetUnit>('class');
  const [targetId, setTargetId] = useState('class');
  const [targetPoints, setTargetPoints] = useState('100');
  const [rewardText, setRewardText] = useState('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="공동 목표 추가"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            disabled={title.trim() === ''}
            onClick={() => {
              const parsed = Number.parseInt(targetPoints, 10);
              onAdd({
                title: title.trim(),
                targetUnit,
                targetId,
                targetPoints: Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
                reward: rewardText.trim(),
              });
              setTitle('');
            }}
          >
            추가
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="block text-sm">
          <span className="text-slate-700">목표 이름</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="우리 반 100점 모으기"
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>

        <div className="flex gap-3">
          <label className="block flex-1 text-sm">
            <span className="text-slate-700">대상</span>
            <select
              value={targetUnit}
              onChange={(event) => {
                const next = event.target.value as ScoreTargetUnit;
                setTargetUnit(next);
                setTargetId(
                  next === 'class'
                    ? 'class'
                    : next === 'group'
                      ? (reward.groups[0]?.id ?? '')
                      : (reward.roster[0]?.id ?? ''),
                );
              }}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-2"
            >
              <option value="class">학급 전체</option>
              <option value="group">모둠</option>
              <option value="student">학생</option>
            </select>
          </label>

          <label className="block flex-1 text-sm">
            <span className="text-slate-700">목표 점수</span>
            <input
              type="number"
              min={1}
              value={targetPoints}
              onChange={(event) => setTargetPoints(event.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
            />
          </label>
        </div>

        {targetUnit === 'class' ? null : (
          <label className="block text-sm">
            <span className="text-slate-700">{targetUnit === 'group' ? '모둠' : '학생'}</span>
            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-2"
            >
              {(targetUnit === 'group' ? reward.groups : reward.roster).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-sm">
          <span className="text-slate-700">달성하면 (선택)</span>
          <input
            value={rewardText}
            onChange={(event) => setRewardText(event.target.value)}
            placeholder="다 같이 영화 보기"
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>
      </div>
    </Modal>
  );
}
