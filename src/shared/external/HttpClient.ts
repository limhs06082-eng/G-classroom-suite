/**
 * 바깥에서 자료를 받아 오는 통로.
 *
 * `StorageAdapter`가 저장 방식을, `FileStore`가 파일 접근을 가른 것처럼
 * 이것은 통신을 가른다. 실제 구현은 Tauri를 부르고, 시험은 메모리 구현을
 * 끼운다 — 시험이 인터넷과 NEIS 사정에 매이면 안 된다.
 *
 * GET만 둔다. NEIS도 날씨도 조회뿐이라 더 필요하지 않고, 쓸 일이 없는
 * 메서드를 미리 두면 구현할 때마다 빈 껍데기를 채워야 한다.
 */
export interface HttpClient {
  /**
   * JSON을 받아 온다.
   *
   * 실패하면 던진다. 받는 쪽이 사람에게 무엇을 보일지 정한다 —
   * 여기서 조용히 null을 돌려주면 "왜 급식이 안 뜨지"를 알 길이 없다.
   */
  getJson(url: string): Promise<unknown>;
}
