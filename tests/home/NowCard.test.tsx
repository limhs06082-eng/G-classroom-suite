import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { NowCard } from '../../src/features/home/NowCard';
import type { NowState } from '../../src/features/now/nowCore';
import { ToolsProvider, useTools } from '../../src/features/tools/ToolsContext';

/*
 * 카드는 <Link>를 그린다. react-router 맥락 밖에서 그리면 죽으므로 실제
 * 화면에서 쓰이는 모양대로 MemoryRouter로 감싼다. MealCard 시험과 같은 이유다.
 *
 * ToolsProvider도 여기서만 씌운다. **카드가 제 provider를 만들면 안 된다** —
 * 그러면 툴바와 다른 상태를 보게 되어 단추가 조용히 죽는다.
 */

/**
 * 열린 도구를 그대로 내건다.
 *
 * 이 시험은 카드만 그린다. 툴바도 모달도 없어서 '타이머가 열렸다'를 화면에서
 * 볼 수가 없다. 계획서는 카드 단추의 `aria-pressed`로 보라고 했는데, 이
 * 단추들은 켜고 끄는 토글이 아니라 모달을 여는 단추라 그 표시가 거짓말이
 * 된다(한 번 더 눌러도 안 꺼진다). 상태를 직접 내걸어 본다.
 */
function OpenToolProbe() {
  const { openTool } = useTools();
  return <span data-testid="open-tool">{openTool ?? '없음'}</span>;
}

function show(state: NowState, onOpenBoard = vi.fn(), hasMealCard = true) {
  return render(
    <MemoryRouter>
      <ToolsProvider>
        <NowCard state={state} onOpenBoard={onOpenBoard} hasMealCard={hasMealCard} />
        <OpenToolProbe />
      </ToolsProvider>
    </MemoryRouter>,
  );
}

function openedTool(): string {
  return screen.getByTestId('open-tool').textContent ?? '';
}

