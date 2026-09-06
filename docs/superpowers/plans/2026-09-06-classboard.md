# 학급 게시판 ① (0.21.0) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선생님이 자기 Firebase 설정값을 붙여 넣으면, 학생이 링크·QR로 들어와 글과 댓글을 쓰는 학급 게시판을 설치형·웹 양쪽에서 쓴다.

**Architecture:** 게시판 자료는 선생님의 Firebase(Firestore)에만 산다. 앱은 설정값을 **이 컴퓨터에만**(localStorage) 두고, 학생 링크에 그 설정값을 실어 보내 학생 화면이 어느 배포에서 열려도 그 선생님의 Firebase에 붙게 한다. 통신은 `BoardClient` 인터페이스 뒤에 두어(형성평가의 `QuizSessionRelay`와 같은 자리) Firebase 없이 화면을 시험한다. 읽기는 **열 때 한 번 + [새로고침]**(실시간 구독 없음)이라 무료 한도에 여유가 있고, Firestore **lite** SDK(REST만, 구독 없음)를 써서 꾸러미도 작다.

**Tech Stack:** React 19 · react-router · firebase 12(`firebase/app`·`firebase/auth`·`firebase/firestore/lite`, 전부 동적 import) · qrcode · vitest.

**Spec:** `docs/reference/home-2-and-class-board-proposal.md` §2.

## Global Constraints

- `firebase`는 **정적 import 금지**. 웹 첫 청크 400KB 한도(`check-bundle-purity`).
- 설정값·계정은 SuiteData·백업에 넣지 않는다(AI 키·NEIS 키와 같은 원칙). 저장소 키 접두는 `classroom-suite:v1:`.
- 학생 화면(`/classboard/join/:code`)은 웹 전용 — 라우터에서 `import.meta.env.VITE_TARGET === 'desktop'` 글자 비교로 뺀다. 설치형 번들 표지자 `classroom-suite:v1:classboard-join`.
- 교사 화면(`/classboard`)과 설정 탭은 설치형·웹 공통. 설치형 CSP `connect-src`에 `https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com`을 더하고 `check-release`가 그 목록을 센다(`*` 금지는 그대로).
- 학생은 익명 로그인, 교사는 이메일/비밀번호. 숨기기·지우기·주제 관리는 게시판 문서의 `ownerUid`와 같은 uid만.
- 라우트 이름 `board/*`는 전자칠판이 쓴다 → 이 기능은 `classboard`.
- 공식 웹 배포 `https://g-classroom-suite.vercel.app` — 설치형에서 학생 링크의 기본 주소. 설정에서 바꿀 수 있다.

---

## 파일 지도

| 파일 | 책임 |
|---|---|
| `src/features/classboard/boardTypes.ts` | Board·Topic·Post·Comment·User 타입 |
| `src/features/classboard/boardCore.ts` | 순수 규칙: 기본 주제, 주제 조작, 글 id(시간 역순), 보이는 글 고르기, 글자 다듬기, 시각 표시 |
| `src/features/classboard/boardSettings.ts` | 설정값 붙여넣기 해석, 이 컴퓨터 저장, 학생 화면 주소, 규칙 문서 글 |
| `src/features/classboard/joinLink.ts` | 학생 링크 만들기·읽기(설정값을 `?p=`에 base64url) |
| `src/features/classboard/joinStore.ts` | 학생 폰에 코드별 설정값·이름 기억 |
| `src/features/classboard/boardClient.ts` | `BoardClient` 인터페이스 + `getBoardClient/setBoardClient` |
| `src/features/classboard/FirebaseBoardClient.ts` | Firebase 구현(동적 import) |
| `src/features/classboard/useBoardData.ts` | 읽기·새로고침·낙관적 쓰기 훅 |
| `src/features/classboard/BoardView.tsx` | 주제 탭·글쓰기·글·댓글(교사·학생 공용) |
| `src/features/classboard/ClassboardPage.tsx` | 교사 화면: 안내 → 로그인 → 게시판 만들기 → 코드·링크·QR·관리 |
| `src/features/classboard/ClassboardJoinPage.tsx` | 학생 화면(웹) |
| `src/features/classboard/ClassboardSettingsTab.tsx` | 설정 → 학급 게시판 탭 |
| `src/app/navigation.ts`, `src/app/router.tsx`, `src/index.css` | 내비·라우트·색 토큰 |
| `src/features/settings/SettingsPage.tsx` | 탭 추가 |
| `src-tauri/tauri.conf.json`, `scripts/check-release.mjs`, `scripts/check-bundle-purity.mjs` | CSP·검사 |
| `README.md`, `docs/releases/v0.21.0.md` | 선생님용 연결 안내·릴리스 노트 |

## Firestore 자료 모양

```
boards/{code}                 { ownerUid, classId, className, topics:[{id,name,locked}], nicknameOnly, closed, createdAt, updatedAt }
boards/{code}/posts/{id}      { topicId, text, authorName, authorUid, byTeacher, createdAt, hidden }
boards/{code}/comments/{id}   { postId, text, authorName, authorUid, byTeacher, createdAt, hidden }
```

- 글·댓글 id는 **시간 역순**(`9999999999999 - now` 13자리 + 무작위 4자)이라 기본 정렬(id 오름차순)에 `limit`만 걸어도 최신 글이 온다. `orderBy`가 없으니 `where('hidden','==',false)`와 함께 써도 복합 색인이 필요 없다.
- 학생은 `where('hidden','==',false)`로 읽고, 교사는 조건 없이 읽는다. 규칙이 그 차이를 강제한다.

