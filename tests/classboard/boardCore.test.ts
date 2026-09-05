import { describe, expect, it } from 'vitest';

import {
  addTopic,
  cleanText,
  commentsFor,
  createBoard,
  createBoardCode,
  defaultTopics,
  isValidCode,
  MAX_TOPICS,
  newEntryId,
  normalizeCode,
  removeTopic,
  renameTopic,
  setTopicLocked,
  sortNewest,
  timeLabel,
  visiblePosts,
} from '../../src/features/classboard/boardCore';
import type { BoardComment, BoardPost } from '../../src/features/classboard/boardTypes';

const NOW = '2026-09-06T09:00:00.000Z';

function board() {
  return createBoard({ code: 'ABC234', ownerUid: 'teacher', classId: 'class-1', className: '3학년 2반' }, NOW);
}

describe('코드', () => {
  it('여섯 글자, 헷갈리는 글자(O·I·L) 없음', () => {
    const code = createBoardCode(() => 0.999);
    expect(code).toHaveLength(6);
    expect(isValidCode(code)).toBe(true);
    expect(isValidCode('ABCO12')).toBe(false);
    expect(isValidCode('ABC12')).toBe(false);
  });

  it('소문자·공백·붙임표는 받아 준다', () => {
    expect(normalizeCode(' abc-234 ')).toBe('ABC234');
  });
});

describe('주제', () => {
  it('기본 셋 — 건의함·칭찬 릴레이·자유 이야기', () => {
    expect(defaultTopics().map((topic) => topic.name)).toEqual(['건의함', '칭찬 릴레이', '자유 이야기']);
    expect(board().topics.every((topic) => !topic.locked)).toBe(true);
  });

  it('이름 바꾸기·추가·잠그기·지우기', () => {
    let next = renameTopic(board(), 'suggest', '  우리 반 건의  ');
    expect(next.topics[0]?.name).toBe('우리 반 건의');
    // 빈 이름은 무시한다.
    expect(renameTopic(next, 'suggest', '   ')).toBe(next);

    next = addTopic(next, '독서 나눔', 'reading');
    expect(next.topics.map((topic) => topic.id)).toEqual(['suggest', 'praise', 'free', 'reading']);
    // 같은 id는 두 번 못 넣는다.
    expect(addTopic(next, '또', 'reading')).toBe(next);

    next = setTopicLocked(next, 'free', true);
    expect(next.topics.find((topic) => topic.id === 'free')?.locked).toBe(true);

    next = removeTopic(next, 'reading');
    expect(next.topics).toHaveLength(3);
  });

  it('여덟 개까지, 마지막 하나는 못 지운다', () => {
    let next = board();
    for (let index = 0; index < 10; index += 1) next = addTopic(next, `주제 ${index}`, `t${index}`);
    expect(next.topics).toHaveLength(MAX_TOPICS);

    let one = board();
    one = removeTopic(one, 'suggest');
    one = removeTopic(one, 'praise');
    expect(one.topics).toHaveLength(1);
    expect(removeTopic(one, 'free')).toBe(one);
  });
});

describe('글 id는 시간 역순', () => {
  it('나중 글의 id가 사전순으로 앞에 온다 — orderBy 없이 limit만으로 최신 글을 받기 위해', () => {
    const earlier = newEntryId(new Date('2026-09-06T09:00:00.000Z'), () => 0.5);
    const later = newEntryId(new Date('2026-09-06T09:00:01.000Z'), () => 0.5);
    expect(later < earlier).toBe(true);
    expect(earlier).toHaveLength(17);
    expect(sortNewest([{ id: earlier }, { id: later }]).map((row) => row.id)).toEqual([later, earlier]);
  });
});

function post(id: string, topicId: string, hidden = false): BoardPost {
  return { id, topicId, text: id, authorName: '하나', authorUid: 'u', byTeacher: false, createdAt: NOW, hidden };
}

function comment(id: string, postId: string, hidden = false): BoardComment {
  return { id, postId, text: id, authorName: '두리', authorUid: 'u', byTeacher: false, createdAt: NOW, hidden };
}

describe('보이는 글·댓글', () => {
  it('주제로 거르고, 숨긴 글은 교사만 본다', () => {
    const posts = [post('3', 'free'), post('2', 'suggest', true), post('1', 'suggest')];
    expect(visiblePosts(posts, 'suggest', false).map((row) => row.id)).toEqual(['1']);
    expect(visiblePosts(posts, 'suggest', true).map((row) => row.id)).toEqual(['1', '2']);
  });

  it('댓글은 대화 순서(오래된 것 먼저)', () => {
    const comments = [comment('1', 'p'), comment('3', 'p'), comment('2', 'q'), comment('0', 'p', true)];
    expect(commentsFor(comments, 'p', false).map((row) => row.id)).toEqual(['3', '1']);
    expect(commentsFor(comments, 'p', true).map((row) => row.id)).toEqual(['3', '1', '0']);
  });
});

describe('글자 다듬기', () => {
  it('줄 끝 공백·과한 빈 줄을 정리하고 길이를 자른다', () => {
    expect(cleanText('  안녕  \r\n\r\n\r\n\r\n반가워  ', 100)).toBe('안녕\n\n반가워');
    expect(cleanText('가나다라마', 3)).toBe('가나다');
    // 이모지는 한 글자로 센다 — 잘린 자리에 깨진 글자가 남지 않는다.
    expect(cleanText('😀😀😀', 2)).toBe('😀😀');
  });
});

describe('시각 표시', () => {
  const now = new Date(2026, 8, 6, 14, 30, 0);
  it('방금 · n분 전 · 오늘은 시:분 · 올해는 월/일 · 지난해는 연.월.일', () => {
    expect(timeLabel(new Date(2026, 8, 6, 14, 29, 30).toISOString(), now)).toBe('방금');
    expect(timeLabel(new Date(2026, 8, 6, 14, 10, 0).toISOString(), now)).toBe('20분 전');
    expect(timeLabel(new Date(2026, 8, 6, 9, 5, 0).toISOString(), now)).toBe('09:05');
    expect(timeLabel(new Date(2026, 8, 1, 9, 5, 0).toISOString(), now)).toBe('9/1');
    expect(timeLabel(new Date(2025, 11, 24, 9, 5, 0).toISOString(), now)).toBe('2025.12.24');
    expect(timeLabel('깨진 값', now)).toBe('');
  });
});
