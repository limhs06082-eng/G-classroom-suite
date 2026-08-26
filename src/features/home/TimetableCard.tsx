import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { useToday } from '../../shared/state/useToday';
import { Card } from '../../shared/ui';
import { todayPeriods, weekdayOf } from '../timetable/timetableCore';

/**
 * 오늘 시간표.
 *
 * `▶ 지금` 표시는 여기 없다. 그건 교시 시각(1교시 09:00~09:40)을 알아야 하는데
 * 그 자료가 아직 없다 — 2-나-2의 몫이다. 여기서는 오늘 채워진 교시를 순서대로
 * 보여 주는 데까지다.
 *
 * 갈래를 넷으로 가르는 까닭은 **선생님이 할 일이 저마다 다르기** 때문이다.
 * 학급이 없으면 학급을 만들어야 하고, 한 칸도 없으면 짜러 가야 하고, 오늘만
 * 비었으면 오늘 줄을 채워야 하고, 주말이면 아무것도 안 해도 된다. 둘을 하나로
 * 뭉치면 선생님을 엉뚱한 화면으로 보낸다.
 *
 * `isDesktop()` 분기를 두지 않는다. 급식과 달리 시간표는 바깥 통신이 없어
 * 웹에서도 설치형에서도 똑같이 돈다.
 */
export function TimetableCard() {
  const { data } = useSuite();
  const activeClass = useActiveClass();

  // 하루 종일 켜 두는 화면이라 useToday를 쓴다. 자정이 지나면 날짜가 저절로
  // 바뀌어야 아침에 어제 시간표가 걸려 있지 않다.
  const date = useToday();

  if (activeClass === null) {
    /*
     * '학급이 없다'를 '시간표가 없다'로 뭉개지 않는다. 시간표 탭으로 보내
     * 봐야 거기서도 학급부터 만들라는 말을 듣게 될 뿐이다. HomePage가 이
     * 경우를 먼저 막지만, 그 사정이 이 카드의 안전장치일 수는 없다.
     */
    return (
      <Card title="오늘 시간표" icon={CalendarDays}>
        <p className="text-sm text-slate-500">학급을 먼저 만들면 시간표가 여기 나옵니다.</p>
      </Card>
    );
  }

  /*
   * 날짜 조각을 갈라 이 지역의 Date를 짓는다.
   *
   * `new Date('2026-08-24')`처럼 **날짜만** 넘기면 UTC 자정으로 읽힌다. 우리
   * (KST, UTC+9)에서는 같은 날 아침 아홉 시가 되어 티가 안 나지만, 시계가
   * UTC보다 뒤인 곳에서는 하루가 통째로 밀린다. 글자 해석 규칙에 기대는 대신
   * 숫자로 짓는다 — 화요일 시간표가 월요일에 뜨는 것은 아무도 빨리 못 알아챈다.
   */
  const [year = 0, month = 0, day = 0] = date.split('-').map(Number);
  const weekday = weekdayOf(new Date(year, month - 1, day));

  const classId = activeClass.id;
  // 우리 반 것만 센다. 옆 반 시간표가 있어도 우리 반이 비었으면 짜러 가야 한다.
  const hasAny = data.timetableEntries.some((entry) => entry.classId === classId);
  const periods = todayPeriods(data.timetableEntries, classId, weekday);

  return (
    <Card title="오늘 시간표" icon={CalendarDays}>
      {!hasAny ? (
        /*
         * 주말보다 이것이 먼저다. 주말인 것은 내일이면 지나가지만 빈 시간표는
         * 안 지나간다. '오늘은 수업이 없습니다'로 덮으면 토요일에 앱을 처음
         * 연 선생님은 이 기능이 있다는 것조차 모른 채 지나간다.
         */
        <p className="text-sm text-slate-500">
          시간표를 한 번 짜 두면 여기 나옵니다.{' '}
          <Link to="/settings" className="font-medium text-brand-700 underline">
            시간표 짜기
          </Link>
        </p>
      ) : weekday === 0 ? (
        <p className="text-sm text-slate-500">오늘은 수업이 없습니다.</p>
      ) : periods.length === 0 ? (
        <p className="text-sm text-slate-500">오늘은 시간표가 비어 있습니다.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {periods.map((slot) => (
            <li key={slot.period} className="flex gap-3 text-sm">
              {/* 번호를 오른쪽에 맞춘다. 왼쪽에 붙이면 한 자리와 두 자리가 어긋난다. */}
              <span data-numeric className="w-4 text-right text-slate-400">
                {slot.period}
              </span>
              <span className="text-slate-900">{slot.subject}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
