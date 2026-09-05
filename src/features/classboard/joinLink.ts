import type { BoardFirebaseConfig } from './boardTypes';

/**
 * 학생 링크.
 *
 * `https://<배포>/classboard/join/<코드>?p=<설정값>` — 설정값(apiKey·authDomain·
 * projectId·appId)을 base64url로 실어 보낸다. 학생 화면은 어느 배포에서 열려도
 * 링크에 든 설정값으로 **그 선생님의** Firebase에 붙는다. 그래서 설치형(.exe)
 * 선생님도 공식 웹 배포 하나로 학생을 받을 수 있다.
 *
 * 설정값은 비밀이 아니다(Firebase 웹 설정은 공개를 전제로 만든 값이고, 배포된
 * 자바스크립트에 그대로 들어간다). 자료를 지키는 것은 규칙(rulesText)이다.
 */

const KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeConfig(config: BoardFirebaseConfig): string {
  const slim: BoardFirebaseConfig = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    appId: config.appId,
  };
  return toBase64Url(JSON.stringify(slim));
}

export function decodeConfig(param: string): BoardFirebaseConfig | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(param));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (!KEYS.every((key) => typeof record[key] === 'string' && record[key] !== '')) return null;
    return {
      apiKey: String(record['apiKey']),
      authDomain: String(record['authDomain']),
      projectId: String(record['projectId']),
      appId: String(record['appId']),
    };
  } catch {
    return null;
  }
}

export function buildJoinLink(origin: string, code: string, config: BoardFirebaseConfig): string {
  return `${origin.replace(/\/+$/, '')}/classboard/join/${code}?p=${encodeConfig(config)}`;
}

/** `location.search`에서 설정값을 읽는다. 없거나 깨졌으면 null. */
export function configFromSearch(search: string): BoardFirebaseConfig | null {
  const param = new URLSearchParams(search).get('p');
  return param === null || param === '' ? null : decodeConfig(param);
}
