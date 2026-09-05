import { birthdaysOn } from '../../shared/roster/birthdayCore';
import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { isDesktop } from '../../shared/platform/target';
import { useNow } from '../../shared/state/useNow';
import { useToday } from '../../shared/state/useToday';
import { cx } from '../../shared/ui';
import { ddayLabel, eventsSoon } from '../notice/eventsCore';
import { assignmentsDueSoon, itemsFor } from '../notice/noticeCore';
import { hmOf, nowState } from '../now/nowCore';
import { useDuty } from '../duty/useDuty';
import { useTodayMeal } from '../home/useTodayMeal';
import { effectivePeriods, weekdayOf, WEEKDAY_NAMES } from '../timetable/timetableCore';

/**
 * 오늘 보드 — 아침에 켜 두는 학급 TV 화면.
 *
 * 날짜·시계·시간표·급식·당번·알림장을 한 화면에 모은다. 홈에도 같은 정보가
 * 있지만 홈은 교사 창(조작하는 화면)이고, 이것은 교실 뒷자리에서 읽는
 * 화면이라 board 스케일로 다시 그린다. 제목은 board-sm, 본문은 board-base —
 * 28px 본문은 8m 뒷자리에서 안 읽힌다.
 *
 * 급식은 설치형에서만 그린다(NEIS가 브라우저의 직접 요청을 막는다).
 * 날씨는 넣지 않았다 — 헤더 배지의 로딩·캐시 사정이 AppShell에 살고
 * 있어서, 보드가 따로 들면 같은 코드가 두 벌이 된다. 필요해지면
 * 그 로직을 훅으로 빼는 것이 먼저다.
 */
export function TodayBoard() {
  const { data } = useSuite();
  const activeClass = useActiveClass();
  const date = useToday();
  const minutes = useNow();
  const [year = 0, month = 0, day = 0] = date.split('-').map(Number);
  const weekday = weekdayOf(new Date(year, month - 1, day));
  const weekdayName = weekday === 0 ? '주말' : `${WEEKDAY_NAMES[weekday - 1] ?? ''}요일`;

  const classId = activeClass?.id ?? '';
  const periods = effectivePeriods(data.timetableEntries, data.timetableOverrides, classId, date, weekday);
  const now = nowState(data.periodTimes, periods, minutes);

  const hasNotice =
    itemsFor(data.notices, classId, date).length > 0 ||
    assignmentsDueSoon(data.assignments, classId, date).length > 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <p className="text-board-lg font-black text-slate-900">
          {month}월 {day}일 {weekdayName}
        </p>
        {/*
          시계. 아침에 켜 두는 학급 TV인데 지금 몇 시인지 안 나오면
          학생들은 교실 시계를 따로 찾는다. 수업 중이면 몇 교시인지도 함께.
        */}
        <p data-numeric className="text-board-base font-bold text-slate-500">
          {hmOf(minutes)}
          {now.kind === 'lesson' ? (
            <span className="ml-4 text-brand-700">{now.period}교시 {now.subject}</span>
          ) : now.kind === 'lunch' ? (
            <span className="ml-4 text-brand-700">점심시간</span>
          ) : null}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <TimetableSection periods={periods} weekday={weekday} nowPeriod={now.kind === 'lesson' ? now.period : null} />
          {/*
           * isDesktop()으로 충분하다. useTodayMeal의 Tauri 조각은 전부 동적
           * import라 청크를 가르는 자리가 아니다(router.tsx의 리터럴 비교가
           * 필요한 경우와 다르다).
           */}
          {isDesktop() ? <MealSection /> : null}
        </div>
        <div className="flex flex-col gap-8">
          <BirthdaySection date={date} />
          <EventsSection date={date} />
          <DutySection />
          <NoticeSection date={date} />
        </div>
      </div>

      {/* 전부 비면 날짜만 뜬 빈 화면이 된다. 무엇을 채우면 되는지 한 줄 남긴다. */}
      {periods.length === 0 && !hasNotice ? (
        <p className="text-board-sm text-slate-400">
          시간표·알림장·당번을 등록하면 이 화면이 채워집니다.
        </p>
      ) : null}
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-3 text-board-sm font-bold text-slate-500">{children}</h2>;
}

