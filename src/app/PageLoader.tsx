/** 라우트 lazy 청크를 불러오는 동안 표시한다. */
export function PageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-500"
    >
      <div className="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" />
      <span className="text-sm">불러오는 중…</span>
    </div>
  );
}
