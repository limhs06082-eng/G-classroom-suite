import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  icon?: LucideIcon;
  title: string;
  /** 다음에 무엇을 하면 되는지 알려 준다. 비어 있다는 사실만 알리면 막다른 길이 된다. */
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {Icon ? <Icon className="size-8 text-slate-300" aria-hidden /> : null}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description === undefined ? null : (
        <p className="max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
      )}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
