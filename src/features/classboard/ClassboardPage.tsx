import { Copy, LogIn, LogOut, MessagesSquare, QrCode, RefreshCw, Settings2, School } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { isDesktop } from '../../shared/platform/target';
import { useActiveClass } from '../../shared/roster/SuiteDataProvider';
import { Button, Card, cx, EmptyState, Modal, useToast } from '../../shared/ui';
import { createId } from '../../shared/ids';
import { BoardView } from './BoardView';
import { getBoardClient, toKoreanBoardError, type BoardClient } from './boardClient';
import {
  addTopic,
  createBoard,
  createBoardCode,
  newEntryId,
  removeTopic,
  renameTopic,
  setTopicLocked,
  TOPIC_NAME_MAX,
} from './boardCore';
import { readClassboardSettings, resolveStudentOrigin, type ClassboardSettings } from './boardSettings';
import type { Board, BoardComment, BoardPost, BoardUser } from './boardTypes';
import { buildJoinLink } from './joinLink';
import { useBoardData } from './useBoardData';

/**
 * 교사 화면. 설정 없음 → 안내, 로그인 전 → 선생님 계정, 게시판 없음 → 만들기,
 * 그 뒤 코드·링크·QR과 글 관리.
 *
 * 게시판은 학급마다 하나. 어느 게시판이 이 학급 것인지는 게시판 문서의 `classId`로
 * 찾는다 — SuiteData에 아무것도 더하지 않으므로 백업·동기화가 게시판을 모른다.
 */
