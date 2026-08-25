import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryHttpClient } from '../../src/shared/external/MemoryHttpClient';
import { NeisSource } from '../../src/shared/external/NeisSource';

let http: MemoryHttpClient;
let neis: NeisSource;

beforeEach(() => {
  http = new MemoryHttpClient();
  neis = new NeisSource(http);
});

const emptyResult = { RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } };

describe('학교 검색', () => {
  it('이름을 주소에 넣어 부른다', async () => {
    http.put(
      'https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=20&SCHUL_NM=%ED%95%9C%EB%B9%9B%EC%B4%88',
      emptyResult,
    );

    await neis.searchSchools('한빛초');

    expect(http.calls[0]).toContain('SCHUL_NM=%ED%95%9C%EB%B9%9B%EC%B4%88');
  });

  it('앞뒤 공백은 떼고 보낸다', async () => {
    http.put(
      'https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=20&SCHUL_NM=%ED%95%9C%EB%B9%9B%EC%B4%88',
      emptyResult,
    );

    await neis.searchSchools('  한빛초  ');

    expect(http.calls).toHaveLength(1);
  });

  it('이름이 비면 부르지 않는다', async () => {
    // 빈 검색은 NEIS가 전국 학교를 돌려준다. 부를 이유가 없다.
    expect(await neis.searchSchools('   ')).toEqual([]);
    expect(http.calls).toEqual([]);
  });

  it('통신이 실패하면 그대로 던진다', async () => {
    http.fail(
      'https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=20&SCHUL_NM=%ED%95%9C%EB%B9%9B%EC%B4%88',
      '인터넷 연결 없음',
    );

    /*
     * 여기서 삼키면 화면이 "결과 없음"을 보여 준다. 이름을 잘못 친 것과
     * 인터넷이 끊긴 것은 선생님이 할 일이 다르다.
     */
    await expect(neis.searchSchools('한빛초')).rejects.toThrow('인터넷 연결 없음');
  });
});

describe('급식 조회', () => {
  const url =
    'https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=10' +
    '&ATPT_OFCDC_SC_CODE=J10&SD_SCHUL_CODE=7551281&MLSV_YMD=20260601';

  it('날짜에서 하이픈을 떼어 부른다', async () => {
    // NEIS는 YYYYMMDD를 받는데 우리는 YYYY-MM-DD로 다닌다.
    http.put(url, emptyResult);

    await neis.fetchMeals('J10', '7551281', '2026-06-01');

    expect(http.calls[0]).toBe(url);
  });

  it('학교 코드가 없으면 부르지 않는다', async () => {
    expect(await neis.fetchMeals('', '7551281', '2026-06-01')).toEqual([]);
    expect(await neis.fetchMeals('J10', '', '2026-06-01')).toEqual([]);
    expect(http.calls).toEqual([]);
  });

  it('통신이 실패하면 그대로 던진다', async () => {
    http.fail(url, 'NEIS가 응답하지 않음');

    await expect(neis.fetchMeals('J10', '7551281', '2026-06-01')).rejects.toThrow(
      'NEIS가 응답하지 않음',
    );
  });
});
