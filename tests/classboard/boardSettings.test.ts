import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearClassboardSettings,
  CLASSBOARD_CONFIG_STORAGE,
  hasClassboardConfig,
  OFFICIAL_STUDENT_ORIGIN,
  parseFirebaseConfigText,
  readClassboardSettings,
  resolveStudentOrigin,
  rulesText,
  saveClassboardSettings,
} from '../../src/features/classboard/boardSettings';

const CONSOLE_SNIPPET = `// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
const firebaseConfig = {
  apiKey: "AIzaSyExample-KEY_123",
  authDomain: "our-class.firebaseapp.com",
  projectId: "our-class",
  storageBucket: "our-class.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
const app = initializeApp(firebaseConfig);`;

beforeEach(() => {
  localStorage.clear();
});

describe('설정값 붙여넣기 해석', () => {
  it('콘솔에서 복사한 코드를 통째로 붙여 넣어도 넷만 뽑는다', () => {
    expect(parseFirebaseConfigText(CONSOLE_SNIPPET)).toEqual({
      apiKey: 'AIzaSyExample-KEY_123',
      authDomain: 'our-class.firebaseapp.com',
      projectId: 'our-class',
      appId: '1:1234567890:web:abcdef123456',
    });
  });

  it('JSON(따옴표 키)도 받는다', () => {
    const json = JSON.stringify({ apiKey: 'k', authDomain: 'a', projectId: 'p', appId: 'i', extra: 1 });
    expect(parseFirebaseConfigText(json)).toEqual({ apiKey: 'k', authDomain: 'a', projectId: 'p', appId: 'i' });
  });

  it('넷 중 하나라도 없으면 null — 반쯤 저장하지 않는다', () => {
    expect(parseFirebaseConfigText('apiKey: "k", projectId: "p"')).toBeNull();
    expect(parseFirebaseConfigText('')).toBeNull();
  });
});

describe('이 컴퓨터 저장', () => {
  it('저장·읽기·지우기가 한 바퀴 돈다', () => {
    expect(hasClassboardConfig()).toBe(false);
    saveClassboardSettings({
      config: { apiKey: 'k', authDomain: 'a', projectId: 'p', appId: 'i' },
      studentOrigin: '',
    });
    expect(hasClassboardConfig()).toBe(true);
    expect(readClassboardSettings()?.config.projectId).toBe('p');
    clearClassboardSettings();
    expect(readClassboardSettings()).toBeNull();
  });

  it('깨진 값은 없는 것으로 친다', () => {
    localStorage.setItem(CLASSBOARD_CONFIG_STORAGE, '{"config":{"apiKey":"k"}}');
    expect(readClassboardSettings()).toBeNull();
    localStorage.setItem(CLASSBOARD_CONFIG_STORAGE, 'not json');
    expect(readClassboardSettings()).toBeNull();
  });
});

describe('학생 화면 주소', () => {
  const settings = { config: { apiKey: 'k', authDomain: 'a', projectId: 'p', appId: 'i' }, studentOrigin: '' };

  it('설치형은 공식 배포, 웹은 지금 주소, 적어 둔 것이 있으면 그것', () => {
    expect(resolveStudentOrigin(settings, true, 'tauri://localhost')).toBe(OFFICIAL_STUDENT_ORIGIN);
    expect(resolveStudentOrigin(settings, false, 'https://my.vercel.app/')).toBe('https://my.vercel.app');
    expect(resolveStudentOrigin({ ...settings, studentOrigin: 'https://mine.app/ ' }, true, 'x')).toBe(
      'https://mine.app',
    );
    expect(resolveStudentOrigin(null, true, 'x')).toBe(OFFICIAL_STUDENT_ORIGIN);
  });
});

describe('규칙 글', () => {
  it('주인만 고치고, 숨긴 글은 주인만 읽고, 익명은 게시판을 못 만든다', () => {
    const text = rulesText();
    expect(text).toContain("rules_version = '2'");
    expect(text).toContain('match /boards/{code}');
    expect(text).toContain("sign_in_provider != 'anonymous'");
    expect(text).toContain('resource.data.hidden == false');
    // 바이트로 센다 — 한글 1,000자는 3,000바이트다.
    expect(text).toContain('toUtf8().size() <= maxBytes');
    expect(text).toContain('textOk(code, 4000)');
    expect(text).toContain('textOk(code, 1200)');
    // 학생이 손으로 만든 요청으로 '선생님' 표시를 달 수 없다.
    expect(text).toContain('request.resource.data.byTeacher == false || owner(code)');
    // 없는 게시판은 get()이 터지기 전에 exists()로 거른다.
    expect(text).toContain('exists(boardPath(code))');
    // 로그인만 보는 느슨한 규칙이 아니다.
    expect(text).not.toMatch(/allow read, write: if request\.auth != null;/);
  });
});
