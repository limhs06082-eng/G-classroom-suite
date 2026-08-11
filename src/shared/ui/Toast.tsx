import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { createId } from '../domain/factories';
import { Button } from './Button';
import { cx } from './cx';

/**
 * 알림.
 *
 * 원본 5개 앱이 Toast를 각자 4벌 구현했다. 그중 seating의 것이 유일하게
 * '실행 취소' 액션을 지원했는데, 이게 교사용 앱에서 가장 중요한 기능이다.
 * 수업 중 잘못 누른 점수·당번 배정을 되돌릴 마지막 기회이기 때문이다.
 * 통합본은 그 기능을 기본으로 삼는다.
 */

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  tone?: ToastTone;
  /** 0이면 자동으로 사라지지 않는다. */
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastItem extends Required<Pick<ToastOptions, 'tone' | 'durationMs'>> {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastApi {
  show: (message: string, options?: ToastOptions) => string;
  success: (message: string, options?: Omit<ToastOptions, 'tone'>) => string;
  error: (message: string, options?: Omit<ToastOptions, 'tone'>) => string;
  warning: (message: string, options?: Omit<ToastOptions, 'tone'>) => string;
  info: (message: string, options?: Omit<ToastOptions, 'tone'>) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (api === null) {
    throw new Error('useToast는 ToastProvider 안에서만 쓸 수 있습니다.');
  }
  return api;
}

/** 오류는 사용자가 읽고 닫을 때까지 남긴다. 실행 취소는 누를 시간을 준다. */
function defaultDuration(tone: ToastTone, hasAction: boolean): number {
  if (tone === 'error') return 0;
  if (hasAction) return 8000;
  return 4000;
}

const TONE_STYLES: Record<ToastTone, string> = {
  success: 'bg-success-50 text-success-700 border-success-200',
  error: 'bg-danger-50 text-danger-700 border-danger-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  info: 'bg-info-50 text-info-700 border-info-200',
};

const TONE_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string): void => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, options: ToastOptions = {}): string => {
      const tone = options.tone ?? 'info';
      const hasAction = options.actionLabel !== undefined && options.onAction !== undefined;
      const durationMs = options.durationMs ?? defaultDuration(tone, hasAction);
      const id = createId();

      const item: ToastItem = {
        id,
        message,
        tone,
        durationMs,
        ...(options.actionLabel === undefined ? {} : { actionLabel: options.actionLabel }),
        ...(options.onAction === undefined ? {} : { onAction: options.onAction }),
      };

      // 화면을 알림으로 덮지 않는다. 오래된 것부터 밀어낸다.
      setToasts((current) => [...current, item].slice(-4));

      if (durationMs > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), durationMs),
        );
      }

      return id;
    },
    [dismiss],
  );

  // 언마운트 시 남은 타이머를 정리한다.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (message, options) => show(message, { ...options, tone: 'success' }),
      error: (message, options) => show(message, { ...options, tone: 'error' }),
      warning: (message, options) => show(message, { ...options, tone: 'warning' }),
      info: (message, options) => show(message, { ...options, tone: 'info' }),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(<ToastViewport toasts={toasts} onDismiss={dismiss} />, document.body)}
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      // polite: 수업 중 화면 낭독을 끊지 않는다.
      aria-live="polite"
      aria-atomic="false"
      className="no-print pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => {
        const Icon = TONE_ICONS[toast.tone];
        return (
          <div
            key={toast.id}
            className={cx(
              'pointer-events-auto flex items-start gap-3 rounded-card border p-3 shadow-lg',
              TONE_STYLES[toast.tone],
            )}
          >
            <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1 text-sm leading-relaxed break-words">{toast.message}</p>

            <div className="flex shrink-0 items-center gap-1">
              {toast.actionLabel !== undefined && toast.onAction !== undefined ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    toast.onAction?.();
                    onDismiss(toast.id);
                  }}
                >
                  {toast.actionLabel}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                icon={X}
                iconOnly
                aria-label="알림 닫기"
                onClick={() => onDismiss(toast.id)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
