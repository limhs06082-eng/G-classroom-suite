import { Database, Download, RotateCcw, School, Shield, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';

import { importLegacyRoster, scanLegacy, type LegacyScanResult } from '../../shared/migration/legacyImport';
// 도구함 쪽 원본 4개 앱. 같은 이름이라 별칭으로 갈라 둔다.
import {
  importLegacy as importToolkitLegacy,
  scanLegacy as scanToolkitLegacy,
  type LegacyScan as ToolkitLegacyScan,
} from './legacyImport';
import { useSuite } from '../../shared/roster/SuiteDataProvider';
import { formatBytes, measureDataSize } from '../../shared/storage/dataSize';
import type { BackupSummary } from '../../shared/storage/StorageAdapter';
import { Badge, Button, Card, ConfirmDialog, cx, EmptyState, Tabs, useToast } from '../../shared/ui';
import { ClassTermTab } from './ClassTermTab';
import { LockTab } from './LockTab';

type SettingsTab = 'school' | 'classes' | 'lock' | 'backup' | 'legacy';

/**
 * 설정.
 *
 * 백업·복원이 이 화면의 중심이다. localStorage는 브라우저 기록을 지우면
 * 전부 사라지므로, 교사가 스스로 지킬 수 있는 수단이 눈에 보여야 한다.
 */
export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('school');

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-slate-900">설정</h1>

      <Tabs
        items={[
          { id: 'school', label: '학교 정보' },
          { id: 'classes', label: '학급·학기' },
          { id: 'lock', label: '교사 잠금' },
          { id: 'backup', label: '백업·복원' },
          { id: 'legacy', label: '기존 앱에서 가져오기' },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as SettingsTab)}
      >
        {tab === 'school' ? <SchoolTab /> : null}
        {tab === 'classes' ? <ClassTermTab /> : null}
        {tab === 'lock' ? <LockTab /> : null}
        {tab === 'backup' ? <BackupTab /> : null}
        {tab === 'legacy' ? (
          <div className="flex flex-col gap-4">
            <LegacyTab />
            <ToolkitLegacyTab />
          </div>
        ) : null}
      </Tabs>
    </div>
  );
}

