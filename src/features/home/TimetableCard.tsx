import { CalendarDays, CalendarCog } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { MAX_PERIOD } from '../../shared/domain/types';
import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { useToday } from '../../shared/state/useToday';
import { Badge, Button, Card, Modal } from '../../shared/ui';
import {
  cellSubject,
  effectivePeriods,
  setOverride,
  subjectButtons,
  weekdayOf,
} from '../timetable/timetableCore';

/**
 * 오늘 시간표.
 *
 * 주간 시간표 위에 **하루 바꾸기**를 얹어 보여 준다. 행사·보강으로 그날만
 * 교시가 바뀌는 날, 주간 시간표를 고쳤다가 다음 주에 되돌리는 대신
 * [오늘만 바꾸기]로 그날치만 적는다. 바뀐 칸에는 '오늘만' 배지가 붙는다.
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
  const [editing, setEditing] = useState(false);

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
  const periods = effectivePeriods(data.timetableEntries, data.timetableOverrides, classId, date, weekday);

  return (
    <Card
      title="오늘 시간표"
      icon={CalendarDays}
      action={
        // 주말·빈 시간표에는 바꿀 오늘이 없다.
        hasAny && weekday !== 0 ? (
          <Button size="sm" variant="ghost" icon={CalendarCog} onClick={() => setEditing(true)}>
            오늘만 바꾸기
          </Button>
        ) : undefined
      }
    >
      {!hasAny ? (
        /*
         * 주말보다 이것이 먼저다. 주말인 것은 내일이면 지나가지만 빈 시간표는
         * 안 지나간다. '오늘은 수업이 없습니다'로 덮으면 토요일에 앱을 처음
         * 연 선생님은 이 기능이 있다는 것조차 모른 채 지나간다.
         */
        <p className="text-sm text-slate-500">
          시간표를 한 번 짜 두면 여기 나옵니다.{' '}
          <Link to="/settings?tab=timetable" className="font-medium text-brand-700 underline">
            시간표 짜기
          </Link>
        </p>
      ) : weekday === 0 ? (
        <p className="text-sm text-slate-500">오늘은 수업이 없습니다.</p>
      ) : periods.length === 0 ? (
        <p className="text-sm text-slate-500">
          오늘은 시간표가 비어 있습니다.{' '}
          {/* 여기에도 길을 둔다. 할 일이 '오늘 줄을 채우기'인데 갈 데가 없으면
              말만 하고 마는 카드가 된다. */}
          <Link to="/settings?tab=timetable" className="font-medium text-brand-700 underline">
            오늘 줄 채우기
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {periods.map((slot) => (
            <li key={slot.period} className="flex items-baseline gap-3 text-sm">
              {/* 번호를 오른쪽에 맞춘다. 왼쪽에 붙이면 한 자리와 두 자리가 어긋난다. */}
              <span data-numeric className="w-4 text-right text-slate-400">
                {slot.period}
              </span>
              <span className="text-slate-900">{slot.subject}</span>
              {slot.overridden ? <Badge tone="info">오늘만</Badge> : null}
            </li>
          ))}
        </ul>
      )}

      {editing ? <TodayOverrideModal date={date} weekday={weekday} onClose={() => setEditing(false)} /> : null}
    </Card>
  );
}

/**
 * 오늘만 바꾸기.
 *
 * 교시마다 과목을 고른다. 원래 과목으로 되돌리면 하루 바꾸기가 지워지고
 * 주간 시간표가 다시 보인다. '없음'은 그날 그 교시가 없다는 뜻이다.
 */
function TodayOverrideModal({
  date,
  weekday,
  onClose,
}: {
  date: string;
  weekday: number;
  onClose: () => void;
}) {
  const { data, update } = useSuite();
  const activeClass = useActiveClass();
  const classId = activeClass?.id ?? '';

  const effective = effectivePeriods(data.timetableEntries, data.timetableOverrides, classId, date, weekday);
  const effectiveByPeriod = new Map(effective.map((slot) => [slot.period, slot]));
  const options = subjectButtons(data.timetableEntries, classId, activeClass?.grade);

  return (
    <Modal
      open
      onClose={onClose}
      title="오늘만 바꾸기"
      size="sm"
      footer={
        <>
          {/* 행사로 다섯 교시를 바꾼 날, 하나씩 되돌리지 않게 한 번에. */}
          {effective.some((slot) => slot.overridden) ? (
            <Button
              variant="ghost"
              onClick={() =>
                update((suite) => ({
                  ...suite,
                  timetableOverrides: suite.timetableOverrides.filter(
                    (override) => override.classId !== classId || override.date !== date,
                  ),
                }))
              }
            >
              오늘 바꾸기 모두 지우기
            </Button>
          ) : null}
          {/* '닫기'는 취소로 읽힌다. 고르는 즉시 저장되므로 '완료'다. */}
          <Button variant="primary" onClick={onClose}>
            완료
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-500">
        오늘({date})만 바뀝니다. 고르는 즉시 저장되고, 주간 시간표는 그대로라 다음 주에는
        원래대로 돌아옵니다.
      </p>

      <ul className="flex flex-col gap-2">
        {Array.from({ length: MAX_PERIOD }, (_, index) => index + 1).map((period) => {
          const original = cellSubject(data.timetableEntries, classId, weekday, period);
          const slot = effectiveByPeriod.get(period);
          const current = slot?.subject ?? '';
          // 직접 입력한 과목이 목록에 없으면 고를 수 있게 더한다.
          const choices = current !== '' && !options.includes(current) ? [...options, current] : options;

          return (
            <li key={period} className="flex items-center gap-2">
              <span data-numeric className="w-4 shrink-0 text-right text-sm text-slate-400">
                {period}
              </span>
              <select
                value={current}
                onChange={(event) =>
                  update((suite) => ({
                    ...suite,
                    timetableOverrides: setOverride(
                      suite.timetableOverrides,
                      suite.timetableEntries,
                      classId,
                      date,
                      weekday,
                      period,
                      event.target.value,
                    ),
                  }))
                }
                aria-label={`${period}교시 오늘 과목`}
                className="h-9 min-w-0 flex-1 rounded-control border border-slate-300 px-2 text-sm"
              >
                <option value="">없음</option>
                {choices.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
              {slot?.overridden === true ? (
                <span className="shrink-0 text-xs text-slate-400">
                  원래 {original === '' ? '없음' : original}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
