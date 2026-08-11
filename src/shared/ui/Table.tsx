import type { ReactNode } from 'react';

import { cx } from './cx';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  align?: 'left' | 'center' | 'right';
  /** 예: 'w-16' */
  widthClass?: string;
  /** 좁은 화면에서 숨길 열. 명렬표에서 부가 정보 열에 쓴다. */
  hideOnNarrow?: boolean;
}

interface Props<T> {
  columns: ReadonlyArray<Column<T>>;
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** 행이 없을 때 자리. EmptyState를 넣는다. */
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  /** 명렬표처럼 행이 많을 때 촘촘하게 */
  dense?: boolean;
  caption?: string;
}

const ALIGN = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

export function Table<T>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
  dense = false,
  caption,
}: Props<T>) {
  if (rows.length === 0 && empty !== undefined) {
    return <>{empty}</>;
  }

  const cellPadding = dense ? 'px-2 py-1.5' : 'px-3 py-2.5';

  return (
    // 열이 많은 표는 페이지가 아니라 표 자신이 가로로 스크롤해야 한다.
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {caption === undefined ? null : <caption className="sr-only">{caption}</caption>}

        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(
                  cellPadding,
                  'bg-slate-50 font-semibold text-slate-600 whitespace-nowrap',
                  ALIGN[column.align ?? 'left'],
                  column.widthClass,
                  column.hideOnNarrow === true && 'hidden sm:table-cell',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick === undefined ? undefined : () => onRowClick(row)}
              className={cx(
                'border-b border-slate-100',
                onRowClick === undefined ? undefined : 'cursor-pointer hover:bg-slate-50',
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cx(
                    cellPadding,
                    'text-slate-800',
                    ALIGN[column.align ?? 'left'],
                    column.hideOnNarrow === true && 'hidden sm:table-cell',
                  )}
                >
                  {column.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