describe('지금 카드', () => {
  it('시간표가 없으면 짜라고 한다', () => {
    show({ kind: 'no-timetable' });

    expect(screen.getByRole('link', { name: '시간표 짜기' })).toBeInTheDocument();
  });

  it('등교 전에는 곧 시작할 교시를 한 줄로 짚는다', () => {
    show({ kind: 'before', period: 1, subject: '국어', startsAt: '09:00', minutesUntil: 30 });

    expect(screen.getByText(/1교시 국어/)).toBeInTheDocument();
    expect(screen.getByText(/09:00/)).toBeInTheDocument();
  });

  it('수업 중에는 교시·과목·남은 시간을 말한다', () => {
    show({ kind: 'lesson', period: 3, subject: '수학', minutesLeft: 12 });

    expect(screen.getByText(/3교시 수학/)).toBeInTheDocument();
    expect(screen.getByText(/12분 남음/)).toBeInTheDocument();
    // 아직 여유가 있으면 종료 예고는 없다.
    expect(screen.queryByText(/곧 수업이 끝납니다/)).not.toBeInTheDocument();
  });

  it('5분 이하로 남으면 곧 끝난다고 조용히 알린다', () => {
    show({ kind: 'lesson', period: 3, subject: '수학', minutesLeft: 5 });

    expect(screen.getByText(/곧 수업이 끝납니다/)).toBeInTheDocument();
  });

  it('수업 중에만 도구가 손에 닿는다', () => {
    show({ kind: 'lesson', period: 3, subject: '수학', minutesLeft: 12 });

    expect(screen.getByRole('button', { name: '타이머 (지금)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '화면 가리기 (지금)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전자칠판' })).toBeInTheDocument();
  });

  it('쉬는 시간에는 도구를 안 내민다', () => {
    show({ kind: 'break', period: 4, subject: '사회', minutesUntil: 7 });

    // 쉬는 시간에 타이머를 내밀면 자리만 차지한다. 다음 교시가 궁금할 때다.
    expect(screen.getByText(/다음 4교시 사회/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '타이머 (지금)' })).not.toBeInTheDocument();
  });

  it('점심때는 급식을 보라고 한다', () => {
    show({ kind: 'lunch' });

    expect(screen.getByText(/점심/)).toBeInTheDocument();
  });

  it('하교 후에는 끝났다고 한다', () => {
    show({ kind: 'after' });

    expect(screen.getByText(/오늘 수업이 끝났습니다/)).toBeInTheDocument();
  });

  it('타이머 단추가 진짜로 도구를 연다', async () => {
    const user = userEvent.setup();
    show({ kind: 'lesson', period: 3, subject: '수학', minutesLeft: 12 });

    await user.click(screen.getByRole('button', { name: '타이머 (지금)' }));

    // 그리기만 하고 안 이어져 있으면 선생님은 앱이 고장 났다고 여긴다.
    expect(openedTool()).toBe('timer');
  });

  it('화면 가리기 단추는 화면 가리개를 연다', async () => {
    const user = userEvent.setup();
    show({ kind: 'lesson', period: 3, subject: '수학', minutesLeft: 12 });

    await user.click(screen.getByRole('button', { name: '화면 가리기 (지금)' }));

    /*
     * 단추가 있는지, 무언가 열리는지만 보면 **둘째 단추가 첫째 것을 베낀
     * 채로** 통과한다. 도구 단추를 늘릴 때 실제로 나는 사고가 이것이라,
     * 어느 도구가 열렸는지까지 본다.
     */
    expect(openedTool()).toBe('curtain');
  });

  it('전자칠판은 넘겨받은 것을 부른다', async () => {
    const user = userEvent.setup();
    const onOpenBoard = vi.fn();
    show({ kind: 'lesson', period: 3, subject: '수학', minutesLeft: 12 }, onOpenBoard);

    await user.click(screen.getByRole('button', { name: '전자칠판' }));

    expect(onOpenBoard).toHaveBeenCalledTimes(1);
    // 전자칠판은 도구함 밖에 있다. 여기서 도구를 열면 툴바가 엉뚱한 것을 띄운다.
    expect(openedTool()).toBe('없음');
  });

  it('한참 남았으면 시·분으로 나눠 말한다', () => {
    // 오후에만 수업이 있는 반이면 등교 전에 실제로 이런 값이 나온다.
    show({ kind: 'before', period: 5, subject: '체육', startsAt: '13:40', minutesUntil: 280 });

    expect(screen.getByText(/4시간 40분 뒤/)).toBeInTheDocument();
    // '280분 뒤'는 사람이 못 읽는다.
    expect(screen.queryByText(/280분/)).not.toBeInTheDocument();
  });

  it('수업이 아닌 때에는 단추가 하나도 없다', () => {
    /*
     * 쉬는 시간만 막으면 점심·하교 후로 새어 나간다. 갈래마다 따로 그리는
     * 카드라 한 갈래를 고치면서 다른 갈래에 도구를 흘리기 쉽다.
     */
    const quiet = [
      { kind: 'before', period: 1, subject: '국어', startsAt: '09:00', minutesUntil: 30 },
      { kind: 'break', period: 4, subject: '사회', minutesUntil: 7 },
      { kind: 'lunch' },
      { kind: 'after' },
      { kind: 'no-timetable' },
    ] satisfies NowState[];

    for (const state of quiet) {
      const view = show(state);
      expect(screen.queryAllByRole('button')).toHaveLength(0);
      view.unmount();
    }
  });

  it('모르는 갈래가 와도 빈 카드로 두지 않는다', () => {
    /*
     * 일곱째 갈래가 생기면 컴파일이 먼저 깨진다. 그래도 저장된 자료가 코드보다
     * 앞서 나가는 일은 있고, 그때 아무 말도 없는 카드는 아무도 신고하지 않는다.
     */
    show({ kind: 'holiday' } as unknown as NowState);

    expect(screen.getByText(/알 수 없습니다/)).toBeInTheDocument();
    expect(screen.getByText(/holiday/)).toBeInTheDocument();
  });
});

describe('없는 카드를 가리키지 않는다', () => {
  it('급식 카드가 있으면 그리로 안내한다', () => {
    show({ kind: 'lunch' }, vi.fn(), true);

    expect(screen.getByText(/오늘 급식/)).toBeInTheDocument();
  });

  it('급식 카드가 없으면 점심이라고만 한다', () => {
    /*
     * 급식은 설치형에서만 된다 — NEIS가 브라우저의 직접 요청을 막는다.
     * 웹의 그 자리에는 이름이 '급식'인 다른 카드가 있고 내용은 "설치형에서만
     * 받아 옵니다"다. 거기에 대고 "'오늘 급식' 카드에 있습니다"라고 하면
     * 없는 것을 찾아 헤매게 만든다.
     */
    show({ kind: 'lunch' }, vi.fn(), false);

    expect(screen.getByText('점심시간입니다')).toBeInTheDocument();
    expect(screen.queryByText(/오늘 급식/)).not.toBeInTheDocument();
  });
});

describe('아래 툴바와 이름이 겹치지 않는다', () => {
  it('도구 단추 이름에 어느 쪽인지 담는다', () => {
    /*
     * 화면 아래 전역 툴바에도 [타이머]·[화면 가리기]가 있다. 눈으로 보면
     * 자리가 달라 헷갈리지 않지만, 낭독기로 단추를 훑으면 같은 이름이 두 번
     * 들리고 어느 쪽인지 알 길이 없다. 보이는 글자는 그대로 두고 이름에만
     * 담는다 — 보이는 글자가 이름에 들어 있어야 음성 조작도 그대로 된다.
     */
    show({ kind: 'lesson', period: 3, subject: '수학', minutesLeft: 12 });

    expect(screen.getByRole('button', { name: '타이머 (지금)' })).toHaveTextContent('타이머');
    expect(screen.getByRole('button', { name: '화면 가리기 (지금)' })).toHaveTextContent(
      '화면 가리기',
    );
  });

  it('두 시간짜리 수업도 사람이 읽는 말로 남은 시간을 낸다', () => {
    show({ kind: 'lesson', period: 3, subject: '수학', minutesLeft: 150 });

    // '150분 남음'이 홈에서 가장 큰 글씨 아래에 붙으면 아무도 못 읽는다.
    expect(screen.getByText('2시간 30분 남음')).toBeInTheDocument();
  });
})
