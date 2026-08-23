import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileBackedStorage, KEY_TO_FILE } from '../../src/shared/storage/FileBackedStorage';
import { MemoryFileStore } from '../../src/shared/storage/MemoryFileStore';

let files: MemoryFileStore;

beforeEach(() => {
  files = new MemoryFileStore();
  vi.useFakeTimers();
});

async function open(): Promise<FileBackedStorage> {
  return FileBackedStorage.open(files);
}

describe('FileBackedStorage — 열고 읽기', () => {
  it('파일이 없으면 빈 저장소로 시작한다', async () => {
    const storage = await open();

    // 새로 설치한 선생님이 처음 만나는 상태다.
    expect(storage.getItem('classroom-suite:v1:data')).toBeNull();
  });

  it('파일에 있던 것을 읽어 온다', async () => {
    await files.writeAtomic('data.json', '{"schoolName":"한빛초"}');

    const storage = await open();

    expect(storage.getItem('classroom-suite:v1:data')).toBe('{"schoolName":"한빛초"}');
  });

  it('읽기는 기다리지 않는다', async () => {
    await files.writeAtomic('data.json', '{"a":1}');
    const storage = await open();

    // Storage 인터페이스는 동기다. Promise가 아니라 값이 나와야 한다.
    const value: string | null = storage.getItem('classroom-suite:v1:data');
    expect(value).toBe('{"a":1}');
  });
});

describe('FileBackedStorage — 쓰기', () => {
  it('쓴 값을 곧바로 다시 읽을 수 있다', async () => {
    const storage = await open();

    storage.setItem('classroom-suite:v1:data', '{"b":2}');

    // 파일에 닿기 전이라도 메모리에는 있어야 한다.
    expect(storage.getItem('classroom-suite:v1:data')).toBe('{"b":2}');
  });

  it('잠시 뒤 파일에 닿는다', async () => {
    const storage = await open();

    storage.setItem('classroom-suite:v1:data', '{"b":2}');
    await vi.advanceTimersByTimeAsync(300);

    expect(await files.read('data.json')).toBe('{"b":2}');
  });

  it('몰아친 쓰기를 한 번으로 묶는다', async () => {
    const storage = await open();

    // 보상 점수는 수업 중 분당 여러 번 눌린다. 매번 파일을 쓰면 안 된다.
    storage.setItem('classroom-suite:v1:data', '1');
    storage.setItem('classroom-suite:v1:data', '2');
    storage.setItem('classroom-suite:v1:data', '3');
    await vi.advanceTimersByTimeAsync(300);

    expect(files.writeCount).toBe(1);
    expect(await files.read('data.json')).toBe('3');
  });

  it('열쇠가 다르면 파일도 다르다', async () => {
    const storage = await open();

    storage.setItem('classroom-suite:v1:data', 'D');
    storage.setItem('classroom-suite:v1:backups', 'B');
    await vi.advanceTimersByTimeAsync(300);

    expect(await files.read('data.json')).toBe('D');
    expect(await files.read('backups.json')).toBe('B');
  });

  it('meta와 neis-key는 한 파일에 함께 담긴다', async () => {
    const storage = await open();

    storage.setItem('classroom-suite:v1:meta', '{"lastSavedAt":"x"}');
    storage.setItem('classroom-suite:v1:neis-key', 'abc');
    await vi.advanceTimersByTimeAsync(300);

    const prefs: unknown = JSON.parse((await files.read('prefs.json')) ?? '{}');
    expect(prefs).toEqual({
      'classroom-suite:v1:meta': '{"lastSavedAt":"x"}',
      'classroom-suite:v1:neis-key': 'abc',
    });
  });

  it('한 파일에 함께 담긴 것도 다시 열면 살아 있다', async () => {
    const first = await open();
    first.setItem('classroom-suite:v1:meta', 'M');
    first.setItem('classroom-suite:v1:neis-key', 'K');
    await first.flush();

    const second = await FileBackedStorage.open(files);

    expect(second.getItem('classroom-suite:v1:meta')).toBe('M');
    expect(second.getItem('classroom-suite:v1:neis-key')).toBe('K');
  });
});

describe('FileBackedStorage — 지우기', () => {
  it('지우면 파일에서도 없어진다', async () => {
    const storage = await open();
    storage.setItem('classroom-suite:v1:data', 'X');
    await vi.advanceTimersByTimeAsync(300);

    storage.removeItem('classroom-suite:v1:data');
    await vi.advanceTimersByTimeAsync(300);

    expect(storage.getItem('classroom-suite:v1:data')).toBeNull();
    expect(await files.read('data.json')).toBeNull();
  });
});

describe('FileBackedStorage — 흘려보내기', () => {
  it('flush는 예약된 것을 곧바로 내보낸다', async () => {
    const storage = await open();

    storage.setItem('classroom-suite:v1:data', 'Z');
    await storage.flush();

    // 창을 닫을 때 이걸 안 부르면 마지막 몇 초가 사라진다.
    expect(await files.read('data.json')).toBe('Z');
  });

  it('예약된 것이 없으면 flush가 아무 일도 안 한다', async () => {
    const storage = await open();

    await storage.flush();

    expect(files.writeCount).toBe(0);
  });
});

describe('FileBackedStorage — 쓰기가 실패해도', () => {
  it('메모리 값은 그대로 살아 있고 알림이 온다', async () => {
    const failures: string[] = [];
    const storage = await FileBackedStorage.open(files, {
      onWriteError: (message) => failures.push(message),
    });

    files.failNextWrite = true;
    storage.setItem('classroom-suite:v1:data', 'Y');
    await vi.advanceTimersByTimeAsync(300);

    // 저장이 안 됐다고 화면의 자료까지 잃으면 안 된다. 알리되 들고 있는다.
    expect(storage.getItem('classroom-suite:v1:data')).toBe('Y');
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('data.json');
  });
});

describe('열쇠와 파일의 대응', () => {
  it('네 열쇠가 모두 자리를 갖는다', () => {
    expect(Object.keys(KEY_TO_FILE).sort()).toEqual([
      'classroom-suite:v1:backups',
      'classroom-suite:v1:data',
      'classroom-suite:v1:meta',
      'classroom-suite:v1:neis-key',
    ]);
  });
});
