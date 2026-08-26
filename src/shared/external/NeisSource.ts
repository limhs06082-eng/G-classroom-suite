import type { HttpClient } from './HttpClient';
import {
  neisFault,
  parseMeals,
  parseSchoolSearch,
  schoolSearchTotal,
  type MealMenu,
  type SchoolHit,
} from './neisParse';

const BASE = 'https://open.neis.go.kr/hub';

/** 한 번에 받아 오는 학교 수. 스무 줄이 넘으면 목록에서 눈으로 못 찾는다. */
const PAGE = 20;

export interface SchoolSearchResult {
  /** 이름에 걸린 학교가 모두 몇인가. 못 읽으면 -1. `hits`는 그중 앞부분이다. */
  total: number;
  hits: SchoolHit[];
}

/**
 * NEIS가 오류를 보냈으면 던진다.
 *
 * 200으로 오는 오류를 '자료 없음'으로 읽으면, 화면은 방학이라고 말하고
 * 그 거짓말이 캐시에 담긴다. 못 물어본 것은 못 물어봤다고 해야 한다.
 */
function refuseFault(raw: unknown): void {
  const fault = neisFault(raw);
  if (fault !== null) throw new Error(fault);
}

/**
 * NEIS에서 학교와 급식을 받아 온다.
 *
 * 인증키를 쓰지 않는다. 확인해 보니 키 없이도 답하고, 교사 한 사람이
 * 하루에 부르는 횟수는 무료 한도 근처에도 못 간다. 키를 요구하면
 * "설치하면 바로"라는 전제가 깨진다.
 *
 * **실패를 삼키지 않는다.** 이름을 잘못 친 것과 인터넷이 끊긴 것은
 * 선생님이 할 일이 다르다. 위에서 갈라 보여 줘야 한다.
 *
 * 그래서 약속이 이렇다. **빈 값으로 끝나면 '물어봤더니 없더라'이고,
 * 던지면 '못 물어봤다'다.** NEIS가 200에 실어 보내는 오류도 던지는 쪽이다.
 */
export class NeisSource {
  constructor(private readonly http: HttpClient) {}

  async searchSchools(name: string): Promise<SchoolSearchResult> {
    const trimmed = name.trim();
    // 빈 검색은 NEIS가 전국 학교를 돌려준다. 부를 이유가 없다.
    if (trimmed === '') return { total: 0, hits: [] };

    const url =
      `${BASE}/schoolInfo?Type=json&pIndex=1&pSize=${PAGE}` +
      `&SCHUL_NM=${encodeURIComponent(trimmed)}`;

    const raw = await this.http.getJson(url);
    refuseFault(raw);

    return { total: schoolSearchTotal(raw), hits: parseSchoolSearch(raw) };
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

    const raw = await this.http.getJson(url);
    refuseFault(raw);

    return parseMeals(raw);
  }
}
