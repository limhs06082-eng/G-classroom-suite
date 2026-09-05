import { ArrowLeft, Copy, KeyRound, Sparkles, Square, WandSparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  clearAiConfig,
  defaultModelFor,
  readAiConfig,
  saveAiConfig,
  type AiConfig,
  type AiProvider,
} from '../ai/aiSettings';
import { collectCommentFacts } from '../ai/commentPrompt';
import { AI_PROVIDERS } from '../ai/providers';
import { pingAi, writeCommentWithAi } from '../ai/writeComment';
import type { Student } from '../domain/types';
import { Button, Card, ConfirmDialog, cx, EmptyState, useToast } from '../ui';
import {
  commentOf,
  draftBehaviorComment,
  NEIS_COMMENT_LIMIT,
  upsertBehaviorComment,
} from './behaviorCommentCore';
import { useActiveClass, useRoster, useSuite } from './SuiteDataProvider';

/**
 * 학급 전체 행동특성 및 종합의견.
 *
 * 학기말에 서른 명을 한 명씩 열어 쓰던 일을 한 화면에 모은다. 규칙 초안이든
 * AI 글이든 **빈 학생만** 채운다 — 교사가 이미 다듬은 글을 단추 하나로
 * 덮지 않는다. AI에는 이름·번호를 보내지 않는다(commentPrompt 참조).
 */
