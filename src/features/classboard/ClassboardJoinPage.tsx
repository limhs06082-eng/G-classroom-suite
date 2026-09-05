import { DoorClosed, Link2Off, MessagesSquare } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { Button, EmptyState, useToast } from '../../shared/ui';
import { BoardView } from './BoardView';
import { getBoardClient, toKoreanBoardError } from './boardClient';
import { cleanText, isValidCode, NAME_MAX, newEntryId, normalizeCode } from './boardCore';
import type { BoardComment, BoardPost, BoardUser } from './boardTypes';
import { configFromSearch } from './joinLink';
import { readJoin, saveJoin } from './joinStore';
import { useBoardData } from './useBoardData';

/**
 * 학생 화면. `/classboard/join/:code?p=<설정값>`.
 *
 * 폰 첫 화면 기준(360px). 교사용 내비가 없는 셸 밖 라우트이고, 웹 전용이다 —
 * 설치형에는 학생이 열 웹 화면이 없으니 router.tsx가 이 청크를 뺀다.
 *
 * 링크에 실린 설정값으로 **그 선생님의** Firebase에 익명 로그인한다. 계정도
 * 비밀번호도 없다. 이름(또는 별명)만 적고 들어온다.
 */
export default function ClassboardJoinPage() {
  const { code: rawCode = '' } = useParams();
  const code = normalizeCode(rawCode);
  const location = useLocation();
  const toast = useToast();

  // 링크의 설정값이 먼저, 없으면 전에 열었을 때 기억해 둔 것.
  const [config] = useState(() => configFromSearch(location.search) ?? readJoin(code)?.config ?? null);
  useEffect(() => {
    if (config !== null && isValidCode(code)) saveJoin(code, { config });
  }, [code, config]);

  const client = useMemo(() => (config === null ? null : getBoardClient(config)), [config]);

  const [user, setUser] = useState<BoardUser | null>(null);
  const [authError, setAuthError] = useState('');
  const [authAttempt, setAuthAttempt] = useState(0);

  useEffect(() => {
    if (client === null) return;
    let cancelled = false;
    void (async () => {
      try {
        const current = await client.currentUser();
        const next = current ?? (await client.signInAnonymously());
        if (!cancelled) setUser(next);
      } catch (caught) {
        if (!cancelled) setAuthError(toKoreanBoardError(caught));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, authAttempt]);

  const data = useBoardData(client, code, false, user !== null);

  const [name, setName] = useState(() => readJoin(code)?.name ?? '');
  const [nameDraft, setNameDraft] = useState(name);
  const [editingName, setEditingName] = useState(false);

  if (config === null || !isValidCode(code)) {
    return (
      <Shell>
        <EmptyState
          icon={Link2Off}
          title="주소가 올바르지 않습니다"
          description="선생님이 준 링크나 QR로 다시 들어와 주세요."
        />
      </Shell>
    );
  }

  if (authError !== '') {
    return (
      <Shell>
        <EmptyState
          icon={Link2Off}
          title="들어가지 못했습니다"
          description={authError}
          action={
            <Button
              variant="primary"
              onClick={() => {
                setAuthError('');
                setAuthAttempt((count) => count + 1);
              }}
            >
              다시 시도
            </Button>
          }
        />
      </Shell>
    );
  }

  // 아직 한 번도 못 읽었으면(오류도 없이) 기다린다. loading만 보면 효과가 돌기 전 한 프레임에 '찾지 못했습니다'가 번쩍인다.
  if (user === null || (!data.loaded && data.error === '')) {
    return (
      <Shell>
        <p className="py-12 text-center text-sm text-slate-500">들어가는 중…</p>
      </Shell>
    );
  }

  if (data.board === null) {
    return (
      <Shell>
        <EmptyState
          icon={Link2Off}
          title={data.error === '' ? '게시판을 찾지 못했습니다' : '불러오지 못했습니다'}
          description={
            data.error === '' ? `코드 ${code}로 만든 게시판이 없습니다. 선생님께 링크를 다시 받아 주세요.` : data.error
          }
          action={
            <Button variant="secondary" onClick={() => void data.refresh()}>
              다시 시도
            </Button>
          }
        />
      </Shell>
    );
  }

  const board = data.board;

  if (board.closed) {
    return (
      <Shell>
        <EmptyState icon={DoorClosed} title="지금은 닫혀 있습니다" description="선생님이 게시판을 다시 열면 들어올 수 있습니다." />
      </Shell>
    );
  }

  const nameLabel = board.nicknameOnly ? '별명' : '이름';

  if (name === '' || editingName) {
    const submitName = (event: FormEvent): void => {
      event.preventDefault();
      const clean = cleanText(nameDraft, NAME_MAX).replace(/\n+/g, ' ');
      if (clean === '') return;
      setName(clean);
      saveJoin(code, { name: clean });
      setEditingName(false);
    };
    return (
      <Shell>
        <div className="flex flex-col items-center gap-1 py-6 text-center">
          <MessagesSquare className="size-8 text-classboard-500" aria-hidden />
          <h1 className="text-lg font-bold text-slate-900">{board.className} 학급 게시판</h1>
          <p className="text-sm text-slate-500">
            {board.nicknameOnly ? '별명을 정하고 들어오세요. 이름은 적지 않습니다.' : '이름을 적고 들어오세요.'}
          </p>
        </div>
        <form onSubmit={submitName} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            {nameLabel}
            <input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              maxLength={NAME_MAX}
              autoFocus
              className="h-11 rounded-control border border-slate-300 bg-surface px-3 text-base"
            />
          </label>
          <Button type="submit" variant="primary" size="lg" disabled={cleanText(nameDraft, NAME_MAX) === ''}>
            들어가기
          </Button>
        </form>
      </Shell>
    );
  }

  const now = new Date();
  const author = { uid: user.uid, name, byTeacher: false };

  const post = async (topicId: string, text: string): Promise<void> => {
    const entry: BoardPost = {
      id: newEntryId(new Date()),
      topicId,
      text,
      authorName: name,
      authorUid: user.uid,
      byTeacher: false,
      createdAt: new Date().toISOString(),
      hidden: false,
    };
    const error = await data.addPost(entry);
    if (error !== null) toast.error(error);
  };

  const comment = async (postId: string, text: string): Promise<void> => {
    const entry: BoardComment = {
      id: newEntryId(new Date()),
      postId,
      text,
      authorName: name,
      authorUid: user.uid,
      byTeacher: false,
      createdAt: new Date().toISOString(),
      hidden: false,
    };
    const error = await data.addComment(entry);
    if (error !== null) toast.error(error);
  };

  return (
    <Shell>
      <header className="mb-3 flex items-center gap-2">
        <MessagesSquare className="size-5 shrink-0 text-classboard-500" aria-hidden />
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-slate-900">{board.className} 학급 게시판</h1>
        <button
          type="button"
          onClick={() => {
            setNameDraft(name);
            setEditingName(true);
          }}
          className="text-xs text-slate-500 underline-offset-2 hover:underline"
        >
          {name} · {nameLabel} 바꾸기
        </button>
      </header>
      {data.error === '' ? null : (
        <p role="alert" className="mb-3 rounded-control bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {data.error}
        </p>
      )}
      <BoardView
        board={board}
        posts={data.posts}
        comments={data.comments}
        me={author}
        canModerate={false}
        busy={data.loading}
        now={now}
        onRefresh={() => void data.refresh()}
        onPost={post}
        onComment={comment}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-dvh max-w-md p-4">{children}</div>;
}
