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

/**
 * NEIS가 자료 대신 오류를 보냈는가. 오류면 그 말을, 아니면 null.
 *
 * **NEIS는 오류도 HTTP 200으로 준다.** 몸통만 이렇게 바뀐다. 실제로
 * 불러서 확인한 것들이다.
 *
 * ```
 * INFO-200   해당하는 데이터가 없습니다        ← 방학이다. 오류가 아니다
 * ERROR-300  필수 값이 누락되어 있습니다
 * ERROR-290  인증키가 유효하지 않습니다
 * ERROR-337  일별 트래픽 제한을 넘은 호출입니다
 * ```
 *
 * 이 봉투를 전부 빈 배열로 읽으면 한도에 걸린 아침에도 화면은 "오늘은
 * 급식이 없습니다"라고 한다. 게다가 그 빈 값이 캐시에 담겨 하루 종일
 * 굳는다. **INFO-200만 '없다'이고 나머지는 '못 물었다'다.**
 *
 * 잘 온 응답에도 RESULT가 있지만 `head` 안에 들어 있다. 맨 위에 놓인
 * RESULT는 자료가 안 왔다는 뜻이라, 여기서는 맨 위만 본다.
 */
export function neisFault(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const result = (raw as Record<string, unknown>).RESULT;
  if (typeof result !== 'object' || result === null) return null;

  const code = (result as Record<string, unknown>).CODE;
  if (typeof code !== 'string' || code === 'INFO-200') return null;

  const message = (result as Record<string, unknown>).MESSAGE;
  return typeof message === 'string' && message !== '' ? message : code;
}

/**
 * 이름에 걸린 학교가 모두 몇인가. 못 읽으면 -1.
 *
 * 한 번에 다섯 곳만 받아 온다(NEIS가 열쇠 없는 호출에 매기는 상한이다).
 * 잘린 줄 모르면 자기 학교가 없는 목록을 보고 이름을 잘못 쳤다고 여겨,
 * 더 짧게 고쳐 더 많이 자르게 된다.
 */
export function schoolSearchTotal(raw: unknown): number {
  if (typeof raw !== 'object' || raw === null) return -1;

  const wrapper = (raw as Record<string, unknown>).schoolInfo;
  if (!Array.isArray(wrapper)) return -1;

  for (const part of wrapper) {
    if (typeof part !== 'object' || part === null) continue;
    const head = (part as Record<string, unknown>).head;
    if (!Array.isArray(head)) continue;

    for (const item of head) {
      if (typeof item !== 'object' || item === null) continue;
      const count = (item as Record<string, unknown>).list_total_count;
      if (typeof count === 'number') return count;
    }
  }

  return -1;
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
