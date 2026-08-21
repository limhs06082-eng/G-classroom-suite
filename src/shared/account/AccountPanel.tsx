import type { Auth } from 'firebase/auth';
import { CloudOff, LogIn } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { ensureFirebase } from '../storage/firebaseApp';
import { Button, Card } from '../ui';

/**
 * 계정·동기화 패널.
 *
 * 설정의 '계정·동기화' 탭과 `/login` 경로가 같은 것을 쓴다. 화면 하나를
 * 두 곳에서 보여 주는 것이라, 어느 쪽으로 들어와도 같은 말을 듣는다.
 *
 * `src/features/` 아래가 아니라 여기에 둔다. 학급 기능이 아니라 앱을
 * 어떻게 켤지에 대한 화면이고, 기능 코드는 저장소가 무엇인지 몰라야 한다.
 *
 * 로그인에 성공하면 화면 전환이 아니라 새로 고침으로 간다. 저장소는 앱을
 * 켤 때 한 번 정해지므로, 여기서 라우터만 옮기면 화면은 바뀌어도 자료는
 * 여전히 이 기기 것을 본다.
 */
export function AccountPanel({ showHomeLink = false }: { showHomeLink?: boolean }) {
  /*
   * firebase/auth는 필요할 때 가져온다. 정적으로 부르면 로그인 화면을
   * 열지 않는 교사도 꾸러미를 통째로 내려받는다.
   */
  const [auth, setAuth] = useState<Auth | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void ensureFirebase().then((instance) => {
      if (cancelled) return;
      setAuth(instance?.auth ?? null);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (checking) {
    return (
      <Card>
        <p className="text-sm text-slate-500">확인 중…</p>
      </Card>
    );
  }

  if (auth === null) {
    return (
      <Card title="이 기기에만 저장하고 있습니다" icon={CloudOff}>
        <p className="text-sm text-slate-600">
          Firebase 설정을 넣지 않아 로그인이 필요 없습니다. 자료는 이 브라우저에만
          저장되며, 앱의 모든 기능은 그대로 쓸 수 있습니다.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          교실 컴퓨터와 집 컴퓨터에서 같은 자료를 보시려면{' '}
          <code>src/shared/storage/firebaseConfig.ts</code>를 채워 주세요. 자세한 방법은
          저장소의 <code>docs/firebase-guide.md</code>에 있습니다.
        </p>
        {showHomeLink ? (
          <div className="mt-4">
            <Link
              to="/"
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              돌아가기
            </Link>
          </div>
        ) : null}
      </Card>
    );
  }

  const currentUser = auth.currentUser;

  const submit = async (event: FormEvent, mode: 'in' | 'up'): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = await import(
        'firebase/auth'
      );

      if (mode === 'up') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      window.location.assign('/');
    } catch (caught) {
      setError(toKorean(caught));
      setBusy(false);
    }
  };

  if (currentUser !== null) {
    return (
      <Card title="로그인되어 있습니다" icon={LogIn}>
        <p className="text-sm text-slate-600">{currentUser.email}</p>
        <p className="mt-2 text-sm text-slate-500">
          이 계정으로 저장한 자료는 같은 계정으로 로그인한 다른 기기에서도 보입니다.
        </p>
        <div className="mt-4 flex gap-2">
          {showHomeLink ? (
            <Link
              to="/"
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              우리 반으로
            </Link>
          ) : null}
          <Button
            variant="ghost"
            onClick={() => {
              void import('firebase/auth')
                .then(({ signOut }) => signOut(auth))
                .then(() => window.location.assign('/'));
            }}
          >
            로그아웃
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="로그인" icon={LogIn}>
      <form className="flex max-w-sm flex-col gap-3" onSubmit={(e) => void submit(e, 'in')}>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          이메일
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 rounded-control border border-slate-300 px-3 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          비밀번호
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 rounded-control border border-slate-300 px-3 text-sm"
          />
        </label>

        {error === '' ? null : (
          <p role="alert" className="text-sm font-medium text-danger-600">
            {error}
          </p>
        )}

        <div className="mt-1 flex gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            로그인
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={(e) => void submit(e, 'up')}>
            계정 만들기
          </Button>
        </div>
      </form>

      <p className="mt-4 text-sm text-slate-500">
        처음이시면 <strong>계정 만들기</strong>를 누르세요. 비밀번호는 6자 이상이면 됩니다.
        로그인하지 않아도 앱은 그대로 쓰며, 이 기기에만 저장될 뿐입니다.
      </p>
    </Card>
  );
}

/** Firebase 오류 코드를 교사가 읽을 말로 바꾼다. */
function toKorean(caught: unknown): string {
  const code =
    typeof caught === 'object' && caught !== null && 'code' in caught
      ? String((caught as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않습니다.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '이메일이나 비밀번호가 맞지 않습니다.';
    case 'auth/email-already-in-use':
      return '이미 만든 계정입니다. 로그인을 눌러 주세요.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 합니다.';
    case 'auth/operation-not-allowed':
      return 'Firebase 콘솔에서 이메일/비밀번호 로그인을 켜지 않았습니다. 가이드 1단계를 확인해 주세요.';
    case 'auth/network-request-failed':
      return '인터넷 연결을 확인해 주세요.';
    default:
      return caught instanceof Error ? caught.message : '로그인하지 못했습니다.';
  }
}
