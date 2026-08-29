import { describe, expect, it } from 'vitest';

import { parseWeather, weatherFault } from '../../src/shared/external/weatherParse';

/**
 * 실제로 불러서 받은 응답이다. 2026-08-29 인천 좌표로 부른 것을 그대로 옮겼다.
 *
 * 쓰지 않는 칸(`current_units`·`generationtime_ms`·`elevation`…)까지 남겨 뒀다.
 * 파서가 아는 칸만 집는지 보려면 모르는 칸이 섞여 있어야 한다.
 */
const response = {
  latitude: 37.45,
  longitude: 126.6875,
  generationtime_ms: 0.057,
  utc_offset_seconds: 32400,
  timezone: 'Asia/Seoul',
  timezone_abbreviation: 'GMT+9',
  elevation: 42.0,
  current_units: {
    time: 'iso8601',
    interval: 'seconds',
    temperature_2m: '°C',
    weather_code: 'wmo code',
  },
  current: { time: '2026-08-29T09:30', interval: 900, temperature_2m: 26.3, weather_code: 1 },
  daily_units: { time: 'iso8601', temperature_2m_max: '°C', temperature_2m_min: '°C' },
  daily: { time: ['2026-08-29'], temperature_2m_max: [27.6], temperature_2m_min: [23.6] },
};

/** 나머지는 그대로 두고 `current`만 바꾼다. 칸 하나가 어긋났을 때를 만들려고 쓴다. */
function withCurrent(current: unknown): unknown {
  return { ...response, current };
}

function withDaily(daily: unknown): unknown {
  return { ...response, daily };
}

describe('open-meteo 응답 읽기', () => {
  it('네 칸을 뽑는다', () => {
    expect(parseWeather(response)).toEqual({
      temperature: 26.3,
      low: 23.6,
      high: 27.6,
      code: 1,
    });
  });

  it('영하와 0을 그대로 읽는다', () => {
    /*
     * 0은 거짓 같은 값이다. `if (!temperature)`로 검사하면 0°C인 겨울
     * 아침에 머리띠가 빈다. 게다가 WMO 0은 '맑음'이라 1년 중 가장 자주
     * 오는 코드다 — 이 시험이 없으면 맑은 날마다 날씨가 사라진다.
     */
    const winter = {
      ...response,
      current: { ...response.current, temperature_2m: 0, weather_code: 0 },
      daily: { ...response.daily, temperature_2m_max: [0], temperature_2m_min: [-8.4] },
    };

    expect(parseWeather(winter)).toEqual({ temperature: 0, low: -8.4, high: 0, code: 0 });
  });

  it('current이 없으면 null이다', () => {
    expect(parseWeather({ daily: response.daily })).toBeNull();
  });

  it('daily가 없으면 null이다', () => {
    /*
     * 지금 기온만 있고 최저·최고가 없다. 반쪽을 보여 주느니 안 보여 준다 —
     * 숫자 하나만 뜨면 그게 지금인지 오늘 최고인지 교사가 알 길이 없다.
     */
    expect(parseWeather({ current: response.current })).toBeNull();
  });

  it('weather_code가 없으면 null이다', () => {
    expect(parseWeather(withCurrent({ time: '2026-08-29T09:30', temperature_2m: 26.3 }))).toBeNull();
  });

  it('값이 null로 오면 null이다', () => {
    /*
     * JSON은 null을 실을 수 있고 `typeof null`은 `'object'`다. 숫자인지
     * 따로 보지 않으면 null이 number인 척 그대로 지나가, 머리띠에 빈
     * 자리와 `°`만 남는다.
     */
    expect(parseWeather(withCurrent({ ...response.current, temperature_2m: null }))).toBeNull();
    expect(parseWeather(withCurrent({ ...response.current, weather_code: null }))).toBeNull();
    expect(parseWeather(withDaily({ ...response.daily, temperature_2m_min: [null] }))).toBeNull();
  });

  it('숫자가 아니면 null이다', () => {
    expect(parseWeather(withCurrent({ ...response.current, temperature_2m: '26.3' }))).toBeNull();
    expect(parseWeather(withCurrent({ ...response.current, weather_code: '1' }))).toBeNull();
    expect(parseWeather(withDaily({ ...response.daily, temperature_2m_max: ['27.6'] }))).toBeNull();
  });

  it('NaN은 숫자로 치지 않는다', () => {
    /*
     * JSON은 NaN을 못 싣지만 이 함수가 받는 것은 `unknown`이고, 그 앞에
     * 무엇이 끼일지는 이 파일이 정하지 않는다. 화면에 'NaN°'가 뜨느니
     * 아무것도 안 뜨는 편이 낫다.
     */
    expect(parseWeather(withCurrent({ ...response.current, temperature_2m: Number.NaN }))).toBeNull();
  });

  it('daily 배열이 비면 null이다', () => {
    expect(
      parseWeather(withDaily({ time: [], temperature_2m_max: [], temperature_2m_min: [] })),
    ).toBeNull();
  });

  it('daily 값이 배열이 아니면 null이다', () => {
    // 날짜별 배열로 온다는 것을 넘겨짚지 않는다. 숫자 하나로 오면 `[0]`은 undefined다.
    expect(parseWeather(withDaily({ ...response.daily, temperature_2m_max: 27.6 }))).toBeNull();
  });

  it('응답이 통째로 딴것이면 null이다', () => {
    // 배열도 `typeof`가 'object'다. 먼저 가르지 않으면 칸을 더듬다 조용히 끝난다.
    for (const other of [null, undefined, '', '맑음', 42, true, [], [response]]) {
      expect(parseWeather(other)).toBeNull();
    }
  });

  it('오류 봉투도 null이다', () => {
    // 읽을 게 없는 것은 맞다. 다만 '못 물어봤다'는 사실은 WeatherSource가 따로 올린다.
    expect(parseWeather({ error: true, reason: 'Latitude must be in range of -90 to 90°.' })).toBeNull();
  });
});

