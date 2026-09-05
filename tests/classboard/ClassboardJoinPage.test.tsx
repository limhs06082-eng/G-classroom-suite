import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setBoardClient } from '../../src/features/classboard/boardClient';
import { createBoard } from '../../src/features/classboard/boardCore';
import type { BoardComment, BoardPost } from '../../src/features/classboard/boardTypes';
import ClassboardJoinPage from '../../src/features/classboard/ClassboardJoinPage';
import { encodeConfig } from '../../src/features/classboard/joinLink';
import { ToastProvider } from '../../src/shared/ui';
import { MemoryBoardClient } from './memoryBoardClient';

const CONFIG = { apiKey: 'k', authDomain: 'a.firebaseapp.com', projectId: 'p', appId: 'i' };
const NOW = '2026-09-06T09:00:00.000Z';

function post(id: string, topicId: string, text: string, hidden = false): BoardPost {
  return { id, topicId, text, authorName: '두리', authorUid: 'anon-9', byTeacher: false, createdAt: NOW, hidden };
}

function comment(id: string, postId: string, text: string): BoardComment {
  return { id, postId, text, authorName: '선생님', authorUid: 't', byTeacher: true, createdAt: NOW, hidden: false };
}

let client: MemoryBoardClient;

function show(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/classboard/join/:code" element={<ClassboardJoinPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  client = new MemoryBoardClient();
  setBoardClient(client);
  const board = createBoard({ code: 'ABC234', ownerUid: 'teacher-1', classId: 'class-1', className: '3학년 2반' }, NOW);
  client.boards.set('ABC234', board);
  client.posts.set('ABC234', [post('2', 'suggest', '급식에 과일이 더 나오면 좋겠어요'), post('1', 'suggest', '숨긴 글', true)]);
  client.comments.set('ABC234', [comment('c1', '2', '영양 선생님께 전할게요')]);
});

afterEach(() => {
  setBoardClient(null);
});

describe('학생 화면', () => {
  it('링크로 들어와 이름을 적으면 글이 보이고, 숨긴 글은 없고, 글과 댓글을 쓴다', async () => {
    const user = userEvent.setup();
    show(`/classboard/join/ABC234?p=${encodeConfig(CONFIG)}`);

    // 익명 로그인 → 이름 묻기
    const nameInput = await screen.findByLabelText('이름');
    expect(screen.getByText('3학년 2반 학급 게시판')).toBeInTheDocument();
    await user.type(nameInput, '하나');
    await user.click(screen.getByRole('button', { name: '들어가기' }));

    // 건의함 탭이 먼저, 보이는 글과 그 댓글
    expect(await screen.findByText('급식에 과일이 더 나오면 좋겠어요')).toBeInTheDocument();
    expect(screen.queryByText('숨긴 글')).not.toBeInTheDocument();
    expect(screen.getByText('영양 선생님께 전할게요')).toBeInTheDocument();
    // 학생은 숨기기·지우기가 없다
    expect(screen.queryByRole('button', { name: '글 숨기기' })).not.toBeInTheDocument();

    // 글쓰기
    await user.type(screen.getByLabelText('글쓰기'), '체육 시간을 늘려 주세요');
    await user.click(screen.getByRole('button', { name: '올리기' }));
    expect(await screen.findByText('체육 시간을 늘려 주세요')).toBeInTheDocument();
    const saved = client.posts.get('ABC234')?.find((row) => row.text === '체육 시간을 늘려 주세요');
    expect(saved?.authorName).toBe('하나');
    expect(saved?.authorUid).toBe('anon-1');
    expect(saved?.byTeacher).toBe(false);

    // 댓글
    const article = screen.getByRole('article', { name: '두리의 글' });
    await user.type(within(article).getByLabelText('댓글 쓰기'), '저도요!');
    await user.click(within(article).getByRole('button', { name: '댓글 달기' }));
    expect(await within(article).findByText('저도요!')).toBeInTheDocument();

    // 이름과 설정값을 폰에 기억한다 — 다음엔 코드만으로 들어온다
    expect(localStorage.getItem('classroom-suite:v1:classboard-join:ABC234')).toContain('"name":"하나"');
  });

  it('기억해 둔 설정값으로 코드만 있는 주소도 들어온다', async () => {
    localStorage.setItem(
      'classroom-suite:v1:classboard-join:ABC234',
      JSON.stringify({ config: CONFIG, name: '하나' }),
    );
    show('/classboard/join/abc234');
    expect(await screen.findByText('급식에 과일이 더 나오면 좋겠어요')).toBeInTheDocument();
    expect(screen.getByText(/하나 · 이름 바꾸기/)).toBeInTheDocument();
  });

  it('설정값이 없으면 주소가 올바르지 않다고 하고, 없는 코드는 게시판을 찾지 못한다', async () => {
    show('/classboard/join/ABC234');
    expect(await screen.findByText('주소가 올바르지 않습니다')).toBeInTheDocument();
  });

  it('없는 코드', async () => {
    show(`/classboard/join/ZZZZZZ?p=${encodeConfig(CONFIG)}`);
    expect(await screen.findByText('게시판을 찾지 못했습니다')).toBeInTheDocument();
  });

  it('별명만 받는 게시판은 별명을 묻고, 닫힌 게시판은 들어오지 못한다', async () => {
    client.boards.set('ABC234', { ...client.boards.get('ABC234')!, nicknameOnly: true });
    show(`/classboard/join/ABC234?p=${encodeConfig(CONFIG)}`);
    expect(await screen.findByLabelText('별명')).toBeInTheDocument();
  });

  it('닫힌 게시판', async () => {
    client.boards.set('ABC234', { ...client.boards.get('ABC234')!, closed: true });
    show(`/classboard/join/ABC234?p=${encodeConfig(CONFIG)}`);
    expect(await screen.findByText('지금은 닫혀 있습니다')).toBeInTheDocument();
  });

  it('잠긴 주제는 읽을 수만 있다', async () => {
    const user = userEvent.setup();
    const board = client.boards.get('ABC234')!;
    client.boards.set('ABC234', {
      ...board,
      topics: board.topics.map((topic) => (topic.id === 'suggest' ? { ...topic, locked: true } : topic)),
    });
    localStorage.setItem('classroom-suite:v1:classboard-join:ABC234', JSON.stringify({ config: CONFIG, name: '하나' }));
    show('/classboard/join/ABC234');
    expect(await screen.findByText('잠긴 주제입니다. 읽을 수만 있습니다.')).toBeInTheDocument();
    expect(screen.queryByLabelText('글쓰기')).not.toBeInTheDocument();
    // 다른 주제로 옮기면 쓸 수 있다
    await user.click(screen.getByRole('tab', { name: /자유 이야기/ }));
    expect(screen.getByLabelText('글쓰기')).toBeInTheDocument();
  });
});
