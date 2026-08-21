import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TEAMS,
  MAX_TEAMS,
  MIN_TEAMS,
  normalizeTeams,
  renameTeam,
  resizeTeams,
  resolveTeams,
  teamsOrDefault,
} from '../../src/features/quiz/teamsCore';

describe('teamsOrDefault', () => {
  it('저장된 값이 없으면 기본 넷을 쓴다', () => {
    expect(teamsOrDefault([])).toEqual([...DEFAULT_TEAMS]);
  });

  it('저장된 값이 있으면 그것을 쓴다', () => {
    expect(teamsOrDefault(['모래', '바람'])).toEqual(['모래', '바람']);
  });

  it('돌려준 배열을 고쳐도 기본값이 안 바뀐다', () => {
    const teams = teamsOrDefault([]);
    teams[0] = '엉뚱';

    expect(DEFAULT_TEAMS[0]).toBe('1모둠');
  });
});

describe('resizeTeams', () => {
  it('늘리면 뒤에 기본 이름이 붙는다', () => {
    expect(resizeTeams(['가', '나'], 4)).toEqual(['가', '나', '3모둠', '4모둠']);
  });

  it('줄이면 뒤에서부터 사라진다', () => {
    // 앞에서 지우면 교사가 붙인 이름이 밀려 엉뚱한 모둠이 사라진 것처럼 보인다.
    expect(resizeTeams(['가', '나', '다', '라'], 2)).toEqual(['가', '나']);
  });

  it('최소보다 작게는 못 간다', () => {
    expect(resizeTeams(['가', '나', '다'], 1)).toHaveLength(MIN_TEAMS);
    expect(resizeTeams(['가', '나', '다'], -5)).toHaveLength(MIN_TEAMS);
  });

  it('최대보다 크게는 못 간다', () => {
    expect(resizeTeams([], 99)).toHaveLength(MAX_TEAMS);
  });

  it('빈 목록에서 늘리면 전부 기본 이름이다', () => {
    expect(resizeTeams([], 3)).toEqual(['1모둠', '2모둠', '3모둠']);
  });
});

describe('renameTeam', () => {
  it('그 자리 이름만 바꾼다', () => {
    expect(renameTeam(['가', '나', '다'], 1, '바뀜')).toEqual(['가', '바뀜', '다']);
  });

  it('없는 자리는 아무것도 안 바꾼다', () => {
    expect(renameTeam(['가', '나'], 5, '바뀜')).toEqual(['가', '나']);
    expect(renameTeam(['가', '나'], -1, '바뀜')).toEqual(['가', '나']);
  });
});

describe('normalizeTeams', () => {
  it('앞뒤 공백을 다듬는다', () => {
    expect(normalizeTeams(['  독수리  ', '호랑이'])).toEqual(['독수리', '호랑이']);
  });

  it('빈 이름은 기본 이름으로 되돌린다', () => {
    // 이름 없는 모둠은 칠판에서 누를 수 없다.
    expect(normalizeTeams(['독수리', '   ', '거북이'])).toEqual(['독수리', '2모둠', '거북이']);
  });

  it('같은 이름이 둘이면 갈라 놓는다', () => {
    // 같은 이름이 둘이면 점수가 어느 쪽 것인지 알 수 없다.
    expect(normalizeTeams(['독수리', '독수리'])).toEqual(['독수리', '독수리 (2)']);
  });

  it('셋이 겹쳐도 각각 다른 이름이 된다', () => {
    const result = normalizeTeams(['가', '가', '가']);

    expect(new Set(result).size).toBe(3);
    expect(result[0]).toBe('가');
  });

  it('빈 이름이 겹쳐도 갈라진다', () => {
    const result = normalizeTeams(['1모둠', '']);

    expect(new Set(result).size).toBe(2);
  });

  it('멀쩡한 이름은 그대로 둔다', () => {
    expect(normalizeTeams([...DEFAULT_TEAMS])).toEqual([...DEFAULT_TEAMS]);
  });
});

describe('resolveTeams', () => {
  const groups = [{ name: '독수리' }, { name: '호랑이' }, { name: '거북이' }];

  it('직접 정한 것이 모둠보다 우선한다', () => {
    // 남녀 대항처럼 모둠과 다르게 나누고 싶을 때가 있다.
    const result = resolveTeams(['남학생', '여학생'], groups);

    expect(result.teams).toEqual(['남학생', '여학생']);
    expect(result.source).toBe('manual');
  });

  it('직접 정한 것이 없으면 모둠 이름을 쓴다', () => {
    const result = resolveTeams([], groups);

    expect(result.teams).toEqual(['독수리', '호랑이', '거북이']);
    expect(result.source).toBe('groups');
  });

  it('둘 다 없으면 기본 팀', () => {
    const result = resolveTeams([], []);

    expect(result.teams).toEqual([...DEFAULT_TEAMS]);
    expect(result.source).toBe('default');
  });

  it('모둠이 하나뿐이어도 깨지지 않는다', () => {
    const result = resolveTeams([], [{ name: '하나' }]);

    expect(result.teams).toEqual(['하나']);
    expect(result.source).toBe('groups');
  });

  it('모둠 이름이 겹치면 갈라 놓는다', () => {
    // 이름이 기록의 열쇠라 같은 이름 둘이면 점수가 섞인다.
    const result = resolveTeams([], [{ name: '가' }, { name: '가' }]);

    expect(new Set(result.teams).size).toBe(2);
  });

  it('모둠 이름이 비어 있으면 기본 이름으로 채운다', () => {
    const result = resolveTeams([], [{ name: '독수리' }, { name: '  ' }]);

    expect(result.teams).toEqual(['독수리', '2모둠']);
  });

  it('모둠이 여섯이면 여섯 팀이 된다', () => {
    // 두 앱으로 나뉘어 있을 때는 네 팀 고정이라 두 모둠이 참여할 수 없었다.
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `${i + 1}모둠` }));

    expect(resolveTeams([], six).teams).toHaveLength(6);
  });
});
