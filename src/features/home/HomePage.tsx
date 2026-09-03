import type { LucideIcon } from 'lucide-react';
import {
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Download,
  ListChecks,
  MessageSquareText,
  Monitor,
  Presentation,
  Quote,
  School,
  Shield,
  Sparkles,
  UsersRound,
  UtensilsCrossed,
  Wand2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  useActiveClass,
  useActiveTerm,
  useRoster,
  useSuite,
} from '../../shared/roster/SuiteDataProvider';
import { isDesktop } from '../../shared/platform/target';
import { useNow } from '../../shared/state/useNow';
import { useToday } from '../../shared/state/useToday';
import { Button, Card, cx, EmptyState, useToast } from '../../shared/ui';
import { openBoard } from '../../shared/window/openBoard';
import { AssignmentSummary } from '../assignment/AssignmentSummary';
import { AttendanceSummary } from '../attendance/AttendanceSummary';
import { DutySummary } from '../duty/DutySummary';
import { nowState } from '../now/nowCore';
import { RewardSummary } from '../reward/RewardSummary';
import { ddayLabel, daysUntil, upcomingEvents } from '../notice/eventsCore';
import { summarizeTasks } from '../task/taskCore';
import { effectivePeriods, weekdayOf } from '../timetable/timetableCore';
import { evaluateBackupReminder, type BackupReminder } from './backupReminder';
import { MealCard } from './MealCard';
import { NowCard } from './NowCard';
import { quoteOfDay } from './quotes';
import { BigStat, PendingNote, SummaryCard } from './SummaryCard';
import { TimetableCard } from './TimetableCard';
import { useTodayMeal, useWeekMeals } from './useTodayMeal';

/**
 * 홈.
 *
 * 원본 dashboard를 그대로 홈으로 쓰지 않고, 5개 기능 요약을 얹은 새 화면을 만든다.
 * 7~10단계에서 각 기능을 이식하며 '준비 중' 카드가 실제 요약으로 바뀐다.
 */
