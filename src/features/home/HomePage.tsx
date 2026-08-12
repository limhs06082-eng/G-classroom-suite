import {
  ClipboardCheck,
  Download,
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
import { Button, Card, EmptyState, useToast } from '../../shared/ui';
import { DutySummary } from '../duty/DutySummary';
import { RewardSummary } from '../reward/RewardSummary';
import { evaluateBackupReminder, type BackupReminder } from './backupReminder';
import { BigStat, PendingNote, SummaryCard } from './SummaryCard';

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
          pending
          cta="과제 제출 열기"
        >
          <PendingNote>과제를 등록하면 마감이 가까운 순으로 여기 표시됩니다.</PendingNote>
        </SummaryCard>

        <SummaryCard
          to="/settings"
          label="급식 · 시간표"
          icon={UtensilsCrossed}
          accentClass="text-brand-600"
          tintClass="bg-brand-50"
          pending
          cta="학교 정보 설정"
        >
          <PendingNote>학교를 등록하고 NEIS 키를 넣으면 오늘 급식과 시간표가 표시됩니다.</PendingNote>
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
    </div>
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
          ? '아직 백업한 적이 없습니다. 브라우저 기록을 지우면 학급 데이터가 모두 사라집니다.'
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
