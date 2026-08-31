import { useCallback, useMemo } from 'react';

import { createSeatingState } from '../../shared/domain/factories';
import {
  MAX_SEAT_COLS,
  MAX_SEAT_ROWS,
  MIN_SEAT_COLS,
  MIN_SEAT_ROWS,
  type SavedLayout,
  type SeatingPerspective,
  type SeatingState,
  type Student,
  type StudentPosition,
  type SuiteData,
} from '../../shared/domain/types';
import { useActiveClass, useRoster, useSuite } from '../../shared/roster/SuiteDataProvider';
import { applyLayout, deleteLayout, layoutsOf, saveLayout } from './layoutOps';
import { performRandomSeating } from './seatingCore';
import { buildSeats, type Seat } from './types';

/**
 * 자리 배치 화면과 저장소를 잇는 훅.
 *
 * 화면 컴포넌트는 localStorage를 모른다. 여기서도 모른다.
 * 전부 useSuite().update를 거치므로, 나중에 FirestoreAdapter로 바꿔도
 * 이 파일과 화면 파일은 그대로다.
 */

function upsertSeatingState(
  data: SuiteData,
  classId: string,
  recipe: (state: SeatingState) => SeatingState,
  now: string,
): SuiteData {
  const existing = data.seatingStates.find((state) => state.classId === classId);
  const base = existing ?? createSeatingState(classId, now);
  const next = { ...recipe(base), updatedAt: now };

  return {
    ...data,
    seatingStates: existing
      ? data.seatingStates.map((state) => (state.classId === classId ? next : state))
      : [...data.seatingStates, next],
  };
}

function clampRows(value: number): number {
  return Math.max(MIN_SEAT_ROWS, Math.min(MAX_SEAT_ROWS, Math.round(value)));
}

function clampCols(value: number): number {
  return Math.max(MIN_SEAT_COLS, Math.min(MAX_SEAT_COLS, Math.round(value)));
}

export interface SeatingView {
  classId: string | null;
  rows: number;
  cols: number;
  seats: Seat[];
  /** 재학 중인 학생의 배치만. 전출생은 자리를 차지하지 않는다. */
  positions: StudentPosition[];
  /** 좌석 id → 학생 */
  studentBySeat: Map<string, Student>;
  /** 아직 자리가 없는 재학생 */
  unseated: Student[];
  lockedStudentIds: Set<string>;
  roster: Student[];
  /** 교사 화면에서 자리표를 보는 방향. 전자칠판은 이 값을 쓰지 않는다. */
  perspective: SeatingPerspective;
  /** 이 학급에 저장해 둔 자리표 */
  layouts: SavedLayout[];

  setSize: (rows: number, cols: number) => void;
  setPerspective: (next: SeatingPerspective) => void;
  toggleSeatDisabled: (seatId: string) => void;
  toggleLock: (studentId: string) => void;
  shuffleSeats: () => { ok: boolean; message?: string };
  /** 배치 통째 복원 — 무작위 배치·불러오기의 실행 취소용 */
  restorePositions: (previous: StudentPosition[]) => void;
  swapSeats: (seatA: string, seatB: string) => void;
  assignStudent: (studentId: string, seatId: string) => void;
  clearSeats: () => Promise<void>;

  /** 이름이 비었거나 저장할 배치가 없으면 false */
  saveCurrentLayout: (name: string) => boolean;
  loadLayout: (layoutId: string) => { droppedStudents: number };
  removeLayout: (layoutId: string) => void;
}

