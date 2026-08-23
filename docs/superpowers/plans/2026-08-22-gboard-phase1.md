# G-board 1판 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지금 웹앱을 윈도우 데스크톱 앱으로 띄우고, 자료가 브라우저가 아니라 파일에 쌓이게 한다.

**Architecture:** Tauri 2가 기존 Vite 빌드를 감싼다. 저장은 새 어댑터를 만들지 않고 `Storage` 인터페이스를 파일로 뒷받침해 `LocalStorageAdapter`를 그대로 쓴다. 웹과 설치형은 `import.meta.env.VITE_TARGET`으로 빌드 시점에 갈린다.

**Tech Stack:** Tauri 2.11 (Rust + WebView2), Vite 6, React 19, TypeScript 5.8 strict, Vitest

**설계 문서:** `docs/superpowers/specs/2026-08-22-gboard-desktop-design.md`

## Global Constraints

- **기능 논리를 고치지 않는다.** `src/features/` 아래에서 허용되는 변경은 전자칠판을 여는 방식(`target="_blank"` → `openBoard()`)뿐이다.
- **기존 745개 테스트가 계속 통과해야 한다.** 각 과업 끝에서 `npm run verify`로 확인한다.
- **`npm run build`(웹)의 첫 화면 청크가 400KB를 넘지 않아야 한다.** 지금 368KB다. Tauri 코드가 웹 번들에 새면 커진다.
- **환경변수를 필수로 만들지 않는다.** `VITE_TARGET`이 없으면 웹으로 동작한다.
- **TypeScript는 `strict` + `noUncheckedIndexedAccess`다.** 배열 접근은 `undefined`가 섞인 타입으로 나온다.
- **주석은 한국어로, 무엇을 하는지가 아니라 왜 그렇게 했는지를 적는다.** 주변 코드의 밀도와 말투를 따른다.
- **Windows에서 작업한다.** Bash 도구는 Git Bash다. `npm run tauri`는 PowerShell/Bash 어느 쪽이든 된다.
- 앱 identifier는 `net.ssamdongne.gboard`, 제품 이름은 `G-board`.

---

## 파일 구조

새로 만드는 것:

| 파일 | 책임 |
|---|---|
| `src/shared/storage/FileStore.ts` | 파일 접근 인터페이스. 구현은 갈아 끼운다 |
| `src/shared/storage/MemoryFileStore.ts` | 테스트용 구현. 실패를 흉내 낼 수 있다 |
| `src/shared/storage/TauriFileStore.ts` | 진짜 구현. Tauri fs 플러그인을 부른다 |
| `src/shared/storage/FileBackedStorage.ts` | `Storage`를 파일로. 메모리 지도 + 예약 쓰기 |
| `src/shared/platform/target.ts` | 지금 웹인가 설치형인가. 한 곳에서만 판단한다 |
| `src/shared/window/openBoard.ts` | 전자칠판 창 열기. 웹/설치형이 다르다 |
| `src-tauri/` | Tauri 껍데기 |

고치는 것:

| 파일 | 무엇을 |
|---|---|
| `vite.config.ts` | `VITE_TARGET` 정의, Tauri용 서버 설정 |
| `src/main.tsx` | 설치형이면 파일 저장소로 시작 |
| `src/app/router.tsx` | 설치형에서 형성평가 라우트 제거 |
| `src/features/home/HomePage.tsx` | 설치형에서 형성평가 카드 → 안내 카드 |
| 여섯 화면 | `<Link target="_blank">` → `openBoard()` |
| `package.json` | `build:desktop`, `tauri` 스크립트 |

---

## Task 1: 지금 어느 쪽인지 판단하는 곳

**Files:**
- Create: `src/shared/platform/target.ts`
- Create: `tests/platform/target.test.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces: `isDesktop(): boolean`, `TARGET: 'web' | 'desktop'`

판단을 한 곳에 모은다. 여기저기서 `import.meta.env`를 읽으면 나중에 조건이
바뀔 때 새는 곳이 생긴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/platform/target.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { isDesktop, TARGET } from '../../src/shared/platform/target';

describe('빌드 대상 판단', () => {
  it('VITE_TARGET이 없으면 웹이다', () => {
    // 아무 설정 없이 fork해 배포해도 웹으로 도는 것이 기본값이다.
    expect(TARGET).toBe('web');
    expect(isDesktop()).toBe(false);
  });

  it('둘은 항상 같은 답을 준다', () => {
    expect(isDesktop()).toBe(TARGET === 'desktop');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/platform/target.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/shared/platform/target"`

- [ ] **Step 3: 구현한다**

`src/shared/platform/target.ts`:

```ts
/**
 * 지금 웹인가 설치형인가.
 *
 * 이 판단을 여기 한 곳에만 둔다. 화면마다 `import.meta.env`를 읽으면
 * 나중에 조건이 바뀔 때 고치다 빠뜨리는 곳이 생긴다.
 *
 * `VITE_TARGET`은 빌드 때 글자로 치환되므로, 아래 분기 중 안 쓰는 쪽은
 * 번들에서 통째로 사라진다. 설치형 바이너리에 웹 전용 코드가,
 * 웹 번들에 Tauri 코드가 들어가지 않는 근거가 이것이다.
 *
 * 값이 없으면 웹이다. 설정 없이 fork해 배포하는 것이 기본 흐름이다.
 */
export const TARGET: 'web' | 'desktop' =
  import.meta.env.VITE_TARGET === 'desktop' ? 'desktop' : 'web';

export function isDesktop(): boolean {
  return TARGET === 'desktop';
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/platform/target.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: vite.config.ts에 값을 넣는다**

`vite.config.ts`의 `defineConfig({...})` 안, `base: '/'` 바로 아래에 추가:

```ts
  define: {
    /*
     * 빌드 대상을 글자로 박아 넣는다. import.meta.env.VITE_TARGET은
     * VITE_ 접두사 덕에 자동으로 들어가지만, 값이 없을 때 undefined가
     * 되어 타입이 흔들린다. 여기서 못 박아 둔다.
     */
    'import.meta.env.VITE_TARGET': JSON.stringify(process.env.VITE_TARGET ?? 'web'),
  },
```

- [ ] **Step 6: package.json에 설치형 빌드 스크립트를 넣는다**

`scripts`에 추가 (`build` 바로 아래):

```json
    "build:desktop": "cross-env VITE_TARGET=desktop vite build",
```

먼저 `cross-env`를 설치한다. Windows에서는 `VITE_TARGET=x vite build`가 안 된다.

```bash
npm install -D cross-env
```

- [ ] **Step 7: 두 빌드가 다 되는지 확인한다**

```bash
npm run build && npm run build:desktop
```

Expected: 둘 다 `✓ built in ...`

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: 빌드 대상을 한 곳에서 판단한다"
```

---

## Task 2: 파일 접근 인터페이스와 메모리 구현

**Files:**
- Create: `src/shared/storage/FileStore.ts`
- Create: `src/shared/storage/MemoryFileStore.ts`
- Create: `tests/storage/MemoryFileStore.test.ts`

**Interfaces:**
- Produces: `interface FileStore`, `class MemoryFileStore implements FileStore`

파일 시스템을 직접 부르면 테스트에서 못 돌린다. 인터페이스로 감싸고
테스트에서는 메모리 구현을 끼운다. `LocalStorageAdapter`가 `MemoryStorage`로
시험받는 것과 같은 방식이다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/storage/MemoryFileStore.test.ts`:

```ts
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
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/storage/MemoryFileStore.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 인터페이스를 만든다**

