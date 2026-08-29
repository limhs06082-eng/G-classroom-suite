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

/**
 * 한 번에 받아 오는 학교 수.
 *
 * 스물이 아니라 **다섯**이다. 우리가 고른 값이 아니라 NEIS가 정한 값이다.
 * 인증키 없이 부르면 pSize를 얼마로 보내든 다섯 행만 온다. pIndex로 쪽을
 * 넘겨도 1쪽과 똑같은 다섯 행이 다시 온다 — 직접 불러 확인했다.
 *
 * 그래서 여기에 20을 적어 두면 코드가 거짓말을 한다. 오는 대로 적는다.
 * 대신 화면이 "모두 88곳 중 5곳만 보입니다"라고 말해 준다.
 */
const PAGE = 5;

export interface SchoolSearchResult {
  /** 이름에 걸린 학교가 모두 몇인가. 못 읽으면 -1. `hits`는 그중 앞부분이다. */
  total: number;
  hits: SchoolHit[];
}

/**
 * NEIS까지는 갔는데 자료 대신 오류를 받았을 때.
 *
 * 보통 Error와 갈라 두는 까닭은 **선생님이 할 일이 다르기** 때문이다.
 * 여기 닿았다는 것은 인터넷이 멀쩡하다는 뜻이라, 공유기를 다시 켤 일이
 * 아니다. NEIS가 보낸 사유(하루 호출 한도 따위)를 그대로 보여 줘야 한다.
 * 글자로 가르면 안 된다 — 통신 실패 쪽 글자는 무엇이 올지 모른다.
 */
export class NeisFaultError extends Error {}

/**
 * NEIS가 오류를 보냈으면 던진다.
 *
 * 200으로 오는 오류를 '자료 없음'으로 읽으면, 화면은 방학이라고 말하고
 * 그 거짓말이 캐시에 담긴다. 못 물어본 것은 못 물어봤다고 해야 한다.
 */
function refuseFault(raw: unknown): void {
  const fault = neisFault(raw);
  if (fault !== null) throw new NeisFaultError(fault);
}

/**
 * NEIS에서 학교와 급식을 받아 온다.
 *
 * 인증키를 쓰지 않는다. 키 없이도 답하고, 키를 요구하면 "설치하면 바로"라는
 * 전제가 깨진다. 대신 **한 번에 다섯 행**이라는 상한이 붙는다.
 *
 * 급식은 이 상한에 안 닿는다. 하루치가 조식·중식·석식 최대 세 행이다.
 * 학교 검색은 닿는다 — 그래서 몇 곳이 잘렸는지 화면에 말해 준다.
 * 시간표는 이 상한 때문에 아예 못 쓴다(6교시가 늘 잘린다). 그건 NEIS에서
 * 받지 않고 선생님이 한 번 짜 넣는 쪽으로 갔다.
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

  /**
   * 학교 코드로 도로명 주소만 받아 온다. 없으면 빈 글자.
   *
   * 학교를 고를 때 주소도 함께 담기 시작한 것은 이 판부터다. 그 전에 고른
   * 교사에게는 주소 칸이 비어 있고, 그대로 두면 **기존 사용자 전원에게
   * 날씨가 안 보인다.** 다시 고르라고 하지 않고 여기로 한 번 채운다.
   *
   * 이름이 아니라 코드 둘로 묻는다. 이름으로 물으면 같은 이름의 학교가
   * 여럿이라 엉뚱한 곳의 주소가 오고, 그러면 부산 학교에 서울 날씨를 띄우는
   * 자리로 되돌아간다 — 지오코딩을 버린 바로 그 까닭이다.
   *
   * 약속은 급식과 같다. **빈 글자는 '물어봤더니 없더라'이고, 던지면 '못
   * 물어봤다'다.** 통신 실패를 빈 글자로 삼키면 부르는 쪽이 '이 학교는 주소가
   * 없다'로 읽고 다시 안 묻는다.
   */
  async fetchAddress(officeCode: string, schoolCode: string): Promise<string> {
    if (officeCode === '' || schoolCode === '') return '';

    const url =
      `${BASE}/schoolInfo?Type=json&pIndex=1&pSize=${PAGE}` +
      `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}` +
      `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}`;

    const raw = await this.http.getJson(url);
    refuseFault(raw);

    // 코드 둘로 물었으니 한 행이다. 여럿이 와도 첫 행이 그 학교다.
    return parseSchoolSearch(raw)[0]?.address ?? '';
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
