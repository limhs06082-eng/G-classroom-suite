import type { Region } from '../domain/regions';
import type { HttpClient } from './HttpClient';
import { parseWeather, weatherFault, type Weather } from './weatherParse';

const BASE = 'https://api.open-meteo.com/v1/forecast';

/**
 * open-meteo까지는 갔는데 자료 대신 오류를 받았을 때.
 *
 * `NeisFaultError`와 같은 자리다. 보통 Error와 갈라 두는 까닭도 같다 —
 * 여기 닿았다는 것은 인터넷이 멀쩡하다는 뜻이라 공유기를 다시 켤 일이
 * 아니다. 글자로 가르면 안 된다. 통신 실패 쪽 글자는 무엇이 올지 모른다.
 */
export class WeatherFaultError extends Error {}

/**
 * 시·도 좌표로 오늘 날씨를 받아 온다.
 *
 * 인증키를 쓰지 않는다. open-meteo는 키 없이 답하고, 키를 요구하면 급식과
 * 같은 전제("설치하면 바로")가 깨진다. NEIS와 달리 한 번에 몇 행이라는
 * 상한도 없다 — 우리는 지역 하나의 하루치만 묻는다.
 *
 * 약속은 급식과 같다. **`null`로 끝나면 '받았는데 못 읽었다'이고, 던지면
 * '못 물어봤다'다.** 위층이 다시 물어볼지 캐시에 담을지를 이걸로 가른다.
 *
 * 주소에서 `timezone=Asia/Seoul`이 알맹이다. 안 주면 open-meteo가 UTC로
 * 하루를 끊는데, 한국 자정부터 오전 9시까지는 UTC로 아직 어제라 **등교
 * 시간에 물으면 어제 최저·최고**가 온다. 지금 기온은 멀쩡하니 화면은
 * 그럴듯하고, 틀렸다는 표시가 어디에도 없다.
 *
 * 좌표는 그대로 붙인다. `Region`의 위도·경도는 숫자라 주소에 실릴 때
 * 탈이 날 글자가 없다(우리 표는 전부 양수다).
 */
export class WeatherSource {
  constructor(private readonly http: HttpClient) {}

  async fetchWeather(region: Region): Promise<Weather | null> {
    const url =
      `${BASE}?latitude=${region.lat}&longitude=${region.lon}` +
      '&current=temperature_2m,weather_code' +
      '&daily=temperature_2m_max,temperature_2m_min' +
      '&timezone=Asia%2FSeoul&forecast_days=1';

    const raw = await this.http.getJson(url);

    const fault = weatherFault(raw);
    if (fault !== null) throw new WeatherFaultError(fault);

    return parseWeather(raw);
  }
}