`src/shared/storage/FileStore.ts`:

```ts
/**
 * 파일 접근.
 *
 * `StorageAdapter`가 저장 방식을 가르는 이음매인 것처럼, 이것은 파일
 * 시스템을 가르는 이음매다. 실제 구현은 Tauri를 부르고, 테스트는
 * 메모리 구현을 끼운다.
 *
 * 경로는 앱 자료 폴더 기준의 상대 경로다(`data.json`). 절대 경로를
 * 다루는 것은 구현의 몫이라, 부르는 쪽이 운영체제를 알 필요가 없다.
 */
export interface FileStore {
  /** 없으면 null. 못 읽는 것과 없는 것을 구별하지 않는다 — 부르는 쪽이 할 일이 같다. */
  read(path: string): Promise<string | null>;

  /**
   * 반쪽 파일을 남기지 않고 쓴다.
   *
   * 임시 파일에 쓴 뒤 이름을 바꿔 치운다. 어느 순간에 죽어도 남는 것은
   * 옛 파일 아니면 새 파일이지 반쪽짜리가 아니다. 한 해치 학급 자료가
   * 걸린 일이라 이 보장이 이 인터페이스의 존재 이유다.
   */
  writeAtomic(path: string, text: string): Promise<void>;

  remove(path: string): Promise<void>;
}
```

- [ ] **Step 4: 메모리 구현을 만든다**

`src/shared/storage/MemoryFileStore.ts`:

```ts
import type { FileStore } from './FileStore';

/**
 * 테스트용 파일 저장소.
 *
 * `failNextWrite`로 쓰기 실패를 흉내 낼 수 있다. 원자적 쓰기가 진짜로
 * 옛 내용을 지키는지는 실패를 만들어 봐야 확인할 수 있다.
 */
export class MemoryFileStore implements FileStore {
  private files = new Map<string, string>();

  /** 다음 쓰기를 실패시킨다. 한 번 쓰면 저절로 꺼진다. */
  failNextWrite = false;
  /** 실제로 파일에 쓴 횟수. 예약 쓰기가 묶이는지 확인할 때 쓴다. */
  writeCount = 0;

  read(path: string): Promise<string | null> {
    return Promise.resolve(this.files.get(path) ?? null);
  }

  writeAtomic(path: string, text: string): Promise<void> {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      // 옛 내용은 건드리지 않는다. 이름 바꾸기가 실패한 상황을 흉내 낸다.
      return Promise.reject(new Error(`쓰기 실패: ${path}`));
    }

    this.files.set(path, text);
    this.writeCount += 1;
    return Promise.resolve();
  }

  remove(path: string): Promise<void> {
    this.files.delete(path);
    return Promise.resolve();
  }
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run tests/storage/MemoryFileStore.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: 파일 접근 이음매와 테스트용 구현"
```

---

## Task 3: Storage를 파일로 뒷받침한다

**Files:**
- Create: `src/shared/storage/FileBackedStorage.ts`
- Create: `tests/storage/FileBackedStorage.test.ts`

**Interfaces:**
- Consumes: `FileStore`, `MemoryFileStore` (Task 2)
- Produces: `class FileBackedStorage implements Storage`, `FileBackedStorage.open(store, options?): Promise<FileBackedStorage>`, `storage.flush(): Promise<void>`

이 과업이 1판의 심장이다. `LocalStorageAdapter`가 쓰는 것은
`getItem`·`setItem`·`removeItem` 셋뿐이므로, 이 셋을 파일로 뒷받침하면
어댑터 445줄과 그 시험 25개를 그대로 물려받는다.

`Storage`는 동기고 파일은 비동기다. 켤 때 한 번 읽어 메모리를 채우고,
읽기는 메모리에서 답하고, 쓰기는 메모리를 고친 뒤 예약한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/storage/FileBackedStorage.test.ts`:

```ts
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
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/storage/FileBackedStorage.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현한다**

`src/shared/storage/FileBackedStorage.ts`:

```ts
import type { FileStore } from './FileStore';

/**
 * 열쇠가 어느 파일로 가는가.
 *
 * 가르는 기준은 **백업하는가**와 **오래되면 버리는가** 둘이다.
 * `data.json`만 백업·내보내기 대상이라, 선생님이 그 파일 하나만
 * 복사해 두면 자료를 지킨 것이 된다.
 *
 * meta와 neis-key는 자잘해서 한 파일에 함께 담는다. 파일이 늘어날수록
 * 폴더를 여신 분이 무엇이 무엇인지 알기 어렵다.
 */
export const KEY_TO_FILE = {
  'classroom-suite:v1:data': 'data.json',
  'classroom-suite:v1:backups': 'backups.json',
  'classroom-suite:v1:meta': 'prefs.json',
  'classroom-suite:v1:neis-key': 'prefs.json',
} as const;

/** 몰아친 쓰기를 묶는 시간. 보상 점수는 수업 중 분당 여러 번 눌린다. */
const WRITE_DELAY_MS = 200;

interface Options {
  /** 파일에 못 썼을 때 알릴 통로 */
  onWriteError?: (message: string) => void;
}

/**
 * `Storage`를 파일로 뒷받침한다.
 *
 * `LocalStorageAdapter`가 쓰는 것은 `getItem`·`setItem`·`removeItem`
 * 셋뿐이다. 그 셋을 파일에 얹으면 어댑터 445줄과 그 시험 25개를
 * 고스란히 물려받는다. 새 어댑터를 쓰면 그 전부를 다시 써야 한다.
 *
 * ## 동기와 비동기를 잇는 법
 *
 * `Storage`는 동기고 파일은 비동기다. 켤 때 한 번 읽어 메모리를 채우고,
 * 읽기는 메모리에서 답하고, 쓰기는 메모리를 고친 뒤 예약한다.
 *
 * ## 못 썼을 때
 *
 * 메모리 값은 되돌리지 않는다. 저장이 실패했다고 화면의 자료까지
 * 잃으면 방금 준 점수가 눈앞에서 사라진다. 알리되 들고 있는다.
 */
export class FileBackedStorage implements Storage {
  private map = new Map<string, string>();
  private dirty = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: Promise<void> | null = null;

  private constructor(
    private readonly files: FileStore,
    private readonly onWriteError: (message: string) => void,
  ) {}

  /**
   * 파일을 읽어 저장소를 연다.
   *
   * 생성자가 아니라 이 함수로 여는 이유는 읽기가 비동기이기 때문이다.
   * 반쯤 채워진 저장소를 남에게 넘기지 않는다.
   */
  static async open(files: FileStore, options?: Options): Promise<FileBackedStorage> {
    const storage = new FileBackedStorage(
      files,
      options?.onWriteError ?? ((message) => console.warn(message)),
    );

    const fileNames = [...new Set(Object.values(KEY_TO_FILE))];

    for (const fileName of fileNames) {
      const raw = await files.read(fileName);
      if (raw === null) continue;

      const keys = ownersOf(fileName);
      if (keys.length === 1 && keys[0] !== undefined) {
        // 파일 하나가 열쇠 하나를 통째로 담는다. 글자 그대로 넣는다.
        storage.map.set(keys[0], raw);
        continue;
      }

      // 여럿이 함께 사는 파일이다. 열쇠별로 갈라 담는다.
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) continue;
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value === 'string') storage.map.set(key, value);
        }
      } catch {
        // 이 파일이 깨졌다고 본 자료까지 못 열면 안 된다. 없는 셈 친다.
      }
    }

    return storage;
  }

  // ── Storage 인터페이스 ──────────────────────────────────────

  get length(): number {
    return this.map.size;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
    this.schedule(key);
  }

  removeItem(key: string): void {
    this.map.delete(key);
    this.schedule(key);
  }

  clear(): void {
    const keys = [...this.map.keys()];
    this.map.clear();
    for (const key of keys) this.schedule(key);
  }

  // ── 파일로 내보내기 ─────────────────────────────────────────

  private schedule(key: string): void {
    const fileName = KEY_TO_FILE[key as keyof typeof KEY_TO_FILE];
    // 우리가 모르는 열쇠는 메모리에만 둔다. 파일을 함부로 늘리지 않는다.
    if (fileName === undefined) return;

    this.dirty.add(fileName);
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.pending = this.writeDirty();
    }, WRITE_DELAY_MS);
  }

  /** 예약된 쓰기를 곧바로 내보낸다. 창을 닫을 때 반드시 부른다. */
  async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
      this.pending = this.writeDirty();
    }

    await this.pending;
  }

  private async writeDirty(): Promise<void> {
    const targets = [...this.dirty];
    this.dirty.clear();

    for (const fileName of targets) {
      const keys = ownersOf(fileName);
      const single = keys.length === 1 ? keys[0] : undefined;

      try {
        if (single !== undefined) {
          const value = this.map.get(single);
          if (value === undefined) await this.files.remove(fileName);
          else await this.files.writeAtomic(fileName, value);
          continue;
        }

        const bundle: Record<string, string> = {};
        for (const key of keys) {
          const value = this.map.get(key);
          if (value !== undefined) bundle[key] = value;
        }

        if (Object.keys(bundle).length === 0) await this.files.remove(fileName);
        else await this.files.writeAtomic(fileName, JSON.stringify(bundle));
      } catch (error) {
        /*
         * 메모리 값은 되돌리지 않는다. 저장이 실패했다고 화면의 자료까지
         * 잃으면 방금 준 점수가 눈앞에서 사라진다.
         */
        this.onWriteError(
          `${fileName}에 저장하지 못했습니다: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}

