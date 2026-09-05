import { Copy, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

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
  const [askReplace, setAskReplace] = useState(false);

  // 다른 학생으로 옮겨 가면 글상자도 그 학생 것으로.
  useEffect(() => {
    setText(commentOf(data.behaviorComments, student.classId, student.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id]);

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
            icon={Sparkles}
            onClick={() => (text.trim() === '' ? fillDraft() : setAskReplace(true))}
          >
            초안 넣기
          </Button>
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
        onBlur={() => persist(text)}
        rows={6}
        aria-label={`${student.name} 행동특성 및 종합의견`}
        placeholder="[초안 넣기]를 누르거나 직접 적어 주세요."
        className="w-full rounded-control border border-slate-300 p-3 text-sm leading-relaxed"
      />
      <p className={cx('mt-1 text-right text-xs', over ? 'font-semibold text-danger-700' : 'text-slate-500')}>
        {text.length} / {NEIS_COMMENT_LIMIT}자{over ? ' — 나이스 기준을 넘었습니다' : ''}
      </p>

      <ConfirmDialog
        open={askReplace}
        title="초안으로 바꿀까요?"
        description="지금 적힌 글을 기록에서 만든 초안으로 바꿉니다. 바꾼 뒤에는 되돌릴 수 없습니다."
        confirmLabel="초안으로 바꾸기"
        onConfirm={() => {
          setAskReplace(false);
          fillDraft();
        }}
        onCancel={() => setAskReplace(false)}
      />
    </Card>
  );
}
