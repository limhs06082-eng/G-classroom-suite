import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore/lite';

import type { BoardClient } from './boardClient';
import type { Board, BoardComment, BoardFirebaseConfig, BoardPost, BoardTopic, BoardUser } from './boardTypes';

/**
 * Firebase 구현.
 *
 * **firebase는 여기서도 `import type`뿐이다.** 실제 꾸러미는 처음 쓰일 때
 * `await import(...)`로 온다 — 정적으로 부르면 게시판을 안 쓰는 선생님도 첫
 * 화면에서 수백 KB를 내려받는다(docs/reference/ai-studio-firebase-prompt.md 함정 2).
 *
 * Firestore는 **lite**(`firebase/firestore/lite`)를 쓴다. REST 한 번 읽기만 있고
 * 실시간 구독·오프라인 캐시가 없다 — 이 게시판은 "열 때 한 번 + [새로고침]"이라
 * 그 둘이 필요 없고, 꾸러미가 3분의 1이며, 설치형 CSP에 열어 줄 주소가
 * `firestore.googleapis.com` 하나로 끝난다(WebChannel 없음).
 *
 * 앱 이름을 프로젝트별로 붙인다. 웹 판의 '계정·동기화'가 기본 앱([DEFAULT])을
 * 이미 쓰고 있을 수 있어서, 이름 없이 initializeApp을 부르면 그쪽과 부딪힌다.
 */
interface Ready {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

const ROWS_LIMIT = 300;

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function bool(value: unknown): boolean {
  return value === true;
}

function toUser(user: User): BoardUser {
  return { uid: user.uid, isAnonymous: user.isAnonymous, email: user.email };
}

function parseTopics(raw: unknown): BoardTopic[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({ id: str(item['id']), name: str(item['name']), locked: bool(item['locked']) }))
    .filter((topic) => topic.id !== '' && topic.name !== '');
}

function parseBoard(code: string, raw: Record<string, unknown>): Board {
  return {
    code,
    ownerUid: str(raw['ownerUid']),
    classId: str(raw['classId']),
    className: str(raw['className']),
    topics: parseTopics(raw['topics']),
    nicknameOnly: bool(raw['nicknameOnly']),
    closed: bool(raw['closed']),
    createdAt: str(raw['createdAt']),
    updatedAt: str(raw['updatedAt']),
  };
}

function parsePost(id: string, raw: Record<string, unknown>): BoardPost {
  return {
    id,
    topicId: str(raw['topicId']),
    text: str(raw['text']),
    authorName: str(raw['authorName']),
    authorUid: str(raw['authorUid']),
    byTeacher: bool(raw['byTeacher']),
    createdAt: str(raw['createdAt']),
    hidden: bool(raw['hidden']),
  };
}

function parseComment(id: string, raw: Record<string, unknown>): BoardComment {
  return {
    id,
    postId: str(raw['postId']),
    text: str(raw['text']),
    authorName: str(raw['authorName']),
    authorUid: str(raw['authorUid']),
    byTeacher: bool(raw['byTeacher']),
    createdAt: str(raw['createdAt']),
    hidden: bool(raw['hidden']),
  };
}

export class FirebaseBoardClient implements BoardClient {
  private pending: Promise<Ready> | null = null;

  constructor(private readonly config: BoardFirebaseConfig) {}

  private ready(): Promise<Ready> {
    this.pending ??= (async () => {
      const [{ getApp, getApps, initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore/lite'),
      ]);
      const name = `classboard:${this.config.projectId}:${this.config.appId}`;
      const app = getApps().some((existing) => existing.name === name)
        ? getApp(name)
        : initializeApp(
            {
              apiKey: this.config.apiKey,
              authDomain: this.config.authDomain,
              projectId: this.config.projectId,
              appId: this.config.appId,
            },
            name,
          );
      return { app, auth: getAuth(app), db: getFirestore(app) };
    })();
    return this.pending;
  }

  async currentUser(): Promise<BoardUser | null> {
    const { auth } = await this.ready();
    const { onAuthStateChanged } = await import('firebase/auth');
    const user = await new Promise<User | null>((resolve) => {
      const stop = onAuthStateChanged(auth, (next) => {
        stop();
        resolve(next);
      });
    });
    return user === null ? null : toUser(user);
  }

  async signInAnonymously(): Promise<BoardUser> {
    const { auth } = await this.ready();
    const { signInAnonymously } = await import('firebase/auth');
    const credential = await signInAnonymously(auth);
    return toUser(credential.user);
  }

