/**
 * 퀴즈 모둠 이름 다루기.
 *
 * 모둠 이름은 기록의 열쇠다. QuizRun.correctTeamsByQuestion이
 * `{ 문제id: ['1모둠', '3모둠'] }` 형태로 팀을 **이름으로** 담는다.
 * 그래서 빈 이름이나 중복 이름이 저장되면 점수가 어긋난다.
 */

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 8;

/** 팀을 한 번도 안 정한 교사가 보게 될 기본값. */
export const DEFAULT_TEAMS: readonly string[] = ['1모둠', '2모둠', '3모둠', '4모둠'];

export function defaultTeamName(index: number): string {
  return `${index + 1}모둠`;
}

/** 팀 이름이 어디서 왔는지. 화면이 교사에게 설명할 때 쓴다. */
export type TeamSource = 'manual' | 'groups' | 'default';

export interface ResolvedTeams {
  teams: string[];
  source: TeamSource;
}

/**
 * 퀴즈 팀을 정한다.
 *
 * 직접 정한 것 → 자리·모둠에서 편성한 모둠 → 기본 팀 순으로 고른다.
 *
 * **직접 정한 것이 이긴다.** 남녀 대항이나 두 팀 대결처럼 모둠과 다르게
 * 나누고 싶을 때가 있고, 그때 앱이 모둠으로 되돌리면 교사가 싸워야 한다.
 *
 * **모둠은 복사하지 않는다.** 부르는 쪽이 지금 모둠을 넘기므로, 자리·모둠에서
 * 하나 더 만들면 퀴즈에도 바로 나타난다. 복사해 두면 "왜 6모둠인데 퀴즈는
 * 4개지"가 생긴다.
 */
export function resolveTeams(
  manual: readonly string[],
  groups: readonly { name: string }[],
): ResolvedTeams {
  if (manual.length > 0) return { teams: normalizeTeams(manual), source: 'manual' };
  if (groups.length > 0) {
    return { teams: normalizeTeams(groups.map((group) => group.name)), source: 'groups' };
  }

  return { teams: [...DEFAULT_TEAMS], source: 'default' };
}

/** 저장된 값이 비어 있으면 기본값. 화면과 훅이 같은 답을 보게 한다. */
export function teamsOrDefault(saved: readonly string[]): string[] {
  return saved.length > 0 ? [...saved] : [...DEFAULT_TEAMS];
}

/**
 * 모둠 수를 바꾼다.
 *
 * 늘리면 뒤에 기본 이름을 붙이고, 줄이면 뒤에서부터 지운다.
 * 앞에서 지우면 교사가 붙여 둔 이름이 밀려 엉뚱한 모둠이 사라진 것처럼 보인다.
 */
export function resizeTeams(teams: readonly string[], count: number): string[] {
  const size = Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, Math.round(count)));

  return Array.from({ length: size }, (_, index) => teams[index] ?? defaultTeamName(index));
}

export function renameTeam(teams: readonly string[], index: number, name: string): string[] {
  if (index < 0 || index >= teams.length) return [...teams];

  return teams.map((team, i) => (i === index ? name : team));
}

/**
 * 저장하기 직전에 다듬는다.
 *
 * 빈 이름은 기본 이름으로 되돌린다 — **이름 없는 모둠은 칠판에서 누를 수 없다.**
 * 중복도 마찬가지다. 같은 이름이 둘이면 점수가 어느 쪽 것인지 알 수 없다.
 */
export function normalizeTeams(teams: readonly string[]): string[] {
  const used = new Set<string>();

  return teams.map((team, index) => {
    const trimmed = team.trim();
    const base = trimmed === '' ? defaultTeamName(index) : trimmed;

    if (!used.has(base)) {
      used.add(base);
      return base;
    }

    // 이미 쓰인 이름이면 뒤에 번호를 붙여 갈라 놓는다.
    let candidate = `${base} (2)`;
    for (let n = 2; used.has(candidate); n += 1) candidate = `${base} (${n + 1})`;
    used.add(candidate);
    return candidate;
  });
}
