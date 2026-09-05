import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { PrintLayout } from '../../shared/ui';
import { effectivePeriods, WEEKDAY_NAMES } from '../timetable/timetableCore';
import { eventPhrase, shortDate } from './eventsCore';
import { frequentPhrases } from './noticeCore';
import { eventsBetween } from './weekCore';

/**
 * 주간 안내문 — A4 한 장.
 *
 * 금요일마다 손으로 만들던 "주간 학습 안내"다. 그 주 시간표(하루 바꾸기
 * 반영), 그 주 학급 일정, 늘 챙길 것(최근 알림장에 자주 쓴 글줄), 그리고
 * 교사가 적은 한마디. 인쇄 포털은 마운트된 것을 전부 찍으므로, 이 컴포넌트는
 * 찍을 때만 마운트한다.
 */
export function WeeklySheet({ week, message }: { week: string[]; message: string }) {
  const { data } = useSuite();
  const activeClass = useActiveClass();
  if (activeClass === null || week.length === 0) return null;
  const classId = activeClass.id;
  const monday = week[0] ?? '';
  const friday = week[week.length - 1] ?? monday;

  const periods = [...data.periodTimes].sort((a, b) => a.period - b.period);
  const byDay = week.map((date, index) =>
    effectivePeriods(data.timetableEntries, data.timetableOverrides, classId, date, index + 1),
  );
  const rows = periods.filter((time) => byDay.some((day) => day.some((cell) => cell.period === time.period)));
  const events = eventsBetween(data.classEvents, classId, monday, friday);
  const standing = frequentPhrases(data.notices, classId, monday, { days: 30, limit: 6 });

  return (
    <PrintLayout
      title={`${activeClass.name} 주간 안내`}
      subtitle={`${shortDate(monday)} ~ ${shortDate(friday)}`}
      footer={[data.profile.schoolName, data.profile.teacherName].filter(Boolean).join(' · ')}
    >
      {message.trim() === '' ? null : (
        <p className="print-keep mb-4 whitespace-pre-line text-base leading-relaxed">{message.trim()}</p>
      )}

      <table className="w-full border-collapse text-center text-sm">
        <thead>
          <tr>
            <th className="w-12 border border-black px-2 py-1.5">교시</th>
            {week.map((date, index) => (
              <th key={date} className="border border-black px-2 py-1.5">
                {WEEKDAY_NAMES[index] ?? ''} ({date.slice(5).replace('-', '/')})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows.length > 0 ? rows : periods).map((time) => (
            <tr key={time.period}>
              <td data-numeric className="border border-black px-2 py-1.5 font-semibold">
                {time.period}
              </td>
              {byDay.map((day, index) => (
                <td key={week[index]} className="border border-black px-2 py-1.5">
                  {day.find((cell) => cell.period === time.period)?.subject ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {events.length > 0 ? (
        <section className="print-keep mt-4">
          <h2 className="mb-1 text-sm font-semibold">이번 주 일정</h2>
          <ul className="flex flex-col gap-1 text-base">
            {events.map((event) => (
              <li key={event.id}>· {eventPhrase(monday, event).replace(/^(오늘|내일) /, `${shortDate(event.date)} `)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {standing.length > 0 ? (
        <section className="print-keep mt-4">
          <h2 className="mb-1 text-sm font-semibold">늘 챙길 것</h2>
          <ul className="flex flex-col gap-1 text-base">
            {standing.map((line) => (
              <li key={line}>· {line}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </PrintLayout>
  );
}
