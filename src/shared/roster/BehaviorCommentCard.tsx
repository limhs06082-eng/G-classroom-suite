import { Copy, Sparkles, WandSparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import { readAiConfig } from '../ai/aiSettings';
import { collectCommentFacts } from '../ai/commentPrompt';
import { writeCommentWithAi } from '../ai/writeComment';
import type { Student } from '../domain/types';
import { Button, Card, ConfirmDialog, cx, useToast } from '../ui';
import {
  commentOf,
  draftBehaviorComment,
  NEIS_COMMENT_LIMIT,
  upsertBehaviorComment,
} from './behaviorCommentCore';
import type { DateRange } from './studentSummary';
import { useSuite } from './SuiteDataProvider';

/**
 * 행동특성 및 종합의견 카드.
 *
 * [초안 넣기]가 기록에서 한 단락을 만들고, 교사가 고친 글은 칸을 떠날 때
 * 저장된다. [복사하기]로 나이스에 붙여 넣는다. 글이 이미 있을 때 초안은
 * 묻고 나서 바꾼다 — 학기말에 다듬은 문장이 단추 하나로 사라지면 안 된다.
 */
export function BehaviorCommentCard({ student, range }: { student: Student; range?: DateRange }) {
  const { data, update } = useSuite();
  const toast = useToast();
  const saved = commentOf(data.behaviorComments, student.classId, student.id);
  const [text, setText] = useState(saved);
  const [askReplace, setAskReplace] = useState<'draft' | 'ai' | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const aiReady = readAiConfig() !== null;

  /*
   * 다른 학생으로 옮겨 가거나 저장된 글이 바깥(다른 창·기기)에서 바뀌면
   * 글상자도 따라간다. 아직 칸을 안 떠난 타이핑은 그때 덮인다 — 이 앱의
   * 다른 blur 저장 칸들과 같은 한계다.
   */
  useEffect(() => {
    setText(saved);
  }, [student.id, saved]);

  const persist = (value: string): void => {
    update((suite) => ({
      ...suite,
      behaviorComments: upsertBehaviorComment(
        suite.behaviorComments,
        { classId: student.classId, studentId: student.id, text: value },
        new Date().toISOString(),
      ),
    }));
  };

  const fillDraft = (): void => {
    const draft = draftBehaviorComment(data, student.id, range);
    if (draft === '') {
      toast.info('아직 기록이 없어 초안을 만들 수 없습니다. 관찰 기록부터 적어 주세요.');
      return;
    }
    setText(draft);
    persist(draft);
    toast.success('초안을 넣었습니다. 고쳐서 쓰세요.');
  };

  /** AI 글. 이름·번호는 보내지 않는다(collectCommentFacts). 키는 학급 전체 화면에서 넣는다. */
  const fillAi = async (): Promise<void> => {
    const config = readAiConfig();
    if (config === null) {
      toast.warning('먼저 학생 명단 → [행동특성 한 번에]에서 AI 키를 넣어 주세요.');
      return;
    }
    const facts = collectCommentFacts(data, student.id, range);
    if (facts === null) return;
    setAiBusy(true);
    try {
      const result = await writeCommentWithAi(facts, config);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setText(result.text);
      persist(result.text);
      toast.success('AI가 썼습니다. 읽고 고쳐서 쓰세요.');
    } finally {
      setAiBusy(false);
    }
  };

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('복사했습니다. 나이스에 붙여 넣으세요.');
    } catch {
      toast.error('복사하지 못했습니다. 글을 직접 선택해 복사해 주세요.');
    }
  };

  const over = text.length > NEIS_COMMENT_LIMIT;

  return (
    <Card
      title="행동특성 및 종합의견"
      icon={Sparkles}
      action={
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="secondary"
            icon={WandSparkles}
            onClick={() => (text.trim() === '' ? fillDraft() : setAskReplace('draft'))}
          >
            초안 넣기
          </Button>
          {aiReady ? (
            <Button
              size="sm"
              variant="secondary"
              icon={Sparkles}
              loading={aiBusy}
              onClick={() => (text.trim() === '' ? void fillAi() : setAskReplace('ai'))}
            >
              AI로 작성
            </Button>
          ) : null}
          <Button size="sm" variant="primary" icon={Copy} disabled={text.trim() === ''} onClick={() => void copy()}>
            복사하기
          </Button>
        </div>
      }
    >
      <p className="mb-2 text-sm text-slate-500">
        관찰 기록·칭찬·당번·과제·출결에서 초안을 만들고, 고쳐서 나이스에 붙여 넣습니다. 지도(감점)
        기록은 초안에 넣지 않습니다.
      </p>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        // 안 바뀌었으면 저장하지 않는다 — 칸을 스쳐 지나갈 때마다 쓰기가 나가면 안 된다.
        onBlur={() => {
          if (text.trim() !== saved) persist(text);
        }}
        rows={6}
        aria-label={`${student.name} 행동특성 및 종합의견`}
        placeholder="[초안 넣기]를 누르거나 직접 적어 주세요."
        className="w-full rounded-control border border-slate-300 p-3 text-sm leading-relaxed"
      />
      <p className={cx('mt-1 text-right text-xs', over ? 'font-semibold text-danger-700' : 'text-slate-500')}>
        {text.length} / {NEIS_COMMENT_LIMIT}자{over ? ' — 나이스 기준을 넘었습니다' : ''}
      </p>

      <ConfirmDialog
        open={askReplace !== null}
        title={askReplace === 'ai' ? 'AI 글로 바꿀까요?' : '초안으로 바꿀까요?'}
        description={
          askReplace === 'ai'
            ? '지금 적힌 글을 AI가 쓴 글로 바꿉니다. 바꾼 뒤에는 되돌릴 수 없습니다.'
            : '지금 적힌 글을 기록에서 만든 초안으로 바꿉니다. 바꾼 뒤에는 되돌릴 수 없습니다.'
        }
        confirmLabel={askReplace === 'ai' ? 'AI 글로 바꾸기' : '초안으로 바꾸기'}
        onConfirm={() => {
          const kind = askReplace;
          setAskReplace(null);
          if (kind === 'ai') void fillAi();
          else fillDraft();
        }}
        onCancel={() => setAskReplace(null)}
      />
    </Card>
  );
}
