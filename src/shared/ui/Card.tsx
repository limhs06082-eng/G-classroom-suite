import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx } from './cx';

interface Props {
  title?: ReactNode;
  /** 제목 옆 아이콘. 기능 카드에서 영역 색과 함께 쓴다. */
  icon?: LucideIcon;
  /** 예: 'text-duty-500' — navigation.ts의 accentClass를 그대로 넘긴다. */
  accentClass?: string;
  /** 제목 줄 오른쪽 영역 (버튼·필터 등) */
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function Card({
  title,
  icon: Icon,
  accentClass,
  action,
  className,
  bodyClassName,
  children,
}: Props) {
  return (
    <section className={cx('rounded-card border border-slate-200 bg-surface shadow-card', className)}>
      {title === undefined && action === undefined ? null : (
        <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          {Icon ? <Icon className={cx('size-4 shrink-0', accentClass ?? 'text-slate-400')} aria-hidden /> : null}
          {/* 본문과 1px 차이다. 위계를 크기가 아니라 굵기로 만든다. */}
          <h2 className="min-w-0 truncate text-base font-semibold text-slate-900">{title}</h2>
          {action ? <div className="ml-auto shrink-0">{action}</div> : null}
        </header>
      )}
      <div className={cx('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
