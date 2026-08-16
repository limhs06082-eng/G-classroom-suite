/**
 * 짝이 되는 앱 주소.
 *
 * ── 수강생이 고치는 곳입니다 ──────────────────────────────────
 *
 * `수업·업무 도구함`(G-teacher-toolkit)을 Vercel에 배포했다면, 그 주소를
 * 아래 SIBLING_APP_URL에 붙여 넣으세요. 헤더에 도구함으로 가는 버튼이 생깁니다.
 *
 *   export const SIBLING_APP_URL = 'https://my-toolkit.vercel.app';
 *
 * **비워 두면 버튼이 안 나옵니다.** 도구함을 안 쓰거나 아직 배포하지 않았으면
 * 그대로 두면 됩니다. 앱은 그대로 동작합니다.
 *
 * 환경 변수를 쓰지 않는 이유: fork한 직후 아무 설정 없이 Vercel에 올려도
 * 바로 동작해야 하기 때문입니다. firebaseConfig.ts와 같은 방침입니다.
 */
export const SIBLING_APP_URL = '';

/** 버튼에 적히는 이름. */
export const SIBLING_APP_LABEL = '수업·업무 도구함';

/**
 * 주소가 쓸 만한지 보고 아니면 null.
 *
 * http(s)만 받는다. 손으로 고치는 파일이라 `javascript:` 같은 것이
 * 들어갈 수 있고, 그것을 그대로 링크에 넣으면 안 된다.
 */
export function siblingAppHref(url: string = SIBLING_APP_URL): string | null {
  const trimmed = url.trim();
  if (trimmed === '') return null;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    // 주소 모양이 아니면 버튼을 숨긴다. 깨진 링크를 보여 주는 것보다 낫다.
    return null;
  }
}
