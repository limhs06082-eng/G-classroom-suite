import { ArrowRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { cx } from '../../shared/ui';

interface Props {
  to: string;
  label: string;
  icon: LucideIcon;
  /** 예: 'text-duty-500' */
  accentClass: string;
  /** 예: 'bg-duty-50' */
  tintClass: string;
  /** 아직 이식하지 않은 기능. 요약 대신 안내를 보여 준다. */
  pending?: boolean;
  /** 카드 아래쪽 링크 문구 */
  cta: string;
  children: ReactNode;
}

/**
 * 홈의 기능 요약 카드.
 *
 * 카드 하나가 곧 그 기능으로 가는 입구다. 교사가 아침에 이 화면만 보고
 * 오늘 무엇을 해야 하는지 알 수 있어야 한다.
 */
export function SummaryCard({
  to,
  label,
  icon: Icon,
  accentClass,
  tintClass,
  pending = false,
  cta,
  children,
}: Props) {
  return (
    <Link
      to={to}
      className={cx(
        'group flex flex-col rounded-card border border-slate-200 bg-white p-4 transition-colors',
        'hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cx('inline-flex size-8 items-center justify-center rounded-control', tintClass)}>
          <Icon className={cx('size-4', accentClass)} aria-hidden />
        </span>
        <h2 className="text-sm font-semibold text-slate-900">{label}</h2>
      </div>

      <div className={cx('mt-3 min-h-14 flex-1', pending && 'text-slate-400')}>{children}</div>

      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 group-hover:text-brand-700">
        {cta}
        <ArrowRight className="size-3.5" aria-hidden />
      </span>
    </Link>
  );
}

/** 아직 이식하지 않은 기능의 자리. 6단계에서는 대부분 이 상태다. */
export function PendingNote({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-slate-400">{children}</p>;
}

/** 숫자 하나를 크게 보여 주는 요약. 카드마다 같은 리듬을 유지한다. */
export function BigStat({ value, unit, note }: { value: number | string; unit?: string; note?: string }) {
  return (
    <div>
      <p className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {unit === undefined ? null : <span className="text-sm text-slate-500">{unit}</span>}
      </p>
      {note === undefined ? null : <p className="mt-1 text-sm text-slate-500">{note}</p>}
    </div>
  );
}
