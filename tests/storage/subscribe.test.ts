import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmptySuiteData } from '../../src/shared/domain/factories';
import { LocalStorageAdapter, STORAGE_KEYS } from '../../src/shared/storage/LocalStorageAdapter';
import { serializeSuiteData } from '../../src/shared/storage/schema';

/** jsdom은 localStorage 쓰기에 storage 이벤트를 쏘지 않는다. 직접 만든다. */
function fireStorage(key: string | null, newValue: string | null): void {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
}

describe('LocalStorageAdapter.subscribe', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('다른 탭의 저장을 파싱해서 전달한다', () => {
    const adapter = new LocalStorageAdapter();
    const listener = vi.fn();
    adapter.subscribe(listener);

    fireStorage(STORAGE_KEYS.data, serializeSuiteData(createEmptySuiteData()));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ students: [] });
  });

  it('데이터 키가 아니면 부르지 않는다', () => {
    // 백업·메타가 바뀔 때 화면을 갈아 끼울 이유가 없다.
    const adapter = new LocalStorageAdapter();
    const listener = vi.fn();
    adapter.subscribe(listener);

    fireStorage(STORAGE_KEYS.backups, '[]');
    fireStorage(STORAGE_KEYS.meta, '{}');

    expect(listener).not.toHaveBeenCalled();
  });

  it('깨진 JSON이면 부르지 않는다', () => {
    // 멀쩡한 화면을 망가진 데이터로 덮지 않는다.
    const adapter = new LocalStorageAdapter();
    const listener = vi.fn();
    adapter.subscribe(listener);

    fireStorage(STORAGE_KEYS.data, '{잘린 json');

    expect(listener).not.toHaveBeenCalled();
  });

  it('키가 지워졌으면 부르지 않는다', () => {
    // 전체 초기화한 창이 스스로 새로고침한다. 이쪽까지 빈 화면으로 만들지 않는다.
    const adapter = new LocalStorageAdapter();
    const listener = vi.fn();
    adapter.subscribe(listener);

    fireStorage(STORAGE_KEYS.data, null);

    expect(listener).not.toHaveBeenCalled();
  });

  it('해제하면 더는 오지 않는다', () => {
    const adapter = new LocalStorageAdapter();
    const listener = vi.fn();
    const unsubscribe = adapter.subscribe(listener);

    unsubscribe();
    fireStorage(STORAGE_KEYS.data, serializeSuiteData(createEmptySuiteData()));

    expect(listener).not.toHaveBeenCalled();
  });
});
