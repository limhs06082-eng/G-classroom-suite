import type { BoardFirebaseConfig } from './boardTypes';

/**
 * 학생 폰에 코드별로 기억하는 것 — 링크에 실려 온 설정값과 학생이 적은 이름.
 *
 * 링크를 한 번 열었으면 다음엔 `/classboard/join/<코드>`만으로도 들어온다
 * (설정값을 여기서 되찾는다). 이름도 매번 묻지 않는다.
 *
 * 이 키의 글자는 scripts/check-bundle-purity.mjs가 설치형 번들에서 찾는 표지자다 —
 * 학생 화면 코드가 설치형에 실리면 안 된다(형성평가 참여 화면과 같은 이유).
 * 이름을 바꾸면 그 검사가 조용히 풀린다.
 */
const JOIN_STORAGE_PREFIX = 'classroom-suite:v1:classboard-join:';

export interface JoinMemory {
  config: BoardFirebaseConfig | null;
  name: string;
}

function keyFor(code: string): string {
  return `${JOIN_STORAGE_PREFIX}${code}`;
}

export function readJoin(code: string): JoinMemory | null {
  try {
    const raw = localStorage.getItem(keyFor(code));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const config = record['config'];
    const validConfig =
      typeof config === 'object' &&
      config !== null &&
      ['apiKey', 'authDomain', 'projectId', 'appId'].every(
        (key) => typeof (config as Record<string, unknown>)[key] === 'string',
      );
    return {
      config: validConfig ? (config as BoardFirebaseConfig) : null,
      name: typeof record['name'] === 'string' ? record['name'] : '',
    };
  } catch {
    return null;
  }
}

export function saveJoin(code: string, patch: Partial<JoinMemory>): void {
  const current = readJoin(code) ?? { config: null, name: '' };
  try {
    localStorage.setItem(keyFor(code), JSON.stringify({ ...current, ...patch }));
  } catch {
    // 저장이 막혀 있으면 매번 이름을 적으면 된다.
  }
}
