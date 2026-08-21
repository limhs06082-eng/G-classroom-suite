import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';

import { firebaseConfig, hasFirebaseConfig } from './firebaseConfig';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import type { StorageAdapter } from './StorageAdapter';

/**
 * Firebase를 켜는 곳.
 *
 * ## 왜 전부 동적 import인가
 *
 * firebase 꾸러미는 첫 화면 번들을 364KB에서 1,028KB로 키운다. 정적으로
 * 부르면 설정을 넣지 않은 교사도 그 664KB를 그대로 내려받는다 — 쓰지도
 * 않을 코드다. `await import(...)`로 미루면, 설정이 비어 있을 때는
 * 꾸러미를 아예 건드리지 않는다.
 *
 * 타입만 가져오는 `import type`은 빌드하면서 사라지므로 번들에 남지 않는다.
 */

interface Ready {
  app: FirebaseApp;
  auth: Auth;
}

let ready: Ready | null = null;
let pending: Promise<Ready | null> | null = null;

/** 설정이 비어 있으면 null. 부르는 쪽이 이 기기 저장으로 내려가면 된다. */
export function ensureFirebase(): Promise<Ready | null> {
  if (!hasFirebaseConfig()) return Promise.resolve(null);
  if (ready !== null) return Promise.resolve(ready);

  pending ??= (async () => {
    const [{ initializeApp }, { getAuth }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]);

    const app = initializeApp(firebaseConfig);
    ready = { app, auth: getAuth(app) };
    return ready;
  })();

  return pending;
}

/**
 * 로그인 상태가 처음 정해질 때까지 기다린다.
 *
 * Firebase는 새로 고침 직후 잠깐 '아직 모름' 상태다. 이때 바로 물으면
 * 로그인해 둔 교사도 로그아웃으로 보여서, 이 기기 자료로 시작했다가
 * 잠시 뒤 원격 자료로 튄다. 한 번만 기다렸다가 시작한다.
 */
export async function waitForAuth(): Promise<User | null> {
  const instance = await ensureFirebase();
  if (instance === null) return null;

  const { onAuthStateChanged } = await import('firebase/auth');

  return new Promise((resolve) => {
    const stop = onAuthStateChanged(instance.auth, (user) => {
      stop();
      resolve(user);
    });
  });
}

/**
 * 어떤 저장소를 쓸지 정한다.
 *
 * 설정이 비었거나 로그인하지 않았으면 이 기기 저장이다. 앱은 그대로 돌아간다.
 */
export async function resolveAdapter(
  onWarning?: (message: string) => void,
): Promise<StorageAdapter> {
  if (!hasFirebaseConfig()) return new LocalStorageAdapter();

  try {
    const instance = await ensureFirebase();
    if (instance === null) return new LocalStorageAdapter();

    const user = await waitForAuth();
    if (user === null) return new LocalStorageAdapter();

    const { FirestoreAdapter } = await import('./FirestoreAdapter');
    return new FirestoreAdapter(instance.app, user.uid, { onWarning });
  } catch (error) {
    /*
     * 설정이 틀렸거나 인터넷이 없어도 앱은 떠야 한다. 교사가 오늘 수업에서
     * 쓰려던 자료는 이 기기에도 있다.
     */
    onWarning?.(
      `Firebase에 연결하지 못해 이 기기 자료로 시작합니다: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return new LocalStorageAdapter();
  }
}
