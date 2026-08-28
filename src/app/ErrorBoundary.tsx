import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** 오류 화면 제목. 라우트별로 "당번 화면에 문제가 생겼습니다"처럼 구체적으로 준다. */
  title?: string;
  /** 이 경계 안쪽만 다시 그리도록 초기화한다. 없으면 새로고침 버튼만 보인다. */
  onReset?: () => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 오류 격리 경계.
 *
 * 원본 앱 5개 중 assignment·reward에는 ErrorBoundary가 아예 없었다.
 * 통합본은 전역(RootErrorBoundary)과 라우트 단위 두 곳에 모두 건다.
 * 한 기능이 죽어도 나머지 기능과 저장된 데이터는 살아 있어야 한다.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // 사용자가 화면을 캡처해 문의할 수 있도록 콘솔에는 원문을 남긴다.
    console.error('[classroom-suite] 렌더링 오류', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  override render(): ReactNode {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    const title = this.props.title ?? '화면을 표시하는 중 문제가 생겼습니다';

    return (
      <div role="alert" className="flex min-h-64 items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-card border border-danger-500/30 bg-surface p-6 shadow-card">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger-500" aria-hidden />
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                저장된 데이터는 그대로 있습니다. 아래 버튼으로 다시 시도해 주세요. 문제가 반복되면
                설정 화면에서 데이터를 내보내 백업한 뒤 문의해 주세요.
              </p>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">
                  오류 내용 보기
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded-control bg-slate-100 p-3 text-xs text-slate-700">
                  {error.message}
                </pre>
              </details>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="inline-flex items-center gap-1.5 rounded-control bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-press"
                >
                  <RotateCcw className="size-4" aria-hidden />
                  다시 시도
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-control border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  새로고침
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