export default function CommentsPage() {
  const { data, update } = useSuite();
  const activeClass = useActiveClass();
  const roster = useRoster();
  const toast = useToast();

  const term = data.terms.find((item) => item.id === data.activeTermId) ?? null;
  const [termOnly, setTermOnly] = useState(true);
  const range =
    termOnly && term !== null && term.startDate !== '' && term.endDate !== ''
      ? { from: term.startDate, to: term.endDate }
      : undefined;

  // 아직 칸을 안 떠난 타이핑. 떠나면 자료로 가고 여기서 지운다.
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map());
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(() => readAiConfig());
  const [ask, setAsk] = useState<{ student: Student; kind: 'draft' | 'ai' } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const stopRef = useRef(false);

  if (activeClass === null) {
    return (
      <Card>
        <EmptyState icon={Sparkles} title="학급을 먼저 만들어 주세요" description="학급이 있어야 의견을 쓸 수 있습니다." />
      </Card>
    );
  }

  const classId = activeClass.id;
  const savedOf = (student: Student): string => commentOf(data.behaviorComments, classId, student.id);
  const textOf = (student: Student): string => drafts.get(student.id) ?? savedOf(student);
  const written = roster.filter((student) => savedOf(student).trim() !== '').length;

  const persist = (student: Student, value: string): void => {
    update((suite) => ({
      ...suite,
      behaviorComments: upsertBehaviorComment(
        suite.behaviorComments,
        { classId, studentId: student.id, text: value },
        new Date().toISOString(),
      ),
    }));
  };

  const fillDraft = (student: Student): boolean => {
    const draft = draftBehaviorComment(data, student.id, range);
    if (draft === '') return false;
    persist(student, draft);
    return true;
  };

  const fillAi = async (student: Student): Promise<boolean> => {
    const config = readAiConfig();
    if (config === null) {
      toast.warning('먼저 아래 AI 작성 설정에 키를 넣어 주세요.');
      return false;
    }
    const facts = collectCommentFacts(data, student.id, range);
    if (facts === null) return false;
    const result = await writeCommentWithAi(facts, config);
    if (!result.ok) {
      toast.error(`${student.name}: ${result.error}`);
      return false;
    }
    persist(student, result.text);
    return true;
  };

  const runOne = async (student: Student, kind: 'draft' | 'ai'): Promise<void> => {
    setBusyId(student.id);
    try {
      const ok = kind === 'draft' ? fillDraft(student) : await fillAi(student);
      if (kind === 'draft' && !ok) toast.info(`${student.name}: 아직 기록이 없어 초안을 만들 수 없습니다.`);
    } finally {
      setBusyId(null);
    }
  };

  const askOrRun = (student: Student, kind: 'draft' | 'ai'): void => {
    if (textOf(student).trim() === '') void runOne(student, kind);
    else setAsk({ student, kind });
  };

  /** 빈 학생만, 차례로. AI는 한 번에 하나씩 — 회사들이 동시 요청을 막는다. */
  const runAll = async (kind: 'draft' | 'ai'): Promise<void> => {
    const targets = roster.filter((student) => savedOf(student).trim() === '');
    if (targets.length === 0) {
      toast.info('빈 학생이 없습니다. 이미 글이 있는 학생은 각자 단추로 바꿀 수 있습니다.');
      return;
    }
    if (kind === 'ai' && readAiConfig() === null) {
      toast.warning('먼저 아래 AI 작성 설정에 키를 넣어 주세요.');
      return;
    }
    stopRef.current = false;
    setProgress({ done: 0, total: targets.length });
    let filled = 0;
    for (const [index, student] of targets.entries()) {
      if (stopRef.current) break;
      const ok = kind === 'draft' ? fillDraft(student) : await fillAi(student);
      if (ok) filled += 1;
      setProgress({ done: index + 1, total: targets.length });
    }
    setProgress(null);
    toast.success(`${filled}명의 글을 채웠습니다.`);
  };

  const copyOne = async (student: Student): Promise<void> => {
    try {
      await navigator.clipboard.writeText(textOf(student));
      toast.success(`${student.name} 글을 복사했습니다.`);
    } catch {
      toast.error('복사하지 못했습니다. 글을 직접 선택해 복사해 주세요.');
    }
  };

  const copyAll = async (): Promise<void> => {
    const block = roster
      .filter((student) => textOf(student).trim() !== '')
      .map((student) => `${student.number}번 ${student.name}\n${textOf(student)}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(block);
      toast.success('전체를 복사했습니다. 문서에 붙여 넣어 두세요.');
    } catch {
      toast.error('복사하지 못했습니다.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-2">
        <Link to="/roster" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="size-4" aria-hidden />
          학생 명단
        </Link>
        <h1 className="text-xl font-bold text-slate-900">{activeClass.name} 행동특성 및 종합의견</h1>
        <p className="text-sm text-slate-500">
          작성 {written} / {roster.length}
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {term !== null ? (
            <div className="inline-flex gap-0.5 rounded-control border border-slate-200 p-0.5" role="group" aria-label="집계 기간">
              <Button size="sm" variant={termOnly ? 'primary' : 'ghost'} aria-pressed={termOnly} onClick={() => setTermOnly(true)}>
                {term.name}
              </Button>
              <Button size="sm" variant={termOnly ? 'ghost' : 'primary'} aria-pressed={!termOnly} onClick={() => setTermOnly(false)}>
                통산
              </Button>
            </div>
          ) : null}
          <Button size="sm" variant="secondary" icon={WandSparkles} disabled={progress !== null} onClick={() => void runAll('draft')}>
            모두 초안 넣기
          </Button>
          <Button size="sm" variant="primary" icon={Sparkles} disabled={progress !== null} onClick={() => void runAll('ai')}>
            AI로 모두 작성
          </Button>
          <Button size="sm" variant="secondary" icon={Copy} disabled={written === 0} onClick={() => void copyAll()}>
            모두 복사
          </Button>
        </div>
      </header>

      {progress !== null ? (
        <div className="flex items-center gap-3 rounded-card border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-slate-800" role="status">
          <span>
            쓰는 중 {progress.done} / {progress.total}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded bg-surface">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <Button size="sm" variant="ghost" icon={Square} onClick={() => { stopRef.current = true; }}>
            중단
          </Button>
        </div>
      ) : null}

      <p className="text-sm text-slate-500">
        빈 학생만 채웁니다. 이미 글이 있는 학생은 각자 단추로 바꿉니다. 글은 칸을 떠날 때 저장됩니다.
        지도(감점) 기록은 초안에도 AI에도 넣지 않습니다.
      </p>

      {roster.length === 0 ? (
        <Card>
          <EmptyState icon={Sparkles} title="학생이 없습니다" description="학생 명단을 먼저 등록해 주세요." />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="학생별 의견">
          {roster.map((student) => {
            const text = textOf(student);
            const over = text.length > NEIS_COMMENT_LIMIT;
            const busy = busyId === student.id;
            return (
              <li key={student.id} className="rounded-card border border-slate-200 bg-surface p-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span data-numeric className="w-6 text-right text-sm text-slate-400">
                    {student.number}
                  </span>
                  <Link to={`/roster/${student.id}`} className="text-sm font-semibold text-slate-900 hover:underline">
                    {student.name}
                  </Link>
                  <span className={cx('text-xs', over ? 'font-semibold text-danger-700' : 'text-slate-500')}>
                    {text.length} / {NEIS_COMMENT_LIMIT}자
                  </span>
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" icon={WandSparkles} disabled={busy || progress !== null} aria-label={`${student.name} 초안 넣기`} onClick={() => askOrRun(student, 'draft')}>
                      초안
                    </Button>
                    <Button size="sm" variant="ghost" icon={Sparkles} loading={busy} disabled={progress !== null} aria-label={`${student.name} AI로 작성`} onClick={() => askOrRun(student, 'ai')}>
                      AI
                    </Button>
                    <Button size="sm" variant="ghost" icon={Copy} disabled={text.trim() === ''} aria-label={`${student.name} 복사`} onClick={() => void copyOne(student)}>
                      복사
                    </Button>
                  </div>
                </div>
                <textarea
                  value={text}
                  onChange={(event) => setDrafts((current) => new Map(current).set(student.id, event.target.value))}
                  onBlur={() => {
                    const value = drafts.get(student.id);
                    if (value === undefined) return;
                    if (value.trim() !== savedOf(student)) persist(student, value);
                    setDrafts((current) => {
                      const next = new Map(current);
                      next.delete(student.id);
                      return next;
                    });
                  }}
                  rows={3}
                  aria-label={`${student.name} 행동특성 및 종합의견`}
                  placeholder="[초안]이나 [AI]를 누르거나 직접 적어 주세요."
                  className="w-full rounded-control border border-slate-300 p-2 text-sm leading-relaxed"
                />
              </li>
            );
          })}
        </ul>
      )}

      <AiSettingsCard config={aiConfig} onChange={setAiConfig} />

      <ConfirmDialog
        open={ask !== null}
        title={ask?.kind === 'ai' ? 'AI 글로 바꿀까요?' : '초안으로 바꿀까요?'}
        description={`${ask?.student.name ?? ''} 학생에게 이미 글이 있습니다. 지금 글을 새 글로 바꿉니다. 바꾼 뒤에는 되돌릴 수 없습니다.`}
        confirmLabel={ask?.kind === 'ai' ? 'AI 글로 바꾸기' : '초안으로 바꾸기'}
        onConfirm={() => {
          if (ask !== null) void runOne(ask.student, ask.kind);
          setAsk(null);
        }}
        onCancel={() => setAsk(null)}
      />
    </div>
  );
}

/**
 * AI 작성 설정. 키는 이 컴퓨터에만 남고 백업에 안 들어간다.
 * 설정이 없으면 펼쳐 두고, 있으면 접어 둔다 — 매번 키를 보여 줄 이유가 없다.
 */
function AiSettingsCard({ config, onChange }: { config: AiConfig | null; onChange: (next: AiConfig | null) => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(config === null);
  const [provider, setProvider] = useState<AiProvider>(config?.provider ?? 'gemini');
  const [apiKey, setApiKey] = useState(config?.apiKey ?? '');
  const [model, setModel] = useState(config?.model ?? defaultModelFor(config?.provider ?? 'gemini'));
  const [checking, setChecking] = useState(false);
  const info = AI_PROVIDERS.find((item) => item.id === provider) ?? AI_PROVIDERS[0];

  const pickProvider = (next: AiProvider): void => {
    setProvider(next);
    // 회사를 바꾸면 모델도 그 회사 기본으로 — 다른 회사 모델 이름이 남아 있으면 404다.
    setModel(defaultModelFor(next));
  };

  const save = (): AiConfig | null => {
    if (apiKey.trim() === '') {
      clearAiConfig();
      onChange(null);
      toast.info('키를 지웠습니다.');
      return null;
    }
    const next = { provider, apiKey: apiKey.trim(), model: model.trim() === '' ? defaultModelFor(provider) : model.trim() };
    saveAiConfig(next);
    onChange(next);
    toast.success('이 컴퓨터에 저장했습니다.');
    return next;
  };

  const check = async (): Promise<void> => {
    const next = save();
    if (next === null) return;
    setChecking(true);
    try {
      const result = await pingAi(next);
      if (result.ok) toast.success('연결됐습니다. 이제 [AI로 모두 작성]을 쓸 수 있습니다.');
      else toast.error(result.error);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card
      title="AI 작성 설정"
      icon={KeyRound}
      action={
        <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? '접기' : config === null ? '키 넣기' : `${info?.label ?? ''} 연결됨 · 바꾸기`}
        </Button>
      }
    >
      {open ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            선생님 개인의 API 키로 AI가 글을 씁니다. 키는 <strong className="font-semibold">이 컴퓨터에만</strong> 저장되고
            백업에 들어가지 않습니다. AI에는 <strong className="font-semibold">학생 이름·번호를 보내지 않으며</strong>, 관찰 기록
            원문과 출결·칭찬·과제 숫자만 보냅니다. 비용은 선생님 계정에서 나갑니다(한 명에 몇 원 수준).
          </p>
          <div className="inline-flex flex-wrap gap-0.5 rounded-control border border-slate-200 p-0.5" role="group" aria-label="AI 회사">
            {AI_PROVIDERS.map((item) => (
              <Button key={item.id} size="sm" variant={provider === item.id ? 'primary' : 'ghost'} aria-pressed={provider === item.id} onClick={() => pickProvider(item.id)}>
                {item.label}
              </Button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">API 키</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={info?.keyHint ?? ''}
              aria-label="API 키"
              autoComplete="off"
              className="h-10 rounded-control border border-slate-300 px-3 font-mono text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">모델 (회사가 이름을 바꾸면 여기서 고칩니다)</span>
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              aria-label="모델"
              className="h-10 rounded-control border border-slate-300 px-3 font-mono text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => save()}>
              저장
            </Button>
            <Button variant="secondary" loading={checking} onClick={() => void check()}>
              연결 확인
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          {config === null ? '아직 키가 없습니다. [키 넣기]를 누르세요.' : `${info?.label ?? ''} · ${config.model}`}
        </p>
      )}
    </Card>
  );
}
