import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { MealCard, type MealState } from '../../src/features/home/MealCard';
import type { MealMenu } from '../../src/shared/external/neisParse';

/*
 * '학교 미설정' 상태가 <Link>를 그린다. react-router 맥락 밖에서 그리면
 * "Cannot destructure property 'basename'..."로 죽으므로, 이 카드가 실제로
 * 화면 안에서 쓰이는 모양대로 MemoryRouter로 감싼다.
 */
function renderCard(state: MealState) {
  return render(
    <MemoryRouter>
      <MealCard state={state} />
    </MemoryRouter>,
  );
}

const lunch: MealMenu[] = [
  {
    kind: '중식',
    date: '2026-06-01',
    dishes: [
      { name: '홍국쌀밥', allergens: [] },
      { name: '두부새우젓국', allergens: [5, 9, 18] },
    ],
    calories: '489.7 Kcal',
  },
];

describe('오늘 급식 카드', () => {
  it('메뉴를 보여 준다', () => {
    renderCard({ kind: 'ready', meals: lunch });

    expect(screen.getByText('홍국쌀밥')).toBeInTheDocument();
    expect(screen.getByText('두부새우젓국')).toBeInTheDocument();
  });

  it('알레르기 번호는 화면을 어지럽히지 않는다', () => {
    renderCard({ kind: 'ready', meals: lunch });

    // 이름 안에 번호가 섞여 있으면 한눈에 안 읽힌다.
    expect(screen.getByText('두부새우젓국')).toBeInTheDocument();
    expect(screen.queryByText(/두부새우젓국 \(/)).not.toBeInTheDocument();
  });

  it('학교를 안 정했으면 무엇을 하면 되는지 말한다', () => {
    renderCard({ kind: 'no-school' });

    expect(screen.getByText(/학교를 정하면/)).toBeInTheDocument();
  });

  it('급식이 없는 날은 그렇게 말한다', () => {
    // 방학·주말. 오류가 아니다.
    renderCard({ kind: 'ready', meals: [] });

    expect(screen.getByText(/오늘은 급식이 없습니다/)).toBeInTheDocument();
  });

  it('못 받아 왔으면 결과 없음과 다르게 말한다', () => {
    renderCard({ kind: 'failed' });

    /*
     * "급식이 없는 날"과 "인터넷이 끊긴 날"은 다르다. 같은 말로 보이면
     * 선생님은 급식이 없는 줄 알고 넘어간다.
     */
    expect(screen.getByText(/받아 오지 못했습니다/)).toBeInTheDocument();
  });

  it('받아 오는 중임을 알린다', () => {
    renderCard({ kind: 'loading' });

    expect(screen.getByText(/불러오는 중/)).toBeInTheDocument();
  });
});
