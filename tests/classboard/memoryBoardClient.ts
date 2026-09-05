import type { BoardClient } from '../../src/features/classboard/boardClient';
import type {
  Board,
  BoardComment,
  BoardPost,
  BoardUser,
} from '../../src/features/classboard/boardTypes';

/**
 * 시험용 메모리 구현. 인터페이스를 그대로 채우고, 규칙이 하는 일 가운데
 * 화면이 기대는 것(학생은 숨긴 글을 못 받는다)만 흉내 낸다.
 */
export class MemoryBoardClient implements BoardClient {
  user: BoardUser | null = null;
  boards = new Map<string, Board>();
  posts = new Map<string, BoardPost[]>();
  comments = new Map<string, BoardComment[]>();
  /** 다음 호출을 실패시킨다. 오류 화면을 시험할 때. */
  failNext: Error | null = null;
  calls: string[] = [];
  private anonCount = 0;

  private tick(name: string): void {
    this.calls.push(name);
    if (this.failNext !== null) {
      const error = this.failNext;
      this.failNext = null;
      throw error;
    }
  }

  async currentUser(): Promise<BoardUser | null> {
    this.tick('currentUser');
    return this.user;
  }

  async signInAnonymously(): Promise<BoardUser> {
    this.tick('signInAnonymously');
    this.anonCount += 1;
    this.user = { uid: `anon-${this.anonCount}`, isAnonymous: true, email: null };
    return this.user;
  }

  async signInTeacher(email: string, _password: string, mode: 'in' | 'up'): Promise<BoardUser> {
    this.tick(`signInTeacher:${mode}`);
    this.user = { uid: 'teacher-1', isAnonymous: false, email };
    return this.user;
  }

  async signOut(): Promise<void> {
    this.tick('signOut');
    this.user = null;
  }

  async getBoard(code: string): Promise<Board | null> {
    this.tick('getBoard');
    return this.boards.get(code) ?? null;
  }

  async listMyBoards(uid: string): Promise<Board[]> {
    this.tick('listMyBoards');
    return [...this.boards.values()].filter((board) => board.ownerUid === uid);
  }

  async createBoard(board: Board): Promise<void> {
    this.tick('createBoard');
    this.boards.set(board.code, board);
  }

  async updateBoard(code: string, patch: Partial<Omit<Board, 'code' | 'ownerUid' | 'createdAt'>>): Promise<void> {
    this.tick('updateBoard');
    const current = this.boards.get(code);
    if (current === undefined) throw new Error('없는 게시판');
    this.boards.set(code, { ...current, ...patch });
  }

  async listPosts(code: string, includeHidden: boolean): Promise<BoardPost[]> {
    this.tick('listPosts');
    return (this.posts.get(code) ?? []).filter((post) => includeHidden || !post.hidden);
  }

  async listComments(code: string, includeHidden: boolean): Promise<BoardComment[]> {
    this.tick('listComments');
    return (this.comments.get(code) ?? []).filter((comment) => includeHidden || !comment.hidden);
  }

  async addPost(code: string, post: BoardPost): Promise<void> {
    this.tick('addPost');
    this.posts.set(code, [...(this.posts.get(code) ?? []), post]);
  }

  async addComment(code: string, comment: BoardComment): Promise<void> {
    this.tick('addComment');
    this.comments.set(code, [...(this.comments.get(code) ?? []), comment]);
  }

  async setPostHidden(code: string, postId: string, hidden: boolean): Promise<void> {
    this.tick('setPostHidden');
    this.posts.set(code, (this.posts.get(code) ?? []).map((post) => (post.id === postId ? { ...post, hidden } : post)));
  }

  async deletePost(code: string, postId: string): Promise<void> {
    this.tick('deletePost');
    this.posts.set(code, (this.posts.get(code) ?? []).filter((post) => post.id !== postId));
  }

  async setCommentHidden(code: string, commentId: string, hidden: boolean): Promise<void> {
    this.tick('setCommentHidden');
    this.comments.set(
      code,
      (this.comments.get(code) ?? []).map((comment) => (comment.id === commentId ? { ...comment, hidden } : comment)),
    );
  }

  async deleteComment(code: string, commentId: string): Promise<void> {
    this.tick('deleteComment');
    this.comments.set(code, (this.comments.get(code) ?? []).filter((comment) => comment.id !== commentId));
  }
}