export function useSeating(): SeatingView {
  const { data, update, guard } = useSuite();
  const activeClass = useActiveClass();
  const roster = useRoster();

  const classId = activeClass?.id ?? null;
  const state = useMemo(
    () => (classId === null ? null : (data.seatingStates.find((s) => s.classId === classId) ?? null)),
    [data.seatingStates, classId],
  );

  const rows = state?.rows ?? 5;
  const cols = state?.cols ?? 6;
  const disabledSeatIds = useMemo(() => state?.disabledSeatIds ?? [], [state]);
  const perspective: SeatingPerspective = state?.perspective ?? 'student';

  const layouts = useMemo(
    () => (classId === null ? [] : layoutsOf(data, classId)),
    [data, classId],
  );

  const seats = useMemo(() => buildSeats(rows, cols, disabledSeatIds), [rows, cols, disabledSeatIds]);

  const rosterById = useMemo(() => new Map(roster.map((s) => [s.id, s])), [roster]);

  // 전출생이 자리를 붙들고 있으면 새 학생을 앉힐 자리가 없어진다.
  const positions = useMemo(
    () => (state?.positions ?? []).filter((p) => rosterById.has(p.studentId)),
    [state, rosterById],
  );

  const studentBySeat = useMemo(() => {
    const map = new Map<string, Student>();
    for (const position of positions) {
      const student = rosterById.get(position.studentId);
      if (student) map.set(position.seatId, student);
    }
    return map;
  }, [positions, rosterById]);

  const unseated = useMemo(() => {
    const seated = new Set(positions.map((p) => p.studentId));
    return roster.filter((student) => !seated.has(student.id));
  }, [positions, roster]);

  const lockedStudentIds = useMemo(
    () => new Set(data.seatingProfiles.filter((p) => p.isLocked).map((p) => p.studentId)),
    [data.seatingProfiles],
  );

  const mutate = useCallback(
    (recipe: (state: SeatingState) => SeatingState): void => {
      if (classId === null) return;
      const now = new Date().toISOString();
      update((current) => upsertSeatingState(current, classId, recipe, now));
    },
    [classId, update],
  );

  const setSize = useCallback(
    (nextRows: number, nextCols: number): void => {
      const r = clampRows(nextRows);
      const c = clampCols(nextCols);
      mutate((prev) => ({
        ...prev,
        rows: r,
        cols: c,
        // 줄어든 교실 밖으로 밀려난 학생은 불변조건 검사가 자리를 비우고 알려 준다.
      }));
    },
    [mutate],
  );

  const setPerspective = useCallback(
    (next: SeatingPerspective): void => {
      mutate((prev) => ({ ...prev, perspective: next }));
    },
    [mutate],
  );

  const toggleSeatDisabled = useCallback(
    (seatId: string): void => {
      mutate((prev) => {
        const disabled = new Set(prev.disabledSeatIds);
        if (disabled.has(seatId)) disabled.delete(seatId);
        else disabled.add(seatId);

        return {
          ...prev,
          disabledSeatIds: [...disabled],
          // 사용 안 함으로 바꾼 자리에 앉아 있던 학생은 자리에서 뺀다.
          positions: prev.positions.filter((p) => !disabled.has(p.seatId)),
        };
      });
    },
    [mutate],
  );

  const toggleLock = useCallback(
    (studentId: string): void => {
      update((current) => ({
        ...current,
        seatingProfiles: current.seatingProfiles.map((profile) =>
          profile.studentId === studentId ? { ...profile, isLocked: !profile.isLocked } : profile,
        ),
      }));
    },
    [update],
  );

  /**
   * 배치를 통째로 되돌린다. 무작위 배치·자리표 불러오기의 실행 취소가 쓴다.
   *
   * 시력·교우관계를 30분 걸려 맞춘 배치가 오탭 한 번에 사라지는 것을
   * 확인창 대신 실행 취소로 막는다 — 무작위 배치는 하루에도 몇 번 누르는
   * 버튼이라 매번 확인을 물으면 그게 더 성가시다.
   */
  const restorePositions = useCallback(
    (previous: StudentPosition[]): void => {
      mutate((prev) => ({ ...prev, positions: previous }));
    },
    [mutate],
  );

  const shuffleSeats = useCallback((): { ok: boolean; message?: string } => {
    const result = performRandomSeating(
      roster.map((student) => ({ id: student.id, isLocked: lockedStudentIds.has(student.id) })),
      seats,
      positions,
    );

    if (!result.ok) return { ok: false, ...(result.message === undefined ? {} : { message: result.message }) };

    mutate((prev) => ({ ...prev, positions: result.positions }));
    return { ok: true };
  }, [roster, lockedStudentIds, seats, positions, mutate]);

  const swapSeats = useCallback(
    (seatA: string, seatB: string): void => {
      if (seatA === seatB) return;

      mutate((prev) => {
        const next = prev.positions.map((position) => {
          if (position.seatId === seatA) return { ...position, seatId: seatB };
          if (position.seatId === seatB) return { ...position, seatId: seatA };
          return position;
        });
        return { ...prev, positions: next };
      });
    },
    [mutate],
  );

  const assignStudent = useCallback(
    (studentId: string, seatId: string): void => {
      mutate((prev) => {
        // 그 자리에 앉아 있던 학생과 옮겨 오는 학생의 자리를 맞바꾼다.
        const occupant = prev.positions.find((p) => p.seatId === seatId);
        const previousSeat = prev.positions.find((p) => p.studentId === studentId)?.seatId;

        const without = prev.positions.filter(
          (p) => p.studentId !== studentId && p.seatId !== seatId,
        );

        const next = [...without, { studentId, seatId }];
        if (occupant && previousSeat !== undefined) {
          next.push({ studentId: occupant.studentId, seatId: previousSeat });
        }

        return { ...prev, positions: next };
      });
    },
    [mutate],
  );

  const clearSeats = useCallback(async (): Promise<void> => {
    // 배치를 지우는 건 되돌리기 어렵다. 직전 상태를 남긴다.
    await guard('자리 배치 초기화 직전');
    mutate((prev) => ({ ...prev, positions: [] }));
  }, [guard, mutate]);

  const saveCurrentLayout = useCallback(
    (name: string): boolean => {
      if (classId === null) return false;

      const now = new Date().toISOString();
      // saveLayout은 저장할 것이 없으면 받은 데이터를 그대로 돌려준다.
      // 그 판정을 update 밖에서 미리 해 둔다. 화면이 결과를 알아야 한다.
      const saved = saveLayout(data, classId, name, now) !== data;
      if (!saved) return false;

      update((current) => saveLayout(current, classId, name, now));
      return true;
    },
    [classId, data, update],
  );

  const loadLayout = useCallback(
    (layoutId: string): { droppedStudents: number } => {
      const now = new Date().toISOString();
      // 몇 명이 빠졌는지는 화면이 알려야 하므로 update 밖에서 한 번 더 계산한다.
      const preview = applyLayout(data, layoutId, now);

      update((current) => applyLayout(current, layoutId, now).data);

      return { droppedStudents: preview.droppedStudents };
    },
    [data, update],
  );

  const removeLayout = useCallback(
    (layoutId: string): void => {
      update((current) => deleteLayout(current, layoutId));
    },
    [update],
  );

  return {
    classId,
    rows,
    cols,
    seats,
    positions,
    studentBySeat,
    unseated,
    lockedStudentIds,
    roster,
    perspective,
    layouts,
    setSize,
    setPerspective,
    toggleSeatDisabled,
    toggleLock,
    shuffleSeats,
    restorePositions,
    swapSeats,
    assignStudent,
    clearSeats,
    saveCurrentLayout,
    loadLayout,
    removeLayout,
  };
}
