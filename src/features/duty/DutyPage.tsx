import {
  Check,
  Eraser,
  Lock,
  Monitor,
  Plus,
  Printer,
  Scale,
  Shuffle,
  Trash2,
  UserRoundCog,
  Users,
  Wand2,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { ROLE_CATEGORIES, type DutyRole, type RoleCategory, type RoleCycle } from '../../shared/domain/types';
import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { statusOf, STATUS_LABELS } from '../attendance/attendanceCore';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  cx,
  EmptyState,
  Modal,
  PrintLayout,
  Tabs,
  usePrint,
  useToast,
} from '../../shared/ui';
import { openBoard } from '../../shared/window/openBoard';
import { useDuty } from './useDuty';

type DutyTab = 'today' | 'roles' | 'fairness';

/**
 * 역할·당번 화면.
 *
 * 원본 G-class-duty-manager를 이식했다. 학기 관리(OperationPeriod)는
 * 공통 Term으로 이미 통합했으므로 여기서는 다루지 않는다.
 */
export default function DutyPage() {
  const activeClass = useActiveClass();
  const duty = useDuty();
  const toast = useToast();
  const { data } = useSuite();
  const printNow = usePrint();

  const [tab, setTab] = useState<DutyTab>('today');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<DutyRole | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [substituteRoleId, setSubstituteRoleId] = useState<string | null>(null);

  if (activeClass === null) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          title="학급을 먼저 만들어 주세요"
          description="학급과 명단이 있어야 당번을 배정할 수 있습니다."
          action={
            <Link
              to="/setup"
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-press"
            >
              처음 설정 시작하기
            </Link>
          }
        />
      </Card>
    );
  }

  if (duty.roster.length === 0) {
    return (
      <Card title="역할·당번" icon={Wand2} accentClass="text-duty-500">
        <EmptyState
          icon={Users}
          title="학생 명단이 비어 있습니다"
          description="명단을 등록하면 당번을 자동으로 배정할 수 있습니다."
          action={
            <Link
              to="/roster"
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-press"
            >
              명단 등록하기
            </Link>
          }
        />
      </Card>
    );
  }

  const handleAssign = (): void => {
    const { warnings, assignedRoles } = duty.assignWeek();

    if (assignedRoles === 0) {
      toast.warning('오늘 배정할 역할이 없습니다. 역할의 활성 요일을 확인해 주세요.');
      return;
    }

    toast.success(`${duty.week.label} 당번을 배정했습니다.`);
    for (const warning of warnings) toast.warning(warning.message);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">역할·당번</h1>
        <Badge tone="neutral">{duty.week.label}</Badge>
        {duty.fairness.spread > 2 ? (
          <Badge tone="warning">배정이 {duty.fairness.spread}회 차이로 쏠려 있습니다</Badge>
        ) : null}

        <div className="ml-auto flex flex-wrap gap-2">
          <Button icon={Shuffle} variant="primary" disabled={!duty.hasRoles} onClick={handleAssign}>
            이번 주 배정
          </Button>
          <Button variant="secondary" icon={Monitor} onClick={() => openBoard('/board/duty')}>
            전자칠판
          </Button>
          <Button
            variant="secondary"
            icon={Printer}
            disabled={duty.currentRound === null}
            onClick={printNow}
          >
            당번표 인쇄
          </Button>
        </div>
      </div>

      {/* 인쇄 전용 당번표. 교실 뒤 게시판에 붙이는 종이다. */}
      {duty.currentRound !== null ? (
        <PrintLayout
          title={`${activeClass?.name ?? ''} 당번표`}
          subtitle={duty.currentRound.label}
          footer={[data.profile.schoolName, data.profile.teacherName].filter(Boolean).join(' · ')}
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-black px-2 py-1.5 text-left">역할</th>
                <th className="border border-black px-2 py-1.5 text-left">맡은 학생</th>
              </tr>
            </thead>
            <tbody>
              {duty.currentRound.assignments.map((assignment) => {
                const role = duty.roles.find((item) => item.id === assignment.roleId);
                if (role === undefined) return null;
                const names = assignment.studentIds
                  .map((id) => duty.roster.find((student) => student.id === id)?.name)
                  .filter(Boolean)
                  .join(', ');

                return (
                  <tr key={assignment.roleId}>
                    <td className="border border-black px-2 py-1.5">{role.name}</td>
                    <td className="border border-black px-2 py-1.5">{names}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PrintLayout>
      ) : null}

      <Tabs
        items={[
          { id: 'today', label: '오늘의 당번', count: duty.todayDuties.length },
          { id: 'roles', label: '역할 관리', count: duty.roles.length },
          { id: 'fairness', label: '공정성' },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as DutyTab)}
      >
        {tab === 'today' ? (
          <TodayTab
            duty={duty}
            onGoRoles={() => setTab('roles')}
            onSubstitute={setSubstituteRoleId}
          />
        ) : null}

        {tab === 'roles' ? (
          <RolesTab
            duty={duty}
            onAdd={() => setAddOpen(true)}
            onDelete={setDeleting}
            onClear={() => setConfirmClear(true)}
          />
        ) : null}

        {tab === 'fairness' ? <FairnessTab duty={duty} /> : null}
      </Tabs>

      <SubstituteModal
        duty={duty}
        roleId={substituteRoleId}
        onClose={() => setSubstituteRoleId(null)}
      />

      <AddRoleModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(input) => {
          duty.addRole(input);
          setAddOpen(false);
          toast.success(`${input.name} 역할을 만들었습니다.`);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`${deleting?.name ?? ''} 역할을 지울까요?`}
        description="이 역할의 지난 배정 기록도 함께 정리됩니다. 지우기 직전 상태는 자동으로 백업됩니다."
        destructive
        confirmLabel="역할 삭제"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting === null) return;
          void (async () => {
            await duty.deleteRole(deleting.id);
            toast.warning(`${deleting.name} 역할을 지웠습니다.`);
            setDeleting(null);
          })();
        }}
      />

      <ConfirmDialog
        open={confirmClear}
        title="당번 배정 기록을 지울까요?"
        description="이 학급의 지난 배정이 모두 사라집니다. 역할 자체는 남습니다. 공정성 계산도 처음부터 다시 시작됩니다."
        confirmLabel="기록 지우기"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          void (async () => {
            await duty.clearRounds();
            setConfirmClear(false);
            toast.info('당번 배정 기록을 지웠습니다.');
          })();
        }}
      />
    </div>
  );
}

