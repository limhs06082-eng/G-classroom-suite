import type { SuiteData } from '../domain/types';

/**
 * 교사 잠금.
 *
 * **보안이 아니다.** PIN은 브라우저에 그대로 저장되고 개발자 도구를 열면 보인다.
 * 교사가 자리를 비운 사이 학생이 지나가다 화면을 만지는 것을 막는 장치다.
 *
 * ToolsBar의 `화면 가리기`와 다르다. 그건 수업 중 잠깐 가리는 도구라
 * Esc 한 번에 걷히고 걷히는 것이 목적이다. 이쪽은 쉽게 걷히면 안 되고
 * 새로 고쳐도 남아야 한다.
 *
 * 설계 근거: docs/superpowers/specs/2026-08-16-teacher-lock-and-quote-design.md
 */

export const PIN_LENGTH = 4;

/** 숫자 4자리인가. 그 외에는 저장하지 않는다. */
export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export function setPin(data: SuiteData, pin: string): SuiteData {
  if (!isValidPin(pin)) return data;

  return { ...data, lockPin: pin };
}

/**
 * PIN을 지우면 잠금도 함께 풀린다.
 *
 * PIN을 지웠는데 잠금이 남으면 **열 수 있는 값이 없는 잠긴 화면**이 된다.
 * 자료를 초기화하는 것 말고는 길이 없어진다.
 */
export function clearPin(data: SuiteData): SuiteData {
  return { ...data, lockPin: '', isLocked: false };
}

/** PIN이 없으면 잠그지 않는다. 잠근 뒤 열 방법이 없으면 안 된다. */
export function engageLock(data: SuiteData): SuiteData {
  if (data.lockPin === '') return data;

  return { ...data, isLocked: true };
}

/**
 * 맞으면 풀고 틀리면 그대로 둔다.
 *
 * 틀린 횟수를 세지 않고 잠그지도 않는다. 이 장치의 목적은 실수를 막는 것이지
 * 침입을 막는 것이 아니다. 잠가 버리면 교사가 자기 앱을 못 쓰게 되는 쪽이
 * 더 흔하다.
 */
export function tryUnlock(data: SuiteData, pin: string): { data: SuiteData; ok: boolean } {
  if (data.lockPin === '' || pin !== data.lockPin) return { data, ok: false };

  return { data: { ...data, isLocked: false }, ok: true };
}
