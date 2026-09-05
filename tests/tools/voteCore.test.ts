import { describe, expect, it } from 'vitest';

import { bump, createVote, leaders, resetCounts, total } from '../../src/features/tools/voteCore';

describe('거수 투표', () => {
  it('빈 선택지는 버리고 둘~넷만 받는다', () => {
    const vote = createVote(' 급식 어땠나요? ', ['좋았어요', ' ', '별로였어요', '보통', '그냥', '하나 더']);
    if (vote === null) throw new Error('vote');
    expect(vote.question).toBe('급식 어땠나요?');
    expect(vote.options).toEqual(['좋았어요', '별로였어요', '보통', '그냥']);
    expect(vote.counts).toEqual([0, 0, 0, 0]);

    expect(createVote('q', ['하나'])).toBeNull();
  });

  it('손 든 수를 올리고 내리되 0 밑으로는 안 간다', () => {
    let vote = createVote('q', ['a', 'b']);
    if (vote === null) throw new Error('vote');
    vote = bump(vote, 0, 1);
    vote = bump(vote, 0, 1);
    vote = bump(vote, 1, -1);
    expect(vote.counts).toEqual([2, 0]);
    expect(total(vote)).toBe(2);
    expect(leaders(vote)).toEqual([0]);

    vote = bump(vote, 1, 1);
    vote = bump(vote, 1, 1);
    expect(leaders(vote)).toEqual([0, 1]);
    expect(leaders(resetCounts(vote))).toEqual([]);
  });
});
