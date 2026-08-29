/**
 * open-meteo 응답을 우리 타입으로 옮긴다.
 *
 * `neisParse`와 같은 약속이다 — **무엇이 와도 던지지 않는다.** 못 읽으면
 * `null`이다. 급식은 화면 한 칸이지만 날씨는 머리띠에 뜨고, 머리띠는 모든
 * 화면에 늘 있다. 여기서 던지면 날씨가 안 보이는 게 아니라 앱이 안 열린다.
 *
 * 통신과 떼어 둔 까닭도 같다. 섞어 두면 응답 모양 하나를 확인하려고 매번
 * 인터넷을 타야 한다.
 */

export interface Weather {
  /** 지금 기온(°C). 소수 한 자리로 온다. */
  temperature: number;
  /**
   * 오늘 최저·최고(°C).
   *
   * open-meteo는 `daily`를 날짜별 배열로 준다. `forecast_days=1`로 물으므로
   * 우리가 쓰는 것은 첫 칸뿐이다.
   */
  low: number;
  high: number;
  /**
   * WMO 날씨 코드. 0=맑음, 1~3=구름, 45~48=안개, 51~67=비, 71~77=눈,
   * 80~99=소나기·뇌우.
   *
   * 숫자 그대로 둔다. 아이콘으로 옮기는 표는 화면 쪽 일이고, 여기서
   * '맑음' 같은 글자로 바꿔 버리면 모르는 코드를 만났을 때 무엇이 왔는지
   * 알 길이 없다.
   */
  code: number;
}

/**
 * 더듬어도 되는 객체인가.
 *
 * 배열도 `typeof`가 `'object'`다. 먼저 가르지 않으면 `[]`를 받아 칸을
 * 더듬다 전부 `undefined`가 되어 조용히 끝난다 — 자료가 온 것과 딴것이
 * 온 것이 같은 모양이 된다.
 */
function objectOf(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * 숫자만 통과시킨다.
 *
 * 참·거짓으로 검사하면 안 되는 자리다. **0°C와 WMO 0(맑음)은 거짓 같은
 * 값이고, 하필 그 둘이 가장 자주 온다.** 겨울 아침과 맑은 날에 날씨가
 * 사라지는데 코드에는 이상한 데가 없어 보인다.
 *
 * `Number.isFinite`까지 보는 것은 JSON이 NaN을 못 싣기 때문이 아니라 이
 * 함수가 받는 것이 `unknown`이기 때문이다. 화면에 `NaN°`가 뜨느니 아무것도
 * 안 뜨는 편이 낫다.
 */
function numberOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** `daily`의 첫 칸. 날짜별 배열이라고 넘겨짚지 않고 배열인지부터 본다. */
function firstNumberOf(value: unknown): number | null {
  if (!Array.isArray(value)) return null;

  // Array.isArray가 unknown을 any[]로 좁힌다. 그대로 두면 any가 새어 나간다.
  const list: readonly unknown[] = value;
  return numberOf(list[0]);
}

/**
 * open-meteo가 자료 대신 오류를 보냈는가. 오류면 그 사유를, 아니면 null.
 *
 * **NEIS와 다르다.** NEIS는 오류도 HTTP 200으로 준다. open-meteo는 상태
 * 코드를 제대로 준다 — 잘못된 위도, 없는 변수 이름, 빠진 매개변수 셋을
 * 실제로 불러 봤더니 전부 400이었고 몸통이 `{"error":true,"reason":"…"}`
 * 였다. 그러니 보통은 `TauriHttpClient`가 이 봉투를 보기 전에 던진다.
 *
 * 그런데도 알아보는 까닭은, **상태 코드를 보는 것이 `HttpClient`의 약속이
 * 아니라 그 구현 하나의 성질**이기 때문이다. 이음매는 "JSON을 받아 온다,
 * 실패하면 던진다"까지만 말한다. 상태를 안 보는 구현이 끼면 봉투가 자료인
 * 척 파서까지 오고, 파서는 규칙대로 `null`을 낸다. 그러면 '못 물어봤다'가
 * '읽을 게 없다'로 뭉개진다 — NEIS에서 한 번 겪은 그 자리다.
 */
export function weatherFault(raw: unknown): string | null {
  const body = objectOf(raw);
  if (body === null || body['error'] !== true) return null;

  const reason = body['reason'];
  // 사유가 비면 우리 문구를 올린다. 빈 글자는 오류가 없는 것과 구분이 안 된다.
  return typeof reason === 'string' && reason !== '' ? reason : '날씨를 받아 오지 못했습니다.';
}

export function parseWeather(raw: unknown): Weather | null {
  const body = objectOf(raw);
  if (body === null) return null;

  const current = objectOf(body['current']);
  const daily = objectOf(body['daily']);
  if (current === null || daily === null) return null;

  const temperature = numberOf(current['temperature_2m']);
  const code = numberOf(current['weather_code']);
  const high = firstNumberOf(daily['temperature_2m_max']);
  const low = firstNumberOf(daily['temperature_2m_min']);

  /*
   * 넷이 다 있어야 준다. 반쪽을 보여 주느니 안 보여 준다 — 최저·최고 없이
   * 숫자 하나만 뜨면 그게 지금 기온인지 오늘 최고인지 교사가 알 수 없고,
   * 물어볼 곳도 없다.
   */
  if (temperature === null || code === null || high === null || low === null) return null;

  return { temperature, low, high, code };
}
