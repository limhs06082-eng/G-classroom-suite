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
