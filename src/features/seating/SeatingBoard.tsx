import { Crown } from 'lucide-react';
import { useState } from 'react';

import { Button, cx, EmptyState } from '../../shared/ui';
import { ClassroomGrid } from './ClassroomGrid';
import { groupColorStyle } from './groupColors';
import { useGrouping } from './useGrouping';
import { useSeating } from './useSeating';

type BoardView = 'seats' | 'groups';

/**
 * 전자칠판용 자리표·모둠표.
 *
 * 교사 화면과 같은 ClassroomGrid를 board 스케일로 쓴다.
 * 원본은 교사용과 학생 공개용을 따로 만들어 두 벌을 유지해야 했고,
 * 한쪽만 고치면 조용히 어긋났다.
 */
export function SeatingBoard() {
  const seating = useSeating();
  const grouping = useGrouping();
  const [view, setView] = useState<BoardView>('seats');

  return (
    <div className="flex flex-col gap-5">
      {/* 수업 중 칠판 앞에서 누르는 버튼이라 크게 둔다 */}
      <div className="flex gap-2">
        <Button
          size="lg"
          variant={view === 'seats' ? 'primary' : 'secondary'}
          aria-pressed={view === 'seats'}
          onClick={() => setView('seats')}
        >
          자리표
        </Button>
        <Button
          size="lg"
          variant={view === 'groups' ? 'primary' : 'secondary'}
          aria-pressed={view === 'groups'}
          onClick={() => setView('groups')}
        >
          모둠
        </Button>
      </div>

      {view === 'seats' ? (
        seating.positions.length === 0 ? (
          <EmptyState
            title="아직 배치된 자리가 없습니다"
            description="자리·모둠 화면에서 무작위 배치를 누르면 여기에 표시됩니다."
          />
        ) : (
          /*
           * perspective를 넘기지 않는다. 기본값 'student'로 그린다.
           * 이 화면은 학생이 보는 화면이다. 교사가 자기 화면을 교사 시점으로
           * 돌렸다고 여기까지 뒤집히면, 학생은 눈앞에 칠판을 두고 칠판이
           * 아래에 그려진 자리표를 보게 된다.
           */
          <ClassroomGrid
            seats={seating.seats}
            cols={seating.cols}
            studentBySeat={seating.studentBySeat}
            lockedStudentIds={seating.lockedStudentIds}
            scale="board"
          />
        )
      ) : grouping.groups.length === 0 ? (
        <EmptyState
          title="아직 편성된 모둠이 없습니다"
          description="자리·모둠 화면의 모둠 편성 탭에서 만들 수 있습니다."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grouping.groups.map((group) => {
            const style = groupColorStyle(group.color);
            const members = group.studentIds
              .map((id) => grouping.studentById.get(id))
              .filter((student) => student !== undefined)
              .sort((a, b) => a.number - b.number);

            return (
              <li key={group.id} className={cx('rounded-card border-4 p-4', style.card)}>
                <h2 className={cx('flex items-center gap-2 text-board-sm font-bold', style.text)}>
                  <span className={cx('size-4 shrink-0 rounded-full', style.dot)} aria-hidden />
                  {group.name}
                </h2>
                <ul className="mt-3 flex flex-col gap-1">
                  {members.map((student) => (
                    <li
                      key={student.id}
                      className="flex items-center gap-2 text-board-sm text-slate-900"
                    >
                      {group.leaderId === student.id ? (
                        <Crown className="size-6 shrink-0 text-amber-500" aria-label="모둠장" />
                      ) : null}
                      <span className="truncate">{student.name}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
