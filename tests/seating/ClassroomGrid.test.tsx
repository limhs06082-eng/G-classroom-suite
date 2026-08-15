import { fireEvent, render, screen } from '@testing-library/react';
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

describe('ClassroomGrid 자리 고정', () => {
  const seats = buildSeats(1, 2, []);
  const student = createStudent(
    { id: 's-1', classId: 'class-1', number: 1, name: '김하나' },
    NOW,
  );

  const props = {
    seats,
    cols: 2,
    studentBySeat: new Map([['r1c1', student]]),
    lockedStudentIds: new Set<string>(),
  };

  /*
   * 회귀 방지.
   *
   * 예전에는 자리 고정 버튼이 좌석 버튼의 자식이었다. 버튼 안의 버튼은
   * 유효하지 않은 HTML이고 브라우저마다 탭 순서와 화면 낭독기 동작이 달라진다.
   */
  it('자리 고정 버튼이 좌석 버튼 안에 들어가지 않는다', () => {
    render(<ClassroomGrid {...props} onToggleLock={() => {}} />);

    const lock = screen.getByLabelText('김하나 자리 고정');
    expect(lock.closest('button')).toBe(lock);
    expect(lock.parentElement?.closest('button')).toBeNull();
  });

  it('좌석과 자물쇠가 각각 눌린다', () => {
    const seatClicks: string[] = [];
    const lockToggles: string[] = [];

    render(
      <ClassroomGrid
        {...props}
        onSeatClick={(id) => seatClicks.push(id)}
        onToggleLock={(id) => lockToggles.push(id)}
      />,
    );

    fireEvent.click(screen.getByLabelText('김하나 자리 고정'));
    expect(lockToggles).toEqual(['s-1']);
    // 자물쇠를 눌렀는데 좌석까지 눌리면 안 된다.
    expect(seatClicks).toEqual([]);

    fireEvent.click(screen.getByLabelText(/1행 1열/));
    expect(seatClicks).toEqual(['r1c1']);
  });

  it('누를 수 없는 화면에서는 자물쇠가 버튼이 아니다', () => {
    render(
      <ClassroomGrid {...props} lockedStudentIds={new Set(['s-1'])} scale="board" />,
    );

    expect(screen.queryByLabelText(/자리 고정$/)).toBeNull();
    expect(screen.getByLabelText(/1행 1열/).textContent).toContain('김하나');
  });
});
