import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryFileStore } from '../../src/shared/storage/MemoryFileStore';

let store: MemoryFileStore;

beforeEach(() => {
  store = new MemoryFileStore();
});

describe('MemoryFileStore', () => {
  it('없는 파일은 null이다', async () => {
    expect(await store.read('data.json')).toBeNull();
  });

  it('쓴 것을 그대로 읽는다', async () => {
    await store.writeAtomic('data.json', '{"a":1}');

    expect(await store.read('data.json')).toBe('{"a":1}');
  });

  it('지우면 없어진다', async () => {
    await store.writeAtomic('data.json', '{}');
    await store.remove('data.json');

    expect(await store.read('data.json')).toBeNull();
  });

  it('쓰기가 실패하면 옛 내용이 남는다', async () => {
    // 원자적 쓰기의 핵심이다. 반쪽짜리가 남으면 안 된다.
    await store.writeAtomic('data.json', '{"old":true}');
    store.failNextWrite = true;

    await expect(store.writeAtomic('data.json', '{"new":true}')).rejects.toThrow();
    expect(await store.read('data.json')).toBe('{"old":true}');
  });

  it('쓴 횟수를 센다', async () => {
    // 예약 쓰기가 정말로 묶이는지 확인할 때 쓴다.
    await store.writeAtomic('a.json', '1');
    await store.writeAtomic('a.json', '2');

    expect(store.writeCount).toBe(2);
  });
});