  async signInTeacher(email: string, password: string, mode: 'in' | 'up'): Promise<BoardUser> {
    const { auth } = await this.ready();
    const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = await import('firebase/auth');
    const credential =
      mode === 'up'
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
    return toUser(credential.user);
  }

  async signOut(): Promise<void> {
    const { auth } = await this.ready();
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
  }

  async getBoard(code: string): Promise<Board | null> {
    const { db } = await this.ready();
    const { doc, getDoc } = await import('firebase/firestore/lite');
    const snapshot = await getDoc(doc(db, 'boards', code));
    const raw = snapshot.data();
    return raw === undefined ? null : parseBoard(code, raw);
  }

  async listMyBoards(uid: string): Promise<Board[]> {
    const { db } = await this.ready();
    const { collection, getDocs, limit, query, where } = await import('firebase/firestore/lite');
    const snapshot = await getDocs(query(collection(db, 'boards'), where('ownerUid', '==', uid), limit(50)));
    return snapshot.docs.map((row) => parseBoard(row.id, row.data()));
  }

  async createBoard(board: Board): Promise<void> {
    const { db } = await this.ready();
    const { doc, setDoc } = await import('firebase/firestore/lite');
    await setDoc(doc(db, 'boards', board.code), board);
  }

  async updateBoard(code: string, patch: Partial<Omit<Board, 'code' | 'ownerUid' | 'createdAt'>>): Promise<void> {
    const { db } = await this.ready();
    const { doc, updateDoc } = await import('firebase/firestore/lite');
    await updateDoc(doc(db, 'boards', code), { ...patch, updatedAt: new Date().toISOString() });
  }

  async listPosts(code: string, includeHidden: boolean): Promise<BoardPost[]> {
    const { db } = await this.ready();
    const { collection, getDocs, limit, query, where } = await import('firebase/firestore/lite');
    const posts = collection(db, 'boards', code, 'posts');
    /*
     * orderBy가 없다. id가 시간 역순(boardCore.newEntryId)이라 기본 정렬(id 오름차순)에
     * limit만 걸어도 최신 글이 온다. where + orderBy였다면 복합 색인이 필요했다.
     */
    const rows = includeHidden
      ? query(posts, limit(ROWS_LIMIT))
      : query(posts, where('hidden', '==', false), limit(ROWS_LIMIT));
    const snapshot = await getDocs(rows);
    return snapshot.docs.map((row) => parsePost(row.id, row.data()));
  }

  async listComments(code: string, includeHidden: boolean): Promise<BoardComment[]> {
    const { db } = await this.ready();
    const { collection, getDocs, limit, query, where } = await import('firebase/firestore/lite');
    const comments = collection(db, 'boards', code, 'comments');
    const rows = includeHidden
      ? query(comments, limit(ROWS_LIMIT * 2))
      : query(comments, where('hidden', '==', false), limit(ROWS_LIMIT * 2));
    const snapshot = await getDocs(rows);
    return snapshot.docs.map((row) => parseComment(row.id, row.data()));
  }

  async addPost(code: string, post: BoardPost): Promise<void> {
    const { db } = await this.ready();
    const { doc, setDoc } = await import('firebase/firestore/lite');
    const { id, ...data } = post;
    await setDoc(doc(db, 'boards', code, 'posts', id), data);
  }

  async addComment(code: string, comment: BoardComment): Promise<void> {
    const { db } = await this.ready();
    const { doc, setDoc } = await import('firebase/firestore/lite');
    const { id, ...data } = comment;
    await setDoc(doc(db, 'boards', code, 'comments', id), data);
  }

  async setPostHidden(code: string, postId: string, hidden: boolean): Promise<void> {
    const { db } = await this.ready();
    const { doc, updateDoc } = await import('firebase/firestore/lite');
    await updateDoc(doc(db, 'boards', code, 'posts', postId), { hidden });
  }

  async deletePost(code: string, postId: string): Promise<void> {
    const { db } = await this.ready();
    const { deleteDoc, doc } = await import('firebase/firestore/lite');
    await deleteDoc(doc(db, 'boards', code, 'posts', postId));
  }

  async setCommentHidden(code: string, commentId: string, hidden: boolean): Promise<void> {
    const { db } = await this.ready();
    const { doc, updateDoc } = await import('firebase/firestore/lite');
    await updateDoc(doc(db, 'boards', code, 'comments', commentId), { hidden });
  }

  async deleteComment(code: string, commentId: string): Promise<void> {
    const { db } = await this.ready();
    const { deleteDoc, doc } = await import('firebase/firestore/lite');
    await deleteDoc(doc(db, 'boards', code, 'comments', commentId));
  }
}
