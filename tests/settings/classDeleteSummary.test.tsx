import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createClassRoom,
  createEmptySuiteData,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { ClassTermTab } from '../../src/features/settings/ClassTermTab';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

/*
 * 삭제 확인창은 세는 것과 지우는 것을 잇는 네 번째 자리다.
 *
 * classOps.ts 머리말이 규칙을 못 박아 두었다 — 세는 항목과 지우는 항목은
 * 반드시 같아야 한다. 그런데 그 둘이 맞아도 **교사에게 안 보여 주면** 규칙이
 * 지키려던 것을 못 지킨다. 손으로 서른다섯 칸을 채운 시간표가 목록에서
 * 빠지면, 교사는 그것이 사라지는 줄 모르고 확인을 누른다.
 *
 * classOps.test.ts는 세기와 지우기가 맞는지만 본다. 안내 문장에서 한 줄을
 * 지워도 그쪽 시험은 전부 통과한다. 그 구멍을 여기서 막는다.
 */

const NOW = '2026-08-26T09:00:00.000Z';

function seeded(): SuiteData {
  const term = createTerm(
    {
      id: 'term-1',
      schoolYear: '2026',
      semester: '2학기',
      startDate: '2026-08-17',
      endDate: '2027-01-05',
    },
    NOW,
  );
  const room = createClassRoom({ termId: term.id, name: '3학년 2반' }, NOW);
  // 학급이 하나뿐이면 삭제 단추가 아예 안 나온다. 지울 수 있는 상태를 만든다.
  const other = createClassRoom({ termId: term.id, name: '3학년 3반' }, NOW);

  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room, other],
    students: [createStudent({ classId: room.id, number: 1, name: '김하나' }, NOW)],
    activeTermId: term.id,
    activeClassId: room.id,
    timetableEntries: [
      { classId: room.id, weekday: 1, period: 1, subject: '국어' },
      { classId: room.id, weekday: 1, period: 2, subject: '수학' },
      { classId: room.id, weekday: 2, period: 1, subject: '체육' },
      // 옆 반 것은 세면 안 된다. 세 칸이라고 말해야 한다.
      { classId: other.id, weekday: 1, period: 1, subject: '영어' },
    ],
  };
}

function show(data: SuiteData = seeded()) {
  return render(
    <ToastProvider>
      <SuiteDataProvider
        adapter={stubAdapter({ load: async () => ({ data, repairs: [], isFirstRun: false }) })}
      >
        <ClassTermTab />
      </SuiteDataProvider>
    </ToastProvider>,
  );
}

async function openDelete(): Promise<void> {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: '3학년 2반 삭제' }));
}

describe('학급 삭제 안내', () => {
  it('시간표가 몇 칸 사라지는지 말해 준다', async () => {
    show();

    await openDelete();

    expect(await screen.findByText(/시간표 3칸/)).toBeInTheDocument();
  });

  it('학생 수도 함께 말해 준다', async () => {
    // 시간표만 보고 다른 항목이 빠졌는지는 못 잡는다. 목록 자체가 살아 있어야 한다.
    show();

    await openDelete();

    expect(await screen.findByText(/학생 1명/)).toBeInTheDocument();
  });

  it('조사가 앞말을 따라간다', async () => {
    show();

    await openDelete();

    /*
     * 목록 끝에 무엇이 오느냐로 조사가 갈린다. '칸'은 받침이 있어 '이'다.
     * '칸가'로 굳혀 두면 항목을 하나 더할 때마다 문장이 어긋나고,
     * 그건 아무도 안 고친다.
     */
    expect(await screen.findByText(/시간표 3칸이 함께 사라집니다/)).toBeInTheDocument();
  });

  it('아무 자료도 없으면 없다고 한다', async () => {
    const empty = seeded();

    show({ ...empty, students: [], timetableEntries: [] });

    await openDelete();

    expect(await screen.findByText(/아직 자료가 없습니다/)).toBeInTheDocument();
  });
});
