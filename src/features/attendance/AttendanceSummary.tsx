import { useActiveClass, useRoster, useSuite } from '../../shared/roster/SuiteDataProvider';
import { useToday } from '../../shared/state/useToday';
import { BigStat, PendingNote } from '../home/SummaryCard';
import { isConfirmed, statusOf, summarize, STATUS_LABELS } from './attendanceCore';

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
    // "여기서 바로"라고 하면 거짓말이다 — 이 카드는 이동만 한다.
    return <PendingNote>명단을 등록하면 출결 화면에서 이름을 눌러 찍을 수 있습니다.</PendingNote>;
  }

  const summary = summarize(data.attendanceRecords, classId, today, roster.length);
  const confirmed = isConfirmed(data.attendanceRecords, classId, today);

  if (summary.marked === 0) {
    // 확인 도장이 있으면 '안 찍음'이 아니라 '전원 출석 확인함'이다.
    return confirmed ? (
      <BigStat value={roster.length} unit="명 전원 출석" note="오늘 출결 확인 완료" />
    ) : (
      <PendingNote>아직 오늘 출결을 찍지 않았습니다. 전원 출석이면 [출결 확인]만 눌러 주세요.</PendingNote>
    );
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
