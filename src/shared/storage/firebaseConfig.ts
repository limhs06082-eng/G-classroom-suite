/**
 * Firebase 설정값.
 *
 * ── 여기만 채우면 됩니다 ──────────────────────────────────────
 *
 * Firebase 콘솔 → 프로젝트 설정 → 내 앱 → SDK 설정에서 복사한 값을 넣으세요.
 * 비워 두면 이 브라우저에만 저장하는 모드로 동작합니다. 앱은 그대로 씁니다.
 *
 * **이 값은 비밀이 아닙니다.** 브라우저에 그대로 내려가는 값이라 저장소에
 * 올려도 됩니다. 자료를 지키는 것은 이 값이 아니라 Firestore 보안 규칙입니다.
 * docs/firebase-guide.md 4단계를 반드시 하세요.
 */
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/*
 * 타입을 적어 두는 것이 중요하다. `as const`를 붙이면 apiKey의 타입이
 * string이 아니라 적어 넣은 그 글자 하나가 되고, 그러면 아래 빈 값 비교를
 * TypeScript가 "겹칠 리 없는 비교"라며 거부한다. 비워 뒀을 때는 멀쩡하다가
 * 값을 채우는 순간 타입 검사가 깨진다.
 */
export const firebaseConfig: FirebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

/** 설정이 채워져 있는가. 비어 있으면 LocalStorageAdapter로 간다. */
export function hasFirebaseConfig(): boolean {
  return firebaseConfig.apiKey !== '' && firebaseConfig.projectId !== '';
}