function SchoolTab() {
  const { data, update } = useSuite();
  const toast = useToast();

  return (
    <Card title="학교와 선생님" icon={School}>
      <div className="flex max-w-md flex-col gap-3">
        <label className="block text-sm">
          <span className="text-slate-700">학교 이름</span>
          <input
            defaultValue={data.profile.schoolName}
            onBlur={(event) => {
              const schoolName = event.target.value.trim();
              if (schoolName !== data.profile.schoolName) {
                update((current) => ({ ...current, profile: { ...current.profile, schoolName } }));
                toast.success('학교 이름을 저장했습니다.');
              }
            }}
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-700">선생님 이름</span>
          <input
            defaultValue={data.profile.teacherName}
            onBlur={(event) => {
              const teacherName = event.target.value.trim();
              if (teacherName !== data.profile.teacherName) {
                update((current) => ({ ...current, profile: { ...current.profile, teacherName } }));
                toast.success('선생님 이름을 저장했습니다.');
              }
            }}
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>

        <p className="text-sm text-slate-500">
          입력한 이름은 인쇄물과 안내 문구에 쓰입니다.
        </p>

        <div className="border-t border-slate-100 pt-3">
          <div className="flex gap-3">
            <label className="block flex-1 text-sm">
              <span className="text-slate-700">교육청 코드</span>
              <input
                defaultValue={data.profile.officeCode}
                placeholder="예: D10"
                onBlur={(event) => {
                  const officeCode = event.target.value.trim();
                  if (officeCode !== data.profile.officeCode) {
                    update((current) => ({
                      ...current,
                      profile: { ...current.profile, officeCode },
                    }));
                    toast.success('교육청 코드를 저장했습니다.');
                  }
                }}
                className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
              />
            </label>

            <label className="block flex-1 text-sm">
              <span className="text-slate-700">학교 코드</span>
              <input
                defaultValue={data.profile.schoolCode}
                placeholder="예: 7000000"
                onBlur={(event) => {
                  const schoolCode = event.target.value.trim();
                  if (schoolCode !== data.profile.schoolCode) {
                    update((current) => ({
                      ...current,
                      profile: { ...current.profile, schoolCode },
                    }));
                    toast.success('학교 코드를 저장했습니다.');
                  }
                }}
                className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
              />
            </label>
          </div>

          {/*
            지금 아무 일도 일어나지 않는 칸이다.
            설명이 없으면 교사가 고장으로 읽는다.
          */}
          <p className="mt-2 text-sm text-slate-500">
            나중에 급식·시간표를 불러올 때 쓰는 값입니다. 지금은 저장만 해 둡니다.
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * 저장 자료가 얼마나 찼는지.
 *
 * 백업 탭에 둔다. 정리하는 수단(백업 내려받기)이 바로 아래 있어서,
 * 알림과 할 일이 한 화면에 있다.
 */
function DataSizeCard() {
  const { data } = useSuite();
  const report = measureDataSize(data);

  // 여유로울 때는 말을 걸지 않는다. 겁줄 이유가 없다.
  if (report.level === 'ok') return null;

  const percent = Math.round(report.ratio * 100);
  const warn = report.level === 'warn';

  return (
    <Card title="저장 자료 크기" icon={Database}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span data-numeric className="text-2xl font-bold text-slate-900">
          {formatBytes(report.bytes)}
        </span>
        <span className={cx('text-sm font-medium', warn ? 'text-danger-700' : 'text-warning-700')}>
          한도의 {percent}%
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <span
          className={cx('block h-full', warn ? 'bg-danger-500' : 'bg-warning-500')}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>

      <p className={cx('mt-3 text-sm', warn ? 'text-danger-700' : 'text-slate-600')}>
        {warn
          ? 'Firebase를 붙였다면 곧 저장이 실패합니다. 아래에서 백업을 내려받은 뒤 활동·보상 → 기록 탭에서 지난 기록을 정리해 주세요.'
          : 'Firebase를 붙였다면 문서 하나에 1MB까지 담깁니다. 학년말에 백업을 내려받고 지난 기록을 정리하면 넉넉해집니다.'}
      </p>

      <p className="mt-1 text-sm text-slate-500">
        Firebase를 붙이지 않았다면 이 브라우저에만 저장되고 한도가 훨씬 넉넉합니다.
        그래도 백업은 받아 두세요.
      </p>

      <ul className="mt-3 flex flex-col gap-1">
        {report.slices.slice(0, 4).map((slice) => (
          <li key={slice.label} className="flex items-center gap-2 text-sm">
            <span className="w-20 shrink-0 text-slate-600">{slice.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <span
                className="block h-full bg-slate-400"
                style={{ width: `${Math.round(slice.share * 100)}%` }}
              />
            </span>
            <span data-numeric className="w-14 shrink-0 text-right text-xs text-slate-500">
              {formatBytes(slice.bytes)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function BackupTab() {
  const { adapter, flush } = useSuite();
  const toast = useToast();

  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<BackupSummary | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const refresh = async (): Promise<void> => {
    setBackups(await adapter.listBackups());
    setLastExportedAt(await adapter.getLastExportedAt());
  };

  useEffect(() => {
    void refresh();
    // adapter는 Provider 수명 동안 안정적이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async (): Promise<void> => {
    try {
      // 대기 중인 변경이 백업 파일에서 빠지면 안 된다.
      await flush();

      const json = await adapter.exportJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `우리반-백업-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);

      await refresh();
      toast.success('백업 파일을 내려받았습니다. 클라우드나 USB에 보관해 주세요.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '백업 파일을 만들지 못했습니다.');
    }
  };

  const handleImport = async (file: File): Promise<void> => {
    const text = await file.text();
    const result = await adapter.importJson(text);

    if (!result.ok) {
      toast.error(result.message ?? '가져오지 못했습니다.');
      return;
    }

    for (const repair of result.repairs) {
      if (repair.severity === 'warning') toast.warning(repair.message);
    }

    toast.success('가져왔습니다. 화면을 새로 고칩니다.');
    // 전역 상태를 통째로 갈아 끼우는 것보다 다시 읽는 편이 확실하다.
    window.setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="flex flex-col gap-4">
      <DataSizeCard />

      <Card title="백업" icon={Shield}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            이 앱은 학급 자료를 이 브라우저에만 저장합니다. 브라우저 기록을 지우거나
            다른 기기를 쓰면 자료가 보이지 않습니다.{' '}
            <strong className="font-semibold">정기적으로 파일로 내려받아 두세요.</strong>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon={Download} onClick={() => void handleExport()}>
              지금 백업하기
            </Button>

            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-control border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Upload className="size-4" aria-hidden />
              백업 파일 가져오기
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImport(file);
                  event.target.value = '';
                }}
              />
            </label>

            {lastExportedAt === null ? (
              <Badge tone="warning">아직 백업한 적 없음</Badge>
            ) : (
              <Badge tone="success">
                마지막 백업 {lastExportedAt.slice(0, 10)}
              </Badge>
            )}
          </div>

          <p className="text-sm text-slate-500">
            가져오기는 지금 자료를 덮어씁니다. 덮어쓰기 직전 상태는 아래 자동 백업에 남습니다.
          </p>
        </div>
      </Card>

      <Card
        title={`자동 백업 ${backups.length}개`}
        icon={RotateCcw}
        action={
          backups.length === 0 ? null : (
            <Button
              size="sm"
              variant="ghost"
              icon={Trash2}
              onClick={() => {
                void (async () => {
                  await adapter.clearBackups();
                  await refresh();
                  toast.info('자동 백업을 모두 지웠습니다.');
                })();
              }}
            >
              모두 지우기
            </Button>
          )
        }
      >
        {backups.length === 0 ? (
          <EmptyState
            title="아직 자동 백업이 없습니다"
            description="자료를 바꾸면 앱이 알아서 직전 상태를 남깁니다. 학기 전환이나 초기화처럼 되돌리기 어려운 작업 직전에도 남습니다."
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {backups.map((backup) => (
              <li
                key={backup.id}
                className="flex flex-wrap items-center gap-2 rounded-control border border-slate-200 px-2.5 py-1.5 text-sm"
              >
                <span className="w-32 shrink-0 text-slate-500">
                  {backup.createdAt.slice(5, 16).replace('T', ' ')}
                </span>
                <span className="min-w-0 flex-1 truncate">{backup.reason}</span>
                {backup.kind === 'guard' ? <Badge tone="brand">보호</Badge> : null}
                <span className="shrink-0 text-xs text-slate-400">
                  {Math.round(backup.sizeBytes / 1024)}KB
                </span>
                <Button size="sm" variant="secondary" onClick={() => setRestoring(backup)}>
                  이 시점으로 되돌리기
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="위험 구역">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="danger" icon={Trash2} onClick={() => setConfirmReset(true)}>
            전체 초기화
          </Button>
          <p className="text-sm text-slate-500">
            학급·명단·기록이 모두 지워집니다. 직전 상태는 자동 백업에 남습니다.
          </p>
        </div>
      </Card>

      <ConfirmDialog
        open={restoring !== null}
        title="이 시점으로 되돌릴까요?"
        description={`${restoring?.createdAt.slice(0, 16).replace('T', ' ') ?? ''} 상태로 돌아갑니다. 그 뒤에 바뀐 내용은 사라집니다. 지금 상태도 백업으로 남으니 다시 되돌릴 수 있습니다.`}
        confirmLabel="되돌리기"
        onCancel={() => setRestoring(null)}
        onConfirm={() => {
          if (restoring === null) return;
          void (async () => {
            const result = await adapter.restoreBackup(restoring.id);
            setRestoring(null);

            if (!result.ok) {
              toast.error(result.message ?? '되돌리지 못했습니다.');
              return;
            }
            toast.success('되돌렸습니다. 화면을 새로 고칩니다.');
            window.setTimeout(() => window.location.reload(), 600);
          })();
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        title="정말 전체를 초기화할까요?"
        description="학급·학생 명단·자리 배치·당번·점수·과제 기록이 모두 지워집니다. 되돌릴 수 있도록 직전 상태를 자동 백업에 남깁니다."
        destructive
        confirmPhrase="초기화"
        confirmLabel="전체 초기화"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          void (async () => {
            await adapter.reset();
            setConfirmReset(false);
            toast.warning('전체를 초기화했습니다.');
            window.setTimeout(() => window.location.reload(), 600);
          })();
        }}
      />
    </div>
  );
}


/**
 * 기존 앱에서 가져오기.
 *
 * 원본 5개 앱은 같은 브라우저의 다른 키에 자료를 남겨 두었다.
 * 명단만 옮긴다. 자리 배치·점수·당번 이력은 원본마다 구조가 크게 달라
 * 잘못 옮기면 조용히 틀린 기록이 생긴다.
 */
function LegacyTab() {
  const { update, guard } = useSuite();
  const toast = useToast();
  const [scan, setScan] = useState<LegacyScanResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setScan(scanLegacy(window.localStorage));
  }, []);

  if (scan === null) return null;

  if (scan.sources.length === 0) {
    return (
      <Card title="기존 앱에서 가져오기">
        <EmptyState
          title="이 브라우저에서 원본 앱 자료를 찾지 못했습니다"
          description="원본 앱을 쓰던 브라우저에서 이 화면을 열어야 합니다. 다른 기기라면 그쪽에서 백업 파일을 내려받아 위의 백업·복원 탭에서 가져오세요."
        />
      </Card>
    );
  }

  return (
    <Card title="기존 앱에서 가져오기">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          이 브라우저에서 원본 앱 자료를 찾았습니다.{' '}
          <strong className="font-semibold">학생 명단만</strong> 가져옵니다. 자리 배치·점수·당번
          이력은 원본마다 구조가 달라 잘못 옮기면 틀린 기록이 남습니다.
        </p>

        <ul className="flex flex-col gap-1">
          {scan.sources.map((source) => (
            <li
              key={source.key}
              className="flex items-center gap-2 rounded-control border border-slate-200 px-2.5 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{source.label}</span>
              <Badge tone={source.studentCount > 0 ? 'success' : 'neutral'}>
                학생 {source.studentCount}명
              </Badge>
            </li>
          ))}
        </ul>

        <p className="text-sm text-slate-500">
          학생이 가장 많은 자료를 기준으로 가져옵니다. 이미 있는 학생은 다시 넣지 않습니다.
          원본 자료는 지우지 않으므로 언제든 원래 앱으로 돌아갈 수 있습니다.
        </p>

        <Button
          variant="primary"
          icon={Upload}
          disabled={scan.totalStudents === 0}
          className="self-start"
          onClick={() => setConfirming(true)}
        >
          명단 가져오기
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="기존 앱의 명단을 가져올까요?"
        description="지금 명단에 없는 학생만 추가됩니다. 가져오기 직전 상태는 자동으로 백업됩니다."
        confirmLabel="가져오기"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          void (async () => {
            await guard('기존 앱 명단 가져오기 직전');

            let imported = 0;
            let skipped = 0;
            update((current) => {
              const result = importLegacyRoster(current, window.localStorage);
              imported = result.importedStudents;
              skipped = result.skipped;
              return result.data;
            });

            setConfirming(false);
            if (imported === 0) {
              toast.warning('새로 가져올 학생이 없습니다.');
            } else {
              toast.success(
                skipped > 0
                  ? `${imported}명을 가져왔습니다. ${skipped}명은 이미 있거나 이름이 없어 건너뛰었습니다.`
                  : `${imported}명을 가져왔습니다.`,
              );
            }
          })();
        }}
      />
    </Card>
  );
}

/**
 * 도구함 쪽 원본 4개 앱에서 가져오기.
 *
 * 학급 자료(위 카드)와 나눠 둔다. 가져오는 것이 다르다 — 이쪽은 수업 흐름·
 * 문제 세트·업무·문구이고, 학급 명단과 섞이지 않는다.
 */
function ToolkitLegacyTab() {
  const { update, guard } = useSuite();
  const toast = useToast();
  const [scan, setScan] = useState<ToolkitLegacyScan | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setScan(scanToolkitLegacy(window.localStorage));
  }, []);

  if (scan === null || scan.sources.length === 0) return null;

  return (
    <Card title="수업·업무 도구 원본에서 가져오기">
      <p className="text-sm text-slate-600">
        이 브라우저에서 원본 앱 자료를 찾았습니다. 수업 흐름·문제 세트·업무·문구를 가져옵니다.
      </p>

      <ul className="mt-3 flex flex-col gap-1">
        {scan.sources.map((source) => (
          <li key={source.key} className="text-sm text-slate-700">
            <Badge tone="neutral">{source.label}</Badge>
          </li>
        ))}
      </ul>

      <Button className="mt-3" variant="primary" icon={Upload} onClick={() => setConfirming(true)}>
        가져오기
      </Button>

      <ConfirmDialog
        open={confirming}
        title="원본 자료를 가져올까요?"
        description="지금 있는 것에 더합니다. 이미 같은 것이 있으면 건너뜁니다. 가져오기 직전 상태는 자동으로 백업됩니다."
        confirmLabel="가져오기"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          void (async () => {
            await guard('도구 원본 가져오기 직전');

            let added = 0;
            update((current) => {
              const result = importToolkitLegacy(current, window.localStorage);
              added =
                result.data.lessonTemplates.length -
                current.lessonTemplates.length +
                (result.data.quizSets.length - current.quizSets.length) +
                (result.data.tasks.length - current.tasks.length) +
                (result.data.messageTemplates.length - current.messageTemplates.length);
              return result.data;
            });

            setConfirming(false);
            toast.success(added > 0 ? `${added}건을 가져왔습니다.` : '새로 가져올 것이 없습니다.');
          })();
        }}
      />
    </Card>
  );
}
