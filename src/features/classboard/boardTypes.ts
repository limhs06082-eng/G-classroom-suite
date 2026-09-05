/**
 * 학급 게시판 자료 모양.
 *
 * 이 자료는 SuiteData가 아니다 — **선생님의 Firebase(Firestore)에만** 산다.
 * 앱은 게시판 코드로 그곳을 읽고 쓸 뿐, 백업·동기화 어디에도 싣지 않는다.
 * 학생 글이 선생님 개인의 Firebase에 남는다는 것을 설정 화면이 그대로 알린다.
 */

/** 선생님이 Firebase 콘솔에서 복사해 붙여 넣는 웹 앱 설정 가운데 게시판이 쓰는 넷. */
export interface BoardFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export interface BoardTopic {
  id: string;
  name: string;
  /** 잠그면 학생이 새 글·댓글을 못 쓴다(방학 중). 읽기는 된다. */
  locked: boolean;
}

/** Firestore `boards/{code}` 문서. */
export interface Board {
  /** 학생이 들어오는 6자 코드. 문서 id이기도 하다. */
  code: string;
  /** 만든 선생님의 uid. 숨기기·지우기·주제 관리는 이 uid만 — 규칙이 그렇게 잠근다. */
  ownerUid: string;
  /** 앱의 학급 id. 같은 선생님의 다른 기기에서도 학급을 찾아 게시판을 잇는다. */
  classId: string;
  className: string;
  topics: BoardTopic[];
  /** 학교 개인정보 지침에 따라 이름 대신 별명만 받는다. */
  nicknameOnly: boolean;
  /** 닫으면 학생 화면이 "닫혀 있습니다"만 보여 준다. */
  closed: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Firestore `boards/{code}/posts/{id}` 문서. 제목 없이 본문 한 덩어리 — 문자처럼. */
export interface BoardPost {
  id: string;
  topicId: string;
  text: string;
  authorName: string;
  authorUid: string;
  byTeacher: boolean;
  createdAt: string;
  /** 선생님이 숨긴 글. 학생 화면에서 빠지고, 규칙이 학생의 읽기도 막는다. */
  hidden: boolean;
}

/** Firestore `boards/{code}/comments/{id}` 문서. 글 아래가 아니라 게시판 아래 — 한 번에 읽는다. */
export interface BoardComment {
  id: string;
  postId: string;
  text: string;
  authorName: string;
  authorUid: string;
  byTeacher: boolean;
  createdAt: string;
  hidden: boolean;
}

export interface BoardUser {
  uid: string;
  /** 학생(익명 로그인)인가. 선생님은 이메일 계정이다. */
  isAnonymous: boolean;
  email: string | null;
}

export type NewPost = Omit<BoardPost, 'id' | 'createdAt' | 'hidden'>;
export type NewComment = Omit<BoardComment, 'id' | 'createdAt' | 'hidden'>;
