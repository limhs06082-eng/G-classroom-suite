import { CalendarCheck, CheckCheck, ChevronLeft, ChevronRight, Printer, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ATTENDANCE_STATUSES, type AttendanceStatus, type Student } from '../../shared/domain/types';
import { useActiveClass, useRoster, useSuite } from '../../shared/roster/SuiteDataProvider';
import { useToday } from '../../shared/state/useToday';
import { Badge, Button, Card, cx, EmptyState, PrintLayout, Table, Tabs, usePrint, useToast } from '../../shared/ui';
import {
  isConfirmed,
  monthlyCounts,
  nextStatus,
  noteOf,
  setConfirmed,
  setNote,
  setStatus,
  setStatusMany,
  statusOf,
  STATUS_LABELS,
  summarize,
} from './attendanceCore';

/**
 * 출결.
 *
 * 아침에 이름을 탭해서 찍는 화면이다. 탭할 때마다
 * 출석 → 결석 → 지각 → 조퇴 → 체험학습 → 출석으로 돈다 — 과제 화면의
 * 상태 순환과 같은 조작이라 따로 배울 것이 없다.
 *
 * 전자칠판이 없다. 결석자 명단은 교사가 보는 것이지 교실 화면에
 * 띄울 것이 아니다.
 */

const STATUS_TONES: Record<AttendanceStatus, string> = {
  absent: 'border-danger-200 bg-danger-50 text-danger-700',
  late: 'border-warning-200 bg-warning-50 text-warning-700',
  early: 'border-slate-300 bg-slate-100 text-slate-700',
  fieldTrip: 'border-attendance-500/30 bg-attendance-50 text-attendance-700',
};

export default function AttendancePage() {
  const activeClass = useActiveClass();
  const roster = useRoster();
  const today = useToday();

  const [tab, setTab] = useState('today');
  const [date, setDate] = useState<string | null>(null);

  // 날짜를 안 골랐으면 오늘이다. 자정이 지나면 저절로 다음 날로 넘어간다.
  const targetDate = date ?? today;

  if (activeClass === null || roster.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CalendarCheck}
          title="명단이 있어야 출결을 찍을 수 있습니다"
          description="학급과 학생 명단을 먼저 등록해 주세요."
          action={
            <Link
              to={activeClass === null ? '/setup' : '/roster'}
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-press"
            >
              {activeClass === null ? '처음 설정 시작하기' : '명단 등록하기'}
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">출결</h1>
        <p className="text-sm text-slate-500">{activeClass.name}</p>
      </div>

      <Tabs
        items={[
          { id: 'today', label: '오늘 출결' },
          { id: 'monthly', label: '월별 통계' },
        ]}
        activeId={tab}
        onChange={setTab}
      >
        {tab === 'today' ? (
          <DailyTab date={targetDate} today={today} onDateChange={setDate} />
        ) : (
          <MonthlyTab today={today} />
        )}
      </Tabs>
    </div>
  );
}

