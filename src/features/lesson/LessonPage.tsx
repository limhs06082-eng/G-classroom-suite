import {
  ChevronDown,
  ChevronUp,
  Monitor,
  Play,
  Plus,
  Presentation,
  Square,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

import type { LessonPhase, LessonStage, LessonTemplate } from '../../shared/domain/types';
import { TitleSubjectFields } from '../../shared/TitleSubjectFields';
import { Badge, Button, Card, ConfirmDialog, cx, EmptyState, Modal, useToast } from '../../shared/ui';
import { openBoard } from '../../shared/window/openBoard';
import { MODE_LABELS, PHASE_LABELS, totalMinutes } from './lessonCore';
import { useLesson } from './useLesson';

const PHASES: LessonPhase[] = ['intro', 'activity', 'wrapup'];

const PHASE_TONE: Record<LessonPhase, string> = {
  intro: 'border-sky-200 bg-sky-50',
  activity: 'border-emerald-200 bg-emerald-50',
  wrapup: 'border-amber-200 bg-amber-50',
};

/**
 * 수업 진행판.
 *
 * 수업 전에는 흐름을 짜고, 수업 중에는 전자칠판을 띄워 진행한다.
 * 원본과 달리 진행 상태를 저장하므로 새로고침해도 이어진다.
 */
export default function LessonPage() {
  const lesson = useLesson();
  const toast = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<LessonTemplate | null>(null);

  const editing = lesson.templates.find((item) => item.id === editingId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">수업 진행</h1>
        {lesson.running === null ? null : <Badge tone="success">진행 중: {lesson.running.title}</Badge>}

        <div className="ml-auto flex flex-wrap gap-2">
          <Button icon={Plus} variant="primary" onClick={() => setAddOpen(true)}>
            수업 흐름 만들기
          </Button>
          {lesson.running === null ? null : (
            <Button variant="secondary" icon={Monitor} onClick={() => openBoard('/board/lesson')}>
              전자칠판
            </Button>
          )}
        </div>
      </div>

      {lesson.running !== null && lesson.progress !== null ? (
        <Card title="지금 진행 중" icon={Presentation} accentClass="text-lesson-500">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-500">
                {lesson.progress.index + 1} / {lesson.progress.total} 단계 · 완료{' '}
                {lesson.progress.doneCount}개
              </p>
              <p className="truncate text-lg font-semibold text-slate-900">
                {lesson.progress.current?.title ?? '단계가 없습니다'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={lesson.goPrev} disabled={lesson.progress.index === 0}>
                이전
              </Button>
              <Button variant="primary" onClick={lesson.goNext} disabled={lesson.progress.isLast}>
                다음
              </Button>
              <Button icon={Square} variant="ghost" onClick={lesson.stopLesson}>
                수업 종료
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {lesson.templates.length === 0 ? (
        <Card>
          <EmptyState
            icon={Presentation}
            title="아직 수업 흐름이 없습니다"
            description="도입·활동·정리 뼈대를 만들어 드립니다. 단계 이름과 시간은 나중에 고치면 됩니다."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>
                수업 흐름 만들기
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lesson.templates.map((template) => (
            <li key={template.id}>
              <Card
                title={template.title}
                action={
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    iconOnly
                    aria-label={`${template.title} 삭제`}
                    onClick={() => setDeleting(template)}
                  />
                }
              >
                {/* 제목은 h2 안이라 truncate된다. 과목 배지는 본문 첫 줄에 둔다. */}
                <p className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  {template.subject === '' ? null : (
                    <Badge tone="neutral">{template.subject}</Badge>
                  )}
                  <span>
                    {template.stages.length}단계 · 총 {totalMinutes(template)}분
                  </span>
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={Play}
                    onClick={() => {
                      lesson.startLesson(template.id);
                      toast.success(`${template.title} 수업을 시작했습니다.`);
                    }}
                  >
                    수업 시작
                  </Button>
                  <Button size="sm" onClick={() => setEditingId(template.id)}>
                    단계 편집
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <StageEditor
        template={editing}
        onClose={() => setEditingId(null)}
        lesson={lesson}
      />

      <AddTemplateModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(title, withStarter) => {
          const id = lesson.addTemplate(title, withStarter);
          setAddOpen(false);
          setEditingId(id);
          toast.success(`${title} 수업 흐름을 만들었습니다.`);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`${deleting?.title ?? ''} 수업 흐름을 지울까요?`}
        description="이 흐름의 단계가 모두 사라집니다. 지우기 직전 상태는 자동으로 백업됩니다."
        destructive
        confirmLabel="삭제"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting === null) return;
          void (async () => {
            await lesson.deleteTemplate(deleting.id);
            toast.warning(`${deleting.title} 수업 흐름을 지웠습니다.`);
            setDeleting(null);
          })();
        }}
      />
    </div>
  );
}

function StageEditor({
  template,
  onClose,
  lesson,
}: {
  template: LessonTemplate | null;
  onClose: () => void;
  lesson: ReturnType<typeof useLesson>;
}) {
  if (template === null) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={`${template.title} 편집`}
      size="xl"
      footer={
        <Button variant="primary" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <TitleSubjectFields
          title={template.title}
          subject={template.subject}
          titleLabel="수업 흐름 이름"
          onTitleChange={(value) => lesson.renameTemplate(template.id, value)}
          onSubjectChange={(value) => lesson.setTemplateSubject(template.id, value)}
        />

        <div className="flex flex-wrap gap-2">
          {PHASES.map((phase) => (
            <Button
              key={phase}
              size="sm"
              icon={Plus}
              onClick={() => lesson.addStage(template.id, phase)}
            >
              {PHASE_LABELS[phase]} 단계 추가
            </Button>
          ))}
          <span className="ml-auto self-center text-sm text-slate-500">
            총 {totalMinutes(template)}분
          </span>
        </div>

        {template.stages.length === 0 ? (
          <EmptyState title="단계가 없습니다" description="위 버튼으로 단계를 추가해 주세요." />
        ) : (
          <ul className="flex flex-col gap-2">
            {template.stages.map((stage, index) => (
              <StageRow
                key={stage.id}
                stage={stage}
                index={index}
                total={template.stages.length}
                onChange={(patch) => lesson.updateStage(template.id, stage.id, patch)}
                onRemove={() => lesson.removeStage(template.id, stage.id)}
                onMove={(to) => lesson.reorderStage(template.id, index, to)}
              />
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function StageRow({
  stage,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  stage: LessonStage;
  index: number;
  total: number;
  onChange: (patch: Partial<LessonStage>) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
}) {
  return (
    <li className={cx('flex flex-wrap items-center gap-2 rounded-card border p-2.5', PHASE_TONE[stage.phase])}>
      <Badge tone="neutral">{PHASE_LABELS[stage.phase]}</Badge>

      <input
        defaultValue={stage.title}
        onBlur={(event) => {
          const title = event.target.value.trim();
          if (title !== '' && title !== stage.title) onChange({ title });
        }}
        aria-label={`${stage.title} 단계 이름`}
        className="min-w-32 flex-1 rounded border border-transparent bg-surface/70 px-2 py-1 text-sm font-medium hover:border-slate-300 focus:border-slate-400"
      />

      <label className="flex items-center gap-1 text-sm text-slate-600">
        <input
          type="number"
          min={0}
          max={120}
          defaultValue={stage.minutes}
          onBlur={(event) => {
            const minutes = Number.parseInt(event.target.value, 10);
            if (Number.isFinite(minutes) && minutes >= 0) onChange({ minutes });
          }}
          aria-label={`${stage.title} 분`}
          className="h-8 w-14 rounded-control border border-slate-300 px-2 text-sm"
        />
        분
      </label>

      <select
        value={stage.mode}
        onChange={(event) => onChange({ mode: event.target.value as LessonStage['mode'] })}
        aria-label={`${stage.title} 활동 형태`}
        className="h-8 rounded-control border border-slate-300 px-1.5 text-sm"
      >
        {(Object.keys(MODE_LABELS) as Array<LessonStage['mode']>).map((mode) => (
          <option key={mode} value={mode}>
            {MODE_LABELS[mode]}
          </option>
        ))}
      </select>

      <div className="flex gap-0.5">
        <Button
          size="sm"
          variant="ghost"
          icon={ChevronUp}
          iconOnly
          aria-label="위로"
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
        />
        <Button
          size="sm"
          variant="ghost"
          icon={ChevronDown}
          iconOnly
          aria-label="아래로"
          disabled={index === total - 1}
          onClick={() => onMove(index + 1)}
        />
        <Button
          size="sm"
          variant="ghost"
          icon={Trash2}
          iconOnly
          aria-label={`${stage.title} 삭제`}
          onClick={onRemove}
        />
      </div>

      <input
        defaultValue={stage.guide}
        onBlur={(event) => onChange({ guide: event.target.value })}
        placeholder="학생에게 보여 줄 안내 (선택)"
        aria-label={`${stage.title} 안내 문구`}
        className="w-full rounded border border-transparent bg-surface/70 px-2 py-1 text-sm hover:border-slate-300 focus:border-slate-400"
      />
    </li>
  );
}

function AddTemplateModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string, withStarter: boolean) => void;
}) {
  const [title, setTitle] = useState('');
  const [withStarter, setWithStarter] = useState(true);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="수업 흐름 만들기"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            disabled={title.trim() === ''}
            onClick={() => {
              onAdd(title.trim(), withStarter);
              setTitle('');
            }}
          >
            만들기
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="block text-sm">
          <span className="text-slate-700">수업 이름</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="수학 3단원 1차시"
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>

        <label className="flex cursor-pointer items-start gap-2 rounded-control border border-slate-200 p-3">
          <input
            type="checkbox"
            checked={withStarter}
            onChange={(event) => setWithStarter(event.target.checked)}
            className="mt-0.5 size-4 shrink-0"
          />
          <span className="text-sm">
            <span className="block font-medium text-slate-800">기본 단계 깔아 주기</span>
            <span className="mt-0.5 block text-slate-500">
              동기 유발 · 학습 목표 · 활동 1·2 · 정리 · 차시 예고 여섯 단계를 만듭니다.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
