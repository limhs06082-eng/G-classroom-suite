import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { isDesktop } from '../../shared/platform/target';
import { useToday } from '../../shared/state/useToday';
import { cx } from '../../shared/ui';
import { assignmentsDueSoon, itemsFor } from '../notice/noticeCore';
import { useDuty } from '../duty/useDuty';
import { useTodayMeal } from '../home/useTodayMeal';
import { effectivePeriods, weekdayOf, WEEKDAY_NAMES } from '../timetable/timetableCore';

/**
 * 오늘 보드 — 아침에 켜 두는 학급 TV 화면.
 *
 * 날짜·시간표·급식·당번·알림장을 한 화면에 모은다. 홈에도 같은 정보가
 * 있지만 홈은 교사 창(조작하는 화면)이고, 이것은 교실 뒷자리에서 읽는
 * 화면이라 board 스케일로 다시 그린다.
 *
 * 급식은 설치형에서만 그린다(NEIS가 브라우저의 직접 요청을 막는다).
 * 날씨는 넣지 않았다 — 헤더 배지의 로딩·캐시 사정이 AppShell에 살고
 * 있어서, 보드가 따로 들면 같은 코드가 두 벌이 된다. 필요해지면
 * 그 로직을 훅으로 빼는 것이 먼저다.
 */
export function TodayBoard() {
  const date = useToday();
  const [year = 0, month = 0, day = 0] = date.split('-').map(Number);
  const weekday = weekdayOf(new Date(year, month - 1, day));
  const weekdayName = weekday === 0 ? '주말' : `${WEEKDAY_NAMES[weekday - 1] ?? ''}요일`;

  return (
    <div className="flex flex-col gap-8">
      <p className="text-board-lg font-black text-slate-900">
        {month}월 {day}일 {weekdayName}
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <TimetableSection weekday={weekday} date={date} />
          {/*
           * isDesktop()으로 충분하다. useTodayMeal의 Tauri 조각은 전부 동적
           * import라 청크를 가르는 자리가 아니다(router.tsx의 리터럴 비교가
           * 필요한 경우와 다르다).
           */}
          {isDesktop() ? <MealSection /> : null}
        </div>
        <div className="flex flex-col gap-8">
          <DutySection />
          <NoticeSection date={date} />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-3 text-board-sm font-bold text-slate-500">{children}</h2>;
}

function TimetableSection({ weekday, date }: { weekday: number; date: string }) {
  const { data } = useSuite();
  const activeClass = useActiveClass();
  const classId = activeClass?.id ?? '';

  const periods = effectivePeriods(data.timetableEntries, data.timetableOverrides, classId, date, weekday);

  return (
    <section>
      <SectionTitle>오늘 시간표</SectionTitle>
      {weekday === 0 || periods.length === 0 ? (
        <p className="text-board-sm text-slate-400">오늘은 수업이 없습니다</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {periods.map((slot) => (
            <li key={slot.period} className="flex items-baseline gap-4 text-board-sm">
              <span data-numeric className="w-8 shrink-0 text-right font-bold text-slate-400">
                {slot.period}
              </span>
              <span className={cx('font-semibold', slot.overridden ? 'text-brand-700' : 'text-slate-900')}>
                {slot.subject}
              </span>
              {slot.overridden ? <span className="text-sm text-brand-700">오늘만</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MealSection() {
  const state = useTodayMeal();

  // 보드는 안내 화면이 아니다. 보여 줄 급식이 있을 때만 자리를 차지한다.
  if (state.kind !== 'ready' || state.meals.length === 0) return null;

  return (
    <section>
      <SectionTitle>오늘 급식</SectionTitle>
      <ul className="flex flex-wrap gap-x-6 gap-y-1.5">
        {state.meals.flatMap((menu) =>
          menu.dishes.map((dish) => (
            <li key={`${menu.kind}-${dish.name}`} className="text-board-sm font-semibold text-slate-900">
              {dish.name}
            </li>
          )),
        )}
      </ul>
    </section>
  );
}

function DutySection() {
  const duty = useDuty();

  if (duty.todayDuties.length === 0) return null;

  return (
    <section>
      <SectionTitle>오늘의 당번</SectionTitle>
      <ul className="flex flex-col gap-1.5">
        {duty.todayDuties.map(({ role, students }) => (
          <li key={role.id} className="flex flex-wrap items-baseline gap-x-3 text-board-sm">
            <span className="font-bold text-slate-500">{role.name}</span>
            <span className="font-semibold text-slate-900">
              {students.map((student) => student.name).join(', ') || '배정 없음'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NoticeSection({ date }: { date: string }) {
  const { data } = useSuite();
  const activeClass = useActiveClass();
  const classId = activeClass?.id ?? '';

  const items = itemsFor(data.notices, classId, date);
  const dueSoon = assignmentsDueSoon(data.assignments, classId, date);

  if (items.length === 0 && dueSoon.length === 0) return null;

  return (
    <section>
      <SectionTitle>알림장</SectionTitle>
      <ol className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-baseline gap-3 text-board-sm">
            <span data-numeric className="shrink-0 font-bold text-notice-500">
              {index + 1}.
            </span>
            <span className="font-semibold text-slate-900">{item.text}</span>
          </li>
        ))}
        {dueSoon.map((assignment) => (
          <li key={assignment.id} className="flex items-baseline gap-3 text-board-sm">
            <span className="shrink-0 font-bold text-danger-500">
              {assignment.dueDate === date ? '오늘까지' : '내일까지'}
            </span>
            <span className="font-semibold text-slate-900">{assignment.title}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
