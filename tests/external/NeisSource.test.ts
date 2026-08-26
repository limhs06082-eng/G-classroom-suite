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
    expect(await neis.searchSchools('   ')).toEqual({ total: 0, hits: [] });
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

describe('NEIS가 오류를 200에 실어 보낼 때', () => {
  const searchUrl =
    'https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=20' +
    '&SCHUL_NM=%ED%95%9C%EB%B9%9B%EC%B4%88';
  const mealUrl =
    'https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=10' +
    '&ATPT_OFCDC_SC_CODE=J10&SD_SCHUL_CODE=7551281&MLSV_YMD=20260601';

  /*
   * NEIS는 오류도 HTTP 200으로 준다. 몸통만 RESULT 봉투로 바뀐다. 실제로
   * 불러서 확인한 모양이다. 이걸 '자료 없음'으로 읽으면 두 가지가 무너진다.
   * 검색에서는 있지도 않은 오타를 찾아 이름만 고쳐 보게 되고, 급식에서는
   * "오늘은 급식이 없습니다"가 캐시에 담겨 하루 종일 굳는다.
   */
  it('학교 검색이 빈 목록 대신 던진다', async () => {
    http.put(searchUrl, {
      RESULT: { CODE: 'ERROR-337', MESSAGE: '일별 트래픽 제한을 넘은 호출입니다.' },
    });

    await expect(neis.searchSchools('한빛초')).rejects.toThrow('일별 트래픽');
  });

  it('급식 조회가 빈 목록 대신 던진다', async () => {
    http.put(mealUrl, {
      RESULT: { CODE: 'ERROR-290', MESSAGE: '인증키가 유효하지 않습니다.' },
    });

    await expect(neis.fetchMeals('J10', '7551281', '2026-06-01')).rejects.toThrow('인증키');
  });

  it('INFO-200은 오류가 아니라 그냥 없는 날이다', async () => {
    http.put(mealUrl, emptyResult);

    // 방학까지 실패로 몰면 캐시가 안 남아 방학 내내 NEIS를 두드린다.
    expect(await neis.fetchMeals('J10', '7551281', '2026-06-01')).toEqual([]);
  });
});

describe('검색 결과가 잘렸을 때', () => {
  it('모두 몇 곳인지 함께 돌려준다', async () => {
    http.put(
      'https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=20&SCHUL_NM=%EC%A4%91%EC%95%99%EC%B4%88',
      {
        schoolInfo: [
          { head: [{ list_total_count: 34 }, { RESULT: { CODE: 'INFO-000' } }] },
          {
            row: [
              {
                ATPT_OFCDC_SC_CODE: 'J10',
                ATPT_OFCDC_SC_NM: '경기도교육청',
                SD_SCHUL_CODE: '7551281',
                SCHUL_NM: '중앙초등학교',
                ORG_RDNMA: '경기도 어딘가',
                SCHUL_KND_SC_NM: '초등학교',
              },
            ],
          },
        ],
      },
    );

    const result = await neis.searchSchools('중앙초');

    // 서른넷 중 하나만 보여 주면서 그 말을 안 하면, 자기 학교가 없는 목록을
    // 보고 이름을 잘못 쳤다고 여긴다.
    expect(result.total).toBe(34);
    expect(result.hits).toHaveLength(1);
  });
});
