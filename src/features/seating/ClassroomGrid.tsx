import { Lock, Plus } from 'lucide-react';

import type { SeatingPerspective, Student } from '../../shared/domain/types';
import { cx } from '../../shared/ui';
import { flipSeats, type Seat } from './types';

export type GridScale = 'desk' | 'board';
export type GridMode = 'assign' | 'layout';

interface Props {
  seats: readonly Seat[];
  cols: number;
  studentBySeat: Map<string, Student>;
  lockedStudentIds: Set<string>;
  scale?: GridScale;
  /** 'layout'이면 자리를 눌러 사용 안 함으로 바꾼다. */
  mode?: GridMode;
  selectedSeatId?: string | null;
  onSeatClick?: (seatId: string) => void;
  onToggleLock?: (studentId: string) => void;
  /** 'teacher'면 교탁에서 본 방향으로 뒤집어 그린다. 전자칠판은 넘기지 않는다. */
  perspective?: SeatingPerspective;
  /** 학생 이름 아래 번호를 함께 보일지 */
  showNumbers?: boolean;
}

/**
 * 교실 좌석 그림.
 *
 * 전자칠판에도 같은 컴포넌트를 쓴다. scale='board'면 타이포와 여백이 커진다.
 * 원본은 교사 화면용과 학생 공개용을 따로 만들어 두 벌을 유지해야 했다.
 */
export function ClassroomGrid({
  seats,
  cols,
  studentBySeat,
  lockedStudentIds,
  scale = 'desk',
  mode = 'assign',
  selectedSeatId = null,
  onSeatClick,
  onToggleLock,
  perspective = 'student',
  showNumbers = true,
}: Props) {
  const isBoard = scale === 'board';
  const isTeacher = perspective === 'teacher';

  /*
   * 칠판 막대는 DOM 순서를 그대로 두고 flex-col-reverse로 아래에 보낸다.
   * 좌석은 배열을 뒤집는다. 둘이 함께여야 180도 회전이 완성된다.
   */
  const ordered = isTeacher ? flipSeats(seats) : seats;

  return (
    <div className={cx('flex items-center gap-3', isTeacher ? 'flex-col-reverse' : 'flex-col')}>
      {/* 방향을 알려 주지 않으면 앞뒤가 뒤집힌 배치표가 나온다 */}
      <div
        className={cx(
          'ink w-full rounded-control bg-slate-800 text-center font-semibold text-white',
          isBoard ? 'py-3 text-board-sm' : 'py-1.5 text-sm',
        )}
      >
        칠판
      </div>

      <div
        className={cx('grid w-full', isBoard ? 'gap-3' : 'gap-2')}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {ordered.map((seat) => {
          const student = studentBySeat.get(seat.id);
          const isSelected = selectedSeatId === seat.id;
          const isLocked = student !== undefined && lockedStudentIds.has(student.id);

          if (seat.isDisabled) {
            return (
              <SeatShell
                key={seat.id}
                isBoard={isBoard}
                onClick={mode === 'layout' ? () => onSeatClick?.(seat.id) : undefined}
                className="border-dashed border-slate-200 bg-slate-50 text-slate-300"
                label={`${seat.row}행 ${seat.column}열, 사용 안 함`}
              >
                <span className={isBoard ? 'text-board-sm' : 'text-xs'}>—</span>
              </SeatShell>
            );
          }

          return (
            <SeatShell
              key={seat.id}
              isBoard={isBoard}
              onClick={onSeatClick === undefined ? undefined : () => onSeatClick(seat.id)}
              className={cx(
                isSelected
                  ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500'
                  : student
                    ? 'border-slate-200 bg-surface'
                    : 'border-slate-200 bg-slate-50',
              )}
              label={
                student
                  ? `${seat.row}행 ${seat.column}열, ${student.number}번 ${student.name}${isLocked ? ', 자리 고정됨' : ''}`
                  : `${seat.row}행 ${seat.column}열, 빈자리`
              }
              overlay={
                student !== undefined && onToggleLock !== undefined ? (
                  <button
                    type="button"
                    onClick={() => onToggleLock(student.id)}
                    aria-label={`${student.name} 자리 ${isLocked ? '고정 해제' : '고정'}`}
                    aria-pressed={isLocked}
                    className={cx(
                      'absolute top-1 right-1 rounded p-0.5 transition-colors duration-[120ms]',
                      isLocked
                        ? 'text-brand-600 hover:text-brand-700'
                        : 'text-slate-300 hover:text-slate-500',
                    )}
                  >
                    <Lock className="size-3.5" aria-hidden />
                  </button>
                ) : undefined
              }
            >
              {student ? (
                <>
                  {showNumbers ? (
                    <span
                      className={cx(
                        'font-mono text-slate-400',
                        isBoard ? 'text-board-sm' : 'text-xs',
                      )}
                    >
                      {student.number}
                    </span>
                  ) : null}
                  <span
                    className={cx(
                      'w-full truncate text-center font-medium text-slate-900',
                      isBoard ? 'text-board-base' : 'text-sm',
                    )}
                  >
                    {student.name}
                  </span>

                  {/* 누를 수 없는 화면(전자칠판·인쇄)에서는 자물쇠를 그림으로만 보인다. */}
                  {onToggleLock === undefined && isLocked ? (
                    <Lock
                      className={cx('text-brand-500', isBoard ? 'size-6' : 'size-3.5')}
                      aria-hidden
                    />
                  ) : null}
                </>
              ) : (
                <Plus
                  className={cx('text-slate-300', isBoard ? 'size-8' : 'size-4')}
                  aria-hidden
                />
              )}
            </SeatShell>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 좌석 한 칸.
 *
 * `overlay`는 칸 위에 얹히지만 DOM에서는 **형제**다. 예전에는 자리 고정
 * 버튼을 좌석 버튼의 자식으로 넣었는데, 버튼 안의 버튼은 유효하지 않은
 * HTML이고 브라우저마다 탭 순서와 화면 낭독기 동작이 달라진다.
 * 겹쳐 보이는 것은 위치(absolute)로 만들고 구조는 나란히 둔다.
 */
function SeatShell({
  isBoard,
  onClick,
  className,
  label,
  overlay,
  children,
}: {
  isBoard: boolean;
  onClick?: (() => void) | undefined;
  className?: string;
  label: string;
  overlay?: React.ReactNode;
  children: React.ReactNode;
}) {
  const shared = cx(
    'flex size-full flex-col items-center justify-center rounded-control border',
    isBoard ? 'min-h-24 gap-1 p-2' : 'min-h-16 gap-0.5 p-1.5',
    className,
  );

  const seat =
    onClick === undefined ? (
      <div className={shared} aria-label={label}>
        {children}
      </div>
    ) : (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cx(shared, 'hover:border-slate-400')}
      >
        {children}
      </button>
    );

  if (overlay === undefined) return seat;

  return (
    <div className="relative">
      {seat}
      {overlay}
    </div>
  );
}
