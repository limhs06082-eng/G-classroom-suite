import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { cx } from '../../shared/ui';

interface Props {
  /** 그 기능으로 가는 길. 없으면 [열기 ↗]가 없다. */
  to?: string;
  label: string;
  icon: LucideIcon;
  /** 예: 'text-duty-500' */
  accentClass: string;
  /** 예: 'bg-duty-50' */
  tintClass: string;
  /** 아직 이식하지 않은 기능. 요약 대신 안내를 보여 준다. */
  pending?: boolean;
  /** [열기 ↗]의 이름. 예: '출결 열기' */
  cta: string;
  /** 머리 오른쪽에 두는 바로 하는 단추. 예: [전원 출석 확인], [+ 일정] */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * 홈의 기능 카드.
 *
 * 홈 2.0부터 카드는 링크가 아니라 **작업대**다 — 안에 입력칸과 단추가 있어
 * 홈에서 적고 끝낸다. 그 기능 화면으로는 머리의 [열기 ↗]로 간다. 머리
 * 오른쪽 끝은 HomeSlot의 [접기]가 쓰므로 비워 둔다(pr-7).
 */
export function SummaryCard({
  to,
  label,
  icon: Icon,
  accentClass,
  tintClass,
  pending = false,
  cta,
  action,
  children,
}: Props) {
  return (
    <section className="flex h-full flex-col rounded-card border border-slate-200 bg-surface p-3">
      <div className="flex items-center gap-2 pr-7">
        <span className={cx('inline-flex size-7 items-center justify-center rounded-control', tintClass)}>
          <Icon className={cx('size-4', accentClass)} aria-hidden />
        </span>
        <h2 className="text-sm font-semibold text-slate-900">{label}</h2>
        <div className="ml-auto flex items-center gap-1">
          {action}
          {to === undefined ? null : (
            <Link
              to={to}
              aria-label={cta}
              title={cta}
              className="rounded-control p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700"
            >
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      <div className={cx('mt-2 flex-1', pending && 'text-slate-400')}>{children}</div>
    </section>
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
        <span data-numeric className="text-2xl font-bold text-slate-900">{value}</span>
        {unit === undefined ? null : <span className="text-sm text-slate-500">{unit}</span>}
      </p>
      {note === undefined ? null : <p className="mt-0.5 text-sm text-slate-500">{note}</p>}
    </div>
  );
}
