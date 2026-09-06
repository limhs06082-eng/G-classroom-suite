import { useCallback, useEffect, useRef, useState } from 'react';

import { toKoreanBoardError, type BoardClient } from './boardClient';
import type { Board, BoardComment, BoardPost } from './boardTypes';

/**
 * 게시판 하나를 읽고 쓰는 훅. 교사 화면·학생 화면이 같이 쓴다.
 *
 * **열 때 한 번 읽고, 그 뒤는 [새로고침].** 실시간 구독이 없다 — 무료 한도(하루
 * 읽기 5만)를 한 반 규모에서 부딪히지 않게 하는 가장 단순한 방법이다. 쓰기는
 * 먼저 화면에 반영하고(낙관적) 서버가 거절하면 다시 읽어 되돌린다.
 *
 * 되돌려 주는 오류는 글자다(`string | null`). 이 훅은 토스트를 모른다.
 */
export interface BoardData {
  board: Board | null;
  posts: BoardPost[];
  comments: BoardComment[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  addPost: (post: BoardPost) => Promise<string | null>;
  addComment: (comment: BoardComment) => Promise<string | null>;
  setPostHidden: (postId: string, hidden: boolean) => Promise<string | null>;
  deletePost: (postId: string) => Promise<string | null>;
  setCommentHidden: (commentId: string, hidden: boolean) => Promise<string | null>;
  deleteComment: (commentId: string) => Promise<string | null>;
  updateBoard: (patch: Partial<Omit<Board, 'code' | 'ownerUid' | 'createdAt'>>) => Promise<string | null>;
}

export function useBoardData(
  client: BoardClient | null,
  code: string,
  includeHidden: boolean,
  enabled: boolean,
): BoardData {
  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // 늦게 온 옛 응답이 새 응답을 덮지 않게 순번을 센다.
  const seq = useRef(0);

  const refresh = useCallback(async (): Promise<void> => {
    if (client === null || code === '' || !enabled) return;
    const mine = (seq.current += 1);
    setLoading(true);
    setError('');
    try {
      const [nextBoard, nextPosts, nextComments] = await Promise.all([
        client.getBoard(code),
        client.listPosts(code, includeHidden),
        client.listComments(code, includeHidden),
      ]);
      if (mine !== seq.current) return;
      setBoard(nextBoard);
      setPosts(nextPosts);
      setComments(nextComments);
    } catch (caught) {
      if (mine !== seq.current) return;
      setError(toKoreanBoardError(caught));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [client, code, includeHidden, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** 먼저 반영하고, 서버가 거절하면 다시 읽어 되돌린다. */
  const attempt = useCallback(
    async (apply: () => void, send: () => Promise<void>): Promise<string | null> => {
      apply();
      try {
        await send();
        return null;
      } catch (caught) {
        void refresh();
        return toKoreanBoardError(caught);
      }
    },
    [refresh],
  );

  const addPost = useCallback(
    (post: BoardPost) =>
      client === null
        ? Promise.resolve('연결되지 않았습니다.')
        : attempt(
            () => setPosts((current) => [post, ...current]),
            () => client.addPost(code, post),
          ),
    [attempt, client, code],
  );

  const addComment = useCallback(
    (comment: BoardComment) =>
      client === null
        ? Promise.resolve('연결되지 않았습니다.')
        : attempt(
            () => setComments((current) => [...current, comment]),
            () => client.addComment(code, comment),
          ),
    [attempt, client, code],
  );

  const setPostHidden = useCallback(
    (postId: string, hidden: boolean) =>
      client === null
        ? Promise.resolve('연결되지 않았습니다.')
        : attempt(
            () => setPosts((current) => current.map((post) => (post.id === postId ? { ...post, hidden } : post))),
            () => client.setPostHidden(code, postId, hidden),
          ),
    [attempt, client, code],
  );

  const deletePost = useCallback(
    (postId: string) =>
      client === null
        ? Promise.resolve('연결되지 않았습니다.')
        : attempt(
            () => setPosts((current) => current.filter((post) => post.id !== postId)),
            () => client.deletePost(code, postId),
          ),
    [attempt, client, code],
  );

  const setCommentHidden = useCallback(
    (commentId: string, hidden: boolean) =>
      client === null
        ? Promise.resolve('연결되지 않았습니다.')
        : attempt(
            () =>
              setComments((current) =>
                current.map((comment) => (comment.id === commentId ? { ...comment, hidden } : comment)),
              ),
            () => client.setCommentHidden(code, commentId, hidden),
          ),
    [attempt, client, code],
  );

  const deleteComment = useCallback(
    (commentId: string) =>
      client === null
        ? Promise.resolve('연결되지 않았습니다.')
        : attempt(
            () => setComments((current) => current.filter((comment) => comment.id !== commentId)),
            () => client.deleteComment(code, commentId),
          ),
    [attempt, client, code],
  );

  const updateBoard = useCallback(
    (patch: Partial<Omit<Board, 'code' | 'ownerUid' | 'createdAt'>>) =>
      client === null
        ? Promise.resolve('연결되지 않았습니다.')
        : attempt(
            () => setBoard((current) => (current === null ? current : { ...current, ...patch })),
            () => client.updateBoard(code, patch),
          ),
    [attempt, client, code],
  );

  return {
    board,
    posts,
    comments,
    loading,
    error,
    refresh,
    addPost,
    addComment,
    setPostHidden,
    deletePost,
    setCommentHidden,
    deleteComment,
    updateBoard,
  };
}
