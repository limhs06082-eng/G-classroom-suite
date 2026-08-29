import { beforeEach, describe, expect, it } from 'vitest';

import type { Region } from '../../src/shared/domain/regions';
import { MemoryHttpClient } from '../../src/shared/external/MemoryHttpClient';
import { WeatherFaultError, WeatherSource } from '../../src/shared/external/WeatherSource';

let http: MemoryHttpClient;
let weather: WeatherSource;

beforeEach(() => {
  http = new MemoryHttpClient();
  weather = new WeatherSource(http);
});

const incheon: Region = { name: '인천광역시', lat: 37.4563, lon: 126.7052 };
const jeju: Region = { name: '제주특별자치도', lat: 33.4996, lon: 126.5312 };

/**
 * 주소를 손으로 적어 둔다. `WeatherSource`가 쓰는 조각으로 조립하면
 * 조각이 틀려도 시험이 함께 틀려서 아무것도 못 잡는다.
 */
const incheonUrl =
  'https://api.open-meteo.com/v1/forecast?latitude=37.4563&longitude=126.7052' +
  '&current=temperature_2m,weather_code' +
  '&daily=temperature_2m_max,temperature_2m_min' +
  '&timezone=Asia%2FSeoul&forecast_days=1';

const jejuUrl =
  'https://api.open-meteo.com/v1/forecast?latitude=33.4996&longitude=126.5312' +
  '&current=temperature_2m,weather_code' +
  '&daily=temperature_2m_max,temperature_2m_min' +
  '&timezone=Asia%2FSeoul&forecast_days=1';

const body = {
  current: { time: '2026-08-29T09:30', interval: 900, temperature_2m: 26.3, weather_code: 1 },
  daily: { time: ['2026-08-29'], temperature_2m_max: [27.6], temperature_2m_min: [23.6] },
};

describe('날씨 조회', () => {
  it('좌표를 제자리에 넣어 부른다', async () => {
    /*
     * 위도와 경도를 맞바꾸면 위도가 126이 되어 open-meteo가 400을 준다.
     * 조용히 다른 지역 날씨가 뜨는 게 아니라 **아무 표시 없이 영영 안
     * 뜬다.** 머리띠는 실패해도 아무것도 안 그리는 자리라(계획서 Task 5),
     * 그렇게 되면 아무도 못 알아챈다.
     */
    http.put(incheonUrl, body);

    await weather.fetchWeather(incheon);

    expect(http.calls).toEqual([incheonUrl]);
  });

  it('지역이 다르면 그 지역 좌표로 부른다', async () => {
    // 한 곳만 시험하면 좌표를 박아 넣은 구현도 통과한다.
    http.put(jejuUrl, body);

    await weather.fetchWeather(jeju);

    expect(http.calls).toEqual([jejuUrl]);
  });

  it('오늘의 최저·최고를 한국 시각으로 묻는다', async () => {
    /*
     * `timezone`을 안 주면 open-meteo가 UTC로 하루를 끊는다. 한국 자정부터
     * 오전 9시까지는 UTC로 아직 어제라, **등교 시간에 물으면 어제 최저·최고**가
     * 온다. 지금 기온은 멀쩡해서 화면은 그럴듯하고 틀렸다는 표시가 없다.
     *
     * `forecast_days=1`은 오늘 하루만 받겠다는 뜻이다. 이게 없으면 `daily`가
     * 7일치로 오고, 파서가 첫 칸을 집는 것은 그대로 맞지만 쓸데없이 커진다.
     */
    http.put(incheonUrl, body);

    await weather.fetchWeather(incheon);

    expect(http.calls[0]).toContain('&timezone=Asia%2FSeoul');
    expect(http.calls[0]).toContain('&forecast_days=1');
  });

  it('받아 온 것을 우리 타입으로 준다', async () => {
    http.put(incheonUrl, body);

    expect(await weather.fetchWeather(incheon)).toEqual({
      temperature: 26.3,
      low: 23.6,
      high: 27.6,
      code: 1,
    });
  });

  it('못 읽는 응답이면 null이고 던지지 않는다', async () => {
    // 약속이 급식과 같다. null은 '받았는데 못 읽었다'이고 던지는 것은 '못 물어봤다'다.
    http.put(incheonUrl, { current: { temperature_2m: 26.3 } });

    expect(await weather.fetchWeather(incheon)).toBeNull();
  });

  it('통신이 실패하면 그대로 던진다', async () => {
    /*
     * 여기서 null로 삼키면 위층이 '오늘은 날씨가 없다'로 읽는다. 인터넷이
     * 끊긴 것과 자료를 못 읽은 것은 다시 물어볼지 말지가 갈린다.
     */
    http.fail(incheonUrl, '인터넷 연결 없음');

    await expect(weather.fetchWeather(incheon)).rejects.toThrow('인터넷 연결 없음');
  });

  it('오류 봉투를 자료인 척 받으면 던진다', async () => {
    /*
     * open-meteo는 이 봉투를 HTTP 400에 실어 보내므로 `TauriHttpClient`가
     * 먼저 던진다 — 실제로 불러 확인했다. 다만 상태 코드를 보는 것은
     * `HttpClient`의 약속이 아니라 그 구현 하나의 성질이다. 봉투가 여기까지
     * 오면 '못 물어봤다'로 올린다.
     */
    http.put(incheonUrl, { error: true, reason: 'Hourly API request limit exceeded.' });

    await expect(weather.fetchWeather(incheon)).rejects.toThrow(WeatherFaultError);
    await expect(weather.fetchWeather(incheon)).rejects.toThrow('Hourly API request limit');
  });
});
