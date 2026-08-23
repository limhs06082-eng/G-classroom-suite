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
