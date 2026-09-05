import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setBoardClient } from '../../src/features/classboard/boardClient';
import { createBoard } from '../../src/features/classboard/boardCore';
import { saveClassboardSettings } from '../../src/features/classboard/boardSettings';
import type { BoardPost } from '../../src/features/classboard/boardTypes';
import ClassboardPage from '../../src/features/classboard/ClassboardPage';
import { createClassRoom, createEmptySuiteData, createTerm } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';
import { MemoryBoardClient } from './memoryBoardClient';

const CONFIG = { apiKey: 'k', authDomain: 'a.firebaseapp.com', projectId: 'our-class', appId: 'i' };
const T0 = '2026-03-02T09:00:00.000Z';
const NOW = '2026-09-06T09:00:00.000Z';

function seeded(): SuiteData {
  return {
    ...createEmptySuiteData(),
    terms: [
      createTerm(
        { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2027-02-28' },
        T0,
      ),
    ],
    classRooms: [createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, T0)],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

function show(): void {
  render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({ load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }) })}
        >
          <ClassboardPage />
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

let client: MemoryBoardClient;

beforeEach(() => {
  localStorage.clear();
  client = new MemoryBoardClient();
  setBoardClient(client);
});

afterEach(() => {
  setBoardClient(null);
});

describe('교사 화면', () => {
  it('설정값이 없으면 연결 안내와 설정 링크를 보여 준다', async () => {
    show();
    expect(await screen.findByText(/선생님의 Firebase/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '설정 → 학급 게시판 열기' })).toHaveAttribute(
      'href',
      '/settings?tab=classboard',
    );
  });

  it('로그인하지 않았으면 선생님 계정 화면, 로그인하면 게시판 만들기', async () => {
    const user = userEvent.setup();
    saveClassboardSettings({ config: CONFIG, studentOrigin: '' });
    show();

    await user.type(await screen.findByLabelText('이메일'), 't@school.kr');
    await user.type(screen.getByLabelText('비밀번호'), 'secret1');
    await user.click(screen.getByRole('button', { name: '계정 만들기' }));
    expect(client.calls).toContain('signInTeacher:up');

    await user.click(await screen.findByRole('button', { name: '이 학급 게시판 만들기' }));

    // 코드 여섯 글자와 학생 링크(설정값이 실려 있다)
    const code = (await screen.findByTestId('board-code')).textContent ?? '';
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
    const created = client.boards.get(code);
    expect(created?.ownerUid).toBe('teacher-1');
    expect(created?.classId).toBe('class-1');
    expect(created?.topics.map((topic) => topic.name)).toEqual(['건의함', '칭찬 릴레이', '자유 이야기']);
    expect(screen.getByText(new RegExp(`/classboard/join/${code}\\?p=`))).toBeInTheDocument();

    // 선생님 글
    await user.type(screen.getByLabelText('글쓰기'), '이번 주 건의를 기다립니다');
    await user.click(screen.getByRole('button', { name: '올리기' }));
    const article = await screen.findByRole('article', { name: '선생님의 글' });
    // 쓴 사람 이름과 '선생님' 표시 — 둘 다 선생님이다.
    expect(within(article).getAllByText('선생님')).toHaveLength(2);
    expect(client.posts.get(code)?.[0]?.byTeacher).toBe(true);
  });

  it('학생 글을 숨기고 지우며, 별명만 받기를 켠다', async () => {
    const user = userEvent.setup();
    saveClassboardSettings({ config: CONFIG, studentOrigin: '' });
    client.user = { uid: 'teacher-1', isAnonymous: false, email: 't@school.kr' };
    const board = createBoard({ code: 'ABC234', ownerUid: 'teacher-1', classId: 'class-1', className: '3학년 2반' }, NOW);
    client.boards.set('ABC234', board);
    const rows: BoardPost[] = [
      { id: '2', topicId: 'suggest', text: '급식에 과일', authorName: '하나', authorUid: 'anon-1', byTeacher: false, createdAt: NOW, hidden: false },
      { id: '1', topicId: 'suggest', text: '이미 숨긴 글', authorName: '두리', authorUid: 'anon-2', byTeacher: false, createdAt: NOW, hidden: true },
    ];
    client.posts.set('ABC234', rows);
    show();

    expect(await screen.findByTestId('board-code')).toHaveTextContent('ABC234');
    // 교사는 숨긴 글도 본다(표시가 붙는다)
    // 코드는 목록에서 먼저 뜨고 글은 그 뒤에 온다.
    const hiddenArticle = await screen.findByRole('article', { name: '두리의 글' });
    expect(within(hiddenArticle).getByText('숨김')).toBeInTheDocument();

    const article = screen.getByRole('article', { name: '하나의 글' });
    await user.click(within(article).getByRole('button', { name: '글 숨기기' }));
    expect(client.posts.get('ABC234')?.find((row) => row.id === '2')?.hidden).toBe(true);
    expect(within(article).getByRole('button', { name: '글 보이기' })).toBeInTheDocument();

    // 지우기는 두 번 — 정말 지울까요?
    await user.click(within(hiddenArticle).getByRole('button', { name: '글 지우기' }));
    await user.click(within(hiddenArticle).getByRole('button', { name: '글 지우기 확인' }));
    expect(screen.queryByRole('article', { name: '두리의 글' })).not.toBeInTheDocument();
    expect(client.posts.get('ABC234')?.some((row) => row.id === '1')).toBe(false);

    await user.click(screen.getByLabelText('별명만 받기'));
    expect(client.boards.get('ABC234')?.nicknameOnly).toBe(true);
  });

  it('주제 관리 — 이름 바꾸기·잠그기·추가', async () => {
    const user = userEvent.setup();
    saveClassboardSettings({ config: CONFIG, studentOrigin: '' });
    client.user = { uid: 'teacher-1', isAnonymous: false, email: 't@school.kr' };
    client.boards.set('ABC234', createBoard({ code: 'ABC234', ownerUid: 'teacher-1', classId: 'class-1', className: '3학년 2반' }, NOW));
    show();
    await screen.findByTestId('board-code');

    await user.click(screen.getByRole('button', { name: '주제 관리' }));
    const dialog = await screen.findByRole('dialog', { name: '주제 관리' });
    const nameInput = within(dialog).getByLabelText('건의함 이름');
    await user.clear(nameInput);
    await user.type(nameInput, '우리 반 건의');
    await user.tab();
    expect(client.boards.get('ABC234')?.topics[0]?.name).toBe('우리 반 건의');

    await user.click(within(dialog).getAllByRole('button', { name: '잠그기' })[2]!);
    expect(client.boards.get('ABC234')?.topics[2]?.locked).toBe(true);

    await user.type(within(dialog).getByLabelText('새 주제 이름'), '독서 나눔');
    await user.click(within(dialog).getByRole('button', { name: '추가' }));
    expect(client.boards.get('ABC234')?.topics.map((topic) => topic.name)).toEqual([
      '우리 반 건의',
      '칭찬 릴레이',
      '자유 이야기',
      '독서 나눔',
    ]);
  });
});
