import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryHttpClient } from '../../src/shared/external/MemoryHttpClient';

let http: MemoryHttpClient;

beforeEach(() => {
  http = new MemoryHttpClient();
});

describe('MemoryHttpClient', () => {
  it('심어 둔 응답을 그대로 돌려준다', async () => {
    http.put('https://example.test/a', { hello: 'world' });

    expect(await http.getJson('https://example.test/a')).toEqual({ hello: 'world' });
  });

  it('안 심은 주소는 던진다', async () => {
    // 시험이 실수로 진짜 주소를 부르면 조용히 통과하지 않고 바로 드러나야 한다.
    await expect(http.getJson('https://example.test/none')).rejects.toThrow('심어 두지 않은 주소');
  });

  it('실패를 심을 수 있다', async () => {
    http.fail('https://example.test/b', '인터넷 연결 없음');

    await expect(http.getJson('https://example.test/b')).rejects.toThrow('인터넷 연결 없음');
  });

  it('부른 주소를 순서대로 기록한다', async () => {
    http.put('https://example.test/a', {});
    http.put('https://example.test/b', {});

    await http.getJson('https://example.test/a');
    await http.getJson('https://example.test/b');

    expect(http.calls).toEqual(['https://example.test/a', 'https://example.test/b']);
  });
});