/** 이 파일에 담기는 열쇠들 */
function ownersOf(fileName: string): string[] {
  return Object.entries(KEY_TO_FILE)
    .filter(([, name]) => name === fileName)
    .map(([key]) => key);
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/storage/FileBackedStorage.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: 물려받은 논리가 진짜 도는지 확인한다**

`tests/storage/adapter-on-files.test.ts`를 새로 만든다. 이것이 이 설계의
증명이다 — 파일 저장소를 끼운 `LocalStorageAdapter`가 예전과 똑같이 구는가.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createClassRoom, createEmptySuiteData, createTerm } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { FileBackedStorage } from '../../src/shared/storage/FileBackedStorage';
import { LocalStorageAdapter } from '../../src/shared/storage/LocalStorageAdapter';
import { MemoryFileStore } from '../../src/shared/storage/MemoryFileStore';

const T0 = '2026-03-02T09:00:00.000Z';

function sample(name: string): SuiteData {
  return {
    ...createEmptySuiteData(),
    profile: { schoolName: name, teacherName: '임한솔', grade: '', classNo: '' },
    terms: [
      createTerm(
        { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
        T0,
      ),
    ],
    classRooms: [createClassRoom({ id: 'class-1', termId: 'term-1', name: '3학년 2반' }, T0)],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

let files: MemoryFileStore;
let storage: FileBackedStorage;
let adapter: LocalStorageAdapter;

beforeEach(async () => {
  vi.useFakeTimers();
  files = new MemoryFileStore();
  storage = await FileBackedStorage.open(files);
  adapter = new LocalStorageAdapter(storage, () => T0);
});

describe('파일 저장소를 끼운 LocalStorageAdapter', () => {
  it('아무것도 없으면 첫 실행으로 알린다', async () => {
    const result = await adapter.load();

    expect(result.isFirstRun).toBe(true);
  });

  it('저장한 것을 다시 불러온다', async () => {
    await adapter.save(sample('한빛초등학교'));

    const result = await adapter.load();
    expect(result.data.profile.schoolName).toBe('한빛초등학교');
  });

  it('앱을 다시 켜도 자료가 남아 있다', async () => {
    await adapter.save(sample('한빛초등학교'));
    await storage.flush();

    // 같은 파일 위에서 새로 연다. 앱을 껐다 켠 것과 같다.
    const reopened = await FileBackedStorage.open(files);
    const next = new LocalStorageAdapter(reopened, () => T0);

    const result = await next.load();
    expect(result.data.profile.schoolName).toBe('한빛초등학교');
    expect(result.isFirstRun).toBe(false);
  });

  it('data.json이 깨져 있으면 백업으로 되돌린다', async () => {
    await adapter.save(sample('한빛초등학교'));
    await adapter.createBackup('시험용', 'guard');
    await storage.flush();

    await files.writeAtomic('data.json', '{ 이건 JSON이 아니다');
    const reopened = await FileBackedStorage.open(files);
    const next = new LocalStorageAdapter(reopened, () => T0);

    const result = await next.load();
    // 물려받은 복구 논리가 파일 위에서도 그대로 돈다.
    expect(result.data.profile.schoolName).toBe('한빛초등학교');
    expect(result.repairs.length).toBeGreaterThan(0);
  });

  it('백업은 data.json이 아니라 backups.json으로 간다', async () => {
    await adapter.save(sample('한빛초등학교'));
    await adapter.createBackup('학기 전환 직전', 'guard');
    await storage.flush();

    expect(await files.read('backups.json')).not.toBeNull();
    // 선생님이 data.json만 복사해 가도 자료가 온전해야 한다.
    expect((await files.read('data.json')) ?? '').not.toContain('학기 전환 직전');
  });
});
```

- [ ] **Step 6: 물려받은 논리 시험을 돌린다**

Run: `npx vitest run tests/storage/adapter-on-files.test.ts`
Expected: PASS (5 tests)

문제가 나면 `FileBackedStorage`를 고친다. `LocalStorageAdapter`는 고치지 않는다 —
745개가 그것에 기대고 있다.

- [ ] **Step 7: 전체 확인**

Run: `npm run verify`
Expected: 771 tests passed (745 기준 + 2 + 5 + 19)

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: Storage를 파일로 뒷받침해 어댑터를 그대로 쓴다"
```

---

## Task 4: Tauri 껍데기를 세운다

**Files:**
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/icons/` (생성 명령으로 만든다)
- Modify: `vite.config.ts`, `package.json`, `.gitignore`

**Interfaces:**
- Produces: `npm run tauri dev`로 앱 창이 뜬다

이 과업은 시험을 쓰지 않는다. 껍데기가 뜨느냐는 **눈으로 확인**할 일이고,
자동화하면 CI에 Rust 툴체인이 필요해진다. 대신 확인 단계를 명시한다.

- [ ] **Step 1: Tauri CLI를 설치한다**

```bash
npm install -D @tauri-apps/cli@^2.11.4
npm install @tauri-apps/api@^2.11.1 @tauri-apps/plugin-fs@^2
```

- [ ] **Step 2: 껍데기를 만든다**

```bash
npx tauri init --app-name "G-board" --window-title "G-board" --frontend-dist "../dist" --dev-url "http://localhost:3000" --before-dev-command "npm run dev" --before-build-command "npm run build:desktop"
```

물어보면 위 값 그대로 답한다. `src-tauri/`가 생긴다.

- [ ] **Step 3: tauri.conf.json을 손본다**

`src-tauri/tauri.conf.json`을 아래로 바꾼다.

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "G-board",
  "version": "0.1.0",
  "identifier": "net.ssamdongne.gboard",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:3000",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build:desktop"
  },
  "app": {
    "windows": [
      {
        "title": "G-board",
        "width": 1280,
        "height": 800,
        "minWidth": 1024,
        "minHeight": 700,
        "resizable": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.ico"]
  }
}
```

`identifier`가 자료 폴더 이름을 정한다. **나중에 바꾸면 쓰시던 분들의
자료 위치가 어긋난다.** 여기서 못 박는다.

- [ ] **Step 4: 임시 아이콘을 만든다**

512x512 PNG 하나를 만들어 `src-tauri/app-icon.png`로 두고:

```bash
npx tauri icon src-tauri/app-icon.png
```

임시로 쓸 PNG는 아래 명령으로 만든다 (파랑 바탕에 흰 `G`).

```bash
node -e "
const s=512;
const svg='<svg xmlns=\"http://www.w3.org/2000/svg\" width='+s+' height='+s+'><rect width='+s+' height='+s+' rx=96 fill=\"#2563eb\"/><text x=\"50%\" y=\"50%\" dy=\".35em\" text-anchor=\"middle\" font-family=\"Arial\" font-size=\"320\" font-weight=\"bold\" fill=\"white\">G</text></svg>';
require('fs').writeFileSync('src-tauri/app-icon.svg', svg);
console.log('SVG 생성. PNG 변환이 필요하면 tauri icon이 svg도 받는다.');
"
npx tauri icon src-tauri/app-icon.svg
```

- [ ] **Step 5: 개발 서버 포트를 고정한다**

`vite.config.ts`의 `server`를 아래로 바꾼다. Tauri는 `devUrl`에 적힌
포트로만 붙으므로, 포트가 바뀌면 흰 화면이 뜬다.

```ts
  server: {
    // Tauri가 devUrl로 이 포트를 본다. 자동으로 옮겨 다니면 흰 화면이 뜬다.
    port: Number(process.env.PORT ?? 3000),
    strictPort: true,
  },
```

- [ ] **Step 6: package.json에 스크립트를 넣는다**

```json
    "tauri": "tauri",
    "desktop:dev": "tauri dev",
    "desktop:build": "tauri build",
```

- [ ] **Step 7: .gitignore에 빌드 산출물을 넣는다**

`.gitignore`에 추가:

```
# Tauri 빌드 산출물
src-tauri/target/
src-tauri/gen/
```

- [ ] **Step 8: 앱이 뜨는지 눈으로 확인한다**

```bash
npm run desktop:dev
```

Expected:
- 첫 실행은 Rust를 컴파일하느라 3~10분 걸린다. 정상이다.
- `G-board`라는 제목의 창이 뜬다
- 지금 웹앱 화면이 그대로 보인다
- 창을 1024x700보다 작게 못 줄인다

확인했으면 창을 닫는다.

- [ ] **Step 9: 웹 빌드가 안 망가졌는지 확인한다**

```bash
npm run verify
```

Expected: 771 tests passed, `✓ built in ...`

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "feat: Tauri 껍데기를 세운다"
```

---

## Task 5: 진짜 파일 저장소를 끼운다

**Files:**
- Create: `src/shared/storage/TauriFileStore.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `FileStore` (Task 2), `FileBackedStorage.open` (Task 3), `isDesktop` (Task 1)
- Produces: 설치형에서 자료가 `%APPDATA%\net.ssamdongne.gboard\`에 쌓인다

- [ ] **Step 1: Tauri 파일 저장소를 만든다**

`src/shared/storage/TauriFileStore.ts`:

```ts
import type { FileStore } from './FileStore';

/**
 * Tauri 파일 저장소.
 *
 * 앱 자료 폴더(`%APPDATA%\net.ssamdongne.gboard\`) 안에서만 움직인다.
 * `BaseDirectory.AppData`를 쓰면 경로를 우리가 조립하지 않아도 되고,
 * 운영체제가 달라도 알맞은 자리를 잡아 준다.
 *
 * `@tauri-apps/plugin-fs`는 동적으로 가져온다. 정적으로 부르면 웹 번들에도
 * 실린다 — Firebase를 붙일 때 첫 화면이 조용히 세 배가 된 적이 있다.
 */
export class TauriFileStore implements FileStore {
  async read(path: string): Promise<string | null> {
    const { readTextFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');

    try {
      if (!(await exists(path, { baseDir: BaseDirectory.AppData }))) return null;
      return await readTextFile(path, { baseDir: BaseDirectory.AppData });
    } catch {
      // 못 읽는 것과 없는 것을 구별하지 않는다. 부르는 쪽이 할 일이 같다.
      return null;
    }
  }

  /**
   * 임시 파일에 쓴 뒤 이름을 바꿔 치운다.
   *
   * 곧바로 덮어쓰면, 쓰는 도중에 앱이 죽었을 때 반쪽짜리 파일이 남는다.
   * 그건 JSON도 아니라서 한 해치 학급 자료가 그대로 사라진다.
   * 이름 바꾸기는 운영체제가 쪼갤 수 없는 한 동작으로 처리한다.
   */
  async writeAtomic(path: string, text: string): Promise<void> {
    const { writeTextFile, rename, mkdir, exists, BaseDirectory } = await import(
      '@tauri-apps/plugin-fs'
    );

    const options = { baseDir: BaseDirectory.AppData } as const;
    const temporary = `${path}.tmp`;

    // 처음 실행이면 폴더가 아직 없다.
    await mkdir('', { ...options, recursive: true }).catch(() => undefined);

    await writeTextFile(temporary, text, options);

    // 윈도우는 대상이 있으면 rename이 실패한다. 먼저 치운다.
    if (await exists(path, options)) {
      await this.remove(path);
    }

    await rename(temporary, path, { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData });
  }

  async remove(path: string): Promise<void> {
    const { remove, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    const options = { baseDir: BaseDirectory.AppData } as const;

    if (await exists(path, options)) {
      await remove(path, options);
    }
  }
}
```

- [ ] **Step 2: main.tsx가 설치형이면 파일 저장소를 쓰게 한다**

`src/main.tsx`에서 `import { resolveAdapter } ...` 아래에 추가:

```ts
import { isDesktop } from './shared/platform/target';
import { LocalStorageAdapter } from './shared/storage/LocalStorageAdapter';
import type { StorageAdapter } from './shared/storage/StorageAdapter';
```

그리고 `void resolveAdapter(...)` 부분을 아래로 바꾼다:

```ts
/**
 * 저장소를 정한 뒤에 그린다.
 *
 * 설치형은 파일에, 웹은 브라우저에 담는다. 웹에서 Firebase 설정이
 * 비어 있으면 resolveAdapter가 기다리지 않고 곧바로 돌려주므로,
 * 설정을 안 넣은 교사에게는 아무 지연이 없다.
 *
 * 최상위 await를 쓰지 않는다. 타입 검사와 테스트는 통과하지만 빌드 목표가
 * es2020이라 esbuild가 거부한다. then으로 받아야 빌드까지 지나간다.
 */
async function chooseAdapter(): Promise<StorageAdapter> {
  if (!isDesktop()) {
    return resolveAdapter((message) => console.warn(message));
  }

  const [{ FileBackedStorage }, { TauriFileStore }] = await Promise.all([
    import('./shared/storage/FileBackedStorage'),
    import('./shared/storage/TauriFileStore'),
  ]);

  const storage = await FileBackedStorage.open(new TauriFileStore(), {
    onWriteError: (message) => console.warn(message),
  });

  /*
   * 창을 닫을 때 예약된 쓰기를 반드시 흘려보낸다. 이걸 빠뜨리면
   * 마지막 몇 초에 준 점수가 사라진다.
   */
  window.addEventListener('beforeunload', () => {
    void storage.flush();
  });

  return new LocalStorageAdapter(storage);
}

void chooseAdapter().then((adapter) => {
  createRoot(rootElement).render(
    <StrictMode>
      {/*
        전자칠판 라우트는 AppShell 밖에 있으므로 알림·데이터를 라우터 바깥에서 감싼다.
        Toast가 바깥이어야 SuiteDataProvider가 복구 내역을 알릴 수 있다.
      */}
      <ToastProvider>
        <SuiteDataProvider adapter={adapter}>
          <RouterProvider router={router} />
        </SuiteDataProvider>
      </ToastProvider>
    </StrictMode>,
  );
});
```

- [ ] **Step 3: fs 플러그인을 Rust 쪽에 등록한다**

`src-tauri/Cargo.toml`의 `[dependencies]`에 추가:

```toml
tauri-plugin-fs = "2"
```

`src-tauri/src/lib.rs`의 `tauri::Builder::default()` 뒤에 붙인다:

```rust
        .plugin(tauri_plugin_fs::init())
```

- [ ] **Step 4: 권한을 연다**

`src-tauri/capabilities/default.json`의 `permissions` 배열에 추가:

```json
    "fs:allow-appdata-read-recursive",
    "fs:allow-appdata-write-recursive",
    "fs:allow-mkdir",
    "fs:allow-rename",
    "fs:allow-exists",
    "fs:allow-remove"
```

- [ ] **Step 5: 자료가 파일에 쌓이는지 눈으로 확인한다**

```bash
npm run desktop:dev
```

앱에서 **설정 → 학급·학기**로 가서 학급을 하나 만든다. 그다음:

```bash
ls -la "$APPDATA/net.ssamdongne.gboard/"
cat "$APPDATA/net.ssamdongne.gboard/data.json" | head -c 300
```

Expected:
- `data.json`이 있고 방금 만든 학급 이름이 들어 있다
- 앱을 껐다 켜도 학급이 그대로 있다

- [ ] **Step 6: 웹이 안 망가졌는지 확인한다**

```bash
npm run verify
```

Expected: 771 tests passed

- [ ] **Step 7: 웹 번들에 Tauri 코드가 안 섞였는지 확인한다**

```bash
npm run build
grep -rl "plugin-fs\|__TAURI__" dist/assets/*.js || echo "깨끗함"
ls -S dist/assets/*.js | head -1 | xargs du -k
```

Expected:
- `깨끗함`
- 가장 큰 청크가 400KB 이하

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: 설치형에서 자료를 파일에 담는다"
```

---

## Task 6: 전자칠판을 앱 창으로 연다

**Files:**
- Create: `src/shared/window/openBoard.ts`
- Create: `tests/window/openBoard.test.ts`
- Modify: `src/features/seating/SeatingPage.tsx:179`, `src/features/duty/DutyPage.tsx:118`, `src/features/reward/RewardPage.tsx:137`, `src/features/assignment/AssignmentPage.tsx:109`, `src/features/lesson/LessonPage.tsx:57`, `src/features/quiz/QuizPage.tsx:48`

**Interfaces:**
- Consumes: `isDesktop` (Task 1)
- Produces: `openBoard(path: string): void`

지금은 `<Link target="_blank">`가 전자칠판을 연다. 데스크톱에서 이 링크는
**앱 창이 아니라 크롬을 연다.** 그 크롬은 `%APPDATA%`의 파일을 볼 수 없어
빈 화면이 뜬다. 안 고치면 전자칠판 기능 전체가 죽는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/window/openBoard.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { openBoard } from '../../src/shared/window/openBoard';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('openBoard — 웹에서', () => {
  it('새 탭을 연다', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    openBoard('/board/seating');

    expect(open).toHaveBeenCalledWith('/board/seating', '_blank', 'noopener');
  });

  it('경로를 그대로 넘긴다', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    openBoard('/board/duty');

    expect(open).toHaveBeenCalledWith('/board/duty', '_blank', 'noopener');
  });
});
```

테스트 환경에서 `VITE_TARGET`은 `web`이므로 웹 갈래만 확인한다.
설치형 갈래는 Task 5처럼 앱을 띄워 눈으로 본다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/window/openBoard.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현한다**

`src/shared/window/openBoard.ts`:

```ts
import { isDesktop } from '../platform/target';

/**
 * 전자칠판 화면을 연다.
 *
 * 웹에서는 새 탭이고, 설치형에서는 새 앱 창이다.
 *
 * 이 함수가 필요한 이유는 데스크톱에서 `<a target="_blank">`가 **앱 창이
 * 아니라 기본 브라우저를 열기** 때문이다. 그렇게 열린 크롬은 앱 자료
 * 폴더의 파일을 볼 수 없어 빈 전자칠판이 뜬다.
 *
 * 두 번째 모니터가 있으면 그쪽에 띄운다. 교실 화면이 보통 그쪽이다.
 */
export function openBoard(path: string): void {
  if (!isDesktop()) {
    window.open(path, '_blank', 'noopener');
    return;
  }

  void openDesktopWindow(path);
}

async function openDesktopWindow(path: string): Promise<void> {
  const [{ WebviewWindow }, { availableMonitors, primaryMonitor }] = await Promise.all([
    import('@tauri-apps/api/webviewWindow'),
    import('@tauri-apps/api/window'),
  ]);

  const label = 'board';

  // 이미 떠 있으면 새로 만들지 않고 그 창을 앞으로 가져온다.
  const existing = await WebviewWindow.getByLabel(label);
  if (existing !== null) {
    await existing.setFocus();
    return;
  }

  const board = new WebviewWindow(label, {
    url: path,
    title: 'G-board 전자칠판',
    fullscreen: true,
  });

  await board.once('tauri://created', async () => {
    const monitors = await availableMonitors();
    const primary = await primaryMonitor();
    const second = monitors.find((m) => m.name !== primary?.name);
    if (second === undefined) return;

    // 두 번째 모니터의 왼쪽 위로 옮긴 뒤 전체 화면으로 만든다.
    const { LogicalPosition } = await import('@tauri-apps/api/dpi');
    await board.setFullscreen(false);
    await board.setPosition(new LogicalPosition(second.position.x, second.position.y));
    await board.setFullscreen(true);
  });
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/window/openBoard.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 여섯 화면을 바꾼다**

각 파일에서 아래 모양의 `<Link>`를 찾는다:

```tsx
          <Link
            to="/board/seating"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-control border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Monitor className="size-4" aria-hidden />
            전자칠판
          </Link>
```

이렇게 바꾼다 (경로는 파일마다 다르다):

```tsx
          <Button variant="secondary" icon={Monitor} onClick={() => openBoard('/board/seating')}>
            전자칠판
          </Button>
```

각 파일 위쪽에 import를 더한다:

```tsx
import { openBoard } from '../../shared/window/openBoard';
```

`Link`를 그 파일에서 더 안 쓰면 `react-router-dom` import에서 뺀다.
`Button`을 아직 안 가져왔으면 `'../../shared/ui'`에서 가져온다.

파일과 경로:

| 파일 | 경로 |
|---|---|
| `src/features/seating/SeatingPage.tsx` | `/board/seating` |
| `src/features/duty/DutyPage.tsx` | `/board/duty` |
| `src/features/reward/RewardPage.tsx` | `/board/reward` |
| `src/features/assignment/AssignmentPage.tsx` | `/board/assignment` |
| `src/features/lesson/LessonPage.tsx` | `/board/lesson` |
| `src/features/quiz/QuizPage.tsx` | `/board/quiz` |

- [ ] **Step 6: 남은 곳이 없는지 확인한다**

```bash
grep -rn 'to="/board' src/features/ | grep 'target="_blank"' || echo "다 바꿨다"
```

Expected: `다 바꿨다`

- [ ] **Step 7: 전체 확인**

Run: `npm run verify`
Expected: 773 tests passed

기존 화면 테스트가 `링크`를 찾다가 깨질 수 있다. 그러면 그 테스트를
`getByRole('button', { name: '전자칠판' })`으로 고친다 — 화면이 실제로
버튼이 됐으므로 테스트가 따라가는 것이 맞다.

- [ ] **Step 8: 설치형에서 눈으로 확인한다**

```bash
npm run desktop:dev
```

자리·모둠 화면에서 [전자칠판]을 누른다.

Expected:
- 크롬이 아니라 **새 앱 창**이 전체 화면으로 뜬다
- 그 창에 자리표가 보인다 (빈 화면이 아니다)
- 교사 창에서 자리를 바꾸면 전자칠판 창도 따라 바뀐다 — **안 따라오면 Task 7이 필요하다는 뜻이다**
- 다시 [전자칠판]을 눌러도 창이 하나만 뜬다

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "feat: 전자칠판을 앱 창으로 연다"
```

---

## Task 7: 두 창이 같은 자료를 보게 한다

**Files:**
- Modify: `src/shared/storage/FileBackedStorage.ts`
- Modify: `tests/storage/FileBackedStorage.test.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `FileBackedStorage` (Task 3)
- Produces: `storage.acceptExternalChange(fileName: string): Promise<void>`

### 먼저 알아야 할 것

`LocalStorageAdapter.subscribe()`는 저장소 객체가 아니라 **`window`의
`storage` 이벤트**를 듣는다. 실제 코드는 이렇다.

```ts
  subscribe(listener: (data: SuiteData) => void): () => void {
    const handle = (event: StorageEvent): void => {
      if (event.key !== STORAGE_KEYS.data) return;
      if (event.newValue === null) return;
      // ... parseSuiteData 후 listener 호출
    };
    window.addEventListener('storage', handle);
    return () => window.removeEventListener('storage', handle);
  }
```

Tauri 창에서는 그 이벤트가 **아예 일어나지 않는다.** 브라우저가 같은 출처의
다른 탭에게 쏘는 것인데, Tauri 창 둘은 서로 남이다.

그래서 이렇게 한다. 다른 창이 파일을 고쳤을 때 **`StorageEvent`를 만들어
`window`에 던진다.** 어댑터는 자기가 브라우저에 있는 줄 알고 그대로 돈다.
**어댑터를 한 줄도 고치지 않는다** — 745개가 그것에 기대고 있다.

- [ ] **Step 1: 실패하는 테스트를 더한다**

`tests/storage/FileBackedStorage.test.ts` 끝에 붙인다:

```ts
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
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/storage/FileBackedStorage.test.ts`
Expected: FAIL — `storage.acceptExternalChange is not a function`

- [ ] **Step 3: 구현한다**

`FileBackedStorage` 클래스 안, `flush()` 아래에 더한다:

```ts
  /**
   * 다른 창이 파일을 고쳤을 때 그 내용을 받아 들인다.
   *
   * 메모리를 고친 뒤 `window`에 `storage` 이벤트를 던지는 것이 핵심이다.
   * `LocalStorageAdapter.subscribe()`가 그 이벤트를 듣기 때문에, 어댑터를
   * 한 줄도 고치지 않고 창 간 동기화를 얻는다. Tauri 창 둘은 서로 남이라
   * 브라우저가 그 이벤트를 대신 쏴 주지 않는다.
   */
  async acceptExternalChange(fileName: string): Promise<void> {
    const raw = await this.files.read(fileName);
    const keys = ownersOf(fileName);
    const single = keys.length === 1 ? keys[0] : undefined;

    if (single !== undefined) {
      if (raw === null) this.map.delete(single);
      else this.map.set(single, raw);
      this.announce(single, raw);
      return;
    }

    if (raw === null) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // 남의 창이 파일을 망가뜨렸다고 내 화면까지 비우지 않는다.
      return;
    }

    if (typeof parsed !== 'object' || parsed === null) return;
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== 'string') continue;
      this.map.set(key, value);
      this.announce(key, value);
    }
  }

  /** 브라우저가 다른 탭에 알릴 때 쓰는 것과 같은 모양의 이벤트를 만든다. */
  private announce(key: string, newValue: string | null): void {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
  }
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/storage/FileBackedStorage.test.ts`
Expected: PASS (18 tests)

- [ ] **Step 5: 파일을 쓸 때 그 사실을 알린다**

`FileBackedStorage`의 `writeDirty()` 안, 파일 쓰기가 성공한 뒤에 알린다.
`try` 블록의 끝(두 갈래가 만나는 자리)에 한 줄을 둔다. 지금 코드에서
`continue`로 빠져나가는 갈래가 있으므로, 그 `continue`를 없애고 갈래를
`if / else`로 바꾼 뒤 공통 끝에 알림을 둔다.

```ts
      try {
        if (single !== undefined) {
          const value = this.map.get(single);
          if (value === undefined) await this.files.remove(fileName);
          else await this.files.writeAtomic(fileName, value);
        } else {
          const bundle: Record<string, string> = {};
          for (const key of keys) {
            const value = this.map.get(key);
            if (value !== undefined) bundle[key] = value;
          }

          if (Object.keys(bundle).length === 0) await this.files.remove(fileName);
          else await this.files.writeAtomic(fileName, JSON.stringify(bundle));
        }

        /*
         * 파일에 닿은 뒤에 알린다. 예약 단계에서 알리면 아직 파일에 없는
         * 것을 다른 창이 읽으러 가서 옛 내용을 본다.
         */
        window.dispatchEvent(new CustomEvent('gboard-local-write', { detail: fileName }));
      } catch (error) {
```

`writeDirty()` 위쪽의 `const single = keys.length === 1 ? keys[0] : undefined;`는
그대로 둔다.

- [ ] **Step 6: 알림이 나가는지 시험한다**

`tests/storage/FileBackedStorage.test.ts`에 더한다:

```ts
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
```

Run: `npx vitest run tests/storage/FileBackedStorage.test.ts`
Expected: PASS (20 tests)

- [ ] **Step 7: 창끼리 잇는다**

`src/main.tsx`의 `chooseAdapter` 안, `storage`를 만든 뒤·`beforeunload`
등록 앞에 더한다:

```ts
  /*
   * 창끼리 알린다. 교사 창에서 자리를 바꾸면 전자칠판 창이 따라와야
   * 하는데, Tauri 창 둘은 각자 다른 webview라 브라우저의 storage
   * 이벤트가 없다. Tauri의 창 간 이벤트로 그 자리를 채운다.
   */
  const [{ emit, listen }, { getCurrentWebviewWindow }] = await Promise.all([
    import('@tauri-apps/api/event'),
    import('@tauri-apps/api/webviewWindow'),
  ]);

  const me = getCurrentWebviewWindow().label;

  window.addEventListener('gboard-local-write', (event) => {
    const fileName = (event as CustomEvent<string>).detail;
    void emit('gboard://file-changed', { from: me, fileName });
  });

  void listen<{ from: string; fileName: string }>('gboard://file-changed', (event) => {
    // 내가 보낸 것이 돌아온 것이면 버린다. 안 그러면 끝없이 돈다.
    if (event.payload.from === me) return;
    void storage.acceptExternalChange(event.payload.fileName);
  });
```

`emit`은 보낸 창에도 닿는다. `from`으로 거르지 않으면 이렇게 돈다 —
내가 쓴다 → 알린다 → 내가 받는다 → `acceptExternalChange`가
`storage` 이벤트를 던진다 → 어댑터가 저장한다 → 처음으로.

- [ ] **Step 8: 두 창이 따라오는지 눈으로 확인한다**

```bash
npm run desktop:dev
```

Expected:
- 자리·모둠에서 [전자칠판]을 열어 둔 채 교사 창에서 자리를 바꾸면,
  전자칠판 창이 **1초 안에** 따라 바뀐다
- 개발자 도구 콘솔(Ctrl+Shift+I)에 같은 메시지가 끝없이 찍히지 않는다
- 전자칠판 창을 닫아도 교사 창이 멀쩡하다

- [ ] **Step 9: 전체 확인**

Run: `npm run verify`
Expected: 779 tests passed

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "feat: 두 창이 같은 자료를 본다"
```

---

## Task 8: 설치형에서 형성평가를 뺀다

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/features/home/HomePage.tsx`
- Create: `tests/app/desktopRoutes.test.ts`

**Interfaces:**
- Consumes: `isDesktop`, `TARGET` (Task 1)

설치형에는 서버가 없어 학생 폰이 들어올 길이 없다. 반쯤 살려 두면
"되는 줄 알았는데 안 되는" 자리가 생긴다. 통째로 뺀다. 다만 사라진 것으로
보이면 안 되므로 홈에 안내 카드를 둔다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/app/desktopRoutes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { desktopHiddenPaths } from '../../src/app/router';

describe('설치형에서 감추는 라우트', () => {
  it('형성평가와 학생 참여 화면을 감춘다', () => {
    // 설치형에는 서버가 없어 학생 폰이 들어올 길이 없다.
    expect(desktopHiddenPaths).toContain('quiz');
    expect(desktopHiddenPaths).toContain('join/:code');
  });

  it('전자칠판 라우트는 감추지 않는다', () => {
    /*
     * 전자칠판은 board/:feature 하나뿐이고 무엇을 그릴지는 BoardPage가
     * 정한다. 이걸 감추면 자리·당번·보상까지 함께 죽는다.
     */
    expect(desktopHiddenPaths).not.toContain('board/:feature');
  });

  it('학급 운영 기능은 감추지 않는다', () => {
    for (const path of ['seating', 'duty', 'reward', 'assignment', 'lesson', 'task', 'message']) {
      expect(desktopHiddenPaths).not.toContain(path);
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/app/desktopRoutes.test.ts`
Expected: FAIL — `desktopHiddenPaths`를 못 찾음

- [ ] **Step 3: router.tsx를 고친다**

`src/app/router.tsx`에서 `devRoutes` 정의 아래에 더한다:

```ts
/**
 * 설치형에서 감추는 경로.
 *
 * 형성평가는 학생 폰이 들어올 서버가 있어야 성립한다. 설치형에는 없다.
 * 반쯤 살려 두면 "되는 줄 알았는데 안 되는" 자리가 되므로 통째로 뺀다.
 * 홈에는 웹으로 가는 안내 카드를 둔다.
 *
 * 목록으로 내보내는 이유는 시험할 수 있게 하기 위해서다. 조건을 라우트
 * 배열 안에 흩어 놓으면 무엇이 빠졌는지 밖에서 확인할 수 없다.
 */
export const desktopHiddenPaths: readonly string[] = ['quiz', 'join/:code'];

function visible(path: string): boolean {
  return !(isDesktop() && desktopHiddenPaths.includes(path));
}
```

`isDesktop`을 import에 더한다:

```ts
import { isDesktop } from '../shared/platform/target';
```

그리고 라우트 배열에서 세 곳을 거른다. `children` 배열 뒤에 `.filter()`를
붙이는 대신, 각 라우트를 조건부로 만든다:

```ts
      ...(visible('quiz') ? [{ path: 'quiz', element: <QuizPage /> }] : []),
```

`join/:code`는 `children` 밖(최상위)에 있으므로 그쪽에서 같은 모양으로
감싼다. 확인한 구조는 이렇다.

```
router
 ├ AppShell
 │   └ children: seating, duty, reward, assignment, lesson, quiz(감춤),
 │               task, message, roster, settings, login, setup, *
 ├ board/:feature          ← 감추지 않는다
 └ join/:code              ← 감춘다
```

`board/:feature`는 감추지 않는다. 전자칠판은 이 라우트 하나뿐이고 무엇을
그릴지는 `BoardPage`가 정한다. 감추면 자리·당번·보상 전자칠판까지 죽는다.
설치형에서 `/board/quiz`로 갈 길은 형성평가 화면뿐인데 그 화면이 없으므로
아무도 그리로 가지 않는다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/app/desktopRoutes.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 홈의 형성평가 카드를 안내 카드로 바꾼다**

`src/features/home/HomePage.tsx`에서 형성평가 `SummaryCard`(212~228줄 근처)를
아래로 감싼다:

```tsx
        {isDesktop() ? (
          <SummaryCard
            to="/settings"
            label="형성평가"
            icon={CheckSquare}
            accentClass="text-quiz-500"
            tintClass="bg-quiz-50"
            pending
            cta="웹에서 여는 법 보기"
          >
            <PendingNote>
              학생 폰으로 참여하는 형성평가는 웹에서 쓰실 수 있습니다.
              g-classroom-suite.vercel.app
            </PendingNote>
          </SummaryCard>
        ) : (
          <SummaryCard
            to="/quiz"
            label="형성평가"
            icon={CheckSquare}
            accentClass="text-quiz-500"
            tintClass="bg-quiz-50"
            cta="형성평가 열기"
          >
            <BigStat
              value={data.quizSets.length}
              unit="개"
              note={
                data.quizRun !== null
                  ? '지금 퀴즈 진행 중'
                  : data.quizResults.length > 0
                    ? `지난 결과 ${data.quizResults.length}건`
                    : '문제 세트'
              }
            />
          </SummaryCard>
        )}
```

import에 더한다:

```tsx
import { isDesktop } from '../../shared/platform/target';
```

- [ ] **Step 6: 전체 확인**

Run: `npm run verify`
Expected: 782 tests passed

- [ ] **Step 7: 설치형 번들에 형성평가가 안 들어갔는지 확인한다**

```bash
npm run build:desktop
grep -rl "QuizSessionRelay\|LocalSessionRelay" dist/assets/*.js || echo "형성평가 코드 없음"
```

Expected: `형성평가 코드 없음`

들어 있으면 `visible()` 조건 밖에서 `lazy(() => import(...))`가 불리고
있다는 뜻이다. `router.tsx`의 주석이 경고하는 그 함정이다 — `lazy()` 호출
자체를 조건 안으로 옮긴다.

- [ ] **Step 8: 웹 번들에는 그대로 있는지 확인한다**

```bash
npm run build
grep -rl "QuizSessionRelay" dist/assets/*.js >/dev/null && echo "웹에는 있다 (정상)" || echo "웹에서도 사라졌다 (문제)"
```

Expected: `웹에는 있다 (정상)`

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "feat: 설치형에서 형성평가를 빼고 웹으로 안내한다"
```

---

## Task 9: 설치본을 만들어 본다

**Files:**
- Modify: `docs/superpowers/specs/2026-08-22-gboard-desktop-design.md` (1판 끝났다고 표시)
- Create: `docs/gboard-first-run.md`

1판의 마지막이다. 배포 자동화는 3판이지만, **설치본이 실제로 만들어지고
설치되는지**는 여기서 확인해야 한다. 3판에 가서야 안 된다는 걸 알면 늦다.

- [ ] **Step 1: 설치본을 만든다**

```bash
npm run desktop:build
```

Expected: `src-tauri/target/release/bundle/nsis/G-board_0.1.0_x64-setup.exe`

첫 빌드는 10~20분 걸린다.

- [ ] **Step 2: 크기를 확인한다**

```bash
ls -lh src-tauri/target/release/bundle/nsis/*.exe
```

Expected: 15MB 이하. 설계에서 12MB 안팎으로 잡았다.

크게 넘으면 `dist`에 안 쓰는 것이 실렸는지 본다:

```bash
du -sh dist
ls -S dist/assets/*.js | head -3 | xargs du -k
```

- [ ] **Step 3: 실제로 설치해 본다**

만들어진 `.exe`를 더블클릭한다.

Expected:
- 윈도우가 "알 수 없는 게시자" 경고를 띄운다 — **정상이다.** 코드 서명을
  안 했다. `추가 정보 → 실행`으로 지나간다
- 설치가 끝나면 시작 메뉴에 `G-board`가 생긴다
- 실행하면 앱이 뜬다
- 학급을 만들고 앱을 껐다 켜도 남아 있다

- [ ] **Step 4: 개발 중 자료와 섞이지 않는지 확인한다**

```bash
ls "$APPDATA/net.ssamdongne.gboard/"
```

`npm run desktop:dev`로 만든 자료와 설치본 자료가 **같은 폴더**를 쓴다.
개발하며 만든 시험용 학급이 보이면 지운다:

```bash
rm -f "$APPDATA/net.ssamdongne.gboard/data.json" "$APPDATA/net.ssamdongne.gboard/backups.json"
```

- [ ] **Step 5: 첫 실행 안내를 쓴다**

`docs/gboard-first-run.md`:

```markdown
# G-board 설치하기

## 받아서 실행하기

1. 설치 파일(`G-board_x.x.x_x64-setup.exe`)을 내려받습니다
2. 더블클릭합니다

## "Windows의 PC 보호" 창이 뜨면

**정상입니다. 바이러스가 아닙니다.**

개인이 만든 프로그램이라 마이크로소프트 인증서가 없습니다. 인증서는
해마다 수십만 원이 들어서, 무료로 나눠 드리는 프로그램에는 붙이지
않았습니다. 쌤핀·스쿨보드도 같은 방식입니다.

1. **추가 정보**를 누릅니다
2. **실행**을 누릅니다

한 번만 하면 다음부터는 안 물어봅니다.

## 자료는 어디에 있나요

`C:\Users\(사용자 이름)\AppData\Roaming\net.ssamdongne.gboard\`

이 폴더의 **`data.json` 하나**가 학급 자료 전부입니다. USB나 클라우드에
복사해 두면 그것으로 백업이 됩니다.

앱 안에서는 **설정 → 백업·복원**에서 내려받을 수 있습니다.

## 인터넷이 필요한가요

**아니요.** 자료는 이 컴퓨터에만 있고, 인터넷 없이 모든 기능이 돕니다.
```

- [ ] **Step 6: 설계 문서에 1판이 끝났다고 적는다**

`docs/superpowers/specs/2026-08-22-gboard-desktop-design.md`의
'세 판으로 나눈다' 절에서 1판 문단 첫 줄을 바꾼다:

```
**1판 — 내 컴퓨터에서 도는 G-board** ✅ 2026-08-22 마침
```

- [ ] **Step 7: 마지막 확인**

```bash
npm run verify
```

Expected: 782 tests passed

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "docs: 1판을 마치고 첫 실행 안내를 쓴다"
git push origin main
```

---

## 1판이 끝나면

- `npm run desktop:dev`로 G-board가 뜬다
- 자료가 `%APPDATA%\net.ssamdongne.gboard\data.json`에 쌓인다
- 전자칠판이 앱 창으로, 두 번째 모니터에 전체 화면으로 뜬다
- 두 창이 같은 자료를 본다
- 형성평가는 설치형에서 빠지고 웹으로 안내한다
- 설치본이 만들어지고 실제로 설치된다
- 웹앱은 아무것도 안 바뀌었다 (첫 화면 청크 400KB 이하 유지)

**아직 아닌 것:** 홈은 지금 웹앱의 것이다. 오늘 보드·급식·시간표·날씨·테마는
2판이고, 자동 갱신과 GitHub Releases 배포는 3판이다.

## 자체 점검 기록

계획을 쓴 뒤 설계 문서와 맞춰 본 결과다.

**설계 항목 대응**

| 설계 | 과업 |
|---|---|
| 껍데기 Tauri | Task 4 |
| 빌드 시점 가르기 | Task 1 |
| 자료 저장 (Storage를 파일로) | Task 2, 3, 5 |
| 반쪽 파일 안 만들기 | Task 2 (인터페이스), Task 5 (구현) |
| 파일 넷으로 가르기 | Task 3 (`KEY_TO_FILE`) |
| 전자칠판 두 번째 창 | Task 6 |
| 두 창이 같은 자료 | Task 7 |
| 형성평가 빼기 | Task 8 |
| 첫 실행 안내 | Task 9 |

**설계에 있으나 1판에 없는 것** — 모두 2·3판 몫이라 의도한 것이다:
오늘 보드, '지금' 카드, 테마 넷, 학교 검색, NEIS 급식·시간표, 날씨,
`cache.json`, 자동 갱신, GitHub Actions.

**점검하며 고친 것**

계획을 쓴 뒤 실제 코드와 맞춰 보다 세 가지가 틀린 것을 찾았다.

1. **Task 7이 통째로 틀렸다.** `LocalStorageAdapter.subscribe()`는 저장소
   객체가 아니라 `window`의 `storage` 이벤트를 듣는다. 처음 쓴 대로
   `FileBackedStorage.subscribe()`를 만들었다면 **아무도 그것을 부르지
   않았을 것이다.** 대신 가짜 `StorageEvent`를 `window`에 던지는 방식으로
   다시 썼고, 그 덕에 어댑터를 한 줄도 안 고치게 됐다.
2. **`board/quiz`라는 라우트는 없다.** `board/:feature` 하나뿐이고 무엇을
   그릴지는 `BoardPage`가 정한다. 그것을 감췄다면 자리·당번·보상 전자칠판이
   함께 죽었을 것이다.
3. **시험 개수가 어긋나 있었다.** 745를 기준으로 다시 세어 771 → 773 →
   779 → 782로 맞췄다. 숫자가 틀리면 확인 단계가 통과인지 아닌지를
   가려 주지 못한다.

**미리 짚어 둔 위험**

- Task 7의 `emit`이 자기에게 돌아와 무한히 도는 문제 — Step 7에 확인
  방법과 고치는 코드를 함께 적었다
- Task 8의 `lazy()`가 조건 밖에 있으면 청크가 그대로 배포되는 문제 —
  `router.tsx`에 이미 같은 취지의 주석이 있고, Step 7에서 번들을 열어 본다
- 윈도우에서 `rename`이 대상 파일이 있으면 실패하는 문제 — Task 5의
  `writeAtomic`에서 먼저 지운다
