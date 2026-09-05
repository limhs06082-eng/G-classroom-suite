import { Crown, Eraser, Lock, Scale, Shuffle, Users } from 'lucide-react';
import { useState } from 'react';

import type { Group, Student } from '../../shared/domain/types';
import { Badge, Button, Card, ConfirmDialog, cx, EmptyState, useToast } from '../../shared/ui';
import { MAX_GROUP_COUNT, MIN_GROUP_COUNT } from './groupingCore';
import { groupColorStyle } from './groupColors';
import { useGrouping } from './useGrouping';

/**
 * 모둠 편성.
 *
 * 여기서 만든 모둠을 보상 기능이 그대로 쓴다.
 * 원본에서는 모둠을 자리배치 앱과 보상 앱에서 각각 따로 만들어야 했다.
 */
export function GroupingPanel() {
  const grouping = useGrouping();
  const toast = useToast();

  const [targetCount, setTargetCount] = useState<number>(() =>
    grouping.groups.length > 0
      ? grouping.groups.length
      : grouping.suggestGroupCount('membersPerGroup', 4, 4),
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const [movingStudentId, setMovingStudentId] = useState<string | null>(null);
  /** 눈금이 모둠 수인가, 모둠당 인원인가. 인원 눈금은 모둠 수를 역산해 넣는다. */
  const [sizeMode, setSizeMode] = useState<'groupCount' | 'membersPerGroup'>('groupCount');
  const [membersPerGroup, setMembersPerGroup] = useState(4);
  const setMembers = (next: number): void => {
    const clamped = Math.max(2, Math.min(10, next));
    setMembersPerGroup(clamped);
    setTargetCount(
      Math.max(
        MIN_GROUP_COUNT,
        Math.min(MAX_GROUP_COUNT, grouping.suggestGroupCount('membersPerGroup', targetCount, clamped)),
      ),
    );
  };

  if (grouping.roster.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="학생 명단이 비어 있습니다"
        description="명단을 등록하면 모둠을 바로 편성할 수 있습니다."
      />
    );
  }

  const handleShuffle = (): void => {
    const { lockCleared } = grouping.shuffleGroups(targetCount);

    toast.success(
      grouping.lockedStudentIds.size > 0
        ? `모둠을 새로 편성했습니다. 고정한 ${grouping.lockedStudentIds.size}명은 그대로 두었습니다.`
        : '모둠을 새로 편성했습니다.',
    );

    if (lockCleared) {
      toast.warning(
        '모둠 수가 줄어 갈 곳이 없어진 고정 학생이 있어 고정이 풀렸습니다. 편성을 확인해 주세요.',
      );
    }
    setMovingStudentId(null);
  };

  const handleBalance = (): void => {
    const { lockCleared } = grouping.balanceGroups(targetCount);

    toast.success(
      grouping.lockedStudentIds.size > 0
        ? `성별과 특성을 고르게 나눴습니다. 고정한 ${grouping.lockedStudentIds.size}명은 그대로 두었습니다.`
        : '성별과 특성을 고르게 나눠 편성했습니다.',
    );

    if (lockCleared) {
      toast.warning(
        '모둠 수가 줄어 갈 곳이 없어진 고정 학생이 있어 고정이 풀렸습니다. 편성을 확인해 주세요.',
      );
    }
    setMovingStudentId(null);
  };

  const handleMove = (targetGroupId: string | null): void => {
    if (movingStudentId === null) return;

    const student = grouping.studentById.get(movingStudentId);
    grouping.moveStudent(movingStudentId, targetGroupId);
    setMovingStudentId(null);

    if (student) {
      toast.info(
        targetGroupId === null
          ? `${student.name} 학생을 모둠에서 뺐습니다.`
          : `${student.name} 학생을 옮겼습니다.`,
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {/*
          "4명씩"으로 생각하는 교사가 28명을 7모둠으로 암산하지 않게, 모둠 수와
          모둠당 인원 두 눈금을 둔다. 인원 눈금을 돌리면 모둠 수가 따라 바뀐다
          (suggestGroupCount) — 편성 함수는 여전히 모둠 수 하나만 받는다.
        */}
        <div className="inline-flex gap-0.5 rounded-control border border-slate-200 p-0.5" role="group" aria-label="편성 기준">
          <Button
            size="sm"
            variant={sizeMode === 'groupCount' ? 'primary' : 'ghost'}
            aria-pressed={sizeMode === 'groupCount'}
            onClick={() => setSizeMode('groupCount')}
          >
            모둠 수
          </Button>
          <Button
            size="sm"
            variant={sizeMode === 'membersPerGroup' ? 'primary' : 'ghost'}
            aria-pressed={sizeMode === 'membersPerGroup'}
            onClick={() => setSizeMode('membersPerGroup')}
          >
            모둠당 인원
          </Button>
        </div>

        {sizeMode === 'groupCount' ? (
          <div className="inline-flex items-center gap-1 rounded-control border border-slate-200 px-1.5 py-1">
            <span className="text-xs text-slate-500">모둠 수</span>
            <Button
              size="sm"
              variant="ghost"
              aria-label="모둠 수 줄이기"
              disabled={targetCount <= MIN_GROUP_COUNT}
              onClick={() => setTargetCount((value) => Math.max(MIN_GROUP_COUNT, value - 1))}
              className="size-6 p-0"
            >
              −
            </Button>
            <span className="w-5 text-center font-mono text-sm text-slate-800">{targetCount}</span>
            <Button
              size="sm"
              variant="ghost"
              aria-label="모둠 수 늘리기"
              disabled={targetCount >= MAX_GROUP_COUNT}
              onClick={() => setTargetCount((value) => Math.min(MAX_GROUP_COUNT, value + 1))}
              className="size-6 p-0"
            >
              +
            </Button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 rounded-control border border-slate-200 px-1.5 py-1">
            <span className="text-xs text-slate-500">모둠당</span>
            <Button
              size="sm"
              variant="ghost"
              aria-label="모둠당 인원 줄이기"
              disabled={membersPerGroup <= 2}
              onClick={() => setMembers(membersPerGroup - 1)}
              className="size-6 p-0"
            >
              −
            </Button>
            <span className="w-5 text-center font-mono text-sm text-slate-800">{membersPerGroup}</span>
            <Button
              size="sm"
              variant="ghost"
              aria-label="모둠당 인원 늘리기"
              disabled={membersPerGroup >= 10}
              onClick={() => setMembers(membersPerGroup + 1)}
              className="size-6 p-0"
            >
              +
            </Button>
            <span className="text-xs text-slate-500">명</span>
          </div>
        )}

        <span className="text-sm text-slate-500">
          학생 {grouping.roster.length}명 ·{' '}
          {sizeMode === 'groupCount'
            ? `모둠당 약 ${Math.ceil(grouping.roster.length / Math.max(1, targetCount))}명`
            : `${targetCount}모둠`}
        </span>

        {grouping.lockedStudentIds.size > 0 ? (
          <Badge tone="brand">모둠 고정 {grouping.lockedStudentIds.size}명</Badge>
        ) : null}

        <div className="ml-auto flex gap-2">
          <Button icon={Scale} variant="secondary" onClick={handleBalance}>
            균형 편성
          </Button>
          <Button icon={Shuffle} variant="primary" onClick={handleShuffle}>
            무작위 편성
          </Button>
          {grouping.groups.length > 0 ? (
            <Button icon={Eraser} variant="ghost" onClick={() => setConfirmClear(true)}>
              모둠 지우기
            </Button>
          ) : null}
        </div>

        <p className="w-full text-xs text-slate-500">
          균형 편성은 성별과 특성 태그를 고르게 나눕니다. 태그는 명단에서 학생 정보를 수정해
          넣습니다. 인원이 맞지 않으면 완전히 고르지 않을 수 있어, 편성 뒤 손으로 옮길 수 있습니다.
        </p>
      </div>

      {movingStudentId !== null ? (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-brand-200 bg-brand-50 p-3">
          <span className="text-sm text-brand-700">
            <strong>{grouping.studentById.get(movingStudentId)?.name}</strong> 학생을 어디로
            옮길까요?
          </span>
          {/*
            모둠 칩을 배너에 나열한다. 8모둠이면 대상 카드가 화면 밖이라
            "카드까지 스크롤 → 여기로 옮기기"가 이동 한 번마다 반복됐다.
            여기서 바로 끝낸다. 카드의 [여기로 옮기기]도 그대로 둔다 —
            눈앞에 카드가 보이면 그쪽이 더 자연스럽다.
          */}
          <div className="flex flex-wrap items-center gap-1">
            {grouping.groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => handleMove(group.id)}
                className="inline-flex items-center gap-1.5 rounded-control border border-brand-200 bg-surface px-2 py-1 text-sm text-slate-800 hover:border-brand-500"
              >
                <span
                  className={cx('size-2 rounded-full', groupColorStyle(group.color).dot)}
                  aria-hidden
                />
                {group.name}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => handleMove(null)}>
              모둠에서 빼기
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMovingStudentId(null)}>
              취소
            </Button>
          </div>
        </div>
      ) : null}

      {grouping.groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="아직 모둠이 없습니다"
          description="모둠 수를 정하고 편성 버튼을 누르면 명단으로 바로 나눕니다."
          action={
            <Button variant="primary" icon={Shuffle} onClick={handleShuffle}>
              모둠 편성
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {grouping.groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              studentById={grouping.studentById}
              lockedStudentIds={grouping.lockedStudentIds}
              isMoveTarget={movingStudentId !== null}
              onSelectAsTarget={() => handleMove(group.id)}
              onRename={(name) => grouping.renameGroup(group.id, name)}
              onSetLeader={(studentId) => grouping.setLeader(group.id, studentId)}
              onToggleLock={grouping.toggleGroupLock}
              onStartMove={setMovingStudentId}
            />
          ))}
        </div>
      )}

      {grouping.ungrouped.length > 0 ? (
        <Card title={`모둠이 없는 학생 ${grouping.ungrouped.length}명`}>
          <ul className="flex flex-wrap gap-2">
            {grouping.ungrouped.map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => setMovingStudentId(student.id)}
                  className="inline-flex items-baseline gap-1.5 rounded-control border border-slate-200 bg-surface px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span className="font-mono text-xs text-slate-400">{student.number}</span>
                  {student.name}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmClear}
        title="모둠 편성을 지울까요?"
        description="이 학급의 모둠이 모두 사라집니다. 모둠 이름과 모둠장도 함께 사라집니다. 지우기 직전 상태는 자동으로 백업됩니다."
        confirmLabel="모둠 지우기"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          void (async () => {
            await grouping.clearGroups();
            setConfirmClear(false);
            toast.info('모둠 편성을 지웠습니다.');
          })();
        }}
      />
    </div>
  );
}

