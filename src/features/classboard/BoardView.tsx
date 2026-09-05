import { Eye, EyeOff, Lock, RefreshCw, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button, cx, Tabs } from '../../shared/ui';
import { cleanText, COMMENT_MAX, commentsFor, POST_MAX, timeLabel, visiblePosts } from './boardCore';
import type { Board, BoardComment, BoardPost } from './boardTypes';

/**
 * 주제 탭 · 글쓰기 · 글과 댓글. 교사 화면과 학생 화면이 같은 것을 본다 —
 * 다른 것은 `canModerate`(숨기기·지우기)와 잠긴 주제에 쓸 수 있는가뿐이다.
 *
 * 글에는 제목이 없다. 문자처럼 본문 한 덩어리·쓴 사람·시각. 좋아요·사진·파일은
 * 없다 — 개인정보와 운영 부담이 늘고, 없어도 건의와 칭찬은 된다.
 */
export interface BoardViewProps {
  board: Board;
  posts: readonly BoardPost[];
  comments: readonly BoardComment[];
  me: { uid: string; name: string; byTeacher: boolean };
  canModerate: boolean;
  busy: boolean;
  now: Date;
  onRefresh: () => void;
  onPost: (topicId: string, text: string) => Promise<void>;
  onComment: (postId: string, text: string) => Promise<void>;
  onHidePost?: (postId: string, hidden: boolean) => void;
  onDeletePost?: (postId: string) => void;
  onHideComment?: (commentId: string, hidden: boolean) => void;
  onDeleteComment?: (commentId: string) => void;
}

const PLACEHOLDERS: Record<string, string> = {
  suggest: '우리 반에 바라는 점을 적어 주세요.',
  praise: '칭찬하고 싶은 친구와 그 이유를 적어 주세요.',
};

const INPUT = 'w-full rounded-control border border-slate-300 bg-surface px-3 text-sm text-slate-900';

export function BoardView({
  board,
  posts,
  comments,
  me,
  canModerate,
  busy,
  now,
  onRefresh,
  onPost,
  onComment,
  onHidePost,
  onDeletePost,
  onHideComment,
  onDeleteComment,
}: BoardViewProps) {
  const [chosenTopic, setChosenTopic] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<{ kind: 'post' | 'comment'; id: string } | null>(null);

  // 고른 주제가 지워졌으면 첫 주제로.
  const topic = board.topics.find((item) => item.id === chosenTopic) ?? board.topics[0] ?? null;
  if (topic === null) {
    return <p className="text-sm text-slate-500">주제가 없습니다. 주제 관리에서 하나 만들어 주세요.</p>;
  }

  const canWrite = canModerate || !topic.locked;
  const shown = visiblePosts(posts, topic.id, canModerate);
  const draftClean = cleanText(draft, POST_MAX);
  const draftLength = [...draft].length;

  const submitPost = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (draftClean === '' || busy) return;
    await onPost(topic.id, draftClean);
    setDraft('');
  };

  const submitComment = async (event: FormEvent, postId: string): Promise<void> => {
    event.preventDefault();
    const clean = cleanText(commentDrafts[postId] ?? '', COMMENT_MAX);
    if (clean === '' || busy) return;
    await onComment(postId, clean);
    setCommentDrafts((current) => ({ ...current, [postId]: '' }));
  };

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        items={board.topics.map((item) => ({
          id: item.id,
          label: item.locked ? `${item.name} (잠김)` : item.name,
          count: visiblePosts(posts, item.id, canModerate).length,
        }))}
        activeId={topic.id}
        onChange={(id) => {
          setChosenTopic(id);
          setConfirming(null);
        }}
      >
        <div className="mt-3 flex flex-col gap-3">
          {canWrite ? (
            <form onSubmit={(event) => void submitPost(event)} className="flex flex-col gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label="글쓰기"
                rows={3}
                placeholder={PLACEHOLDERS[topic.id] ?? '하고 싶은 이야기를 적어 주세요.'}
                className={cx(INPUT, 'resize-y py-2 leading-relaxed')}
              />
              <div className="flex items-center justify-between gap-2">
                <span className={cx('text-xs', draftLength > POST_MAX ? 'text-danger-700' : 'text-slate-400')}>
                  {me.name} · {Math.min(draftLength, POST_MAX)}/{POST_MAX}
                </span>
                <div className="flex items-center gap-1">
                  <Button type="button" size="sm" variant="ghost" icon={RefreshCw} onClick={onRefresh} disabled={busy}>
                    새로고침
                  </Button>
                  <Button type="submit" size="sm" variant="primary" disabled={busy || draftClean === ''}>
                    올리기
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-control bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-4" aria-hidden />
                잠긴 주제입니다. 읽을 수만 있습니다.
              </span>
              <Button type="button" size="sm" variant="ghost" icon={RefreshCw} onClick={onRefresh} disabled={busy}>
                새로고침
              </Button>
            </div>
          )}

          {shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">아직 글이 없습니다. 첫 글을 올려 보세요.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {shown.map((post) => (
                <li key={post.id}>
                  <PostCard
                    post={post}
                    comments={commentsFor(comments, post.id, canModerate)}
                    canModerate={canModerate}
                    canWrite={canWrite}
                    busy={busy}
                    now={now}
                    draft={commentDrafts[post.id] ?? ''}
                    onDraft={(value) => setCommentDrafts((current) => ({ ...current, [post.id]: value }))}
                    onSubmitComment={(event) => void submitComment(event, post.id)}
                    confirming={confirming}
                    onConfirming={setConfirming}
                    onHidePost={onHidePost}
                    onDeletePost={onDeletePost}
                    onHideComment={onHideComment}
                    onDeleteComment={onDeleteComment}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Tabs>
    </div>
  );
}

