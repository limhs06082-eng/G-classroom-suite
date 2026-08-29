import { describe, expect, it } from 'vitest';

import { createEmptySuiteData } from '../../src/shared/domain/factories';
import { regionOfAddress } from '../../src/shared/domain/regions';
import type { SuiteData } from '../../src/shared/domain/types';
import { parseSuiteData, serializeSuiteData } from '../../src/shared/storage/schema';

const NOW = '2026-08-29T09:00:00.000Z';
const ADDRESS = '경기도 성남시 수정구 위례동로 55';

function withSchool(): SuiteData {
  const data = createEmptySuiteData();
  return {
    ...data,
    profile: {
      ...data.profile,
      schoolName: '위례한빛초등학교',
      officeCode: 'J10',
      schoolCode: '7551281',
      schoolAddress: ADDRESS,
    },
  };
}

/*
 * 학교 주소가 백업을 타고 넘어가는지 못 박는다.
 *
 * 주소는 교사가 치는 글자가 아니라 학교를 고를 때 한 번 담기는 것이다.
 * 왕복에서 새면 컴퓨터를 바꾼 교사는 날씨가 왜 안 뜨는지 알 수 없고,
 * 고칠 방법도 '학교를 다시 고른다'뿐인데 그걸 알 길이 없다.
 */
describe('학교 주소 저장·복원', () => {
  it('담은 주소가 그대로 돌아온다', () => {
    const back = parseSuiteData(JSON.parse(serializeSuiteData(withSchool())), NOW);

    expect(back.data.profile.schoolAddress).toBe(ADDRESS);
  });

  it('주소 칸이 없는 옛 자료도 열린다', () => {
    /*
     * 2-나-3 이전 백업에는 이 칸이 아예 없다. 지금 쓰는 교사 전원이 그렇다.
     * 여기서 경고를 띄우거나 학교 코드를 함께 잃으면 안 된다 — 날씨만 없는
     * 것과 급식까지 끊기는 것은 완전히 다른 사고다.
     */
    const old = JSON.parse(serializeSuiteData(withSchool())) as Record<string, unknown>;
    const profile = old['profile'] as Record<string, unknown>;
    delete profile['schoolAddress'];

    const back = parseSuiteData(old, NOW);

    expect(back.data.profile.schoolAddress).toBeUndefined();
    expect(back.data.profile.officeCode).toBe('J10');
    expect(back.data.profile.schoolCode).toBe('7551281');
  });

  it('글자가 아닌 주소는 안 담는다', () => {
    /*
     * 손으로 고친 백업이나 상한 파일에서 온다. 그냥 통과시키면 타입만
     * string이고 알맹이는 숫자인 값이 프로필에 앉는다. 그 값을 받는
     * regionOfAddress()가 곧바로 .trim()을 부르므로, 머리띠를 그리는
     * 순간 화면 전체가 죽는다. 백업 한 줄이 앱을 못 열게 만드는 것이다.
     *
     * "못 읽으면 없는 것으로 친다"가 이 저장소의 규칙이고, 없으면
     * 날씨만 안 뜬다.
     */
    const raw = JSON.parse(serializeSuiteData(withSchool())) as Record<string, unknown>;
    (raw['profile'] as Record<string, unknown>)['schoolAddress'] = 12345;

    const back = parseSuiteData(raw, NOW);

    expect(back.data.profile.schoolAddress).toBeUndefined();
    expect(() => regionOfAddress(back.data.profile.schoolAddress ?? '')).not.toThrow();
  });
});