describe('open-meteo가 자료 대신 오류를 보냈는가', () => {
  /*
   * NEIS는 오류도 HTTP 200으로 준다. open-meteo는 **그러지 않는다** —
   * 잘못된 위도, 없는 변수 이름, 빠진 매개변수 셋을 실제로 불러 봤더니
   * 전부 HTTP 400이었고 몸통이 `{"error":true,"reason":"…"}`였다.
   * 그래서 보통은 `TauriHttpClient`가 먼저 던진다.
   *
   * 그래도 이 봉투를 알아본다. 상태 코드를 보는 것은 `HttpClient`의
   * 약속이 아니기 때문이다 — 그 이음매는 "JSON을 받아 온다, 실패하면
   * 던진다"까지만 말한다. 상태를 안 보는 구현이 끼면 봉투가 자료인 척
   * 파서까지 오고, 그러면 '못 물어봤다'가 '읽을 게 없다'로 뭉개진다.
   */
  it('사유를 꺼낸다', () => {
    expect(
      weatherFault({ reason: 'Latitude must be in range of -90 to 90°. Given: 999.0.', error: true }),
    ).toContain('Latitude must be in range');
  });

  it('정상 응답은 오류가 아니다', () => {
    expect(weatherFault(response)).toBeNull();
  });

  it('error가 참이 아니면 오류가 아니다', () => {
    expect(weatherFault({ error: false, reason: '아무 일도 없다' })).toBeNull();
    expect(weatherFault({ error: 'true' })).toBeNull();
  });

  it('사유가 없으면 우리 문구를 올린다', () => {
    // 빈 글자를 그대로 올리면 화면에 사유 없는 오류가 뜬다. 그건 오류가 없는 것과 구분이 안 된다.
    expect(weatherFault({ error: true })).not.toBeNull();
    expect(weatherFault({ error: true })).not.toBe('');
    expect(weatherFault({ error: true, reason: '' })).not.toBe('');
  });

  it('딴것은 오류가 아니다', () => {
    for (const other of [null, undefined, '', 42, [], [{ error: true }]]) {
      expect(weatherFault(other)).toBeNull();
    }
  });
});
