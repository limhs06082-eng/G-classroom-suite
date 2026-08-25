/**
 * NEIS 응답을 우리 타입으로 옮긴다.
 *
 * 순수 함수로 떼어 둔 이유는 시험 때문이다. 통신과 섞어 두면 응답 모양이
 * 맞는지 확인하려고 매번 인터넷을 타야 한다.
 *
 * **무엇이 와도 던지지 않는다.** 서버가 점검 중이라 HTML을 주는 날도 있고,
 * 급식이 없는 날은 아예 다른 모양으로 답한다. 그때마다 앱이 죽으면
 * 선생님은 급식을 못 보는 게 아니라 앱을 못 쓴다. 못 읽으면 빈 목록이다.
 */

export interface SchoolHit {
  officeCode: string;
  officeName: string;
  schoolCode: string;
  schoolName: string;
  address: string;
  kind: string;
}

export interface MealDish {
  name: string;
  /** 알레르기 유발 식품 번호. 화면에서 접었다 펼 수 있게 이름과 갈라 둔다. */
  allergens: number[];
}

export interface MealMenu {
  /** 조식 · 중식 · 석식 */
  kind: string;
  /**
   * `YYYY-MM-DD`.
   *
   * **빈 글자일 수 있다.** NEIS가 날짜 칸을 안 주거나 모양이 다르면 그대로
   * 통과시킨다 — 여기서 버리면 급식은 있는데 안 보이고, 던지면 앱이 멈춘다.
   * 이걸 캐시 열쇠로 쓰는 쪽은 빈 글자를 걸러야 한다. 안 그러면 날짜를 못
   * 읽은 서로 다른 끼니가 같은 열쇠로 서로를 덮는다.
   */
  date: string;
  dishes: MealDish[];
  /** "489.7 Kcal" 같은 글자 그대로. 계산할 일이 없어 숫자로 바꾸지 않는다. */
  calories: string;
}

/**
 * NEIS 응답에서 `row` 배열을 꺼낸다.
 *
 * 모양이 `{ 이름: [ {head}, {row: [...]} ] }`로 두 겹이라 매번 더듬어야 한다.
 * 결과가 없는 날은 `{ RESULT: {...} }`가 와서 이 구조가 아예 없다.
 */
function rowsOf(raw: unknown, key: string): Record<string, unknown>[] {
  if (typeof raw !== 'object' || raw === null) return [];

  const wrapper = (raw as Record<string, unknown>)[key];
  if (!Array.isArray(wrapper)) return [];

  for (const part of wrapper) {
    if (typeof part !== 'object' || part === null) continue;
    const rows = (part as Record<string, unknown>).row;
    if (Array.isArray(rows)) {
      return rows.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null);
    }
  }

  return [];
}

function text(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  return typeof value === 'string' ? value : '';
}

export function parseSchoolSearch(raw: unknown): SchoolHit[] {
  return rowsOf(raw, 'schoolInfo').map((row) => ({
    officeCode: text(row, 'ATPT_OFCDC_SC_CODE'),
    officeName: text(row, 'ATPT_OFCDC_SC_NM'),
    schoolCode: text(row, 'SD_SCHUL_CODE'),
    schoolName: text(row, 'SCHUL_NM'),
    address: text(row, 'ORG_RDNMA'),
    kind: text(row, 'SCHUL_KND_SC_NM'),
  }));
}

/** `20260601` → `2026-06-01`. 못 읽으면 그대로 둔다. */
function toIsoDate(compact: string): string {
  if (!/^\d{8}$/.test(compact)) return compact;
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

/**
 * `두부새우젓국 (5.9.18)` → 이름과 번호로 가른다.
 *
 * 화면에는 이름만 보여야 읽히고, 번호는 알레르기가 있는 학생을 둔
 * 선생님에게 필요하다. 버리지 않고 갈라 둔다.
 */
function toDish(piece: string): MealDish {
  const match = /^(.*?)\s*\(([\d.\s]+)\)\s*$/.exec(piece.trim());
  if (match === null) return { name: piece.trim(), allergens: [] };

  const name = (match[1] ?? '').trim();
  const allergens = (match[2] ?? '')
    .split('.')
    .map((n) => Number.parseInt(n.trim(), 10))
    .filter((n) => Number.isFinite(n));

  return { name, allergens };
}

export function parseMeals(raw: unknown): MealMenu[] {
  return rowsOf(raw, 'mealServiceDietInfo').map((row) => ({
    kind: text(row, 'MMEAL_SC_NM'),
    date: toIsoDate(text(row, 'MLSV_YMD')),
    dishes: text(row, 'DDISH_NM')
      .split(/<br\s*\/?>/i)
      .map((piece) => toDish(piece))
      .filter((dish) => dish.name !== ''),
    calories: text(row, 'CAL_INFO'),
  }));
}
