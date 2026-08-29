import { UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { allergenNames } from '../../shared/external/allergens';
import type { MealMenu } from '../../shared/external/neisParse';
import { Card, cx } from '../../shared/ui';

/**
 * 급식 카드가 처할 수 있는 상태.
 *
 * 다섯을 가르는 이유는 **선생님이 할 일이 저마다 다르기** 때문이다.
 * 학교를 안 정한 것과 인터넷이 끊긴 것과 방학이라 급식이 없는 것을
 * 같은 말로 보이면, 무엇을 해야 할지 알 수 없다.
 */
export type MealState =
  | { kind: 'no-school' }
  | { kind: 'loading' }
  | { kind: 'ready'; meals: MealMenu[] }
  | { kind: 'failed' };

export function MealCard({ state }: { state: MealState }) {
  /*
   * 알레르기 번호는 기본으로 숨긴다. 대부분의 시선은 메뉴 이름을 훑는
   * 것이고, 번호가 늘 붙어 있으면 이름이 안 읽힌다. 알레르기 학생을 둔
   * 반에서 켜면 그 세션 동안 유지된다 — 저장하지 않는 이유는 이것이
   * 자료가 아니라 그때그때의 읽기 방식이기 때문이다.
   */
  const [showAllergens, setShowAllergens] = useState(false);
  const hasAllergenInfo =
    state.kind === 'ready' && state.meals.some((menu) => menu.dishes.some((dish) => dish.allergens.length > 0));

  return (
    <Card
      title="오늘 급식"
      icon={UtensilsCrossed}
      action={
        hasAllergenInfo ? (
          <button
            type="button"
            onClick={() => setShowAllergens((value) => !value)}
            aria-pressed={showAllergens}
            className={cx(
              'rounded-control px-2 py-1 text-xs font-medium',
              showAllergens ? 'bg-brand-50 text-brand-700' : 'text-slate-400 hover:text-slate-600',
            )}
          >
            알레르기 표시
          </button>
        ) : undefined
      }
    >
      {state.kind === 'no-school' ? (
        <p className="text-sm text-slate-500">
          학교를 정하면 오늘 급식이 여기 나옵니다.{' '}
          <Link to="/settings" className="font-medium text-brand-700 underline">
            학교 찾기
          </Link>
        </p>
      ) : null}

      {state.kind === 'loading' ? (
        <p className="text-sm text-slate-500">불러오는 중…</p>
      ) : null}

      {state.kind === 'failed' ? (
        <p className="text-sm text-slate-600">
          급식을 받아 오지 못했습니다. 인터넷 연결을 확인해 주세요.
        </p>
      ) : null}

      {state.kind === 'ready' && state.meals.length === 0 ? (
        <p className="text-sm text-slate-500">오늘은 급식이 없습니다.</p>
      ) : null}

      {state.kind === 'ready' && state.meals.length > 0 ? (
        <div className="flex flex-col gap-3">
          {state.meals.map((menu) => (
            <div key={`${menu.date}-${menu.kind}`}>
              {state.meals.length > 1 ? (
                <p className="mb-1 text-xs font-medium text-slate-500">{menu.kind}</p>
              ) : null}

              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {menu.dishes.map((dish) => (
                  <li key={dish.name} className="text-sm text-slate-800">
                    {dish.name}
                    {showAllergens && dish.allergens.length > 0 ? (
                      /*
                       * 번호가 아니라 이름으로 쓴다. '5.9.18'을 외우고 있는
                       * 사람은 없고, 이 정보가 필요한 순간은 급하다.
                       */
                      <span className="ml-1 text-xs text-danger-700">
                        ({allergenNames(dish.allergens)})
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
