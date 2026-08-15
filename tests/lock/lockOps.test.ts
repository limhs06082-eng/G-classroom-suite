import { describe, expect, it } from 'vitest';

import { createEmptySuiteData } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import {
  clearPin,
  engageLock,
  isValidPin,
  setPin,
  tryUnlock,
} from '../../src/shared/lock/lockOps';
import { parseSuiteData } from '../../src/shared/storage/schema';

const withPin = (pin: string): SuiteData => setPin(createEmptySuiteData(), pin);

describe('isValidPin', () => {
  it('숫자 네 자리만 받는다', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('0000')).toBe(true);
  });

  it('길이가 다르면 안 된다', () => {
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('')).toBe(false);
  });

  it('숫자가 아니면 안 된다', () => {
    expect(isValidPin('abcd')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin('１２３４')).toBe(false);
  });
});

describe('setPin', () => {
  it('네 자리를 저장한다', () => {
    expect(setPin(createEmptySuiteData(), '1234').lockPin).toBe('1234');
  });

  it('잘못된 값은 저장하지 않는다', () => {
    const data = createEmptySuiteData();

    expect(setPin(data, '12')).toBe(data);
    expect(setPin(data, 'abcd')).toBe(data);
  });
});

describe('engageLock', () => {
  it('PIN이 있으면 잠근다', () => {
    expect(engageLock(withPin('1234')).isLocked).toBe(true);
  });

  it('PIN이 없으면 잠그지 않는다', () => {
    // 잠근 뒤 열 방법이 없으면 안 된다.
    const data = createEmptySuiteData();

    expect(engageLock(data)).toBe(data);
    expect(engageLock(data).isLocked).toBe(false);
  });
});

describe('tryUnlock', () => {
  it('맞으면 풀린다', () => {
    const locked = engageLock(withPin('1234'));
    const result = tryUnlock(locked, '1234');

    expect(result.ok).toBe(true);
    expect(result.data.isLocked).toBe(false);
    // PIN은 남는다. 다시 잠글 수 있어야 한다.
    expect(result.data.lockPin).toBe('1234');
  });

  it('틀리면 잠긴 채로 남는다', () => {
    const locked = engageLock(withPin('1234'));
    const result = tryUnlock(locked, '9999');

    expect(result.ok).toBe(false);
    expect(result.data).toBe(locked);
  });

  it('PIN이 없으면 어떤 값으로도 안 열린다', () => {
    const data = createEmptySuiteData();

    expect(tryUnlock(data, '').ok).toBe(false);
    expect(tryUnlock(data, '1234').ok).toBe(false);
  });
});

describe('clearPin', () => {
  it('PIN을 지우면 잠금도 함께 풀린다', () => {
    /*
     * PIN을 지웠는데 잠금이 남으면 열 수 있는 값이 없는 잠긴 화면이 된다.
     * 자료를 초기화하는 것 말고는 길이 없어진다.
     */
    const locked = engageLock(withPin('1234'));
    const result = clearPin(locked);

    expect(result.lockPin).toBe('');
    expect(result.isLocked).toBe(false);
  });
});

describe('저장된 자료 읽기', () => {
  // parseSuiteData는 이미 JSON.parse된 객체를 받는다. 문자열을 주면
  // isRecord가 걸러 내 빈 자료가 돌아오고, 테스트가 조용히 헛돈다.
  const read = (raw: object): SuiteData =>
    parseSuiteData({ ...createEmptySuiteData(), ...raw }).data;

  it('네 자리 PIN과 잠금 상태를 그대로 읽는다', () => {
    const data = read({ lockPin: '1234', isLocked: true });

    expect(data.lockPin).toBe('1234');
    expect(data.isLocked).toBe(true);
  });

  it('망가진 PIN은 빈 값이 되고 잠금도 풀린다', () => {
    // 여기서 잠금을 안 풀면 열 수 있는 값이 없는 잠긴 화면이 된다.
    const data = read({ lockPin: 'abc', isLocked: true });

    expect(data.lockPin).toBe('');
    expect(data.isLocked).toBe(false);
  });

  it('PIN 없이 잠금만 켜져 있어도 풀린다', () => {
    const data = read({ lockPin: '', isLocked: true });

    expect(data.isLocked).toBe(false);
  });

  it('잠금 항목이 아예 없는 옛 자료도 열린다', () => {
    const { lockPin: _pin, isLocked: _locked, ...old } = createEmptySuiteData();
    const data = parseSuiteData(old).data;

    expect(data.lockPin).toBe('');
    expect(data.isLocked).toBe(false);
  });
});
