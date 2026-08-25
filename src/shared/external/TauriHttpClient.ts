import type { HttpClient } from './HttpClient';

/**
 * Tauri를 통해 바깥으로 나간다.
 *
 * 이름은 `fetch`지만 표준 `fetch`가 아니다. 소스를 열어 확인했더니
 * `invoke('plugin:http|fetch')`로 IPC를 탄다 — webview가 직접 요청하지
 * 않고 Rust가 대신 나간다. NEIS가 `Access-Control` 헤더를 안 주는데도
 * 되는 이유이고, CSP의 `connect-src`를 조여도 되는 이유다.
 *
 * 꾸러미는 동적으로 가져온다. 정적으로 부르면 웹 번들에 실려
 * `npm run verify`의 번들 검사가 막는다.
 */
export class TauriHttpClient implements HttpClient {
  async getJson(url: string): Promise<unknown> {
    const { fetch } = await import('@tauri-apps/plugin-http');

    const response = await fetch(url, { method: 'GET' });

    if (!response.ok) {
      /*
       * 상태 코드를 문구에 남긴다. 403이면 권한 범위 밖 주소를 부른 것이고
       * 500이면 NEIS 쪽 문제다 — 선생님께 보일 말은 다르지만, 우리가
       * 원인을 짚으려면 숫자가 필요하다.
       */
      throw new Error(`받아 오지 못했습니다 (${response.status})`);
    }

    return (await response.json()) as unknown;
  }
}
