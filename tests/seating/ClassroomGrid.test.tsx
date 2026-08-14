import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ClassroomGrid } from '../../src/features/seating/ClassroomGrid';
import { buildSeats } from '../../src/features/seating/types';
import { createStudent } from '../../src/shared/domain/factories';

const NOW = '2026-08-14T09:00:00.000Z';

/** 좌석 칸의 aria-label을 그려진 순서대로 모은다. */
function seatLabels(): string[] {
  return screen
    .getAllByLabelText(/\d+행 \d+열/)
    .map((element) => element.getAttribute('aria-label') ?? '');
}

describe('ClassroomGrid 시점', () => {
  const seats = buildSeats(2, 2, []);
  const studentBySeat = new Map([
    ['r1c1', createStudent({ id: 's-1', classId: 'class-1', number: 1, name: '김하나' }, NOW)],
  ]);

  const props = {
    seats,
    cols: 2,
    studentBySeat,
    lockedStudentIds: new Set<string>(),
  };

  it('기본값은 학생 시점이다 — 1행 1열이 먼저 그려진다', () => {
    render(<ClassroomGrid {...props} />);

    expect(seatLabels()[0]).toContain('1행 1열');
    expect(seatLabels()[3]).toContain('2행 2열');
  });

  it('교사 시점이면 좌석 순서가 뒤집힌다', () => {
    render(<ClassroomGrid {...props} perspective="teacher" />);

    expect(seatLabels()[0]).toContain('2행 2열');
    expect(seatLabels()[3]).toContain('1행 1열');
  });

  it('교사 시점이면 칠판이 아래로 간다', () => {
    const { container } = render(<ClassroomGrid {...props} perspective="teacher" />);

    expect(container.firstElementChild?.className).toContain('flex-col-reverse');
  });

  it('학생 시점에서는 칠판이 위에 남는다', () => {
    const { container } = render(<ClassroomGrid {...props} />);

    expect(container.firstElementChild?.className).not.toContain('flex-col-reverse');
  });

  it('뒤집어도 학생은 원래 자리에 그려진다', () => {
    render(<ClassroomGrid {...props} perspective="teacher" />);

    // 김하나는 1행 1열에 앉아 있다. 화면에서는 마지막 칸이지만 좌석은 그대로다.
    expect(seatLabels()[3]).toContain('김하나');
  });
});
