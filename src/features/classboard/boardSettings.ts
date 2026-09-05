import type { BoardFirebaseConfig } from './boardTypes';

/**
 * 학급 게시판 설정 — 선생님의 Firebase 웹 앱 설정값과 학생 화면 주소.
 *
 * **이 컴퓨터에만** 산다. 학급 자료(SuiteData)와 백업에는 절대 넣지 않는다 —
 * AI 키·NEIS 키와 같은 원칙(aiSettings.ts). 설정값 자체는 비밀이 아니지만
 * (학생 링크에도 실린다), 백업 파일이 오가는 자리에 다른 프로젝트의 설정이
 * 섞여 들어가는 것은 막는다.
 */
export const CLASSBOARD_CONFIG_STORAGE = 'classroom-suite:v1:classboard-firebase';

/**
 * 공식 웹 배포. 설치형(.exe)에는 학생이 열 웹 화면이 없으므로, 학생 링크는
 * 여기를 가리킨다. 설정값이 링크에 실려 가니 어느 배포에서 열려도 **그 선생님의**
 * Firebase에 붙는다. 자기 배포가 있는 분은 설정에서 바꾼다.
 */
export const OFFICIAL_STUDENT_ORIGIN = 'https://g-classroom-suite.vercel.app';

export interface ClassboardSettings {
  config: BoardFirebaseConfig;
  /** 비어 있으면 기본(설치형은 공식 배포, 웹은 지금 주소). */
  studentOrigin: string;
}

const KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;

/**
 * 콘솔에서 복사한 것을 그대로 받는다 — `const firebaseConfig = { apiKey: "..." }`든
 * JSON이든 한 줄이든. 키 넷만 뽑고 나머지(storageBucket 등)는 버린다.
 */
