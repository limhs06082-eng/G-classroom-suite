import { Settings } from 'lucide-react';
import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

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
  return (
    <div className="flex min-h-full flex-col">
      {/* 반투명 헤더는 스크롤할 때 본문 한글이 비쳐 읽기 어려워진다. 불투명으로 둔다. */}
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <span className="text-base font-bold tracking-tight text-slate-900">우리 반</span>

          {/* 5단계에서 실제 학기·학급 정보로 대체 */}
          <span className="hidden text-sm text-slate-500 sm:inline">학급 정보 미설정</span>

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
    </div>
  );
}