export default function HomePage() {
  const { data, adapter } = useSuite();
  const term = useActiveTerm();
  const activeClass = useActiveClass();
  const roster = useRoster();

  const groups = data.groups.filter((group) => group.classId === activeClass?.id);

  // 업무는 학급에 매이지 않는다. activeClass가 없어도 셀 수 있다.
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const taskSummary = summarizeTasks(data.tasks, todayString);

  if (activeClass === null) {
    return (
      <Card>
        <EmptyState
          icon={School}
          title="학급을 먼저 만들어 주세요"
          description="학교와 학급을 등록하면 자리배치·당번·보상·과제를 한 명단으로 관리할 수 있습니다."
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

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h1 className="text-xl font-bold text-slate-900">{activeClass.name}</h1>
        {term === null ? null : <p className="text-sm text-slate-500">{term.name}</p>}
        {data.profile.schoolName === '' ? null : (
          <p className="text-sm text-slate-400">· {data.profile.schoolName}</p>
        )}

        {/*
          아침에 학급 TV에 띄워 두는 종합 화면. 기능별 칠판과 달리 날짜·
          시간표·급식·당번·알림장을 한 화면에 모은다.
        */}
        <Button
          size="sm"
          variant="secondary"
          icon={Monitor}
          className="ml-auto"
          onClick={() => openBoard('/board/today')}
        >
          오늘 보드
        </Button>
      </header>

      <BackupBanner studentCount={roster.length} getLastExportedAt={() => adapter.getLastExportedAt()} />

      {roster.length === 0 ? (
        <Card>
          <EmptyState
            icon={UsersRound}
            title="학생 명단이 비어 있습니다"
            description="명단을 한 번 등록하면 자리배치·당번·보상·과제에서 모두 쓸 수 있습니다."
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
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/*
          맨 앞에 둔다. 설계 그림에서 '지금'은 첫눈에 닿는 자리고, 하루 종일
          켜 둔 화면을 흘긋 볼 때 제일 먼저 찾는 것이 지금 몇 교시인가다.
          자리는 고정이고 내용만 바뀐다 — 때마다 카드가 옮겨 다니면 흘긋
          보는 것 자체가 안 된다.
        */}
        <TodayNow />

        {/* '지금' 바로 다음. 아침에 홈을 열면 출결부터 찍는 것이 하루의 순서다. */}
        <SummaryCard
          to="/attendance"
          label="오늘 출결"
          icon={CalendarCheck}
          accentClass="text-attendance-500"
          tintClass="bg-attendance-50"
          cta="출결 열기"
        >
          <AttendanceSummary />
        </SummaryCard>

        <SummaryCard
          to="/duty"
          label="오늘의 당번"
          icon={Wand2}
          accentClass="text-duty-500"
          tintClass="bg-duty-50"
          cta="역할·당번 열기"
        >
          <DutySummary />
        </SummaryCard>

        <SummaryCard
          to="/seating"
          label="자리·모둠"
          icon={UsersRound}
          accentClass="text-seating-500"
          tintClass="bg-seating-50"
          pending={groups.length === 0}
          cta="자리·모둠 열기"
        >
          {groups.length > 0 ? (
            <BigStat value={groups.length} unit="모둠" note={`학생 ${roster.length}명`} />
          ) : (
            <PendingNote>아직 모둠을 만들지 않았습니다. 명단으로 바로 편성할 수 있습니다.</PendingNote>
          )}
        </SummaryCard>

        <SummaryCard
          to="/reward"
          label="학급 점수"
          icon={Sparkles}
          accentClass="text-reward-500"
          tintClass="bg-reward-50"
          cta="활동·보상 열기"
        >
          <RewardSummary />
        </SummaryCard>

        <SummaryCard
          to="/assignment"
          label="마감 임박 과제"
          icon={ClipboardCheck}
          accentClass="text-assignment-500"
          tintClass="bg-assignment-50"
          cta="과제 제출 열기"
        >
          <AssignmentSummary />
        </SummaryCard>

        {/*
          isDesktop() 분기가 없다. 급식은 NEIS가 브라우저의 직접 요청을 막아
          설치형에서만 되지만, 시간표는 선생님이 손으로 짜는 것이라 바깥에
          물을 데가 없다 — 웹에서도 그대로 돈다.
        */}
        <TimetableCard />

        {isDesktop() ? (
          <TodayMeal />
        ) : (
          <SummaryCard
            to="/settings"
            label="급식"
            icon={UtensilsCrossed}
            accentClass="text-brand-700"
            tintClass="bg-brand-50"
            pending
            cta="학교 정보 설정"
          >
            {/* 시간표를 여기서 뺐다. 바로 위 카드가 웹에서도 뜨므로 그 말은 이제 거짓이다. */}
            <PendingNote>
              급식은 설치형 G-board에서 받아 옵니다. NEIS가 브라우저의 직접 요청을
              막기 때문입니다.
            </PendingNote>
          </SummaryCard>
        )}

        {/* 다가오는 일정 셋. 홈이 아홉 칸이 되어 3×3으로 딱 맞는다. */}
        <SummaryCard
          to="/notice"
          label="다가오는 일정"
          icon={CalendarDays}
          accentClass="text-notice-500"
          tintClass="bg-notice-50"
          pending={upcomingEvents(data.classEvents, activeClass.id, todayString).length === 0}
          cta="일정 관리"
        >
          <UpcomingEvents classId={activeClass.id} today={todayString} />
        </SummaryCard>

        <SummaryCard
          to="/roster"
          label="학생 명단"
          icon={UsersRound}
          accentClass="text-slate-500"
          tintClass="bg-slate-100"
          cta="명단 관리"
        >
          <BigStat
            value={roster.length}
            unit="명"
            note={
              data.students.filter((s) => s.classId === activeClass.id && s.status === 'inactive').length > 0
                ? `전출·제외 ${data.students.filter((s) => s.classId === activeClass.id && s.status === 'inactive').length}명`
                : '모든 기능이 이 명단을 함께 씁니다'
            }
          />
        </SummaryCard>
      </div>

      {/*
        도구함에서 옮겨 온 넷. 학급에 매이지 않아 학급을 안 만들어도 쓸 수 있고,
        그래서 학급 카드와 줄을 나눠 둔다.
      */}
      {/*
        도구함에서 옮겨 온 넷은 **한 줄 스트립**이다. 처음에는 큰 카드 넷이었는데,
        학급 카드 여덟과 합쳐 열셋이 되자 기본 창(1280×800)에서 홈이 스크롤됐다.
        "아침에 이 화면만 보고 오늘 할 일을 안다"는 설계가 스크롤 아래에서
        깨진다. 도구는 학급 자료가 아니라 자주 보는 숫자가 없으니, 큰 카드
        대신 상태 한 줄 달린 칩이면 충분하다.
      */}
      <section aria-label="수업·업무 도구" className="flex flex-wrap items-center gap-2">
        <h2 className="mr-1 text-sm font-semibold text-slate-700">수업·업무 도구</h2>

        <ToolChip
          to="/lesson"
          icon={Presentation}
          accentClass="text-lesson-500"
          label="수업 진행"
          hint={data.lessonRun === null ? `흐름 ${data.lessonTemplates.length}개` : '진행 중'}
          highlight={data.lessonRun !== null}
        />

        {isDesktop() ? (
          /*
           * 설치형에는 서버가 없어 학생 폰이 들어올 길이 없다. 라우트째
           * 뺐으므로(router.tsx) 여기서는 웹으로 가는 안내만 남긴다.
           */
          <ToolChip
            to="/settings"
            icon={CheckSquare}
            accentClass="text-quiz-500"
            label="형성평가"
            hint="웹에서"
          />
        ) : (
          <ToolChip
            to="/quiz"
            icon={CheckSquare}
            accentClass="text-quiz-500"
            label="형성평가"
            hint={data.quizRun !== null ? '진행 중' : `세트 ${data.quizSets.length}개`}
            highlight={data.quizRun !== null}
          />
        )}

        <ToolChip
          to="/task"
          icon={ListChecks}
          accentClass="text-task-500"
          label="업무 체크"
          hint={
            taskSummary.overdue > 0
              ? `기한 지남 ${taskSummary.overdue}`
              : `남은 일 ${taskSummary.open}`
          }
          highlight={taskSummary.overdue > 0}
        />

        <ToolChip
          to="/message"
          icon={MessageSquareText}
          accentClass="text-message-500"
          label="문구 템플릿"
          hint={
            data.messageFavorites.length > 0
              ? `즐겨찾기 ${data.messageFavorites.length}`
              : `${data.messageTemplates.length}개`
          }
        />
      </section>

      <QuoteCard />
    </div>
  );
}

/** 홈 '다가오는 일정' 카드 본문. 가까운 셋, D-day 순. */
function UpcomingEvents({ classId, today }: { classId: string; today: string }) {
  const { data } = useSuite();
  const upcoming = upcomingEvents(data.classEvents, classId, today, 3);

  if (upcoming.length === 0) {
    return <PendingNote>수행평가·현장학습 같은 날짜를 적어 두면 여기 D-day로 나옵니다.</PendingNote>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {upcoming.map((event) => {
        const days = daysUntil(today, event.date);
        return (
          <li key={event.id} className="flex items-center gap-2 text-sm">
            <span
              data-numeric
              className={cx(
                'w-12 shrink-0 font-semibold',
                days === 0 ? 'text-danger-700' : days <= 3 ? 'text-warning-700' : 'text-slate-500',
              )}
            >
              {ddayLabel(today, event.date)}
            </span>
            <span className="min-w-0 flex-1 truncate text-slate-800">{event.title}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 도구 칩 — 큰 카드 대신 한 줄. 이름과 상태 한 마디, 그리고 링크.
 *
 * `highlight`는 지금 봐야 할 게 있을 때(수업 진행 중, 기한 지난 업무)만
 * 켠다. 늘 켜 두면 아무것도 도드라지지 않는다.
 */
function ToolChip({
  to,
  icon: Icon,
  accentClass,
  label,
  hint,
  highlight = false,
}: {
  to: string;
  icon: LucideIcon;
  accentClass: string;
  label: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex h-10 items-center gap-2 rounded-control border px-3 text-sm transition-colors',
        highlight
          ? 'border-warning-200 bg-warning-50 text-slate-900'
          : 'border-slate-200 bg-surface text-slate-800 hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <Icon className={cx('size-4 shrink-0', accentClass)} aria-hidden />
      <span className="font-medium">{label}</span>
      <span data-numeric className="text-xs text-slate-500">
        {hint}
      </span>
    </Link>
  );
}

/**
 * 오늘의 명언.
 *
 * 원본 대시보드에 있던 카드다. 같은 날에는 같은 문장이 나온다 —
 * 새로 고칠 때마다 바뀌면 "아까 그 문장 뭐였지"를 다시 찾을 수 없다.
 */
function QuoteCard() {
  const [offset, setOffset] = useState(0);

  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const quote = quoteOfDay(todayString, offset);

  return (
    <Card title="오늘의 한마디" icon={Quote}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-slate-800">{quote.text}</p>
          {quote.note === undefined ? null : (
            <p className="mt-1 text-sm text-slate-500">{quote.note}</p>
          )}
        </div>

        {/* 넘긴 것은 저장하지 않는다. 새로 고치면 오늘 것으로 돌아온다. */}
        <Button size="sm" variant="ghost" onClick={() => setOffset((value) => value + 1)}>
          다른 한마디
        </Button>
      </div>
    </Card>
  );
}

/**
 * 백업 권유 배너.
 *
 * 조르는 느낌이 되지 않도록 지킬 데이터가 있을 때만, 그리고
 * 마지막 내보내기가 오래됐을 때만 나타난다.
 */
function BackupBanner({
  studentCount,
  getLastExportedAt,
}: {
  studentCount: number;
  getLastExportedAt: () => Promise<string | null>;
}) {
  const { adapter, flush } = useSuite();
  const toast = useToast();
  const [reminder, setReminder] = useState<BackupReminder>({ show: false });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const lastExportedAt = await getLastExportedAt();
      if (cancelled) return;
      setReminder(evaluateBackupReminder(lastExportedAt, studentCount, new Date().toISOString()));
    })();
    return () => {
      cancelled = true;
    };
  }, [getLastExportedAt, studentCount]);

  if (!reminder.show || dismissed) return null;

  /*
   * '아직 백업한 적이 없다' 경고의 원인은 플랫폼마다 다르다. 웹은 브라우저
   * 기록을 지우면 자료가 실제로 전부 사라지지만, 설치형은 파일(data.json)에
   * 있어 그 위험이 없다 — 없는 위험을 경고하면 거짓 알림이 된다. 대신
   * 파일 저장이 실제로 지닌 위험(이 컴퓨터가 고장 나거나 바뀌면 잃는다)으로
   * 이유를 바꿔서, 백업을 권하는 것 자체는 그대로 유지한다.
   */
  const neverBackedUpMessage = isDesktop()
    ? '아직 백업한 적이 없습니다. 이 컴퓨터가 고장 나거나 바뀌면 학급 데이터를 잃을 수 있습니다.'
    : '아직 백업한 적이 없습니다. 브라우저 기록을 지우면 학급 데이터가 모두 사라집니다.';

  const handleExport = async (): Promise<void> => {
    try {
      // 설정의 백업 버튼과 같은 순서다. 대기 중인 저장을 먼저 밀어내지
      // 않으면 방금 바꾼 내용이 백업 파일에서 조용히 빠진다.
      await flush();
      const json = await adapter.exportJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `우리반-백업-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setDismissed(true);
      toast.success('백업 파일을 내려받았습니다. 클라우드나 USB에 보관해 주세요.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '백업 파일을 만들지 못했습니다.');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-warning-200 bg-warning-50 p-3">
      <Shield className="size-5 shrink-0 text-warning-700" aria-hidden />
      <p className="min-w-0 flex-1 text-sm text-warning-700">
        {reminder.kind === 'never'
          ? neverBackedUpMessage
          : `마지막 백업이 ${reminder.days}일 전입니다. 그 사이 바뀐 내용은 백업에 없습니다.`}
      </p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="primary" icon={Download} onClick={() => void handleExport()}>
          지금 백업하기
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
          나중에
        </Button>
      </div>
    </div>
  );
}

/**
 * 지금이 몇 교시인가.
 *
 * 시계 둘(`useToday`·`useNow`)과 자료 둘(교시 시각·오늘 시간표)을 모아
 * `nowState`에 넘기고, 그 답을 카드에 준다. **판단은 여기서 하지 않는다** —
 * 이 자리에 조건을 하나라도 적으면 그때부터 시스템 시계를 돌리지 않고는
 * 확인할 수 없는 갈래가 생긴다.
 *
 * 급식 카드와 달리 `isDesktop()` 분기가 없다. 교시 시각도 시간표도 바깥에
 * 물을 데가 없어 웹에서도 그대로 돈다.
 */
export function TodayNow() {
  const { data } = useSuite();
  const activeClass = useActiveClass();

  /*
   * 날짜도 분도 갈고리로 받는다. 그릴 때 한 번만 재면 교실 컴퓨터에서는
   * 그 값이 며칠씩 안 바뀐다 — 다음 교시가 와도 지난 교시가, 다음 날
   * 아침에도 어제 시간표가 걸려 있다. 하루 종일 켜 두는 것이 이 앱의 전제다.
   */
  const date = useToday();
  const minutes = useNow();

  /*
   * 날짜 조각을 갈라 이 지역의 Date를 짓는다. `new Date('2026-08-24')`처럼
   * 날짜만 넘기면 UTC 자정으로 읽혀 시계가 UTC보다 뒤인 곳에서 하루가 밀린다.
   * 시간표 카드가 같은 이유로 같은 방식을 쓴다.
   */
  const [year = 0, month = 0, day = 0] = date.split('-').map(Number);
  const weekday = weekdayOf(new Date(year, month - 1, day));

  /*
   * 우리 반이 없으면 볼 시간표가 없다. 홈이 이 경우를 먼저 막지만 그 사정이
   * 이 카드의 안전장치일 수는 없다. `no-timetable`로 돌리지 않는 까닭은
   * NowCard에 '학급 먼저' 갈래가 없어서다 — 시간표 짜기로 보내 놓고 거기서
   * 다시 학급부터 만들라는 말을 듣게 하느니 아무 말도 안 하는 편이 낫다.
   */
  if (activeClass === null) return null;

  /*
   * 주말에는 이 카드를 아예 그리지 않는다.
   *
   * `nowState`는 요일을 모른다. 주말에 오늘 줄(빈 목록)을 넘기면
   * `no-timetable`이 되어 "시간표를 짜면 알려 드립니다"가 뜨는데, 그건 이미
   * 짜 둔 선생님에게 거짓말이다. 그렇다고 `after`로 돌리면 토요일 아침
   * 여덟 시에 시작한 적도 없는 수업이 끝났다고 말한다.
   *
   * 남는 말은 '오늘은 수업이 없습니다' 하나인데 **그건 시간표 카드가 이미
   * 하고 있다**(TimetableCard의 `weekday === 0` 갈래). 같은 화면에서 같은
   * 말을 두 번 하면 도움이 아니라 잡음이다 — 계획서가 등교 전·하교 후를 한
   * 줄로 줄인 것과 같은 이유다. 말할 것이 없는 쪽이 비켜 준다.
   *
   * 한 칸도 안 짠 주말도 마찬가지다. 짜러 가는 길은 시간표 카드가 주말에도
   * 먼저 내주므로(그쪽 `hasAny` 갈래) 여기서 한 번 더 내밀 필요가 없다.
   */
  if (weekday === 0) return null;

  /*
   * 하루 바꾸기를 얹은 시간표를 본다. 시간표 카드와 같은 것을 봐야
   * "카드는 음악인데 '지금'은 수학"이라고 서로 다른 말을 하지 않는다.
   */
  const today = effectivePeriods(
    data.timetableEntries,
    data.timetableOverrides,
    activeClass.id,
    date,
    weekday,
  );

  return (
    <NowCard
      state={nowState(data.periodTimes, today, minutes)}
      /*
       * 홈이 급식 카드를 실제로 그리는지 그대로 넘긴다. 웹에서는 안 그리므로
       * 점심때 없는 카드를 가리키게 두면 안 된다. 이 화면 안에서만 아는
       * 사실이라 카드에게 물어보게 하지 않는다.
       */
      hasMealCard={isDesktop()}
      /*
       * 수업 중에 띄우는 칠판이라 수업 진행 화면으로 보낸다. 여는 법은 웹
       * (새 탭)과 설치형(새 앱 창)이 달라서 `openBoard`가 가리고 있고,
       * 카드는 넘겨받은 것을 부르기만 한다.
       */
      onOpenBoard={() => {
        openBoard('/board/lesson');
      }}
    />
  );
}

/**
 * 오늘 급식 카드. 받아 오는 일은 `useTodayMeal`이 한다(오늘 보드와 공유).
 *
 * 설치형에서만 그린다. NEIS가 `Access-Control` 헤더를 안 줘서 브라우저는
 * 직접 못 부르고, 그 제약은 우리가 어쩔 수 없다.
 */
export function TodayMeal() {
  // '이번 주'는 펼쳤을 때만 받아 온다. 아침마다 다섯 날을 물을 이유는 없다.
  const [weekOpen, setWeekOpen] = useState(false);
  const week = useWeekMeals(weekOpen);
  return (
    <MealCard
      state={useTodayMeal()}
      week={week}
      weekOpen={weekOpen}
      onToggleWeek={() => setWeekOpen((value) => !value)}
    />
  );
}
