/*
 * 타이머 구현은 shared 한 벌만 둔다.
 *
 * 전에는 이 파일이 shared/useTimer.ts와 글자까지 같은 사본이었다. 사본이
 * 둘이면 한쪽만 고쳐지는 날이 온다 — 재내보내기로 합친다. 툴바(교사 창)와
 * 수업 칠판(별도 창)이 각자 인스턴스를 갖는 것은 그대로다. 창이 다르면
 * 자바스크립트 세계도 달라서, 같은 인스턴스를 공유할 방법 자체가 없다.
 */
export { formatDuration, useTimer, type Timer, type TimerState } from '../../shared/useTimer';
