import { regionOfAddress, type Region } from '../../shared/domain/regions';
import type { Weather } from '../../shared/external/weatherParse';

/**
 * 머리띠의 날씨가 처할 수 있는 상태.
 *
 * `MealState`와 같은 결이고, **`no-school`과 `failed`를 가르는 까닭도 같다** —
 * 교사가 할 일이 다르다. 앞은 설정에서 학교를 정할 일이고 뒤는 인터넷을
 * 볼 일이다. 화면이 둘 다 안 그린다고 해서(WeatherBadge 주석 참고) 여기서
 * 합치면 안 된다. 합치는 순간 나중에 어느 한쪽만 말해 주기로 마음을 바꿔도
 * 그럴 수가 없고, 지금도 배선 시험이 '묻지도 않았다'를 확인할 길이 없어진다.
 */
export type WeatherState =
  | { kind: 'no-school' }
  | { kind: 'loading' }
  | { kind: 'ready'; region: string; weather: Weather }
  | { kind: 'failed' };

/**
 * 날씨를 담아 두는 곳. `CacheStore`가 이 모양이다.
 *
 * 구체 타입 대신 모양만 받는 까닭은 급식과 같다. 이 파일에 Tauri를 건드리는
 * 모듈이 하나도 안 들어오고, 시험이 메모리 대역을 그대로 끼울 수 있다.
 */
export interface WeatherCache {
  getWeather(regionName: string): Weather | null;
  putWeather(regionName: string, weather: Weather): Promise<void>;
}

/** 날씨를 받아 오는 곳. `WeatherSource`가 이 모양이다. */
export interface WeatherFetcher {
  fetchWeather(region: Region): Promise<Weather | null>;
}

/**
 * 오늘 날씨가 어떤 상태인지 정한다.
 *
 * 머리띠 그리기와 떼어 둔 까닭은 급식과 같지만 더 절실하다. 머리띠는
 * **실패해도 아무것도 안 그리는 자리**라, 이 갈림이 틀리면 화면에 아무 일도
 * 안 일어난다 — 주소를 못 읽어서 안 뜬 것인지, 인터넷이 끊겨서 안 뜬 것인지,
 * 아예 부르지도 않은 것인지 눈으로는 하나도 구별할 수 없다. 효과 안에 붙여
 * 두면 그 셋을 확인할 길이 자체가 없다.
 *
 * 지역은 **주소에서 뽑는다.** 교사에게 지역을 따로 묻지 않는 것이 이 판의
 * 전부다(계획서 Goal).
 */
export async function loadTodayWeather(
  cache: WeatherCache,
  source: WeatherFetcher,
  address: string,
): Promise<WeatherState> {
  /*
   * 주소를 못 읽는 것은 `failed`가 아니다. 여기까지 오는 주소는 NEIS가 준
   * 도로명 주소라 시·도로 시작하는 것이 정상인데, 그래도 못 읽었다면 교사가
   * 볼 곳은 인터넷이 아니라 학교 설정이다.
   */
  const region = regionOfAddress(address);
  if (region === null) return { kind: 'no-school' };

  /*
   * 열쇠는 `Region`이 아니라 `region.name`이다. 담을 때와 찾을 때가 어긋나면
   * 캐시가 영원히 안 맞는데, 그래도 화면은 멀쩡하다 — 매시간이 아니라 매번
   * 새로 받아 올 뿐이다.
   *
   * 낡음 검사는 `getWeather()` 안에 있다. 한 시간이 지났다고 저절로 무슨 일이
   * 일어나지는 않고, 여기 `null`이 '안 물어봤다'와 '낡았다'를 함께 뜻한다.
   * 어느 쪽이든 부르는 쪽이 할 일은 같다 — 가서 받아 온다.
   */
  const cached = cache.getWeather(region.name);
  if (cached !== null) return { kind: 'ready', region: region.name, weather: cached };

  let weather: Weather | null;
  try {
    weather = await source.fetchWeather(region);
  } catch {
    return { kind: 'failed' };
  }

  /*
   * `null`은 급식의 빈 배열과 다르다. 빈 배열은 '물어봤더니 없더라'라서
   * 방학으로 담아 둘 값이 되지만, 여기 `null`은 담을 것이 아예 없다 —
   * 오늘 하늘이 없는 날은 없으므로 이건 우리가 못 읽은 것이다.
   */
  if (weather === null) return { kind: 'failed' };

  try {
    await cache.putWeather(region.name, weather);
  } catch {
    // 담다 실패한 것이지 못 받아 온 것이 아니다. 지금 머리띠에는 떠야 한다.
  }

  return { kind: 'ready', region: region.name, weather };
}
