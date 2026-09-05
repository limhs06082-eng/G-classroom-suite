import { CheckCircle2, Copy, Flame, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { isDesktop } from '../../shared/platform/target';
import { Button, Card, useToast } from '../../shared/ui';
import { createCheckClient, toKoreanBoardError } from './boardClient';
import {
  clearClassboardSettings,
  OFFICIAL_STUDENT_ORIGIN,
  parseFirebaseConfigText,
  readClassboardSettings,
  rulesText,
  saveClassboardSettings,
  type ClassboardSettings,
} from './boardSettings';

/**
 * 설정 → 학급 게시판. 설정값 붙여넣기 · 연결 확인 · 학생 화면 주소 · 규칙 복사.
 *
 * 설치형·웹 공통이다. '계정·동기화'(웹 판의 학급 자료 동기화)와는 다른 Firebase
 * 프로젝트여도 되고 같아도 된다 — 게시판은 `boards/` 아래만 쓴다.
 */
export function ClassboardSettingsTab() {
  const toast = useToast();
  const [settings, setSettings] = useState<ClassboardSettings | null>(() => readClassboardSettings());
  const [text, setText] = useState('');
  const [origin, setOrigin] = useState(settings?.studentOrigin ?? '');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const save = (): void => {
    const config = parseFirebaseConfigText(text);
    if (config === null) {
      toast.error('apiKey·authDomain·projectId·appId 네 값을 찾지 못했습니다. 콘솔의 firebaseConfig를 통째로 붙여 넣어 주세요.');
      return;
    }
    const next = { config, studentOrigin: origin.trim() };
    saveClassboardSettings(next);
    setSettings(next);
    setText('');
    setResult(null);
    toast.success(`${config.projectId} 프로젝트를 이 컴퓨터에 저장했습니다. [연결 확인]을 눌러 보세요.`);
  };

  const saveOrigin = (): void => {
    if (settings === null) return;
    const next = { ...settings, studentOrigin: origin.trim() };
    saveClassboardSettings(next);
    setSettings(next);
    toast.success('학생 화면 주소를 저장했습니다.');
  };

  /**
   * 세 단계를 차례로 — 익명 로그인(설정값·익명 켜짐), Firestore 읽기(데이터베이스·규칙).
   * 어디서 막혔는지가 곧 무엇을 빠뜨렸는지다. 확인용 앱을 따로 쓰므로 게시판 화면의
   * 선생님 로그인은 끊기지 않는다.
   */
  const check = async (): Promise<void> => {
    if (settings === null) return;
    setChecking(true);
    setResult(null);
    const client = createCheckClient(settings.config);
    try {
      await client.signInAnonymously();
    } catch (caught) {
      setResult({ ok: false, message: `로그인 실패 — ${toKoreanBoardError(caught)}` });
      setChecking(false);
      return;
    }
    try {
      await client.getBoard('CHECK0');
      setResult({ ok: true, message: '연결됐습니다 — 익명 로그인 · Firestore · 규칙 모두 이상 없습니다.' });
    } catch (caught) {
      setResult({ ok: false, message: `Firestore 실패 — ${toKoreanBoardError(caught)}` });
    } finally {
      void client.signOut().catch(() => undefined);
      setChecking(false);
    }
  };

  const clear = (): void => {
    clearClassboardSettings();
    setSettings(null);
    setResult(null);
    toast.info('설정값을 지웠습니다. 게시판 자료는 Firebase에 그대로 있습니다.');
  };

  const copyRules = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(rulesText());
      toast.success('규칙을 복사했습니다. Firestore → 규칙 탭에 붙여 넣고 [게시]하세요.');
    } catch {
      toast.error('복사하지 못했습니다. 아래 글을 드래그해 복사해 주세요.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card title="학급 게시판 — Firebase 연결" icon={Flame} accentClass="text-classboard-500">
        <p className="text-sm text-slate-600">
          학생과 함께 쓰는 게시판은 <strong>선생님의 Firebase</strong>에 저장됩니다. 무료 요금제로 충분하고, 설정값은
          이 컴퓨터에만 남습니다(백업 파일에 들어가지 않습니다).
        </p>
        <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-slate-700">
          <li>
            <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-brand-700 underline">
              Firebase 콘솔
            </a>
            에서 프로젝트 추가 → Firestore Database 만들기(프로덕션 모드, 서울) → Authentication에서{' '}
            <strong>익명</strong>과 <strong>이메일/비밀번호</strong> 켜기
          </li>
          <li>프로젝트 설정 → 내 앱 → 웹(&lt;/&gt;) 등록 → 나오는 firebaseConfig를 복사</li>
          <li>아래 칸에 붙여 넣고 [저장] → [연결 확인]</li>
          <li>아래 규칙을 복사해 Firestore → 규칙 탭에 붙여 넣고 [게시]</li>
          <li>
            <Link to="/classboard" className="text-brand-700 underline">
              학급 게시판
            </Link>
            에서 선생님 계정 만들기 → 게시판 만들기
          </li>
        </ol>

        {settings === null ? null : (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-control bg-slate-50 px-3 py-2 text-sm">
            <CheckCircle2 className="size-4 text-success-700" aria-hidden />
            <span>
              연결된 프로젝트 <strong className="font-mono">{settings.config.projectId}</strong>
            </span>
            <span className="ml-auto flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => void check()} disabled={checking}>
                {checking ? '확인 중…' : '연결 확인'}
              </Button>
              <Button size="sm" variant="ghost" icon={Trash2} onClick={clear}>
                지우기
              </Button>
            </span>
          </div>
        )}
        {result === null ? null : (
          <p role="status" className={result.ok ? 'mt-2 text-sm text-success-700' : 'mt-2 text-sm text-danger-700'}>
            {result.message}
          </p>
        )}

        <label className="mt-4 flex flex-col gap-1 text-sm font-medium text-slate-700">
          {settings === null ? 'Firebase 설정값 붙여넣기' : '다른 설정값으로 바꾸기'}
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-label="Firebase 설정값"
            rows={6}
            spellCheck={false}
            placeholder={`const firebaseConfig = {\n  apiKey: "AIza...",\n  authDomain: "....firebaseapp.com",\n  projectId: "...",\n  appId: "1:...:web:..."\n};`}
            className="rounded-control border border-slate-300 bg-surface px-3 py-2 font-mono text-xs leading-relaxed"
          />
        </label>
        <div className="mt-2">
          <Button variant="primary" onClick={save} disabled={text.trim() === ''}>
            저장
          </Button>
        </div>
      </Card>

      <Card title="학생 화면 주소">
        <p className="text-sm text-slate-600">
          학생 링크의 앞부분입니다.{' '}
          {isDesktop() ? (
            <>
              설치형은 기본으로 공식 웹 배포(<span className="font-mono">{OFFICIAL_STUDENT_ORIGIN}</span>)를 씁니다. 설정값이
              링크에 실려 가므로 어느 배포에서 열려도 선생님의 Firebase에 붙습니다.
            </>
          ) : (
            <>비워 두면 지금 이 주소를 씁니다.</>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            aria-label="학생 화면 주소"
            placeholder={isDesktop() ? OFFICIAL_STUDENT_ORIGIN : window.location.origin}
            className="h-10 min-w-0 flex-1 rounded-control border border-slate-300 bg-surface px-3 font-mono text-sm"
          />
          <Button variant="secondary" onClick={saveOrigin} disabled={settings === null}>
            주소 저장
          </Button>
        </div>
      </Card>

      <Card
        title="Firestore 규칙"
        action={
          <Button size="sm" variant="secondary" icon={Copy} onClick={() => void copyRules()}>
            규칙 복사
          </Button>
        }
      >
        <p className="text-sm text-slate-600">
          이 규칙이 실제 자물쇠입니다. 게시판을 만든 선생님 계정만 글을 숨기고 지우며, 학생은 숨긴 글을 읽지 못합니다.
          Firebase 콘솔 → Firestore Database → <strong>규칙</strong> 탭에 그대로 붙여 넣고 <strong>게시</strong>하세요.
        </p>
        <pre className="ink mt-2 max-h-72 overflow-auto rounded-control bg-slate-900 p-3 text-xs leading-relaxed text-white">
          {rulesText()}
        </pre>
      </Card>
    </div>
  );
}
