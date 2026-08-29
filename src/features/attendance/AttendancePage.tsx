import { CalendarCheck, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ATTENDANCE_STATUSES, type AttendanceStatus, type Student } from '../../shared/domain/types';
import { useActiveClass, useRoster, useSuite } from '../../shared/roster/SuiteDataProvider';
import { useToday } from '../../shared/state/useToday';
import { Badge, Button, Card, cx, EmptyState, Table, Tabs } from '../../shared/ui';
import {
  monthlyCounts,
  nextStatus,
  noteOf,
  setNote,
  setStatus,
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
  const classId = activeClass?.id ?? '';

  const summary = summarize(data.attendanceRecords, classId, date, roster.length);
  const marked = roster.filter(
    (student) => statusOf(data.attendanceRecords, classId, date, student.id) !== null,
  );

  const cycle = (studentId: string): void => {
    const current = statusOf(data.attendanceRecords, classId, date, studentId);
    const next = nextStatus(current);
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
          max={today}
          onChange={(event) => onDateChange(event.target.value === today ? null : event.target.value)}
          aria-label="출결 날짜"
          className="h-9 rounded-control border border-slate-300 px-2 text-sm"
        />
        {date !== today ? (
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => onDateChange(null)}>
            오늘로
          </Button>
        ) : null}

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
        <p className="mb-3 text-sm text-slate-500">
          이름을 누를 때마다 출석 → 결석 → 지각 → 조퇴 → 체험학습 순으로 바뀝니다.
        </p>
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {roster.map((student) => {
            const status = statusOf(data.attendanceRecords, classId, date, student.id);
            return (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => cycle(student.id)}
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
        <p className="ml-auto text-sm text-slate-500">나이스 월말 입력 때 옆에 두고 보는 표입니다.</p>
      </div>

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