function TimetableSection({
  periods,
  weekday,
  nowPeriod,
}: {
  periods: ReturnType<typeof effectivePeriods>;
  weekday: number;
  nowPeriod: number | null;
}) {
  // 주말엔 조용히 비켜 준다. 평일에 비어 있는 것은 다르다 — 아래에서 밝힌다.
  if (weekday === 0) return null;

  if (periods.length === 0) {
    return (
      <section>
        <SectionTitle>오늘 시간표</SectionTitle>
        {/* 수업이 없는 건지 시간표를 아직 안 짠 건지, 화면이 말해 줘야 한다. */}
        <p className="text-board-sm text-slate-400">오늘 시간표가 비어 있습니다</p>
      </section>
    );
  }

  return (
    <section>
      <SectionTitle>오늘 시간표</SectionTitle>
      <ul className="flex flex-col gap-1.5">
        {periods.map((slot) => (
          <li key={slot.period} className="flex items-baseline gap-4 text-board-base">
            <span
              data-numeric
              className={cx(
                'w-12 shrink-0 text-right font-bold',
                slot.period === nowPeriod ? 'text-brand-700' : 'text-slate-400',
              )}
            >
              {slot.period === nowPeriod ? '▶' : slot.period}
            </span>
            <span className={cx('font-semibold', slot.overridden ? 'text-brand-700' : 'text-slate-900')}>
              {slot.subject}
            </span>
            {/* desk 스케일(text-sm)을 섞지 않는다 — '오늘만'도 뒷자리에서 읽혀야 한다. */}
            {slot.overridden ? <span className="text-board-sm text-brand-700">오늘만</span> : null}
          </li>
        ))}
      </ul>
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
      <ul className="flex flex-wrap gap-x-8 gap-y-2">
        {state.meals.flatMap((menu) =>
          menu.dishes.map((dish) => (
            <li key={`${menu.kind}-${dish.name}`} className="text-board-base font-semibold text-slate-900">
              {dish.name}
            </li>
          )),
        )}
      </ul>
    </section>
  );
}

/** 오늘 생일. 있는 날에만, 맨 위에 — 이날 교실에서 제일 먼저 보여야 할 것이다. */
function BirthdaySection({ date }: { date: string }) {
  const { data } = useSuite();
  const activeClass = useActiveClass();
  const classId = activeClass?.id ?? '';
  const todays = birthdaysOn(
    data.students.filter((student) => student.classId === classId && student.status === 'active'),
    date,
  );
  if (todays.length === 0) return null;

  return (
    <section>
      <SectionTitle>오늘 생일</SectionTitle>
      <p className="text-board-lg font-black text-slate-900">
        🎂 {todays.map((student) => student.name).join(', ')}
      </p>
      <p className="mt-1 text-board-base text-slate-600">생일 축하합니다!</p>
    </section>
  );
}

/** 오늘과 사흘 안 일정. 학급 TV에서 "내일 수행평가"가 제일 먼저 보여야 한다. */
function EventsSection({ date }: { date: string }) {
  const { data } = useSuite();
  const activeClass = useActiveClass();
  const classId = activeClass?.id ?? '';

  // 사흘 안까지만. 학급 TV에 한 달 뒤 운동회까지 늘어놓으면 오늘 것이 묻힌다.
  const soon = eventsSoon(data.classEvents, classId, date, 3);
  if (soon.length === 0) return null;

  return (
    <section>
      <SectionTitle>다가오는 일정</SectionTitle>
      <ul className="flex flex-col gap-1.5">
        {soon.map((event) => (
          <li key={event.id} className="flex items-baseline gap-4 text-board-base">
            <span data-numeric className="shrink-0 font-bold text-danger-500">
              {ddayLabel(date, event.date)}
            </span>
            <span className="font-semibold text-slate-900">{event.title}</span>
          </li>
        ))}
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
          <li key={role.id} className="flex flex-wrap items-baseline gap-x-4 text-board-base">
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
          <li key={item.id} className="flex items-baseline gap-4 text-board-base">
            <span data-numeric className="shrink-0 font-bold text-notice-500">
              {index + 1}.
            </span>
            <span className="font-semibold text-slate-900">{item.text}</span>
          </li>
        ))}
        {dueSoon.map((assignment) => (
          <li key={assignment.id} className="flex items-baseline gap-4 text-board-base">
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
