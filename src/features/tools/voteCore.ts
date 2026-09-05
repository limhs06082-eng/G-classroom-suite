/**
 * 거수 투표 — 순수 함수. 기록하지 않는다. 그 자리에서 손 들고 세고 끝이다.
 */

export interface Vote {
  question: string;
  /** 2~4개 */
  options: string[];
  counts: number[];
}

export const MAX_OPTIONS = 4;

/** 빈 선택지는 버리고 둘~넷만. 둘이 안 되면 null. */
export function createVote(question: string, options: readonly string[]): Vote | null {
  const cleaned = options.map((option) => option.trim()).filter((option) => option !== '').slice(0, MAX_OPTIONS);
  if (cleaned.length < 2) return null;
  return { question: question.trim(), options: cleaned, counts: cleaned.map(() => 0) };
}

/** 손 든 수를 올리거나 내린다. 0 밑으로는 안 간다. */
export function bump(vote: Vote, index: number, delta: number): Vote {
  return {
    ...vote,
    counts: vote.counts.map((count, i) => (i === index ? Math.max(0, count + delta) : count)),
  };
}

export function resetCounts(vote: Vote): Vote {
  return { ...vote, counts: vote.counts.map(() => 0) };
}

export function total(vote: Vote): number {
  return vote.counts.reduce((sum, count) => sum + count, 0);
}

/** 가장 많이 든 선택지들(동점 포함). 아무도 안 들었으면 빈 목록. */
export function leaders(vote: Vote): number[] {
  const max = Math.max(0, ...vote.counts);
  if (max === 0) return [];
  return vote.counts.flatMap((count, index) => (count === max ? [index] : []));
}
