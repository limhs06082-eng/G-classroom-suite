import { beforeEach, describe, expect, it } from 'vitest';

import { buildJoinLink, configFromSearch, decodeConfig, encodeConfig } from '../../src/features/classboard/joinLink';
import { readJoin, saveJoin } from '../../src/features/classboard/joinStore';

const CONFIG = {
  apiKey: 'AIzaSy-Example_123',
  authDomain: 'our-class.firebaseapp.com',
  projectId: 'our-class',
  appId: '1:1234567890:web:abcdef123456',
};

describe('학생 링크', () => {
  it('설정값을 실어 보내고 되읽는다 — 주소에 안전한 글자만', () => {
    const encoded = encodeConfig(CONFIG);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeConfig(encoded)).toEqual(CONFIG);

    const link = buildJoinLink('https://g-classroom-suite.vercel.app/', 'ABC234', CONFIG);
    expect(link.startsWith('https://g-classroom-suite.vercel.app/classboard/join/ABC234?p=')).toBe(true);
    expect(configFromSearch(new URL(link).search)).toEqual(CONFIG);
  });

  it('깨진 값·빠진 키·없는 값은 null', () => {
    expect(decodeConfig('not-base64!!')).toBeNull();
    expect(decodeConfig(encodeConfig({ ...CONFIG, appId: '' }))).toBeNull();
    expect(configFromSearch('')).toBeNull();
    expect(configFromSearch('?x=1')).toBeNull();
  });
});

describe('학생 폰의 기억', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('코드별로 설정값과 이름을 남기고, 한쪽만 고쳐도 다른 쪽은 남는다', () => {
    expect(readJoin('ABC234')).toBeNull();
    saveJoin('ABC234', { config: CONFIG });
    saveJoin('ABC234', { name: '하나' });
    expect(readJoin('ABC234')).toEqual({ config: CONFIG, name: '하나' });
    expect(readJoin('OTHER1')).toBeNull();
  });
});
