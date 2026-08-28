import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  /** 진행 중 표시. 자동으로 disabled가 된다. */
  loading?: boolean;
  /** 아이콘만 두는 버튼. aria-label을 반드시 함께 준다. */
  iconOnly?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
  secondary:
    'border border-slate-300 bg-surface text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400',
  danger: 'bg-danger-500 text-white hover:bg-danger-700 disabled:bg-danger-200',
};

/*
 * 크기 하한에 주의한다. 교사는 수업 중 서서 조작하고, 전자칠판은 손가락으로 누른다.
 * md 이상은 최소 40px 높이를 유지해 터치 타깃을 확보한다.
 */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-sm gap-1.5',
  md: 'h-10 px-3.5 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
};

const ICON_SIZES: Record<ButtonSize, string> = {
  sm: 'size-4',
  md: 'size-4',
  lg: 'size-5',
};

const ICON_ONLY_SIZES: Record<ButtonSize, string> = {
  sm: 'size-8 p-0',
  md: 'size-10 p-0',
  lg: 'size-12 p-0',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon: Icon,
    loading = false,
    iconOnly = false,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const DisplayIcon = loading ? Loader2 : Icon;

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center rounded-control font-medium',
        // 누르면 반응이 있어야 한다. 짧게, 한 종류로.
        'transition-[background-color,box-shadow,transform] duration-[120ms] ease-out-soft',
        'active:scale-[0.98]',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        iconOnly ? ICON_ONLY_SIZES[size] : SIZES[size],
        className,
      )}
      {...rest}
    >
      {DisplayIcon ? (
        <DisplayIcon className={cx(ICON_SIZES[size], loading && 'animate-spin')} aria-hidden />
      ) : null}
      {iconOnly ? null : children}
    </button>
  );
});
