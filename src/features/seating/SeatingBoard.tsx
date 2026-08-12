import { EmptyState } from '../../shared/ui';
import { ClassroomGrid } from './ClassroomGrid';
import { useSeating } from './useSeating';

/**
 * 전자칠판용 좌석표.
 *
 * 교사 화면과 같은 ClassroomGrid를 board 스케일로 쓴다.
 * 원본은 교사용과 학생 공개용을 따로 만들어 두 벌을 유지해야 했고,
 * 한쪽만 고치면 조용히 어긋났다.
 */
export function SeatingBoard() {
  const seating = useSeating();

  if (seating.positions.length === 0) {
    return (
      <EmptyState
        title="아직 배치된 자리가 없습니다"
        description="자리·모둠 화면에서 무작위 배치를 누르면 여기에 표시됩니다."
      />
    );
  }

  return (
    <ClassroomGrid
      seats={seating.seats}
      cols={seating.cols}
      studentBySeat={seating.studentBySeat}
      lockedStudentIds={seating.lockedStudentIds}
      scale="board"
      // 칠판에서는 누르는 조작을 막는다. 학생들이 보는 화면이다.
      showNumbers
    />
  );
}
