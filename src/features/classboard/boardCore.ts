import type { Board, BoardComment, BoardPost, BoardTopic } from './boardTypes';

/**
 * 게시판 순수 규칙. 통신은 BoardClient가 맡고 여기에는 계산만 둔다 —
 * Firebase 없이 규칙을 전부 시험하기 위해서다(형성평가 sessionCore와 같은 결).
 */

export const POST_MAX = 1000;
export const COMMENT_MAX = 300;
export const NAME_MAX = 20;
export const TOPIC_NAME_MAX = 20;
export const MAX_TOPICS = 8;

/** 0·1·O·I·L처럼 헷갈리는 글자를 뺀 32자(Crockford Base32). 형성평가 코드와 같은 글자판. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 6;

function pick(random: () => number): string {
  const index = Math.floor(random() * CODE_ALPHABET.length);
  return CODE_ALPHABET[Math.min(Math.max(index, 0), CODE_ALPHABET.length - 1)] ?? '0';
}

/** 학생이 들어올 6자 코드. 32^6 ≈ 10억 가지라 찍어서 들어올 수 없다. */
export function createBoardCode(random: () => number = Math.random): string {
  let code = '';
  for (let index = 0; index < CODE_LENGTH; index += 1) code += pick(random);
  return code;
}

export function isValidCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((ch) => CODE_ALPHABET.includes(ch));
}

/** 주소에서 온 코드. 소문자·공백·붙임표는 사람이 옮겨 적다 생긴 것이라 받아 준다. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, '');
}

/** 기본 주제 셋. 이름은 바꿀 수 있고 id는 그대로다. */
export function defaultTopics(): BoardTopic[] {
  return [
    { id: 'suggest', name: '건의함', locked: false },
    { id: 'praise', name: '칭찬 릴레이', locked: false },
    { id: 'free', name: '자유 이야기', locked: false },
  ];
}

export function createBoard(
  input: { code: string; ownerUid: string; classId: string; className: string },
  now: string,
): Board {
  return {
    code: input.code,
    ownerUid: input.ownerUid,
    classId: input.classId,
    className: input.className,
    topics: defaultTopics(),
    nicknameOnly: false,
    closed: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function renameTopic(board: Board, topicId: string, name: string): Board {
  const clean = cleanText(name, TOPIC_NAME_MAX).replace(/\n+/g, ' ');
  if (clean === '') return board;
  return {
    ...board,
    topics: board.topics.map((topic) => (topic.id === topicId ? { ...topic, name: clean } : topic)),
  };
}

/** 여덟 개까지. 탭이 그보다 많으면 고르는 일 자체가 일이 된다. */
export function addTopic(board: Board, name: string, id: string): Board {
  const clean = cleanText(name, TOPIC_NAME_MAX).replace(/\n+/g, ' ');
  if (clean === '' || board.topics.length >= MAX_TOPICS) return board;
  if (board.topics.some((topic) => topic.id === id)) return board;
  return { ...board, topics: [...board.topics, { id, name: clean, locked: false }] };
}

/** 마지막 하나는 못 지운다. 주제 없는 게시판은 글 쓸 자리가 없다. */
export function removeTopic(board: Board, topicId: string): Board {
  if (board.topics.length <= 1) return board;
  return { ...board, topics: board.topics.filter((topic) => topic.id !== topicId) };
}

export function setTopicLocked(board: Board, topicId: string, locked: boolean): Board {
  return {
    ...board,
    topics: board.topics.map((topic) => (topic.id === topicId ? { ...topic, locked } : topic)),
  };
}

/**
 * 글·댓글 문서 id. **시간 역순**이다 — 최신 글이 사전순으로 앞에 온다.
 *
 * Firestore는 `orderBy` 없이 `limit`만 걸면 문서 id 오름차순으로 준다. id가
 * 시간 역순이면 `where('hidden','==',false)`에 `limit(300)`만 붙여도 최신 300개가
 * 오고, `orderBy`가 없으니 **복합 색인을 만들 필요가 없다**. 선생님이 콘솔에서
 * 색인을 하나 더 만드는 단계가 통째로 사라진다.
 */
export function newEntryId(now: Date, random: () => number = Math.random): string {
  const reversed = String(9_999_999_999_999 - now.getTime()).padStart(13, '0');
  let tail = '';
  for (let index = 0; index < 4; index += 1) tail += pick(random);
  return `${reversed}${tail}`;
}

/** id 오름차순 = 최신 먼저(newEntryId가 그렇게 만든다). */
export function sortNewest<T extends { id: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function visiblePosts(
  posts: readonly BoardPost[],
  topicId: string,
  includeHidden: boolean,
): BoardPost[] {
  return sortNewest(posts.filter((post) => post.topicId === topicId && (includeHidden || !post.hidden)));
}

/** 댓글은 대화 순서(오래된 것 먼저)다. */
export function commentsFor(
  comments: readonly BoardComment[],
  postId: string,
  includeHidden: boolean,
): BoardComment[] {
  return sortNewest(
    comments.filter((comment) => comment.postId === postId && (includeHidden || !comment.hidden)),
  ).reverse();
}

/** 줄 끝 공백·세 줄 넘는 빈 줄을 정리하고 글자 수를 자른다(코드 포인트 기준 — 이모지도 한 글자). */
export function cleanText(text: string, max: number): string {
  const trimmed = text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return [...trimmed].slice(0, max).join('');
}

function two(value: number): string {
  return String(value).padStart(2, '0');
}

/** 글 옆의 시각. 문자 앱처럼 — 방금 · n분 전 · 오늘은 시:분 · 올해는 월/일. */
export function timeLabel(iso: string, now: Date): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const diff = now.getTime() - at.getTime();
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  const sameDay =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate();
  if (sameDay) return `${two(at.getHours())}:${two(at.getMinutes())}`;
  if (at.getFullYear() === now.getFullYear()) return `${at.getMonth() + 1}/${at.getDate()}`;
  return `${at.getFullYear()}.${at.getMonth() + 1}.${at.getDate()}`;
}
