import type { HttpClient } from './HttpClient';

/**
 * 시험용 통신.
 *
 * 응답을 미리 심어 두고, 실패도 심을 수 있다. 실패를 만들어 봐야
 * "인터넷이 끊긴 날"의 화면을 확인할 수 있다.
 */
export class MemoryHttpClient implements HttpClient {
  private responses = new Map<string, unknown>();
  private failures = new Map<string, string>();

  /** 실제로 부른 주소를 순서대로. 무엇을 몇 번 불렀는지 확인할 때 쓴다. */
  readonly calls: string[] = [];

  put(url: string, body: unknown): void {
    this.responses.set(url, body);
  }

  fail(url: string, message: string): void {
    this.failures.set(url, message);
  }

  getJson(url: string): Promise<unknown> {
    this.calls.push(url);

    const failure = this.failures.get(url);
    if (failure !== undefined) return Promise.reject(new Error(failure));

    if (!this.responses.has(url)) {
      /*
       * 안 심은 주소를 부르면 던진다. 조용히 빈 값을 돌려주면 시험이
       * 통과해 버리고, 정작 진짜 주소를 잘못 만들었다는 것을 못 잡는다.
       */
      return Promise.reject(new Error(`심어 두지 않은 주소: ${url}`));
    }

    return Promise.resolve(this.responses.get(url));
  }
}
