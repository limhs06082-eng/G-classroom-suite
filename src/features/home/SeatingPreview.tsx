import { useSuite } from '../../shared/roster/SuiteDataProvider';
import { cx } from '../../shared/ui';
import { groupColorStyle } from '../seating/groupColors';
import { flipSeats } from '../seating/types';
import { useSeating } from '../seating/useSeating';

/**
 * 홈 자리·모둠 카드 안의 작은 자리표. 읽기만 한다.
 *
 * 카드 전체가 링크라 단추를 두지 않는다 — 누르면 자리 화면으로 간다.
 * 교사 시점이면 자리 화면과 같은 방향으로 뒤집고 칠판 표시를 아래로 둔다.
 * 모둠이 있으면 칸에 모둠 색을 묻힌다 — 자리 화면에서 보던 그 색이다.
 */
export function SeatingPreview() {
  const seating = useSeating();
  const { data } = useSuite();

  if (seating.positions.length === 0) {
    return <p className="mt-3 text-xs text-slate-400">아직 자리를 배치하지 않았습니다.</p>;
  }

  const colorByStudent = new Map<string, string>();
  for (const group of data.groups) {
    if (group.classId !== seating.classId) continue;
    for (const studentId of group.studentIds) colorByStudent.set(studentId, group.color);
  }

  const teacherView = seating.perspective === 'teacher';
  const seats = teacherView ? flipSeats(seating.seats) : seating.seats;
  const boardMark = (
    <p className="text-center text-[10px] text-slate-400">{teacherView ? '▼ 칠판 쪽' : '▲ 칠판 쪽'}</p>
  );

  return (
    <div className="mt-3 flex flex-col gap-1" role="group" aria-label="자리표 미리보기">
      {teacherView ? null : boardMark}
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${seating.cols}, minmax(0, 1fr))` }}
      >
        {seats.map((seat) => {
          const student = seating.studentBySeat.get(seat.id);
          const color = student === undefined ? undefined : colorByStudent.get(student.id);
          const what = seat.isDisabled
            ? '사용 안 함'
            : student === undefined
              ? '빈자리'
              : `${student.number}번 ${student.name}`;
          return (
            <div
              key={seat.id}
              aria-label={`${seat.row}행 ${seat.column}열, ${what}`}
              className={cx(
                'flex h-7 min-w-0 items-center justify-center truncate rounded border px-1 text-[11px]',
                seat.isDisabled && 'border-transparent bg-slate-200',
                !seat.isDisabled && student === undefined && 'border-dashed border-slate-200 text-slate-300',
                !seat.isDisabled && student !== undefined && color === undefined && 'border-slate-200 bg-surface text-slate-800',
                !seat.isDisabled && student !== undefined && color !== undefined && groupColorStyle(color).card,
                !seat.isDisabled && student !== undefined && color !== undefined && groupColorStyle(color).text,
              )}
            >
              {seat.isDisabled ? '' : (student?.name ?? '')}
            </div>
          );
        })}
      </div>
      {teacherView ? boardMark : null}
    </div>
  );
}
