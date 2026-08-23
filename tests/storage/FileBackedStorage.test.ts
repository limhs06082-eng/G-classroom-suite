import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileBackedStorage, KEY_TO_FILE } from '../../src/shared/storage/FileBackedStorage';
import { MemoryFileStore } from '../../src/shared/storage/MemoryFileStore';

let files: MemoryFileStore;

beforeEach(() => {
  files = new MemoryFileStore();
  vi.useFakeTimers();
});

/*
 * 아직 발화 안 한 setTimeout을 다음 시험까지 들고 가면 안 된다.
 *
 * 몇몇 시험은 flush나 advanceTimers 없이 setItem만 하고 끝난다(의도적으로 —
 * 그 시험의 관심사가 아니다). 정리를 안 하면 그 타이머가 다음 시험에서
 * 발화해, 이번 시험의 storage가 아닌 지난 시험의 storage가 파일을 쓰고
 * `gboard-local-write`를 window에 던진다. 각 시험은 자기 files 객체만
 * 들여다보므로 그 잘못 쓴 파일 자체는 안 보이지만, window 이벤트는
 * 시험 사이에 공유되는 통로라 새는 것이 그대로 다음 시험의 리스너에 잡힌다.
 */
afterEach(() => {
  vi.useRealTimers();
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

  it('한 파일의 다른 열쇠를 고쳐도 이웃이 살아남는다', async () => {
    // 지난 학기에 넣어 둔 NEIS 키가, 이번에 meta만 고쳤다고 사라지면 안 된다.
    await files.writeAtomic(
      'prefs.json',
      JSON.stringify({
        'classroom-suite:v1:meta': 'OLD_META',
        'classroom-suite:v1:neis-key': 'KEEP_ME',
      }),
    );

    const storage = await open();
    storage.setItem('classroom-suite:v1:meta', 'NEW_META');
    await storage.flush();

    const prefs: unknown = JSON.parse((await files.read('prefs.json')) ?? '{}');
    expect(prefs).toEqual({
      'classroom-suite:v1:meta': 'NEW_META',
      'classroom-suite:v1:neis-key': 'KEEP_ME',
    });
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

  it('실패한 쓰기가 다른 파일 저장에 얹혀 다시 나간다', async () => {
    const storage = await FileBackedStorage.open(files, { onWriteError: () => undefined });

    /*
     * backups.json이 실질 노출이다. 10분에 한 번뿐이라, 실패한 채로
     * 목록에서 빠지면 다음 백업까지 영영 안 쓰인다. 그 사이 앱이 닫히면
     * 되돌릴 것이 없어진다.
     */
    files.failNextWrite = true;
    storage.setItem('classroom-suite:v1:backups', 'SNAPSHOT');
    await vi.advanceTimersByTimeAsync(300);
    expect(await files.read('backups.json')).toBeNull();

    // 전혀 다른 파일을 저장한다. 실패했던 쪽은 아무도 다시 건드리지 않았다.
    storage.setItem('classroom-suite:v1:data', 'UNRELATED');
    await vi.advanceTimersByTimeAsync(300);

    expect(await files.read('backups.json')).toBe('SNAPSHOT');
    expect(await files.read('data.json')).toBe('UNRELATED');
  });

  it('쓰기가 실패한 뒤 곧바로 닫아도 flush가 한 번 더 시도한다', async () => {
    const storage = await FileBackedStorage.open(files, { onWriteError: () => undefined });

    files.failNextWrite = true;
    storage.setItem('classroom-suite:v1:backups', 'SNAPSHOT');
    await vi.advanceTimersByTimeAsync(300);
    expect(await files.read('backups.json')).toBeNull();

    /*
     * 아무것도 더 건드리지 않고 창을 닫는다. 실패한 직후라 타이머는
     * 이미 null이므로, flush가 dirty를 보지 않으면 그냥 돌아간다.
     */
    await storage.flush();

    expect(await files.read('backups.json')).toBe('SNAPSHOT');
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

describe('FileBackedStorage — 다른 창이 고친 것 받아 들이기', () => {
  it('파일에서 다시 읽어 메모리를 고친다', async () => {
    const storage = await open();

    await files.writeAtomic('data.json', 'FROM_OTHER_WINDOW');
    await storage.acceptExternalChange('data.json');

    expect(storage.getItem('classroom-suite:v1:data')).toBe('FROM_OTHER_WINDOW');
  });

  it('window에 storage 이벤트를 던진다', async () => {
    const storage = await open();
    const seen: StorageEvent[] = [];
    const handle = (event: Event): void => {
      seen.push(event as StorageEvent);
    };
    window.addEventListener('storage', handle);

    await files.writeAtomic('data.json', 'NEW');
    await storage.acceptExternalChange('data.json');
    window.removeEventListener('storage', handle);

    /*
     * LocalStorageAdapter.subscribe가 이 이벤트를 듣는다. 어댑터를
     * 고치지 않고 창 간 동기화를 얻는 방법이 이것이다.
     */
    expect(seen).toHaveLength(1);
    expect(seen[0]?.key).toBe('classroom-suite:v1:data');
    expect(seen[0]?.newValue).toBe('NEW');
  });

  it('한 파일에 여럿이 살면 각각 이벤트를 던진다', async () => {
    const storage = await open();
    const keys: (string | null)[] = [];
    const handle = (event: Event): void => {
      keys.push((event as StorageEvent).key);
    };
    window.addEventListener('storage', handle);

    await files.writeAtomic(
      'prefs.json',
      JSON.stringify({
        'classroom-suite:v1:meta': 'M',
        'classroom-suite:v1:neis-key': 'K',
      }),
    );
    await storage.acceptExternalChange('prefs.json');
    window.removeEventListener('storage', handle);

    expect(keys.sort()).toEqual(['classroom-suite:v1:meta', 'classroom-suite:v1:neis-key']);
  });

  it('파일이 깨져 있으면 지금 들고 있는 것을 지킨다', async () => {
    const storage = await open();
    storage.setItem('classroom-suite:v1:meta', 'GOOD');

    await files.writeAtomic('prefs.json', '{ 이건 JSON이 아니다');
    await storage.acceptExternalChange('prefs.json');

    // 남의 창이 파일을 망가뜨렸다고 내 화면까지 비우지 않는다.
    expect(storage.getItem('classroom-suite:v1:meta')).toBe('GOOD');
  });
});

describe('FileBackedStorage — 내가 쓴 것을 알린다', () => {
  it('파일에 닿은 뒤에 알린다', async () => {
    const storage = await open();
    const written: string[] = [];
    const handle = (event: Event): void => {
      written.push((event as CustomEvent<string>).detail);
    };
    window.addEventListener('gboard-local-write', handle);

    storage.setItem('classroom-suite:v1:data', 'X');
    await vi.advanceTimersByTimeAsync(300);
    window.removeEventListener('gboard-local-write', handle);

    expect(written).toEqual(['data.json']);
    // 알림이 나갈 때 파일에는 이미 들어 있어야 한다.
    expect(await files.read('data.json')).toBe('X');
  });

  it('쓰기가 실패하면 알리지 않는다', async () => {
    const storage = await FileBackedStorage.open(files, { onWriteError: () => undefined });
    const written: string[] = [];
    const handle = (event: Event): void => {
      written.push((event as CustomEvent<string>).detail);
    };
    window.addEventListener('gboard-local-write', handle);

    files.failNextWrite = true;
    storage.setItem('classroom-suite:v1:data', 'X');
    await vi.advanceTimersByTimeAsync(300);
    window.removeEventListener('gboard-local-write', handle);

    // 안 들어간 것을 들어갔다고 알리면 다른 창이 옛 내용을 읽는다.
    expect(written).toEqual([]);
  });
});
