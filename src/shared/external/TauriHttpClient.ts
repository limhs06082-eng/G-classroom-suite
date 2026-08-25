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
       * 여기 이르렀다는 것 자체가 NEIS 서버까지 갔다 왔다는 뜻이다. Tauri는
       * capabilities/default.json 범위 밖 주소를 요청이 나가기도 전에
       * 막는다 — 그때는 fetch() 자체가 거부되어 이 분기를 아예 타지 않고,
       * 우리 문구가 아닌 plugin-http의 영어 오류로 드러난다. 권한 설정을
       * 잘못 건드리면 실제로는 이런 모양으로 나타난다는 뜻이다. 그러니
       * 여기서 보는 403도 권한이 아니라 NEIS가 준 것이다.
       *
       * 그래서 여기 남기는 숫자는 늘 NEIS 쪽 사정이다: 500이면 NEIS가
       * 죽은 것이라 우리가 할 일이 없고, 400이면 대개 우리가 주소를
       * 잘못 만든 것이다.
       */
      throw new Error(`받아 오지 못했습니다 (${response.status})`);
    }

    try {
      return (await response.json()) as unknown;
    } catch {
      /*
       * 200인데 JSON이 아니다. NEIS는 점검 중일 때 상태 코드 200에 안내
       * HTML을 실어 보낸다. 여기서 JSON.parse의 영어 오류를 그대로 올리면
       * 받는 쪽이 무슨 일인지 알 수 없다.
       */
      throw new Error('자료 대신 다른 것이 왔습니다. NEIS 점검 중일 수 있습니다.');
    }
  }
}
