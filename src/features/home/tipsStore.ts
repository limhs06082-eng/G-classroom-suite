/**
 * 첫 화면 안내를 봤는가 — 이 기기의 취향이라 localStorage에.
 *
 * 자료(SuiteData)에 넣지 않는다. 교실 PC에서 본 안내를 집 노트북에서 한 번
 * 더 보는 것은 괜찮지만, 백업 파일에 "안내 봤음"이 실리는 것은 이상하다.
 */
export const TIPS_SEEN_STORAGE = 'gboard:tips-seen';

export function isTipsSeen(): boolean {
  try {
    return window.localStorage.getItem(TIPS_SEEN_STORAGE) === '1';
  } catch {
    return true; // 저장이 안 되는 환경이면 매번 뜨는 쪽보다 안 뜨는 쪽이 낫다.
  }
}

export function setTipsSeen(seen: boolean): void {
  try {
    if (seen) window.localStorage.setItem(TIPS_SEEN_STORAGE, '1');
    else window.localStorage.removeItem(TIPS_SEEN_STORAGE);
  } catch {
    // 무시
  }
}
