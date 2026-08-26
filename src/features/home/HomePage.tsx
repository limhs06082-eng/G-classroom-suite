import {
  CheckSquare,
  ClipboardCheck,
  Download,
  ListChecks,
  MessageSquareText,
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
import { hasSchool } from '../../shared/domain/school';
import { isDesktop } from '../../shared/platform/target';
import { useToday } from '../../shared/state/useToday';
import { Button, Card, EmptyState, useToast } from '../../shared/ui';
import { AssignmentSummary } from '../assignment/AssignmentSummary';
import { DutySummary } from '../duty/DutySummary';
import { RewardSummary } from '../reward/RewardSummary';
import { summarizeTasks } from '../task/taskCore';
import { evaluateBackupReminder, type BackupReminder } from './backupReminder';
import { MealCard, type MealState } from './MealCard';
import { quoteOfDay } from './quotes';
import { BigStat, PendingNote, SummaryCard } from './SummaryCard';
import { TimetableCard } from './TimetableCard';
import { loadTodayMeal } from './todayMeal';

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
  const taskSummary = summarizeTasks(
    data.tasks,
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
  );

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
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
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
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h1 className="text-xl font-bold text-slate-900">{activeClass.name}</h1>
        {term === null ? null : <p className="text-sm text-slate-500">{term.name}</p>}
        {data.profile.schoolName === '' ? null : (
          <p className="text-sm text-slate-400">· {data.profile.schoolName}</p>
        )}
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
                className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                명단 등록하기
              </Link>
            }
          />
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            accentClass="text-brand-600"
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
      <h2 className="mt-2 text-sm font-semibold text-slate-700">수업·업무 도구</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          to="/lesson"
          label="수업 진행"
          icon={Presentation}
          accentClass="text-lesson-500"
          tintClass="bg-lesson-50"
          cta="수업 진행 열기"
        >
          <BigStat
            value={data.lessonTemplates.length}
            unit="개"
            note={data.lessonRun === null ? '수업 흐름' : '지금 수업 진행 중'}
          />
        </SummaryCard>

        {isDesktop() ? (
          /*
           * 설치형에는 서버가 없어 학생 폰이 들어올 길이 없다. 화면을
           * 반쯤 살려 두면 "되는 줄 알았는데 안 되는" 자리가 되므로
           * 라우트째 뺐다(router.tsx의 quiz 라우트 옆 주석 참고). 여기서는
           * 사라진 것처럼 보이지 않도록 웹으로 가는 안내만 남긴다.
           */
          <SummaryCard
            to="/settings"
            label="형성평가"
            icon={CheckSquare}
            accentClass="text-quiz-500"
            tintClass="bg-quiz-50"
            pending
            cta="웹에서 여는 법 보기"
          >
            <PendingNote>
              학생 폰으로 참여하는 형성평가는 웹에서 쓰실 수 있습니다.
              g-classroom-suite.vercel.app
            </PendingNote>
          </SummaryCard>
        ) : (
          <SummaryCard
            to="/quiz"
            label="형성평가"
            icon={CheckSquare}
            accentClass="text-quiz-500"
            tintClass="bg-quiz-50"
            cta="형성평가 열기"
          >
            <BigStat
              value={data.quizSets.length}
              unit="개"
              note={
                data.quizRun !== null
                  ? '지금 퀴즈 진행 중'
                  : data.quizResults.length > 0
                    ? `지난 결과 ${data.quizResults.length}건`
                    : '문제 세트'
              }
            />
          </SummaryCard>
        )}

        <SummaryCard
          to="/task"
          label="업무 체크"
          icon={ListChecks}
          accentClass="text-task-500"
          tintClass="bg-task-50"
          cta="업무 체크 열기"
        >
          <BigStat
            value={taskSummary.open}
            unit="개"
            note={taskSummary.overdue > 0 ? `기한 지남 ${taskSummary.overdue}개` : '남은 일'}
          />
        </SummaryCard>

        <SummaryCard
          to="/message"
          label="문구 템플릿"
          icon={MessageSquareText}
          accentClass="text-message-500"
          tintClass="bg-message-50"
          cta="문구 템플릿 열기"
        >
          <BigStat
            value={data.messageTemplates.length}
            unit="개"
            note={
              data.messageFavorites.length > 0
                ? `즐겨찾기 ${data.messageFavorites.length}개`
                : '가정 통신 문구'
            }
          />
        </SummaryCard>
      </div>

      <QuoteCard />
    </div>
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
  const { adapter } = useSuite();
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
 * 오늘 급식을 받아 온다.
 *
 * 캐시를 먼저 보고, 없으면 NEIS에 묻는다. 학교 인터넷은 끊긴다 —
 * 어제 받아 둔 것이 있으면 그날도 보인다.
 *
 * 설치형에서만 그린다. NEIS가 `Access-Control` 헤더를 안 줘서 브라우저는
 * 직접 못 부르고, 그 제약은 우리가 어쩔 수 없다.
 */
export function TodayMeal() {
  const { data } = useSuite();
  const [state, setState] = useState<MealState>({ kind: 'loading' });

  const officeCode = data.profile.officeCode ?? '';
  const schoolCode = data.profile.schoolCode ?? '';

  const date = useToday();

  useEffect(() => {
    // 학교가 없으면 여기서 끝낸다. 물을 데가 없는데 Tauri 조각을 들일 이유가 없다.
    if (!hasSchool(officeCode, schoolCode)) {
      setState({ kind: 'no-school' });
      return;
    }

    let cancelled = false;
    setState({ kind: 'loading' });

    void (async () => {
      const [{ NeisSource }, { TauriHttpClient }, { CacheStore }, { TauriFileStore }] =
        await Promise.all([
          import('../../shared/external/NeisSource'),
          import('../../shared/external/TauriHttpClient'),
          import('../../shared/storage/CacheStore'),
          import('../../shared/storage/TauriFileStore'),
        ]);

      // 캐시에 임자를 달아 연다. 학교를 고치면 앞 학교 급식은 통째로 버려진다.
      const cache = await CacheStore.open(new TauriFileStore(), `${officeCode}:${schoolCode}`);

      const next = await loadTodayMeal(
        cache,
        new NeisSource(new TauriHttpClient()),
        officeCode,
        schoolCode,
        date,
      );

      if (!cancelled) setState(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [officeCode, schoolCode, date]);

  return <MealCard state={state} />;
}
