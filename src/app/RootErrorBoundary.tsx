import { AlertTriangle } from 'lucide-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

/**
 * 라우터 최상위 오류 화면.
 *
 * AppShell 자체가 렌더링에 실패했거나 라우팅이 깨진 경우에 표시된다.
 * 이 화면에서도 "설정 → 데이터 내보내기"로 갈 수 있어야 하므로 링크를 남긴다.
 */
export function RootErrorBoundary() {
  const error = useRouteError();

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : '알 수 없는 오류';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-card border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger-500" aria-hidden />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900">앱을 여는 중 문제가 생겼습니다</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              저장된 학급 데이터는 브라우저에 그대로 남아 있습니다. 새로고침해도 같은 화면이 나오면
              설정 화면에서 데이터를 내보내 백업해 두세요.
            </p>

            <pre className="mt-3 max-h-40 overflow-auto rounded-control bg-slate-100 p-3 text-xs text-slate-700">
              {message}
            </pre>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-control bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                새로고침
              </button>
              <Link
                to="/settings"
                className="rounded-control border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                설정으로 이동
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
