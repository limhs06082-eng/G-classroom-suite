import { createId, createSeatingState } from '../../shared/domain/factories';
import type { SavedLayout, SeatingState, SuiteData } from '../../shared/domain/types';

/**
 * 자리표 저장·불러오기.
 *
 * 전부 순수 함수다. 화면은 useSuite().update로 결과를 넘기기만 한다.
 * rosterOps.ts·classOps.ts와 같은 방침이다.
 *
 * 설계 근거: docs/superpowers/specs/2026-08-14-seating-enhancements-design.md
 */

function nowIso(): string {
  return new Date().toISOString();
}

/** 그 학급 자리표만. 만든 순서대로 나온다. */
export function layoutsOf(data: SuiteData, classId: string): SavedLayout[] {
  return data.savedLayouts.filter((layout) => layout.classId === classId);
}

export function saveLayout(
  data: SuiteData,
  classId: string,
  name: string,
  now: string = nowIso(),
): SuiteData {
  const trimmed = name.trim();
  // 이름 없는 자리표는 목록에서 골라낼 수 없다.
  if (trimmed === '') return data;

  const state = data.seatingStates.find((item) => item.classId === classId);
  // 자리 배치를 한 번도 안 한 학급은 저장할 것이 없다.
  if (state === undefined) return data;

  const layout: SavedLayout = {
    id: createId(),
    classId,
    name: trimmed,
    rows: state.rows,
    cols: state.cols,
    // 배열을 복사한다. 저장 뒤 자리를 바꿔도 저장본은 그대로여야 한다.
    disabledSeatIds: [...state.disabledSeatIds],
    positions: state.positions.map((position) => ({ ...position })),
    createdAt: now,
  };

  return { ...data, savedLayouts: [...data.savedLayouts, layout] };
}

export function deleteLayout(data: SuiteData, layoutId: string): SuiteData {
  return { ...data, savedLayouts: data.savedLayouts.filter((layout) => layout.id !== layoutId) };
}

/**
 * 저장한 자리표를 지금 교실에 되돌린다.
 *
 * 저장 뒤 전학 간 학생이 자리를 붙들고 있으면 새 학생을 앉힐 자리가 없어진다.
 * 지금 명단에 없는 학생은 빼고, 몇 명이 빠졌는지 돌려준다. 화면이 알린다.
 */
export function applyLayout(
  data: SuiteData,
  layoutId: string,
  now: string = nowIso(),
): { data: SuiteData; droppedStudents: number } {
  const layout = data.savedLayouts.find((item) => item.id === layoutId);
  if (layout === undefined) return { data, droppedStudents: 0 };

  const enrolled = new Set(
    data.students
      .filter((student) => student.classId === layout.classId && student.status === 'active')
      .map((student) => student.id),
  );

  const positions = layout.positions.filter((position) => enrolled.has(position.studentId));
  const droppedStudents = layout.positions.length - positions.length;

  const existing = data.seatingStates.find((item) => item.classId === layout.classId);

  // 보는 방향은 기존 값을 그대로 둔다. 자리표에 딸린 정보가 아니다.
  const next: SeatingState = {
    ...(existing ?? createSeatingState(layout.classId, now)),
    rows: layout.rows,
    cols: layout.cols,
    disabledSeatIds: [...layout.disabledSeatIds],
    positions: positions.map((position) => ({ ...position })),
    updatedAt: now,
  };

  return {
    data: {
      ...data,
      seatingStates:
        existing === undefined
          ? [...data.seatingStates, next]
          : data.seatingStates.map((item) => (item.classId === layout.classId ? next : item)),
    },
    droppedStudents,
  };
}
