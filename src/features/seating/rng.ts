/**
 * 난수 생성기.
 *
 * 원본은 알고리즘 안에서 Math.random()을 직접 불렀다. 그러면 배치 결과를
 * 검증할 수 없고, "방금 그 배치 다시 보여 주세요" 같은 요구도 들어줄 수 없다.
 * 생성기를 인자로 받아 두 문제를 함께 푼다.
 */

/** [0, 1) 범위의 값을 돌려준다. */
export type Rng = () => number;

export const systemRng: Rng = () => Math.random();

/**
 * 시드 기반 생성기(mulberry32).
 *
 * 같은 시드는 항상 같은 배치를 만든다. 테스트에서 쓰고,
 * 나중에 "이 배치 저장해 두고 다시 불러오기" 기능의 바탕이 된다.
 */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates. 원본 배열을 건드리지 않는다. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = result[i];
    const b = result[j];
    // noUncheckedIndexedAccess 때문에 존재 확인이 필요하다. 범위상 항상 있다.
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }

  return result;
}