function Author({ name, byTeacher, at, now, hidden }: { name: string; byTeacher: boolean; at: string; now: Date; hidden: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
      <span className="font-semibold text-slate-800">{name}</span>
      {byTeacher ? <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">선생님</span> : null}
      <span>{timeLabel(at, now)}</span>
      {hidden ? <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">숨김</span> : null}
    </span>
  );
}

/** 지우기는 두 번 누른다 — 확인 창 대신 그 자리에서. 폰에서 창이 뜨는 것보다 가볍다. */
function DeleteControl({
  label,
  id,
  kind,
  confirming,
  onConfirming,
  onDelete,
}: {
  label: string;
  id: string;
  kind: 'post' | 'comment';
  confirming: { kind: 'post' | 'comment'; id: string } | null;
  onConfirming: (next: { kind: 'post' | 'comment'; id: string } | null) => void;
  onDelete: (id: string) => void;
}) {
  const active = confirming?.kind === kind && confirming.id === id;
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <span className="text-danger-700">정말 지울까요?</span>
        <Button
          size="sm"
          variant="danger"
          aria-label={`${label} 지우기 확인`}
          onClick={() => {
            onDelete(id);
            onConfirming(null);
          }}
        >
          지우기
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onConfirming(null)}>
          취소
        </Button>
      </span>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={Trash2}
      iconOnly
      aria-label={`${label} 지우기`}
      title="지우기"
      onClick={() => onConfirming({ kind, id })}
    />
  );
}

function PostCard({
  post,
  comments,
  canModerate,
  canWrite,
  busy,
  now,
  draft,
  onDraft,
  onSubmitComment,
  confirming,
  onConfirming,
  onHidePost,
  onDeletePost,
  onHideComment,
  onDeleteComment,
}: {
  post: BoardPost;
  comments: BoardComment[];
  canModerate: boolean;
  canWrite: boolean;
  busy: boolean;
  now: Date;
  draft: string;
  onDraft: (value: string) => void;
  onSubmitComment: (event: FormEvent) => void;
  confirming: { kind: 'post' | 'comment'; id: string } | null;
  onConfirming: (next: { kind: 'post' | 'comment'; id: string } | null) => void;
  onHidePost?: (postId: string, hidden: boolean) => void;
  onDeletePost?: (postId: string) => void;
  onHideComment?: (commentId: string, hidden: boolean) => void;
  onDeleteComment?: (commentId: string) => void;
}) {
  return (
    <article
      aria-label={`${post.authorName}의 글`}
      className={cx('rounded-card border border-slate-200 bg-surface p-3', post.hidden && 'opacity-60')}
    >
      <header className="flex items-start justify-between gap-2">
        <Author name={post.authorName} byTeacher={post.byTeacher} at={post.createdAt} now={now} hidden={post.hidden} />
        {canModerate ? (
          <span className="flex shrink-0 items-center gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              icon={post.hidden ? Eye : EyeOff}
              iconOnly
              aria-label={post.hidden ? '글 보이기' : '글 숨기기'}
              title={post.hidden ? '보이기' : '숨기기'}
              onClick={() => onHidePost?.(post.id, !post.hidden)}
            />
            {onDeletePost === undefined ? null : (
              <DeleteControl
                label="글"
                id={post.id}
                kind="post"
                confirming={confirming}
                onConfirming={onConfirming}
                onDelete={onDeletePost}
              />
            )}
          </span>
        ) : null}
      </header>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{post.text}</p>

      {comments.length === 0 ? null : (
        <ul className="mt-2 flex flex-col gap-1.5 border-t border-slate-100 pt-2">
          {comments.map((comment) => (
            <li key={comment.id} className={cx('flex items-start gap-2 text-sm', comment.hidden && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <Author
                  name={comment.authorName}
                  byTeacher={comment.byTeacher}
                  at={comment.createdAt}
                  now={now}
                  hidden={comment.hidden}
                />
                <p className="whitespace-pre-wrap text-slate-700">{comment.text}</p>
              </div>
              {canModerate ? (
                <span className="flex shrink-0 items-center gap-0.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={comment.hidden ? Eye : EyeOff}
                    iconOnly
                    aria-label={comment.hidden ? '댓글 보이기' : '댓글 숨기기'}
                    title={comment.hidden ? '보이기' : '숨기기'}
                    onClick={() => onHideComment?.(comment.id, !comment.hidden)}
                  />
                  {onDeleteComment === undefined ? null : (
                    <DeleteControl
                      label="댓글"
                      id={comment.id}
                      kind="comment"
                      confirming={confirming}
                      onConfirming={onConfirming}
                      onDelete={onDeleteComment}
                    />
                  )}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <form onSubmit={onSubmitComment} className="mt-2 flex items-center gap-1.5">
          <input
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            aria-label="댓글 쓰기"
            placeholder="댓글"
            maxLength={COMMENT_MAX}
            className={cx(INPUT, 'h-9')}
          />
          <Button type="submit" size="sm" variant="secondary" disabled={busy || cleanText(draft, COMMENT_MAX) === ''}>
            댓글 달기
          </Button>
        </form>
      ) : null}
    </article>
  );
}
