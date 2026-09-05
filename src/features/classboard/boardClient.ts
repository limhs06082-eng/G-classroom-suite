import type { Board, BoardComment, BoardFirebaseConfig, BoardPost, BoardUser } from './boardTypes';
import { FirebaseBoardClient } from './FirebaseBoardClient';

/**
 * 게시판 통신의 문.
 *
 * 화면은 이 인터페이스만 안다. 시험은 메모리 구현(tests/classboard/memoryBoardClient.ts)을
 * `setBoardClient`로 꽂고, 실제 앱은 설정값으로 Firebase 구현을 만든다.
 * 형성평가의 QuizSessionRelay와 같은 자리다 — 학생 화면(/classboard/join)이
 * 공급자(Provider) 밖에 있어서 모듈 단위 교체 지점이 맞다.
 *
 * 글·댓글의 id와 시각은 **부르는 쪽**이 boardCore로 만든다(newEntryId). 그래야
 * 낙관적 반영(쓰자마자 화면에 보이기)과 시험이 같은 값을 쥔다.
 */
export interface BoardClient {
  /** 로그인 상태가 정해질 때까지 기다린 뒤 준다. 새로 고침 직후 잠깐 '모름'인 틈을 넘긴다. */
  currentUser(): Promise<BoardUser | null>;
  signInAnonymously(): Promise<BoardUser>;
  signInTeacher(email: string, password: string, mode: 'in' | 'up'): Promise<BoardUser>;
  signOut(): Promise<void>;

  getBoard(code: string): Promise<Board | null>;
  listMyBoards(uid: string): Promise<Board[]>;
  createBoard(board: Board): Promise<void>;
  updateBoard(code: string, patch: Partial<Omit<Board, 'code' | 'ownerUid' | 'createdAt'>>): Promise<void>;

  /** 최신 글 100개·댓글 300개. 학생(includeHidden=false)은 숨긴 글을 받지 않는다 — 규칙도 그렇게 잠근다. */
  listPosts(code: string, includeHidden: boolean): Promise<BoardPost[]>;
  listComments(code: string, includeHidden: boolean): Promise<BoardComment[]>;
  addPost(code: string, post: BoardPost): Promise<void>;
  addComment(code: string, comment: BoardComment): Promise<void>;
  setPostHidden(code: string, postId: string, hidden: boolean): Promise<void>;
  deletePost(code: string, postId: string): Promise<void>;
  setCommentHidden(code: string, commentId: string, hidden: boolean): Promise<void>;
  deleteComment(code: string, commentId: string): Promise<void>;
}

let override: BoardClient | null = null;
const cache = new Map<string, BoardClient>();

/** 설정값마다 하나. 네 값이 다 같아야 같은 앱이다 — apiKey만 고쳐 다시 붙여 넣은 경우를 놓치지 않게. */
export function getBoardClient(config: BoardFirebaseConfig): BoardClient {
  if (override !== null) return override;
  const key = `${config.projectId}|${config.appId}|${config.apiKey}|${config.authDomain}`;
  let client = cache.get(key);
  if (client === undefined) {
    client = new FirebaseBoardClient(config);
    cache.set(key, client);
  }
  return client;
}

/**
 * 설정의 [연결 확인]용. 따로 이름 붙인 앱이라 익명으로 들어갔다 나와도 선생님의
 * 로그인 세션(getBoardClient 쪽)은 그대로다.
 */
export function createCheckClient(config: BoardFirebaseConfig): BoardClient {
  return override ?? new FirebaseBoardClient(config, 'check');
}

/** 시험용. null이면 다시 Firebase 구현으로. */
export function setBoardClient(client: BoardClient | null): void {
  override = client;
}

/** Firebase 오류 코드를 선생님·학생이 읽을 말로. 설정 단계에서 무엇을 빠뜨렸는지 짚어 준다. */
export function toKoreanBoardError(caught: unknown): string {
  const code =
    typeof caught === 'object' && caught !== null && 'code' in caught
      ? String((caught as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않습니다.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '이메일이나 비밀번호가 맞지 않습니다.';
    case 'auth/email-already-in-use':
      return '이미 만든 계정입니다. 로그인을 눌러 주세요.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 합니다.';
    case 'auth/operation-not-allowed':
      return 'Firebase 콘솔 → Authentication에서 이메일/비밀번호 로그인을 켜지 않았습니다.';
    case 'auth/admin-restricted-operation':
      return 'Firebase 콘솔 → Authentication에서 익명 로그인을 켜지 않았습니다.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return '설정값(apiKey)이 맞지 않습니다. 콘솔에서 다시 복사해 붙여 넣어 주세요.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return '인터넷 연결을 확인해 주세요.';
    case 'permission-denied':
      return 'Firestore 규칙이 막았습니다. 설정 → 학급 게시판의 규칙을 콘솔에 붙여 넣고 게시했는지 확인해 주세요.';
    case 'not-found':
    case 'failed-precondition':
      return 'Firestore 데이터베이스가 아직 없습니다. 콘솔 → Firestore Database → 데이터베이스 만들기.';
    default:
      return caught instanceof Error ? caught.message : '연결하지 못했습니다.';
  }
}
