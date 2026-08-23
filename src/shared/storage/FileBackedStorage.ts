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
