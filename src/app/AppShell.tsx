import { Lock, Settings, Users, Wrench } from 'lucide-react';
import { Suspense, useCallback } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { ToolsBar } from '../features/tools/ToolsBar';
import { LockScreen } from '../shared/lock/LockScreen';
import { engageLock, tryUnlock } from '../shared/lock/lockOps';
import { useSuite } from '../shared/roster/SuiteDataProvider';
import { siblingAppHref, SIBLING_APP_LABEL } from '../shared/siblingApp';
import { ClassSwitcher } from './ClassSwitcher';
import { ErrorBoundary } from './ErrorBoundary';
import { FEATURE_NAV } from './navigation';
import { PageLoader } from './PageLoader';

/**
 * 공통 레이아웃.
 *
 * 헤더의 학기·반·인원 표시는 5단계(roster)에서 실제 데이터와 연결한다.
 * 하단 도구 툴바(타이머·커튼 등)는 11단계에서 붙인다.
 */
export function AppShell() {
  const { data, update } = useSuite();
  const siblingHref = siblingAppHref();

  /*
   * update의 콜백은 반환값을 밖으로 낼 수 없다. 맞았는지는 지금 자료로
   * 미리 판정하고, 저장은 update 안에서 한 번 더 계산한다.
   * 순수 함수라 두 번 불러도 같은 답이 나온다.
   */
  const handleUnlock = useCallback(
    (pin: string): boolean => {
      const { ok } = tryUnlock(data, pin);
      if (ok) update((current) => tryUnlock(current, pin).data);

      return ok;
    },
    [data, update],
  );

  return (
    <div className="flex min-h-full flex-col">
      {/* 반투명 헤더는 스크롤할 때 본문 한글이 비쳐 읽기 어려워진다. 불투명으로 둔다. */}
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link to="/" className="shrink-0 text-base font-bold tracking-tight text-slate-900">
            우리 반
          </Link>

          <ClassSwitcher />

          <nav className="ml-auto flex items-center gap-1">
            {FEATURE_NAV.map(({ id, path, label, icon: Icon }) => (
              <NavLink
                key={id}
                to={path}
                end={path === '/'}
                // 좁은 화면에서는 라벨이 숨겨져 아이콘만 남으므로 이름을 따로 준다
                aria-label={label}
                className={({ isActive }) =>
                  [
                    'inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  ].join(' ')
                }
              >
                <Icon className="size-4" aria-hidden />
                <span className="hidden md:inline">{label}</span>
              </NavLink>
            ))}

            <NavLink
              to="/roster"
              aria-label="학생 명단"
              className={({ isActive }) =>
                [
                  'ml-1 rounded-control p-1.5 transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                ].join(' ')
              }
            >
              <Users className="size-4" aria-hidden />
            </NavLink>

            {/*
              짝이 되는 앱으로 넘어가는 버튼.
              src/shared/siblingApp.ts에 주소를 넣으면 나타나고, 비어 있으면 숨는다.
              같은 탭에서 넘어간다 — 앱마다 창을 쌓지 않는다.
            */}
            {siblingHref === null ? null : (
              <a
                href={siblingHref}
                className="ml-2 inline-flex items-center gap-1.5 rounded-control border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Wrench className="size-4 shrink-0 text-slate-400" aria-hidden />
                <span className="hidden lg:inline">{SIBLING_APP_LABEL}</span>
              </a>
            )}

            {/* PIN을 만든 교사에게만 보인다. 누를 수 없는 버튼을 보일 이유가 없다. */}
            {data.lockPin === '' ? null : (
              <button
                type="button"
                onClick={() => update(engageLock)}
                aria-label="화면 잠그기"
                title="화면 잠그기"
                className="ml-1 rounded-control p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <Lock className="size-4" aria-hidden />
              </button>
            )}

            <NavLink
              to="/settings"
              aria-label="설정"
              className={({ isActive }) =>
                [
                  'ml-1 rounded-control p-1.5 transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                ].join(' ')
              }
            >
              <Settings className="size-4" aria-hidden />
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {/* 라우트 단위 격리: 한 기능이 죽어도 헤더와 다른 기능은 살아 있다 */}
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <ToolsBar />

      {/* 전자칠판(/board/*)은 이 껍데기를 쓰지 않는다. 보여 주려고 띄운 화면이라 덮지 않는다. */}
      {data.isLocked ? <LockScreen onSubmit={handleUnlock} /> : null}
    </div>
  );
}
