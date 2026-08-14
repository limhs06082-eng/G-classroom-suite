import { useId, type ReactNode } from 'react';

import { cx } from './cx';

export interface TabItem {
  id: string;
  label: string;
  /** 예: 미제출 5 — 숫자를 라벨 옆에 붙인다. */
  count?: number;
}

interface Props {
  items: readonly TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  children: ReactNode;
}

export function Tabs({ items, activeId, onChange, children }: Props) {
  const baseId = useId();

  // 좌우 화살표로 탭을 옮기는 것은 탭 위젯의 기본 동작이다.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    const index = items.findIndex((item) => item.id === activeId);
    if (index === -1) return;

    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = items[(index + delta + items.length) % items.length];
    if (next) {
      event.preventDefault();
      onChange(next.id);
    }
  };

  return (
    <div>
      <div
        role="tablist"
        onKeyDown={handleKeyDown}
        /*
         * overflow-y-hidden이 반드시 함께 있어야 한다.
         * overflow-x만 auto로 두면 CSS 규칙상 overflow-y도 auto가 되고,
         * 탭의 -mb-px 1px 때문에 쓸데없는 세로 스크롤바가 생긴다.
         */
        className="no-print flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200"
      >
        {items.map((item) => {
          const selected = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              className={cx(
                '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap',
                'transition-colors duration-[120ms] ease-out-soft',
                selected
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
              )}
            >
              {item.label}
              {item.count === undefined ? null : (
                <span className={cx('ml-1.5 text-xs', selected ? 'text-brand-500' : 'text-slate-400')}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${activeId}`}
        aria-labelledby={`${baseId}-tab-${activeId}`}
        className="pt-4"
      >
        {children}
      </div>
    </div>
  );
}
