import { Check, ChevronDown, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  useActiveClass,
  useActiveTerm,
  useRoster,
  useSuite,
} from '../shared/roster/SuiteDataProvider';
import { cx } from '../shared/ui';

/**
 * 헤더의 학기·학급 표시와 전환.
 *
 * 담임은 학급이 하나뿐이라 이 버튼을 누를 일이 없다. 그래서 학급이 하나면
 * 드롭다운을 열 수 있는 버튼이 아니라 그냥 글자로만 보여 준다.
 * 교과 전담처럼 여러 반을 오가는 경우에만 전환 목록이 나타난다.
 */
export function ClassSwitcher() {
  const { data, update } = useSuite();
  const term = useActiveTerm();
  const activeClass = useActiveClass();
  const roster = useRoster();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  if (activeClass === null) {
    return (
      <Link to="/setup" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        학급 설정하기
      </Link>
    );
  }

  const siblings = data.classRooms.filter((room) => room.termId === activeClass.termId);
  const summary = (
    <>
      <span className="font-medium text-slate-800">{activeClass.name}</span>
      <span className="text-slate-400"> · </span>
      <span className="text-slate-500">{roster.length}명</span>
    </>
  );

  if (siblings.length <= 1) {
    return (
      <div className="hidden min-w-0 items-baseline gap-1.5 text-sm sm:flex">
        {term === null ? null : <span className="truncate text-slate-500">{term.name}</span>}
        <span className="truncate">{summary}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative hidden min-w-0 sm:block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex max-w-full items-center gap-1.5 rounded-control px-2 py-1 text-sm hover:bg-slate-100"
      >
        <Users className="size-4 shrink-0 text-slate-400" aria-hidden />
        <span className="truncate">{summary}</span>
        <ChevronDown className="size-4 shrink-0 text-slate-400" aria-hidden />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="학급 전환"
          className="absolute left-0 z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-card border border-slate-200 bg-white py-1 shadow-lg"
        >
          {siblings.map((room) => {
            const selected = room.id === activeClass.id;
            const count = data.students.filter(
              (student) => student.classId === room.id && student.status === 'active',
            ).length;

            return (
              <li key={room.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    update((current) => ({ ...current, activeClassId: room.id }));
                    setOpen(false);
                  }}
                  className={cx(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50',
                    selected ? 'font-medium text-brand-700' : 'text-slate-700',
                  )}
                >
                  <Check
                    className={cx('size-4 shrink-0', selected ? 'text-brand-600' : 'text-transparent')}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{room.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">{count}명</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