export default function ClassboardPage() {
  const activeClass = useActiveClass();
  const toast = useToast();
  const [settings] = useState<ClassboardSettings | null>(() => readClassboardSettings());
  const client = useMemo(() => (settings === null ? null : getBoardClient(settings.config)), [settings]);

  // undefined = 아직 모름(새로 고침 직후).
  const [user, setUser] = useState<BoardUser | null | undefined>(undefined);
  useEffect(() => {
    if (client === null) return;
    let cancelled = false;
    client
      .currentUser()
      .then((current) => {
        if (!cancelled) setUser(current);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);
  const teacher = user !== undefined && user !== null && !user.isAnonymous ? user : null;

  const [myBoards, setMyBoards] = useState<Board[] | null>(null);
  const [boardsError, setBoardsError] = useState('');
  const teacherUid = teacher?.uid ?? null;
  useEffect(() => {
    if (client === null || teacherUid === null) {
      setMyBoards(null);
      return;
    }
    let cancelled = false;
    setBoardsError('');
    client
      .listMyBoards(teacherUid)
      .then((boards) => {
        if (!cancelled) setMyBoards(boards);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setBoardsError(toKoreanBoardError(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [client, teacherUid]);

  const listed = myBoards?.find((board) => board.classId === activeClass?.id) ?? null;
  const data = useBoardData(client, listed?.code ?? '', true, listed !== null);
  const board = data.board ?? listed;
  const [busy, setBusy] = useState(false);

  if (settings === null || client === null) return <GuideCard />;

  if (user === undefined) {
    return (
      <Card>
        <p className="text-sm text-slate-500">확인 중…</p>
      </Card>
    );
  }

  if (teacher === null) {
    return <TeacherSignIn client={client} wasStudent={user !== null} onSignedIn={setUser} />;
  }

  if (activeClass === null) {
    return (
      <Card>
        <EmptyState icon={School} title="학급을 먼저 만들어 주세요" description="게시판은 학급마다 하나씩 만듭니다." />
      </Card>
    );
  }

  const signOut = async (): Promise<void> => {
    try {
      await client.signOut();
      setUser(null);
    } catch (caught) {
      toast.error(toKoreanBoardError(caught));
    }
  };

  if (myBoards === null) {
    return (
      <Card>
        <p className="text-sm text-slate-500">{boardsError === '' ? '게시판을 찾는 중…' : boardsError}</p>
      </Card>
    );
  }

  if (board === null) {
    const create = async (): Promise<void> => {
      setBusy(true);
      try {
        let code = createBoardCode();
        for (let attempt = 0; attempt < 5; attempt += 1) {
          if ((await client.getBoard(code)) === null) break;
          code = createBoardCode();
        }
        const created = createBoard(
          { code, ownerUid: teacher.uid, classId: activeClass.id, className: activeClass.name },
          new Date().toISOString(),
        );
        await client.createBoard(created);
        setMyBoards((current) => [...(current ?? []), created]);
        toast.success('게시판을 만들었습니다. 학생 링크를 나눠 주세요.');
      } catch (caught) {
        toast.error(toKoreanBoardError(caught));
      } finally {
        setBusy(false);
      }
    };

    const attach = async (other: Board): Promise<void> => {
      setBusy(true);
      try {
        await client.updateBoard(other.code, { classId: activeClass.id, className: activeClass.name });
        setMyBoards((current) =>
          (current ?? []).map((item) =>
            item.code === other.code ? { ...item, classId: activeClass.id, className: activeClass.name } : item,
          ),
        );
        toast.success('이 학급에 이었습니다.');
      } catch (caught) {
        toast.error(toKoreanBoardError(caught));
      } finally {
        setBusy(false);
      }
    };

    return (
      <Card
        title={`${activeClass.name} 학급 게시판`}
        icon={MessagesSquare}
        accentClass="text-classboard-500"
        action={
          <Button size="sm" variant="ghost" icon={LogOut} onClick={() => void signOut()}>
            로그아웃
          </Button>
        }
      >
        <p className="text-sm text-slate-600">
          이 학급의 게시판이 아직 없습니다. 만들면 6자 코드가 생기고, 학생은 링크나 QR로 들어옵니다.
        </p>
        <div className="mt-3">
          <Button variant="primary" onClick={() => void create()} disabled={busy}>
            이 학급 게시판 만들기
          </Button>
        </div>
        {myBoards.length === 0 ? null : (
          <div className="mt-5 border-t border-slate-100 pt-3">
            <p className="text-sm font-medium text-slate-700">전에 만든 게시판</p>
            <p className="text-xs text-slate-500">
              백업을 되살려 학급 id가 달라졌다면 여기서 이어 쓸 수 있습니다.
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {myBoards.map((other) => (
                <li key={other.code} className="flex items-center gap-2 text-sm">
                  <span className="font-mono font-semibold">{other.code}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-600">{other.className}</span>
                  <Button size="sm" variant="secondary" onClick={() => void attach(other)} disabled={busy}>
                    이 학급에 잇기
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    );
  }

  const link = buildJoinLink(
    resolveStudentOrigin(settings, isDesktop(), window.location.origin),
    board.code,
    settings.config,
  );
  const now = new Date();
  const me = { uid: teacher.uid, name: '선생님', byTeacher: true };

  const post = async (topicId: string, text: string): Promise<void> => {
    const entry: BoardPost = {
      id: newEntryId(new Date()),
      topicId,
      text,
      authorName: '선생님',
      authorUid: teacher.uid,
      byTeacher: true,
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
      authorName: '선생님',
      authorUid: teacher.uid,
      byTeacher: true,
      createdAt: new Date().toISOString(),
      hidden: false,
    };
    const error = await data.addComment(entry);
    if (error !== null) toast.error(error);
  };

  const report = (promise: Promise<string | null>): void => {
    void promise.then((error) => {
      if (error !== null) toast.error(error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <ShareCard
        board={board}
        link={link}
        busy={data.loading || busy}
        ready={data.board !== null}
        onRefresh={() => void data.refresh()}
        onSignOut={() => void signOut()}
        onUpdate={(patch) => report(data.updateBoard(patch))}
      />
      {data.error === '' ? null : (
        <p role="alert" className="rounded-control bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {data.error}
        </p>
      )}
      <BoardView
        board={board}
        posts={data.posts}
        comments={data.comments}
        me={me}
        canModerate
        busy={data.loading || busy}
        now={now}
        onRefresh={() => void data.refresh()}
        onPost={post}
        onComment={comment}
        onHidePost={(id, hidden) => report(data.setPostHidden(id, hidden))}
        onDeletePost={(id) => report(data.deletePost(id))}
        onHideComment={(id, hidden) => report(data.setCommentHidden(id, hidden))}
        onDeleteComment={(id) => report(data.deleteComment(id))}
      />
    </div>
  );
}

/** 설정 없이 온 사람. 무엇을 준비해야 하는지 한눈에. */
function GuideCard() {
  return (
    <Card title="학급 게시판" icon={MessagesSquare} accentClass="text-classboard-500">
      <p className="text-sm text-slate-600">
        학생과 함께 쓰는 글·댓글 게시판입니다 — 건의함, 칭찬 릴레이, 자유 이야기. 자료는{' '}
        <strong>선생님의 Firebase</strong>에만 저장되고, 학생은 계정 없이 링크·QR로 들어옵니다.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>Firebase 프로젝트를 만들고 Firestore와 로그인(익명·이메일)을 켭니다.</li>
        <li>웹 앱 설정값을 복사해 설정 → 학급 게시판에 붙여 넣습니다.</li>
        <li>같은 화면의 규칙을 Firestore 규칙 탭에 붙여 넣고 게시합니다.</li>
        <li>여기로 돌아와 선생님 계정을 만들고 게시판을 만듭니다.</li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/settings?tab=classboard"
          className="inline-flex h-10 items-center gap-1.5 rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-press"
        >
          <Settings2 className="size-4" aria-hidden />
          설정 → 학급 게시판 열기
        </Link>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        순서를 자세히 보려면 README의 '학급 게시판' 절을 보세요. 무료 요금제로 충분합니다.
      </p>
    </Card>
  );
}

function TeacherSignIn({
  client,
  wasStudent,
  onSignedIn,
}: {
  client: BoardClient;
  wasStudent: boolean;
  onSignedIn: (user: BoardUser) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent, mode: 'in' | 'up'): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSignedIn(await client.signInTeacher(email, password, mode));
    } catch (caught) {
      setError(toKoreanBoardError(caught));
      setBusy(false);
    }
  };

  return (
    <Card title="선생님 계정으로 로그인" icon={LogIn}>
      {wasStudent ? (
        <p className="mb-3 text-sm text-slate-600">
          이 브라우저는 학생으로 들어와 있습니다. 게시판을 관리하려면 선생님 계정으로 로그인하세요.
        </p>
      ) : null}
      <form className="flex max-w-sm flex-col gap-3" onSubmit={(event) => void submit(event, 'in')}>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          이메일
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-10 rounded-control border border-slate-300 bg-surface px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          비밀번호
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-10 rounded-control border border-slate-300 bg-surface px-3 text-sm"
          />
        </label>
        {error === '' ? null : (
          <p role="alert" className="text-sm font-medium text-danger-700">
            {error}
          </p>
        )}
        <div className="mt-1 flex gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            로그인
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={(event) => void submit(event, 'up')}>
            계정 만들기
          </Button>
        </div>
      </form>
      <p className="mt-4 text-sm text-slate-500">
        처음이시면 <strong>계정 만들기</strong>를 누르세요. 이 계정은 선생님의 Firebase 프로젝트 안에만 있고,
        게시판을 만든 계정만 글을 숨기고 지울 수 있습니다. 비밀번호는 6자 이상.
      </p>
    </Card>
  );
}

/** 코드·링크·QR·새로고침·별명만·닫기·주제 관리. */
function ShareCard({
  board,
  link,
  busy,
  ready,
  onRefresh,
  onSignOut,
  onUpdate,
}: {
  board: Board;
  link: string;
  busy: boolean;
  /** 서버에서 게시판을 읽어 왔는가. 그 전의 조작은 낙관적 반영이 붙을 자리가 없어 막는다. */
  ready: boolean;
  onRefresh: () => void;
  onSignOut: () => void;
  onUpdate: (patch: Partial<Omit<Board, 'code' | 'ownerUid' | 'createdAt'>>) => void;
}) {
  const toast = useToast();
  const [qr, setQr] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);

  const showQr = async (): Promise<void> => {
    if (qr !== null) {
      setQr(null);
      return;
    }
    // qrcode 꾸러미는 누를 때 온다. 게시판 화면 청크에 늘 실릴 만큼 자주 쓰지 않는다.
    const { default: QRCode } = await import('qrcode');
    setQr(await QRCode.toDataURL(link, { width: 320, margin: 1 }));
  };

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('학생 링크를 복사했습니다.');
    } catch {
      toast.error('복사하지 못했습니다. 링크를 드래그해 복사해 주세요.');
    }
  };

  return (
    <Card
      title={`${board.className} 학급 게시판`}
      icon={MessagesSquare}
      accentClass="text-classboard-500"
      action={
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={onRefresh} disabled={busy}>
            새로고침
          </Button>
          <Button size="sm" variant="ghost" icon={Settings2} onClick={() => setManaging(true)} disabled={!ready}>
            주제 관리
          </Button>
          <Button size="sm" variant="ghost" icon={LogOut} onClick={onSignOut}>
            로그아웃
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-slate-500">학급 코드</p>
          <p data-testid="board-code" className="font-mono text-3xl font-bold tracking-widest tabular-nums text-slate-900">
            {board.code}
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-xs text-slate-500">학생 링크 — 메신저로 보내거나 QR을 칠판에 띄우세요</p>
          <p className="truncate rounded-control bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600" title={link}>
            {link}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" icon={Copy} onClick={() => void copy()}>
              링크 복사
            </Button>
            <Button size="sm" variant="secondary" icon={QrCode} onClick={() => void showQr()} aria-pressed={qr !== null}>
              {qr === null ? 'QR 보기' : 'QR 닫기'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={board.nicknameOnly}
                disabled={!ready}
                onChange={(event) => onUpdate({ nicknameOnly: event.target.checked })}
              />
              별명만 받기
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={board.closed}
                disabled={!ready}
                onChange={(event) => onUpdate({ closed: event.target.checked })}
              />
              게시판 닫기
            </label>
          </div>
        </div>
      </div>
      {qr === null ? null : (
        <div className="mt-3 flex justify-center">
          <img src={qr} alt="학생 접속 QR" className="size-64 rounded-card border border-slate-200" />
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        학생 이름과 글은 선생님의 Firebase에 저장됩니다. 학교 지침에 따라 '별명만 받기'를 켜 주세요.
      </p>
      <TopicsModal open={managing} board={board} onClose={() => setManaging(false)} onUpdate={onUpdate} />
    </Card>
  );
}

function TopicsModal({
  open,
  board,
  onClose,
  onUpdate,
}: {
  open: boolean;
  board: Board;
  onClose: () => void;
  onUpdate: (patch: Partial<Omit<Board, 'code' | 'ownerUid' | 'createdAt'>>) => void;
}) {
  const [newName, setNewName] = useState('');
  const apply = (next: Board): void => {
    if (next !== board) onUpdate({ topics: next.topics });
  };

  return (
    <Modal open={open} onClose={onClose} title="주제 관리" size="sm">
      <ul className="flex flex-col gap-2">
        {board.topics.map((topic) => (
          <li key={topic.id} className="flex items-center gap-1.5">
            <input
              defaultValue={topic.name}
              key={`${topic.id}:${topic.name}`}
              maxLength={TOPIC_NAME_MAX}
              aria-label={`${topic.name} 이름`}
              onBlur={(event) => {
                const next = event.target.value.trim();
                // 빈 이름은 무시되는데(boardCore), 칸까지 비어 있으면 지운 것처럼 보인다. 되돌린다.
                if (next === '') {
                  event.target.value = topic.name;
                  return;
                }
                if (next !== topic.name) apply(renameTopic(board, topic.id, event.target.value));
              }}
              className={cx('h-9 min-w-0 flex-1 rounded-control border border-slate-300 bg-surface px-2 text-sm', topic.locked && 'text-slate-500')}
            />
            <Button
              size="sm"
              variant={topic.locked ? 'secondary' : 'ghost'}
              onClick={() => apply(setTopicLocked(board, topic.id, !topic.locked))}
              aria-pressed={topic.locked}
            >
              {topic.locked ? '잠김' : '잠그기'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={board.topics.length <= 1}
              onClick={() => apply(removeTopic(board, topic.id))}
              aria-label={`${topic.name} 지우기`}
            >
              지우기
            </Button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply(addTopic(board, newName, createId()));
          setNewName('');
        }}
        className="mt-3 flex items-center gap-1.5"
      >
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          maxLength={TOPIC_NAME_MAX}
          aria-label="새 주제 이름"
          placeholder="새 주제"
          className="h-9 min-w-0 flex-1 rounded-control border border-slate-300 bg-surface px-2 text-sm"
        />
        <Button type="submit" size="sm" variant="primary" disabled={newName.trim() === '' || board.topics.length >= 8}>
          추가
        </Button>
      </form>
      <p className="mt-3 text-xs text-slate-500">잠근 주제는 학생이 읽을 수만 있습니다(방학 중). 지운 주제의 글은 남아 있되 보이지 않습니다.</p>
    </Modal>
  );
}
