import { describe, expect, it } from 'vitest';

import {
  BUILT_IN_TEMPLATES,
  placeholdersIn,
  privacyWarnings,
  renderMessage,
} from '../../src/features/message/messageCore';
import type { SchoolProfile } from '../../src/shared/domain/types';

const profile: SchoolProfile = {
  schoolName: '한빛초등학교',
  teacherName: '임한솔',
  grade: '3',
  classNo: '2',
};

describe('renderMessage', () => {
  it('자리표시자를 프로필 값으로 채운다', () => {
    const { text } = renderMessage('{학교} {학년}학년 {반}반 담임 {교사}', { profile });

    expect(text).toBe('한빛초등학교 3학년 2반 담임 임한솔');
  });

  it('날짜를 읽기 좋은 형태로 바꾼다', () => {
    const { text } = renderMessage('{날짜}에 만나요', { profile, date: '2026-08-13' });

    expect(text).toBe('8월 13일에 만나요');
  });

  it('값이 비면 자리표시자를 그대로 남기고 알린다', () => {
    /*
     * 빈 문자열로 지워 버리면 "3학년 반 학부모님께"처럼
     * 어색한 문장이 조용히 학부모에게 나간다.
     */
    const empty: SchoolProfile = { schoolName: '', teacherName: '', grade: '', classNo: '' };
    const { text, missing } = renderMessage('{학교} {학년}학년', { profile: empty });

    expect(text).toBe('{학교} {학년}학년');
    expect(missing).toEqual(['학교', '학년']);
  });

  it('임시 값으로 자리표시자를 채운다', () => {
    const { text, missing } = renderMessage('준비물: {준비물}', {
      profile,
      extras: { 준비물: '색연필, 자' },
    });

    expect(text).toBe('준비물: 색연필, 자');
    expect(missing).toEqual([]);
  });

  it('공백만 있는 값은 채우지 않은 것으로 본다', () => {
    const { missing } = renderMessage('{장소}', { profile, place: '   ' });

    expect(missing).toEqual(['장소']);
  });

  it('자리표시자 안팎의 공백을 견딘다', () => {
    const { text } = renderMessage('{ 교사 } 드림', { profile });

    expect(text).toBe('임한솔 드림');
  });

  it('자리표시자가 없으면 그대로 둔다', () => {
    const { text, missing } = renderMessage('안녕하세요.', { profile });

    expect(text).toBe('안녕하세요.');
    expect(missing).toEqual([]);
  });
});

describe('placeholdersIn', () => {
  it('본문에 쓰인 자리표시자를 모은다', () => {
    expect(placeholdersIn('{학교} {학년}학년 {반}반 {학교}')).toEqual(['반', '학교', '학년']);
  });

  it('없으면 빈 배열', () => {
    expect(placeholdersIn('자리표시자 없음')).toEqual([]);
  });
});

describe('privacyWarnings', () => {
  it('휴대전화 번호를 알린다', () => {
    // 문구 템플릿에 연락처를 적어 두면 다른 학부모에게 잘못 나갈 수 있다.
    expect(privacyWarnings('연락처는 010-1234-5678입니다')).toHaveLength(1);
    expect(privacyWarnings('01012345678')).toHaveLength(1);
  });

  it('주민등록번호를 알린다', () => {
    expect(privacyWarnings('123456-1234567')).toHaveLength(1);
  });

  it('평범한 문구에는 경고가 없다', () => {
    expect(privacyWarnings('내일 8시까지 등교해 주세요.')).toEqual([]);
  });

  it('학교 대표번호 같은 일반 전화는 걸리지 않는다', () => {
    expect(privacyWarnings('학교 02-123-4567')).toEqual([]);
  });
});

describe('BUILT_IN_TEMPLATES', () => {
  it('기본 문구가 프로필만으로도 대부분 채워진다', () => {
    const thanks = BUILT_IN_TEMPLATES.find((t) => t.id === 'builtin-thanks');
    expect(thanks).toBeDefined();

    const { missing } = renderMessage(thanks?.body ?? '', { profile });
    expect(missing).toEqual([]);
  });

  it('채워야 할 자리표시자가 있는 문구는 그것을 드러낸다', () => {
    const supplies = BUILT_IN_TEMPLATES.find((t) => t.id === 'builtin-supplies');
    const { missing } = renderMessage(supplies?.body ?? '', { profile });

    // 날짜와 준비물은 교사가 그때그때 넣는 값이다.
    expect(missing).toContain('준비물');
    expect(missing).toContain('날짜');
  });

  it('기본 문구 id가 겹치지 않는다', () => {
    const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
