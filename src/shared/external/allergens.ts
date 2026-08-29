/**
 * 학교급식 알레르기 유발 식품 표시 번호.
 *
 * 식품위생법 시행규칙(학교급식 알레르기 표시제)의 19가지다. NEIS 급식
 * 응답의 `(5.9.18)` 같은 번호가 이 표를 가리킨다. neisParse.toDish가
 * 번호를 갈라 두고, 화면이 이 표로 이름을 붙인다.
 */
export const ALLERGEN_NAMES: Readonly<Record<number, string>> = {
  1: '난류',
  2: '우유',
  3: '메밀',
  4: '땅콩',
  5: '대두',
  6: '밀',
  7: '고등어',
  8: '게',
  9: '새우',
  10: '돼지고기',
  11: '복숭아',
  12: '토마토',
  13: '아황산류',
  14: '호두',
  15: '닭고기',
  16: '쇠고기',
  17: '오징어',
  18: '조개류',
  19: '잣',
};

/** `[5, 9, 18]` → `"대두·새우·조개류"`. 모르는 번호는 번호 그대로 남긴다. */
export function allergenNames(numbers: readonly number[]): string {
  return numbers.map((n) => ALLERGEN_NAMES[n] ?? String(n)).join('·');
}
