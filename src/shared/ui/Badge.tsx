import type { ReactNode } from 'react';

import { cx } from './cx';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

interface Props {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}

/*
 * 상태 표시는 색만으로 구분하지 않는다. 반드시 글자를 함께 둔다.
 * 색각 이상이 있는 교사도, 흑백 인쇄물에서도 읽혀야 한다.
 */
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  success: 'bg-success-50 text-success-700 border-success-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  danger: 'bg-danger-50 text-danger-700 border-danger-200',
  info: 'bg-info-50 text-info-700 border-info-200',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
};

export function Badge({ tone = 'neutral', className, children }: Props) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