function DailyTab({
  date,
  today,
  onDateChange,
}: {
  date: string;
  today: string;
  onDateChange: (date: string | null) => void;
}) {
  const { data, update } = useSuite();
  const activeClass = useActiveClass();
  const roster = useRoster();
  const toast = useToast();
  const classId = activeClass?.id ?? '';

  /*
   * 입력 방식 둘.
   *
   * 기본(null)은 이름을 탭할 때마다 상태가 도는 순환이다. 상태 단추를
   * 먼저 고르면 **그 상태로 찍는 붓**이 된다 — 시간표의 "과목 먼저 고르고
   * 칸 찍기"와 같은 조작이라 따로 배울 것이 없다. 지각 셋을 찍는 데
   * 탭 여섯 번(순환 2×3) 대신 넷(붓 1 + 학생 3)이면 된다.
   * '출석' 붓은 지우개다 — 잘못 찍은 것을 빠르게 되돌린다.
   */
  const [paint, setPaint] = useState<AttendanceStatus | 'present' | null>(null);

  const summary = summarize(data.attendanceRecords, classId, date, roster.length);
  const confirmed = isConfirmed(data.attendanceRecords, classId, date);
  const marked = roster.filter(
    (student) => statusOf(data.attendanceRecords, classId, date, student.id) !== null,
  );

  const tap = (studentId: string): void => {
    const current = statusOf(data.attendanceRecords, classId, date, studentId);
    const next =
      paint === null
        ? nextStatus(current)
        : paint === 'present'
          ? null
          : // 같은 상태를 다시 찍으면 출석으로 되돌린다. 시간표의
            // "같은 과목을 다시 찍으면 지운다"와 같은 규칙이다.
            current === paint
            ? null
            : paint;

    update((suite) => ({
      ...suite,
      attendanceRecords: setStatus(suite.attendanceRecords, classId, date, studentId, next),
    }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(event) => {
            const value = event.target.value;
            // 지우면 빈 글자('')가 온다. 그대로 두면 날짜 ''에 기록이 쌓인다.
            onDateChange(value === '' || value === today ? null : value);
          }}
          aria-label="출결 날짜"
          className="h-9 rounded-control border border-slate-300 px-2 text-sm"
        />
        {date !== today ? (
          <>
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => onDateChange(null)}>
              오늘로
            </Button>
            {/* 다음 주 체험학습 결석계를 미리 받아 둔 날, 미리 적을 수 있다. */}
            {date > today ? <Badge tone="info">예정 기록입니다</Badge> : null}
          </>
        ) : null}

        {/*
          결석 0명인 날의 "찍었다" 도장. 이것이 없으면 홈 카드가 하루 종일
          "아직 안 찍었다"고 말하고, 교사는 확인하러 다시 들어온다.
        */}
        <Button
          size="sm"
          variant={confirmed ? 'primary' : 'secondary'}
          icon={CheckCheck}
          aria-pressed={confirmed}
          onClick={() =>
            update((suite) => ({
              ...suite,
              attendanceRecords: setConfirmed(
                suite.attendanceRecords,
                classId,
                date,
                !confirmed,
                new Date().toISOString(),
              ),
            }))
          }
        >
          {confirmed ? '확인 완료' : '출결 확인'}
        </Button>

        <div className="ml-auto flex flex-wrap items-center gap-1.5 text-sm">
          <Badge tone="success">출석 {summary.present}</Badge>
          {summary.byStatus.absent > 0 ? <Badge tone="danger">결석 {summary.byStatus.absent}</Badge> : null}
          {summary.byStatus.late > 0 ? <Badge tone="warning">지각 {summary.byStatus.late}</Badge> : null}
          {summary.byStatus.early > 0 ? <Badge tone="neutral">조퇴 {summary.byStatus.early}</Badge> : null}
          {summary.byStatus.fieldTrip > 0 ? (
            <Badge tone="info">체험학습 {summary.byStatus.fieldTrip}</Badge>
          ) : null}
        </div>
      </div>

      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm text-slate-600">한 번에 찍기:</span>
          {ATTENDANCE_STATUSES.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={paint === status ? 'primary' : 'secondary'}
              aria-pressed={paint === status}
              onClick={() => setPaint(paint === status ? null : status)}
            >
              {STATUS_LABELS[status]}
            </Button>
          ))}
          <Button
            size="sm"
            variant={paint === 'present' ? 'primary' : 'secondary'}
            aria-pressed={paint === 'present'}
            onClick={() => setPaint(paint === 'present' ? null : 'present')}
          >
            출석
          </Button>

          {/* 학년 전체 체험학습 같은 날 — 붓을 고른 채 한 번에 다 찍는다. */}
          {paint !== null && paint !== 'present' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                /*
                 * 되돌리기는 **이 학급·이 날짜의 기록 하나만** 바꾼다.
                 * 배열 전체를 스냅숏으로 되돌리면, 토스트가 떠 있는 동안
                 * 다른 날짜·다른 학급에 찍은 것까지 소리 없이 지워진다.
                 */
                const previousRecord =
                  data.attendanceRecords.find(
                    (record) => record.classId === classId && record.date === date,
                  ) ?? null;
                update((suite) => ({
                  ...suite,
                  attendanceRecords: setStatusMany(
                    suite.attendanceRecords,
                    classId,
                    date,
                    roster.map((student) => student.id),
                    paint,
                  ),
                }));
                toast.info(`전원을 ${STATUS_LABELS[paint]}(으)로 찍었습니다.`, {
                  actionLabel: '실행 취소',
                  onAction: () =>
                    update((suite) => ({
                      ...suite,
                      attendanceRecords: [
                        ...suite.attendanceRecords.filter(
                          (record) => record.classId !== classId || record.date !== date,
                        ),
                        ...(previousRecord === null ? [] : [previousRecord]),
                      ],
                    })),
                });
              }}
            >
              전원 {STATUS_LABELS[paint]}
            </Button>
          ) : null}
        </div>

        <p className="mb-3 text-sm text-slate-500">
          {paint === null
            ? '이름을 누를 때마다 출석 → 결석 → 지각 → 조퇴 → 체험학습 순으로 바뀝니다. 위 단추를 고르면 그 상태로 바로 찍습니다.'
            : paint === 'present'
              ? '누르는 학생마다 출석으로 되돌립니다.'
              : `누르는 학생마다 ${STATUS_LABELS[paint]}(으)로 찍습니다. 같은 학생을 다시 누르면 출석으로 돌아갑니다.`}
        </p>
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {roster.map((student) => {
            const status = statusOf(data.attendanceRecords, classId, date, student.id);
            return (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => tap(student.id)}
                  aria-label={`${student.name} — ${status === null ? '출석' : STATUS_LABELS[status]}`}
                  className={cx(
                    'flex h-11 w-full items-center gap-2 rounded-control border px-2.5 text-left text-sm',
                    status === null
                      ? 'border-slate-200 bg-surface text-slate-800 hover:border-slate-300'
                      : STATUS_TONES[status],
                  )}
                >
                  <span data-numeric className="w-5 shrink-0 text-right text-xs text-slate-400">
                    {student.number}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{student.name}</span>
                  {status === null ? null : (
                    <span className="shrink-0 text-xs font-semibold">{STATUS_LABELS[status]}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {marked.length > 0 ? (
        <Card title="사유 메모">
          <ul className="flex flex-col gap-2">
            {marked.map((student) => {
              const status = statusOf(data.attendanceRecords, classId, date, student.id);
              return (
                <li key={student.id} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 truncate text-sm font-medium text-slate-800">
                    {student.name}
                  </span>
                  <Badge tone={status === 'absent' ? 'danger' : status === 'late' ? 'warning' : 'neutral'}>
                    {status === null ? '' : STATUS_LABELS[status]}
                  </Badge>
                  <input
                    /*
                     * key에 날짜·학생을 넣어 날짜를 옮기면 입력이 새로 마운트되게
                     * 한다. defaultValue라 key가 같으면 이전 날짜의 글자가 남는다.
                     */
                    key={`${date}:${student.id}`}
                    defaultValue={noteOf(data.attendanceRecords, classId, date, student.id)}
                    onBlur={(event) =>
                      update((suite) => ({
                        ...suite,
                        attendanceRecords: setNote(
                          suite.attendanceRecords,
                          classId,
                          date,
                          student.id,
                          event.target.value,
                        ),
                      }))
                    }
                    placeholder="사유 (선택)"
                    aria-label={`${student.name} 사유`}
                    className="h-9 min-w-0 flex-1 rounded-control border border-slate-300 px-2 text-sm"
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function MonthlyTab({ today }: { today: string }) {
  const { data } = useSuite();
  const activeClass = useActiveClass();
  // 전출 학생도 그 달의 기록은 보여야 한다. 통계는 지난 일을 다룬다.
  const roster = useRoster({ includeInactive: true });
  const classId = activeClass?.id ?? '';

  const [month, setMonth] = useState(today.slice(0, 7));
  const printNow = usePrint();

  const counts = useMemo(
    () => monthlyCounts(data.attendanceRecords, classId, month),
    [data.attendanceRecords, classId, month],
  );

  const shiftMonth = (delta: number): void => {
    const [year = 0, mon = 1] = month.split('-').map(Number);
    const moved = new Date(year, mon - 1 + delta, 1);
    setMonth(`${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}`);
  };

  const rows = roster.filter((student) => counts.has(student.id));
  const [year = '', mon = ''] = month.split('-');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" icon={ChevronLeft} iconOnly aria-label="이전 달" onClick={() => shiftMonth(-1)} />
        <p className="text-sm font-semibold text-slate-800">
          {year}년 {Number(mon)}월
        </p>
        <Button size="sm" variant="ghost" icon={ChevronRight} iconOnly aria-label="다음 달" onClick={() => shiftMonth(1)} />
        {/* 나이스는 다른 창(다른 PC)이다. 옆에 두고 보라면 종이로도 나가야 한다. */}
        <Button size="sm" variant="secondary" icon={Printer} disabled={rows.length === 0} onClick={printNow}>
          인쇄
        </Button>
        <p className="ml-auto text-sm text-slate-500">나이스 월말 입력 때 옆에 두고 보는 표입니다.</p>
      </div>

      <PrintLayout
        title={`${activeClass?.name ?? ''} ${year}년 ${Number(mon)}월 출결`}
        footer={[data.profile.schoolName, data.profile.teacherName].filter(Boolean).join(' · ')}
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-12 border border-black px-2 py-1.5">번호</th>
              <th className="border border-black px-2 py-1.5 text-left">이름</th>
              {ATTENDANCE_STATUSES.map((status) => (
                <th key={status} className="border border-black px-2 py-1.5">
                  {STATUS_LABELS[status]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((student) => (
              <tr key={student.id}>
                <td data-numeric className="border border-black px-2 py-1 text-center">
                  {student.number}
                </td>
                <td className="border border-black px-2 py-1">{student.name}</td>
                {ATTENDANCE_STATUSES.map((status) => {
                  const value = counts.get(student.id)?.[status] ?? 0;
                  return (
                    <td key={status} data-numeric className="border border-black px-2 py-1 text-center">
                      {value === 0 ? '' : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </PrintLayout>

      <Card>
        <Table<Student>
          caption={`${year}년 ${Number(mon)}월 출결 통계`}
          columns={[
            {
              key: 'number',
              header: '번호',
              align: 'right',
              widthClass: 'w-12',
              render: (student) => student.number,
            },
            { key: 'name', header: '이름', render: (student) => student.name },
            ...ATTENDANCE_STATUSES.map((status) => ({
              key: status,
              header: STATUS_LABELS[status],
              align: 'center' as const,
              render: (student: Student) => {
                const value = counts.get(student.id)?.[status] ?? 0;
                return value === 0 ? '' : value;
              },
            })),
          ]}
          rows={rows}
          rowKey={(student) => student.id}
          empty={
            <EmptyState
              icon={CalendarCheck}
              title="이 달에는 기록이 없습니다"
              description="전원 출석이었거나, 아직 출결을 찍지 않은 달입니다."
            />
          }
        />
      </Card>
    </div>
  );
}
