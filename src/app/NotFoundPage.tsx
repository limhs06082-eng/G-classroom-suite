import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm font-medium text-slate-500">요청한 화면을 찾을 수 없습니다</p>
      <Link
        to="/"
        className="rounded-control bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-press"
      >
        홈으로 이동
      </Link>
    </div>
  );
}