export function parseFirebaseConfigText(text: string): BoardFirebaseConfig | null {
  const found: Partial<Record<(typeof KEYS)[number], string>> = {};
  const pattern = /["']?(apiKey|authDomain|projectId|appId)["']?\s*[:=]\s*["']([^"'\s]+)["']/g;
  for (const match of text.matchAll(pattern)) {
    const key = match[1] as (typeof KEYS)[number];
    const value = match[2] ?? '';
    if (found[key] === undefined && value !== '') found[key] = value;
  }
  if (!KEYS.every((key) => typeof found[key] === 'string')) return null;
  return {
    apiKey: found.apiKey ?? '',
    authDomain: found.authDomain ?? '',
    projectId: found.projectId ?? '',
    appId: found.appId ?? '',
  };
}

function isConfig(raw: unknown): raw is BoardFirebaseConfig {
  if (typeof raw !== 'object' || raw === null) return false;
  const record = raw as Record<string, unknown>;
  return KEYS.every((key) => typeof record[key] === 'string' && record[key] !== '');
}

export function readClassboardSettings(): ClassboardSettings | null {
  try {
    const raw = localStorage.getItem(CLASSBOARD_CONFIG_STORAGE);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (!isConfig(record['config'])) return null;
    return {
      config: record['config'],
      studentOrigin: typeof record['studentOrigin'] === 'string' ? record['studentOrigin'] : '',
    };
  } catch {
    return null;
  }
}

export function saveClassboardSettings(settings: ClassboardSettings): void {
  try {
    localStorage.setItem(CLASSBOARD_CONFIG_STORAGE, JSON.stringify(settings));
  } catch {
    // 저장이 막힌 브라우저. 이번 세션에는 쓰이고, 다음에 다시 붙여 넣으면 된다.
  }
}

export function clearClassboardSettings(): void {
  try {
    localStorage.removeItem(CLASSBOARD_CONFIG_STORAGE);
  } catch {
    // 지울 것이 없다.
  }
}

export function hasClassboardConfig(): boolean {
  return readClassboardSettings() !== null;
}

/** 학생 링크의 앞부분. 끝의 빗금은 뗀다 — 뒤에 /classboard/join/… 을 붙인다. */
export function resolveStudentOrigin(
  settings: ClassboardSettings | null,
  desktop: boolean,
  locationOrigin: string,
): string {
  const custom = (settings?.studentOrigin ?? '').trim().replace(/\/+$/, '');
  if (custom !== '') return custom;
  return desktop ? OFFICIAL_STUDENT_ORIGIN : locationOrigin.replace(/\/+$/, '');
}

/**
 * 선생님이 Firestore 콘솔 → 규칙 탭에 그대로 붙여 넣는 글.
 *
 * - 게시판 문서는 로그인한 누구나 **하나씩** 읽는다(코드를 아는 학생). 목록은 주인만.
 * - 만들기는 이메일 계정만(익명 불가), 고치기·지우기는 주인만.
 * - 글·댓글: 숨긴 것은 주인만 읽는다. 쓰기는 자기 uid로, 숨김 아님으로, 글자 수 안에서,
 *   **'선생님' 표시(byTeacher)는 주인만**. 설정값이 링크에 실려 가므로 학생이 손으로 만든
 *   요청도 올 수 있다 — 화면이 아니라 규칙이 막아야 한다.
 * - 글자 수는 UTF-8 **바이트**로 센다(toUtf8). `size()`가 글자인지 바이트인지에 걸지 않는다.
 *   한글 3바이트·이모지 4바이트라 앱의 1,000자·300자에 4,000·1,200바이트를 준다.
 * - 없는 게시판은 exists()로 먼저 거른다. get()이 null을 주면 .data에서 규칙 평가가
 *   터져 "찾지 못했습니다" 대신 "규칙이 막았습니다"가 뜬다.
 * - 닫은 게시판에는 주인만 쓴다. 주제 잠금은 규칙이 못 본다(목록 안을 못 훑는다) — 화면만.
 *   고치기·지우기(숨기기 포함)는 주인만 — 학생은 자기 글도 못 지운다(선생님께 말한다).
 */
export function rulesText(): string {
  return `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }
    function boardPath(code) {
      return /databases/$(database)/documents/boards/$(code);
    }
    function owner(code) {
      return signedIn() && exists(boardPath(code))
        && get(boardPath(code)).data.ownerUid == request.auth.uid;
    }
    function boardOpen(code) {
      return exists(boardPath(code)) && get(boardPath(code)).data.closed == false;
    }
    // 글자 수는 UTF-8 바이트(한글 3, 이모지 4). 앱은 글 1,000자·댓글 300자.
    function textOk(code, maxBytes) {
      return request.resource.data.text is string
        && request.resource.data.text.size() > 0
        && request.resource.data.text.toUtf8().size() <= maxBytes
        && request.resource.data.authorUid == request.auth.uid
        && request.resource.data.authorName is string
        && request.resource.data.authorName.toUtf8().size() <= 80
        && request.resource.data.hidden == false
        && request.resource.data.byTeacher is bool
        && (request.resource.data.byTeacher == false || owner(code));
    }

    match /boards/{code} {
      allow get: if signedIn();
      allow list: if signedIn() && resource.data.ownerUid == request.auth.uid;
      allow create: if signedIn()
        && request.auth.token.firebase.sign_in_provider != 'anonymous'
        && request.resource.data.ownerUid == request.auth.uid;
      allow update, delete: if owner(code);

      match /posts/{postId} {
        allow read: if (signedIn() && resource.data.hidden == false) || owner(code);
        allow create: if signedIn()
          && (boardOpen(code) || owner(code))
          && request.resource.data.topicId is string
          && textOk(code, 4000);
        allow update, delete: if owner(code);
      }
      match /comments/{commentId} {
        allow read: if (signedIn() && resource.data.hidden == false) || owner(code);
        allow create: if signedIn()
          && (boardOpen(code) || owner(code))
          && request.resource.data.postId is string
          && textOk(code, 1200);
        allow update, delete: if owner(code);
      }
    }
  }
}
`;
}
