import type { HttpClient } from './HttpClient';
import { parseMeals, parseSchoolSearch, type MealMenu, type SchoolHit } from './neisParse';

const BASE = 'https://open.neis.go.kr/hub';

/**
 * NEIS에서 학교와 급식을 받아 온다.
 *
 * 인증키를 쓰지 않는다. 확인해 보니 키 없이도 답하고, 교사 한 사람이
 * 하루에 부르는 횟수는 무료 한도 근처에도 못 간다. 키를 요구하면
 * "설치하면 바로"라는 전제가 깨진다.
 *
 * **실패를 삼키지 않는다.** 이름을 잘못 친 것과 인터넷이 끊긴 것은
 * 선생님이 할 일이 다르다. 위에서 갈라 보여 줘야 한다.
 */
export class NeisSource {
  constructor(private readonly http: HttpClient) {}

  async searchSchools(name: string): Promise<SchoolHit[]> {
    const trimmed = name.trim();
    // 빈 검색은 NEIS가 전국 학교를 돌려준다. 부를 이유가 없다.
    if (trimmed === '') return [];

    const url =
      `${BASE}/schoolInfo?Type=json&pIndex=1&pSize=20` +
      `&SCHUL_NM=${encodeURIComponent(trimmed)}`;

    return parseSchoolSearch(await this.http.getJson(url));
  }

  /** `date`는 `YYYY-MM-DD`. NEIS는 `YYYYMMDD`를 받으므로 여기서 바꾼다. */
  async fetchMeals(officeCode: string, schoolCode: string, date: string): Promise<MealMenu[]> {
    if (officeCode === '' || schoolCode === '') return [];

    const compact = date.replaceAll('-', '');
    const url =
      `${BASE}/mealServiceDietInfo?Type=json&pIndex=1&pSize=10` +
      `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}` +
      `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}` +
      `&MLSV_YMD=${encodeURIComponent(compact)}`;

    return parseMeals(await this.http.getJson(url));
  }
}
