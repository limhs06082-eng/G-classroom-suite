import { isDesktop } from '../platform/target';

export interface PostResult {
  status: number;
  json: unknown;
}

/**
 * JSON을 POST하고 상태와 본문을 돌려준다.
 *
 * 설치형은 `@tauri-apps/plugin-http`로 나간다 — Rust가 대신 요청하므로
 * CORS가 없고, `capabilities/default.json`의 허용 주소만 나갈 수 있다.
 * 꾸러미는 동적으로 가져온다(웹 번들 순수성). 웹은 표준 fetch다.
 */
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<PostResult> {
  const init = {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    // 한 학생에 1분. 매달린 요청 하나가 서른 명 일괄 작성을 영영 세우면 안 된다.
    signal: AbortSignal.timeout(60_000),
  };

  const response = isDesktop()
    ? await (await import('@tauri-apps/plugin-http')).fetch(url, init)
    : await fetch(url, init);

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { status: response.status, json };
}
