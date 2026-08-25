import { describe, expect, it } from 'vitest';

import { parseMeals, parseSchoolSearch } from '../../src/shared/external/neisParse';

const schoolResponse = {
  schoolInfo: [
    { head: [{ list_total_count: 1 }] },
    {
      row: [
        {
          ATPT_OFCDC_SC_CODE: 'J10',
          ATPT_OFCDC_SC_NM: '경기도교육청',
          SD_SCHUL_CODE: '7551281',
          SCHUL_NM: '위례한빛초등학교',
          ORG_RDNMA: '경기도 성남시 수정구 위례동로 55',
          SCHUL_KND_SC_NM: '초등학교',
        },
      ],
    },
  ],
};

const mealResponse = {
  mealServiceDietInfo: [
    { head: [{ list_total_count: 1 }] },
    {
      row: [
        {
          MMEAL_SC_NM: '중식',
          MLSV_YMD: '20260601',
          DDISH_NM: '홍국쌀밥 <br/>두부새우젓국 (5.9.18)<br/>도토리묵야채무침 (5.6.13)',
          CAL_INFO: '489.7 Kcal',
        },
      ],
    },
  ],
};

const noData = { RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } };

describe('학교 검색 응답 읽기', () => {
  it('필요한 칸을 뽑는다', () => {
    const hits = parseSchoolSearch(schoolResponse);

    expect(hits).toHaveLength(1);
    expect(hits[0]).toEqual({
      officeCode: 'J10',
      officeName: '경기도교육청',
      schoolCode: '7551281',
      schoolName: '위례한빛초등학교',
      address: '경기도 성남시 수정구 위례동로 55',
      kind: '초등학교',
    });
  });

  it('결과가 없으면 빈 목록이다', () => {
    // NEIS는 없을 때 다른 모양으로 답한다. 그걸 오류로 다루면 안 된다.
    expect(parseSchoolSearch(noData)).toEqual([]);
  });

  it('모양이 아주 다르면 빈 목록이다', () => {
    // 서버가 점검 중이라 HTML을 주는 날도 있다. 앱이 죽으면 안 된다.
    expect(parseSchoolSearch('<html>점검 중</html>')).toEqual([]);
    expect(parseSchoolSearch(null)).toEqual([]);
    expect(parseSchoolSearch({ schoolInfo: 'x' })).toEqual([]);
  });
});

describe('급식 응답 읽기', () => {
  it('메뉴를 낱개로 가른다', () => {
    const meals = parseMeals(mealResponse);

    expect(meals).toHaveLength(1);
    expect(meals[0]?.kind).toBe('중식');
    expect(meals[0]?.date).toBe('2026-06-01');
    expect(meals[0]?.dishes.map((d) => d.name)).toEqual([
      '홍국쌀밥',
      '두부새우젓국',
      '도토리묵야채무침',
    ]);
  });

  it('알레르기 번호를 이름에서 떼어 낸다', () => {
    /*
     * 화면에는 "두부새우젓국"만 보여야 읽힌다. 그렇다고 번호를 버리면
     * 알레르기가 있는 학생을 둔 선생님이 확인할 수 없다. 갈라서 둘 다 든다.
     */
    const meals = parseMeals(mealResponse);

    expect(meals[0]?.dishes[1]).toEqual({ name: '두부새우젓국', allergens: [5, 9, 18] });
    expect(meals[0]?.dishes[0]).toEqual({ name: '홍국쌀밥', allergens: [] });
  });

  it('열량을 그대로 든다', () => {
    expect(parseMeals(mealResponse)[0]?.calories).toBe('489.7 Kcal');
  });

  it('급식이 없는 날이면 빈 목록이다', () => {
    // 방학·주말·재량휴업일. 오류가 아니라 그냥 없는 날이다.
    expect(parseMeals(noData)).toEqual([]);
  });

  it('모양이 아주 다르면 빈 목록이다', () => {
    expect(parseMeals('<html>')).toEqual([]);
    expect(parseMeals(undefined)).toEqual([]);
  });
});