## 규칙(선생님이 붙여 넣는 것)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function owner(code) { return signedIn() && get(/databases/$(database)/documents/boards/$(code)).data.ownerUid == request.auth.uid; }
    match /boards/{code} {
      allow get: if signedIn();
      allow list: if signedIn() && resource.data.ownerUid == request.auth.uid;
      allow create: if signedIn() && request.auth.token.firebase.sign_in_provider != 'anonymous' && request.resource.data.ownerUid == request.auth.uid;
      allow update, delete: if owner(code);
      match /posts/{id} {
        allow read: if owner(code) || (signedIn() && resource.data.hidden == false);
        allow create: if signedIn() && request.resource.data.authorUid == request.auth.uid && request.resource.data.hidden == false && request.resource.data.text is string && request.resource.data.text.size() <= 1000;
        allow update, delete: if owner(code);
      }
      match /comments/{id} { (posts와 같되 text 300자) }
    }
  }
}
```

---

### Task 1: 순수 모듈 — 타입·규칙·설정·링크 (+ 시험)

**Files:** Create `boardTypes.ts`, `boardCore.ts`, `boardSettings.ts`, `joinLink.ts`, `joinStore.ts`; Test `tests/classboard/boardCore.test.ts`, `tests/classboard/boardSettings.test.ts`, `tests/classboard/joinLink.test.ts`.

**Produces:**
- `defaultTopics(): BoardTopic[]`(건의함·칭찬 릴레이·자유 이야기), `createBoard({code, ownerUid, classId, className}, now)`, `renameTopic/addTopic/removeTopic/setTopicLocked(board, …)`, `newEntryId(now: Date, random?)`(시간 역순), `sortNewest(rows)`, `visiblePosts(posts, topicId, includeHidden)`, `commentsFor(comments, postId, includeHidden)`, `cleanText(text, max)`, `isValidCode(code)`, `timeLabel(iso, now)`, `POST_MAX=1000`, `COMMENT_MAX=300`, `NAME_MAX=20`.
- `parseFirebaseConfigText(text): BoardFirebaseConfig | null`, `readClassboardSettings/saveClassboardSettings/clearClassboardSettings`, `hasClassboardConfig()`, `resolveStudentOrigin(settings, isDesktop, locationOrigin)`, `OFFICIAL_STUDENT_ORIGIN`, `rulesText()`.
- `encodeConfig/decodeConfig`, `buildJoinLink(origin, code, config)`, `configFromSearch(search)`.
- `readJoin(code): { config, name } | null`, `saveJoin(code, patch)`.

- [ ] 시험을 먼저 쓰고 실패를 본다 → 구현 → 통과 → 커밋.

### Task 2: BoardClient 인터페이스와 Firebase 구현

**Files:** Create `boardClient.ts`, `FirebaseBoardClient.ts`; Test `tests/classboard/memoryBoardClient.ts`(시험용 메모리 구현, 인터페이스를 그대로 채운다).

**Produces:** `interface BoardClient { currentUser(); signInAnonymously(); signInTeacher(email, password, mode); signOut(); getBoard(code); listMyBoards(uid); createBoard(board); updateBoard(code, patch); listPosts(code, includeHidden); listComments(code, includeHidden); addPost(code, input); addComment(code, input); setPostHidden(code, id, hidden); deletePost(code, id); setCommentHidden(code, id, hidden); deleteComment(code, id) }`, `getBoardClient(config)`, `setBoardClient(client | null)`, `toKoreanAuthError(caught)`.

- [ ] 메모리 구현이 인터페이스를 다 채우는지 tsc로 확인. Firebase 구현은 동적 import만 쓰는지 `grep -n "from 'firebase"`가 `import type`만 잡는지 확인.

### Task 3: 화면 — useBoardData, BoardView, 학생 화면, 교사 화면, 설정 탭

**Files:** Create `useBoardData.ts`, `BoardView.tsx`, `ClassboardJoinPage.tsx`, `ClassboardPage.tsx`, `ClassboardSettingsTab.tsx`; Modify `navigation.ts`, `router.tsx`, `index.css`, `SettingsPage.tsx`, `AppShell.tsx`(없음 — 내비는 FEATURE_NAV가 그린다); Test `tests/classboard/ClassboardJoinPage.test.tsx`, `tests/classboard/ClassboardPage.test.tsx`, `tests/app/desktopRoutes.test.ts`.

- 학생 화면: 링크의 설정값 → 익명 로그인 → 게시판 확인 → 이름(별명) → 주제 탭·글·댓글·[새로고침]. 잘못된 코드는 "주소가 올바르지 않습니다".
- 교사 화면: 설정 없음 → 안내 카드(설정 탭 링크) / 로그인 카드 / [이 학급 게시판 만들기] / 게시판(코드·링크 복사·QR·[새로고침]·주제 관리·숨기기·지우기·별명만·닫기).
- 설정 탭: 설정값 붙여넣기 → [저장], [연결 확인](익명 로그인 시도), 학생 화면 주소(설치형), 규칙 [복사], README 안내 링크, 지우기.

### Task 4: 설치형 CSP·검사·번들 표지자

**Files:** Modify `src-tauri/tauri.conf.json`(csp connect-src), `scripts/check-release.mjs`(connect-src 허용 목록 검사), `scripts/check-bundle-purity.mjs`(DESKTOP_FORBIDDEN에 `classroom-suite:v1:classboard-join`).

### Task 5: 문서·판

**Files:** Modify `README.md`(학급 게시판 — Firebase 연결 안내), Create `docs/releases/v0.21.0.md`, `../G-board/확인목록-0.21.0.md`; 판 0.21.0(package.json·tauri.conf.json·Cargo.toml·Cargo.lock).

- [ ] `npm run verify` · `npm run check:release` · 서명 빌드 · 태그.
