import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createBoard } from '../../src/features/classboard/boardCore';
import { useBoardData } from '../../src/features/classboard/useBoardData';
import { MemoryBoardClient } from './memoryBoardClient';

const NOW = '2026-09-06T09:00:00.000Z';

function seeded(): MemoryBoardClient {
  const client = new MemoryBoardClient();
  client.boards.set('ABC234', createBoard({ code: 'ABC234', ownerUid: 't', classId: 'class-1', className: '3학년 2반' }, NOW));
  client.posts.set('ABC234', [
    { id: '1', topicId: 'suggest', text: '급식', authorName: '하나', authorUid: 'a', byTeacher: false, createdAt: NOW, hidden: false },
  ]);
  return client;
}

describe('useBoardData', () => {
  it('켜지면 읽고, 꺼지면(학급 전환·로그아웃) 전 게시판 자료를 비운다', async () => {
    const client = seeded();
    const { result, rerender } = renderHook(
      ({ code, enabled }: { code: string; enabled: boolean }) => useBoardData(client, code, true, enabled),
      { initialProps: { code: 'ABC234', enabled: true } },
    );

    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.board?.code).toBe('ABC234');
    expect(result.current.posts).toHaveLength(1);

    /*
     * 다른 학급으로 바꾸면 code가 ''가 되고 enabled가 꺼진다. 이때 옛 게시판이 남으면
     * 새 학급 아래 남의 코드·글이 보이고 "게시판 만들기"가 안 뜬다.
     */
    rerender({ code: '', enabled: false });
    await waitFor(() => expect(result.current.board).toBeNull());
    expect(result.current.posts).toEqual([]);
    expect(result.current.loaded).toBe(false);
  });

  it('쓰기는 먼저 반영하고, 서버가 거절하면 다시 읽어 되돌린다', async () => {
    const client = seeded();
    const { result } = renderHook(() => useBoardData(client, 'ABC234', true, true));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    client.failNext = Object.assign(new Error('denied'), { code: 'permission-denied' });
    let error: string | null = null;
    await act(async () => {
      error = await result.current.setPostHidden('1', true);
    });
    expect(error).toContain('규칙');
    // 되돌아왔다 — 서버 값은 그대로 hidden=false.
    await waitFor(() => expect(result.current.posts[0]?.hidden).toBe(false));
  });
});