function TodayTab({
  duty,
  onGoRoles,
  onSubstitute,
}: {
  duty: ReturnType<typeof useDuty>;
  onGoRoles: () => void;
  onSubstitute: (roleId: string) => void;
}) {
  /*
   * 오늘 출결을 여기서 읽는다. 결석·체험학습인 학생이 당번이면 배지로
   * 보여야 교사가 대체를 떠올린다 — 출결을 찍는 화면과 당번을 보는 화면이
   * 다른데, 그 사이를 잇는 것이 이 배지다.
   */
  const { data } = useSuite();
  const activeClass = useActiveClass();
  const classId = activeClass?.id ?? '';

  if (!duty.hasRoles) {
    return (
      <EmptyState
        icon={Wand2}
        title="아직 역할이 없습니다"
        description="칠판 지우기·교실 바닥처럼 흔한 역할을 기본으로 만들어 드릴 수 있습니다. 이름과 인원은 나중에 고치면 됩니다."
        action={<Button variant="primary" onClick={onGoRoles}>역할 만들기</Button>}
      />
    );
  }

  if (duty.currentRound === null) {
    return (
      <EmptyState
        icon={Shuffle}
        title="아직 배정하지 않았습니다"
        description="위의 '이번 주 배정'을 누르면 적게 한 학생부터 순서대로 배정합니다."
      />
    );
  }

  if (duty.todayDuties.length === 0) {
    return (
      <EmptyState
        title="오늘은 당번이 없습니다"
        description="역할의 활성 요일에 오늘이 빠져 있습니다. 역할 관리에서 확인해 주세요."
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {duty.todayDuties.map(({ role, students, replaced, doneStudentIds, isDone }) => {
        const locked = duty.currentRound?.lockedRoleIds.includes(role.id) === true;

        return (
          <li
            key={role.id}
            className={cx(
              'rounded-card border p-3',
              isDone ? 'border-success-200 bg-success-50' : 'border-slate-200 bg-surface',
            )}
          >
            <header className="flex items-center gap-2">
              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                {role.name}
              </h3>
              {isDone ? <Badge tone="success">완료</Badge> : null}

              {/*
                대체 버튼을 학생 줄이 아니라 여기 둔다.
                학생 줄은 줄 전체가 완료 토글 버튼이라, 그 안에 버튼을 넣으면
                버튼 안의 버튼이 된다.
              */}
              <button
                type="button"
                onClick={() => onSubstitute(role.id)}
                aria-label={`${role.name} 오늘 대체`}
                title="오늘 대체"
                className="rounded p-0.5 text-slate-300 hover:text-slate-500"
              >
                <UserRoundCog className="size-3.5" aria-hidden />
              </button>

              <button
                type="button"
                onClick={() => duty.toggleRoleLock(role.id)}
                aria-label={`${role.name} ${locked ? '고정 해제' : '고정'}`}
                aria-pressed={locked}
                className={cx('rounded p-0.5', locked ? 'text-brand-700' : 'text-slate-300 hover:text-slate-500')}
              >
                <Lock className="size-3.5" aria-hidden />
              </button>
            </header>

            <ul className="mt-2 flex flex-col gap-1">
              {students.length === 0 ? (
                <li className="px-1 py-1.5 text-sm text-slate-400">배정된 학생이 없습니다</li>
              ) : (
                students.map((student) => {
                  const swap = replaced.find((r) => r.substitute.id === student.id);
                  // 역할 전체가 아니라 이 학생이 마쳤는지를 본다.
                  // 전체 완료 여부를 쓰면 한 명을 눌러도 화면이 그대로여서
                  // 교사는 눌린 건지 알 수 없다.
                  const done = doneStudentIds.has(student.id);

                  return (
                    <li key={student.id}>
                      <button
                        type="button"
                        onClick={() => duty.toggleCompleted(role.id, student.id)}
                        aria-pressed={done}
                        className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-slate-50"
                      >
                        <span
                          className={cx(
                            'inline-flex size-4 shrink-0 items-center justify-center rounded border',
                            done ? 'border-success-500 bg-success-500 text-white' : 'border-slate-300',
                          )}
                          aria-hidden
                        >
                          {done ? <Check className="size-3" /> : null}
                        </span>
                        <span className="font-mono text-xs text-slate-400">{student.number}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-800">{student.name}</span>
                        {swap ? (
                          <Badge tone="info">{swap.original.name} 대신</Badge>
                        ) : null}
                        {(() => {
                          const status = statusOf(data.attendanceRecords, classId, duty.today, student.id);
                          // 결석·체험학습은 오늘 교실에 없다. 대체가 필요하다는 신호다.
                          return status === 'absent' || status === 'fieldTrip' ? (
                            <Badge tone="danger">{STATUS_LABELS[status]}</Badge>
                          ) : null;
                        })()}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 오늘 하루 당번 대체.
 *
 * `DutyCompletion`이 날짜별 기록이라 대체도 그날치다. 결석·조퇴 때문에
 * 하루만 바꾸는 것이 이 기능의 쓸모다.
 *
 * 화면은 이미 대체자를 읽어 표시하고 있었다(`{원래 학생} 대신` 배지).
 * 넣을 방법만 없었다.
 */
function SubstituteModal({
  duty,
  roleId,
  onClose,
}: {
  duty: ReturnType<typeof useDuty>;
  roleId: string | null;
  onClose: () => void;
}) {
  // 훅은 이른 return보다 먼저. 출결은 대체 후보를 거르는 데 쓴다.
  const { data } = useSuite();
  const activeClass = useActiveClass();
  const classId = activeClass?.id ?? '';

  const entry = duty.todayDuties.find((item) => item.role.id === roleId);
  if (roleId === null || entry === undefined) return null;

  const { role, students, replaced } = entry;

  /*
   * students는 대체가 반영된 목록이라 그대로 쓰면 "누구를 대신할지"를 못 고른다.
   * 대체된 자리는 원래 학생으로 되돌려 원래 당번 목록을 만든다.
   */
  const originals = students.map((student) => {
    const swap = replaced.find((item) => item.substitute.id === student.id);
    return { original: swap?.original ?? student, current: student };
  });

  // 오늘 이 역할을 맡은 사람은 후보에서 뺀다. 당번이 당번을 대신하는 것은 대체가 아니다.
  // 결석·체험학습인 학생도 뺀다. 없는 사람을 대신 세우는 것은 대체가 아니라 실수다.
  const onDuty = new Set(students.map((student) => student.id));
  const candidates = duty.roster.filter((student) => {
    if (onDuty.has(student.id)) return false;
    const status = statusOf(data.attendanceRecords, classId, duty.today, student.id);
    return status !== 'absent' && status !== 'fieldTrip';
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`${role.name} 오늘 대체`}
      size="sm"
      footer={
        <Button variant="primary" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <p className="mb-3 text-sm text-slate-500">
        오늘({duty.today})만 바뀝니다. 내일은 원래 당번으로 돌아옵니다.
      </p>

      <ul className="flex flex-col gap-2">
        {originals.map(({ original, current }) => {
          const substituted = original.id !== current.id;

          return (
            <li
              key={original.id}
              className="flex flex-wrap items-center gap-2 rounded-control border border-slate-200 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                <span className="font-mono text-xs text-slate-400">{original.number}</span>{' '}
                {original.name}
              </span>

              <label className="sr-only" htmlFor={`sub-${original.id}`}>
                {original.name} 대신할 학생
              </label>
              <select
                id={`sub-${original.id}`}
                value={substituted ? current.id : ''}
                onChange={(event) =>
                  duty.setSubstitute(
                    role.id,
                    original.id,
                    event.target.value === '' ? null : event.target.value,
                  )
                }
                className="h-9 rounded-control border border-slate-300 px-2 text-sm"
              >
                <option value="">(대체 없음)</option>
                {candidates.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.number} {student.name}
                  </option>
                ))}
                {/* 지금 대체 중인 학생은 후보 목록에 없다. 골라 둔 값이 사라지면 안 된다. */}
                {substituted && !candidates.some((student) => student.id === current.id) ? (
                  <option value={current.id}>
                    {current.number} {current.name}
                  </option>
                ) : null}
              </select>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

function RolesTab({
  duty,
  onAdd,
  onDelete,
  onClear,
}: {
  duty: ReturnType<typeof useDuty>;
  onAdd: () => void;
  onDelete: (role: DutyRole) => void;
  onClear: () => void;
}) {
  const toast = useToast();

  if (!duty.hasRoles) {
    return (
      <EmptyState
        icon={Wand2}
        title="아직 역할이 없습니다"
        description="흔히 쓰는 역할 5가지를 기본으로 깔아 드립니다. 이름·인원·주기는 나중에 고치면 됩니다."
        action={
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                const count = duty.seedStarterRoles();
                toast.success(`기본 역할 ${count}개를 만들었습니다.`);
              }}
            >
              기본 역할 만들기
            </Button>
            <Button icon={Plus} onClick={onAdd}>
              직접 추가
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button icon={Plus} onClick={onAdd}>
          역할 추가
        </Button>
        <Button icon={Eraser} variant="ghost" onClick={onClear}>
          배정 기록 지우기
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {duty.roles.map((role) => (
          <li
            key={role.id}
            className="flex flex-wrap items-center gap-2 rounded-card border border-slate-200 bg-surface p-3"
          >
            <input
              defaultValue={role.name}
              onBlur={(event) => {
                const name = event.target.value.trim();
                if (name !== '' && name !== role.name) duty.updateRole(role.id, { name });
              }}
              aria-label={`${role.name} 이름`}
              className="min-w-32 flex-1 rounded border border-transparent px-1.5 py-1 text-sm font-medium hover:border-slate-300 focus:border-slate-400"
            />
            <Badge tone="neutral">{role.category}</Badge>

            <label className="flex items-center gap-1 text-sm text-slate-600">
              인원
              <input
                type="number"
                min={1}
                max={40}
                defaultValue={role.neededCount}
                onBlur={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  if (Number.isFinite(value) && value >= 1) {
                    duty.updateRole(role.id, { neededCount: value });
                  }
                }}
                aria-label={`${role.name} 필요 인원`}
                className="h-8 w-14 rounded-control border border-slate-300 px-2 text-sm"
              />
            </label>

            <Button
              size="sm"
              variant={role.isActive ? 'secondary' : 'ghost'}
              aria-pressed={role.isActive}
              onClick={() => duty.updateRole(role.id, { isActive: !role.isActive })}
            >
              {role.isActive ? '사용 중' : '사용 안 함'}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              icon={Trash2}
              iconOnly
              aria-label={`${role.name} 삭제`}
              onClick={() => onDelete(role)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FairnessTab({ duty }: { duty: ReturnType<typeof useDuty> }) {
  const { fairness } = duty;

  if (duty.history.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="아직 배정 기록이 없습니다"
        description="한 번이라도 배정하면 누가 몇 번 했는지 여기서 확인할 수 있습니다."
      />
    );
  }

  const rows = duty.roster
    .map((student) => ({ student, count: fairness.counts.get(student.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.student.number - b.student.number);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Badge tone={fairness.spread <= 1 ? 'success' : fairness.spread <= 2 ? 'warning' : 'danger'}>
          최다 {fairness.max}회 · 최소 {fairness.min}회
        </Badge>
        {fairness.spread <= 1 ? (
          <span className="text-sm text-slate-500">고르게 돌아가고 있습니다.</span>
        ) : (
          <span className="text-sm text-slate-500">
            차이가 {fairness.spread}회입니다. 다음 배정에서 적게 한 학생이 먼저 뽑힙니다.
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-1">
        {rows.map(({ student, count }) => (
          <li key={student.id} className="flex items-center gap-2 text-sm">
            <span className="w-8 shrink-0 text-right font-mono text-xs text-slate-400">
              {student.number}
            </span>
            <span className="w-20 shrink-0 truncate text-slate-800">{student.name}</span>
            <span className="flex-1">
              <span
                className="block h-2 rounded-full bg-duty-500"
                style={{ width: `${fairness.max === 0 ? 0 : (count / fairness.max) * 100}%` }}
              />
            </span>
            <span className="w-10 shrink-0 text-right text-slate-500">{count}회</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddRoleModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (input: Pick<DutyRole, 'name' | 'category' | 'neededCount' | 'cycle'>) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<RoleCategory>('청소구역');
  const [neededCount, setNeededCount] = useState('2');
  const [cycle, setCycle] = useState<RoleCycle>('weekly');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="역할 추가"
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
              const parsed = Number.parseInt(neededCount, 10);
              onAdd({
                name: name.trim(),
                category,
                neededCount: Number.isFinite(parsed) && parsed >= 1 ? parsed : 1,
                cycle,
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
          <span className="text-slate-700">역할 이름</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="칠판 지우기"
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-700">분류</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as RoleCategory)}
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-2"
          >
            {ROLE_CATEGORIES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>

        <div className="flex gap-3">
          <label className="block flex-1 text-sm">
            <span className="text-slate-700">필요 인원</span>
            <input
              type="number"
              min={1}
              max={40}
              value={neededCount}
              onChange={(event) => setNeededCount(event.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
            />
          </label>
          <label className="block flex-1 text-sm">
            <span className="text-slate-700">주기</span>
            <select
              value={cycle}
              onChange={(event) => setCycle(event.target.value as RoleCycle)}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-2"
            >
              <option value="daily">매일</option>
              <option value="weekly">주간</option>
              <option value="biweekly">격주</option>
              <option value="monthly">월간</option>
            </select>
          </label>
        </div>
      </div>
    </Modal>
  );
}