function GroupCard({
  group,
  studentById,
  lockedStudentIds,
  isMoveTarget,
  onSelectAsTarget,
  onRename,
  onSetLeader,
  onToggleLock,
  onStartMove,
}: {
  group: Group;
  studentById: Map<string, Student>;
  lockedStudentIds: Set<string>;
  isMoveTarget: boolean;
  onSelectAsTarget: () => void;
  onRename: (name: string) => void;
  onSetLeader: (studentId: string | null) => void;
  onToggleLock: (studentId: string) => void;
  onStartMove: (studentId: string) => void;
}) {
  const style = groupColorStyle(group.color);
  const members = group.studentIds
    .map((id) => studentById.get(id))
    .filter((student): student is Student => student !== undefined)
    .sort((a, b) => a.number - b.number);

  return (
    <section className={cx('rounded-card border p-3', style.card)}>
      <header className="flex items-center gap-2">
        <span className={cx('size-2.5 shrink-0 rounded-full', style.dot)} aria-hidden />
        <input
          defaultValue={group.name}
          onBlur={(event) => onRename(event.target.value)}
          aria-label={`${group.name} 이름`}
          className={cx(
            'min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold',
            'hover:border-slate-300 focus:border-slate-400 focus:bg-surface',
            style.text,
          )}
        />
        <span className="shrink-0 text-xs text-slate-500">{members.length}명</span>
      </header>

      {isMoveTarget ? (
        <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={onSelectAsTarget}>
          여기로 옮기기
        </Button>
      ) : null}

      <ul className="mt-2 flex flex-col gap-1">
        {members.length === 0 ? (
          <li className="px-1 py-2 text-sm text-slate-400">아직 학생이 없습니다</li>
        ) : (
          members.map((student) => {
            const isLeader = group.leaderId === student.id;
            const isLocked = lockedStudentIds.has(student.id);

            return (
              <li
                key={student.id}
                className="flex items-center gap-1 rounded bg-surface/70 px-1.5 py-1 text-sm"
              >
                <span className="font-mono text-xs text-slate-400">{student.number}</span>
                <button
                  type="button"
                  onClick={() => onStartMove(student.id)}
                  className="min-w-0 flex-1 truncate text-left text-slate-800 hover:underline"
                  aria-label={`${student.name} 모둠 옮기기`}
                >
                  {student.name}
                </button>

                <button
                  type="button"
                  onClick={() => onSetLeader(isLeader ? null : student.id)}
                  aria-label={`${student.name} 모둠장 ${isLeader ? '해제' : '지정'}`}
                  aria-pressed={isLeader}
                  className={cx(
                    'rounded p-0.5',
                    isLeader ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500',
                  )}
                >
                  <Crown className="size-3.5" aria-hidden />
                </button>

                <button
                  type="button"
                  onClick={() => onToggleLock(student.id)}
                  aria-label={`${student.name} 모둠 ${isLocked ? '고정 해제' : '고정'}`}
                  aria-pressed={isLocked}
                  className={cx(
                    'rounded p-0.5',
                    isLocked ? 'text-brand-700' : 'text-slate-300 hover:text-slate-500',
                  )}
                >
                  <Lock className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
