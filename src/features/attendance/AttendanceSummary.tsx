import { useActiveClass, useRoster, useSuite } from '../../shared/roster/SuiteDataProvider';
import { useToday } from '../../shared/state/useToday';
import { BigStat, PendingNote } from '../home/SummaryCard';
import { statusOf, summarize, STATUS_LABELS } from './attendanceCore';

/**
 * 홈의 '오늘 출결' 카드 본문.
 *
 * 아침에 홈만 열어도 오늘 누가 없는지 보여야 한다. 아직 안 찍은 날은
 * 찍으러 가라고 안내한다 — 전원 출석과 안 찍음은 다른 상태다.
 */
export function AttendanceSummary() {
  const { data } = useSuite();
  const activeClass = useActiveClass();
  const roster = useRoster();
  const today = useToday();
  const classId = activeClass?.id ?? '';

  if (roster.length === 0) {
    return <PendingNote>명단을 등록하면 아침 출결을 여기서 바로 찍을 수 있습니다.</PendingNote>;
  }

  const summary = summarize(data.attendanceRecords, classId, today, roster.length);

  if (summary.marked === 0) {
    return <PendingNote>아직 오늘 출결을 찍지 않았습니다. 전원 출석이면 그대로 두시면 됩니다.</PendingNote>;
  }

  const away = roster.filter((student) => statusOf(data.attendanceRecords, classId, today, student.id) !== null);

  return (
    <div>
      <BigStat value={summary.present} unit="명 출석" note={`기록 ${summary.marked}명`} />
      <ul className="mt-1 flex flex-col gap-0.5">
        {away.slice(0, 3).map((student) => {
          const status = statusOf(data.attendanceRecords, classId, today, student.id);
          return (
            <li key={student.id} className="truncate text-sm text-slate-500">
              {student.name} — {status === null ? '' : STATUS_LABELS[status]}
            </li>
          );
        })}
        {away.length > 3 ? <li className="text-sm text-slate-400">외 {away.length - 3}명</li> : null}
      </ul>
    </div>
  );
}
