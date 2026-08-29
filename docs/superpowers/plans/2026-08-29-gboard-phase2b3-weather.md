# 날씨 구현 계획 (2-나-3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학교를 정하면 머리띠에 오늘 날씨가 뜬다. 지역을 따로 묻지 않는다.

**Architecture:** 좌표는 **시·도 열일곱의 고정 표**에서 얻는다(지오코딩 API는 쓸 수 없음을 확인했다). 날씨는 `open-meteo`에서 받아 `CacheStore`에 1시간 담는다. 급식과 같은 이음매(`HttpClient` → `TauriHttpClient`)를 쓰고, 판단은 순수 함수에 모은다.

**Tech Stack:** React 19 · TypeScript 5.8 (`strict`, `noUncheckedIndexedAccess`) · Vitest · Tauri 2

## Global Constraints

- **설치형 전용이다.** 급식과 같은 `TauriHttpClient` 길을 쓴다. 웹 묶음에 Tauri 코드가 섞이면 안 되므로 **Tauri를 건드리는 모듈은 전부 `await import(...)` 안에** 있어야 한다.
- **기능 코드는 `localStorage`를 직접 부르지 않는다.**
- **날씨는 자료가 아니라 캐시다.** `cache.json`에 담고 백업에 안 넣는다. 1시간만 남긴다.
- 주석은 한국어로, **무엇이 아니라 왜**를 적는다.
- 색을 직접 박지 마라. `index.css` 토큰을 경유한다. `bg-white`가 아니라 `bg-surface`다.
- TypeScript `strict` + `noUncheckedIndexedAccess`. `any` 금지.
- **`npm run lint`는 `tests/`도 검사한다** (`noUnusedParameters: true`).
- 각 과제는 `npm run verify`가 exit 0이어야 커밋한다.

## 먼저 확인해 둔 사실

**지오코딩 API는 못 쓴다.** 실제 학교 주소 열둘로 쟀다.

```
"인천광역시 남동구"  → 없음      두 낱말을 붙여 물으면 아무것도 안 나온다
"연수구"·"수성구"    → 없음
"용인시"·"파주시"    → 없음
"남동구"            → 남동구노인게이트볼구장
"강서구"            → 서울 강서구   ← 부산 강서구를 물었는데
```

마지막 줄이 결정적이다. **부산 학교에 서울 날씨를 띄운다.** 조용히 틀리는 쪽이 못 찾는 쪽보다 나쁘다.

**`open-meteo` 예보는 잘 된다.** 인증키 없이 되고 시·도 좌표 열일곱이 전부 응답한다.

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=37.4563&longitude=126.7052
  &current=temperature_2m,weather_code
  &daily=temperature_2m_max,temperature_2m_min
  &timezone=Asia%2FSeoul&forecast_days=1

{"current":{"temperature_2m":26.4,"weather_code":1},
 "daily":{"temperature_2m_max":[27.6],"temperature_2m_min":[23.7]}}
```

**NEIS는 좌표를 안 준다.** `ORG_RDNMA`(도로명 주소)의 첫 낱말이 시·도다.

```
인천광역시 남동구 서창남순환로 190-28
경기도 성남시 수정구 위례동로 55
```

---

## File Structure

| 파일 | 맡는 일 |
|---|---|
| `src/shared/domain/regions.ts` | 시·도 열일곱의 좌표. 주소에서 시·도 뽑기 |
| `src/shared/external/weatherParse.ts` | open-meteo 응답 → 우리 타입. 던지지 않는다 |
| `src/shared/external/WeatherSource.ts` | 주소를 부르는 곳 |
| `src/shared/storage/CacheStore.ts` | 날씨 칸(1시간) |
| `src/features/home/todayWeather.ts` | 판단 (`WeatherState`) |
| `src/features/home/WeatherBadge.tsx` | 머리띠에 뜨는 것 |
| `src/app/AppShell.tsx` | 붙이기 |

---

### Task 1: 시·도 좌표와 주소 읽기

**Files:**
- Create: `src/shared/domain/regions.ts`
- Test: `tests/domain/regions.test.ts`

**Interfaces:**
- Produces: `Region`, `REGIONS`, `regionOfAddress(address: string): Region | null`

- [ ] **Step 1: 실패하는 시험을 먼저 쓴다**

`tests/domain/regions.test.ts`

```ts
import { describe, expect, it } from 'vitest';

import { REGIONS, regionOfAddress } from '../../src/shared/domain/regions';

describe('시·도 좌표', () => {
  it('열일곱이다', () => {
    expect(REGIONS).toHaveLength(17);
  });

  it('전부 대한민국 범위 안이다', () => {
    /*
     * 좌표를 손으로 적는 표라 숫자 한 자리만 틀려도 바다나 중국이 된다.
     * 그러면 화면에는 멀쩡한 온도가 뜨고 아무도 못 알아챈다.
     */
    for (const region of REGIONS) {
      expect(region.lat, region.name).toBeGreaterThan(33);
      expect(region.lat, region.name).toBeLessThan(38.7);
      expect(region.lon, region.name).toBeGreaterThan(124.5);
      expect(region.lon, region.name).toBeLessThan(131);
    }
  });

  it('이름이 겹치지 않는다', () => {
    expect(new Set(REGIONS.map((r) => r.name)).size).toBe(REGIONS.length);
  });
});

describe('주소에서 시·도 뽑기', () => {
  it('첫 낱말로 찾는다', () => {
    expect(regionOfAddress('인천광역시 남동구 서창남순환로 190-28')?.name).toBe('인천광역시');
    expect(regionOfAddress('경기도 성남시 수정구 위례동로 55')?.name).toBe('경기도');
  });

  it('앞뒤 공백을 견딘다', () => {
    expect(regionOfAddress('  제주특별자치도 제주시 ... ')?.name).toBe('제주특별자치도');
  });

  it('모르는 주소는 null이다', () => {
    // 던지지 않는다. 주소 하나 때문에 머리띠가 사라지면 안 된다.
    expect(regionOfAddress('')).toBeNull();
    expect(regionOfAddress('어딘가 먼 곳')).toBeNull();
  });

  it('옛 이름도 받아 준다', () => {
    /*
     * 강원도·전라북도는 특별자치도로 바뀌었지만, 예전에 저장해 둔 주소가
     * 그대로 남아 있다. 이름이 바뀌었다고 날씨가 사라지면 안 된다.
     */
    expect(regionOfAddress('강원도 춘천시 ...')?.name).toBe('강원특별자치도');
    expect(regionOfAddress('전라북도 전주시 ...')?.name).toBe('전북특별자치도');
  });
});
```

- [ ] **Step 2: 돌려서 실패를 본다**

`npx vitest run tests/domain/regions.test.ts` → FAIL (모듈 없음)

- [ ] **Step 3: 구현한다**

`src/shared/domain/regions.ts`

```ts
/**
 * 시·도 열일곱과 그 대표 좌표.
 *
 * **지오코딩 API를 안 쓴다.** open-meteo 지오코더로 실제 학교 주소 열둘을
 * 재 봤더니 시·군·구 이름은 대부분 못 찾고, 찾은 것 하나는 노인게이트볼
 * 구장이었으며, **부산 강서구를 물었더니 서울 강서구가 나왔다.** 못 찾는
 * 것보다 조용히 틀리는 쪽이 나쁘다 — 교사는 화면을 믿고, 틀렸다는 표시가
 * 어디에도 없다.
 *
 * 대신 거칠다. 경기도는 남북 130km라 파주와 평택이 2~3°C 차이 날 수 있다.
 * 그래서 화면에 **지역 이름을 함께** 띄운다. "경기도 25°"로 보이면 교사가
 * 그 숫자를 어느 정도로 믿을지 스스로 안다.
 *
 * 좌표는 전부 실제로 불러 응답이 오는지, 대한민국 범위 안인지 확인했다.
 */
export interface Region {
  name: string;
  lat: number;
  lon: number;
}

export const REGIONS: readonly Region[] = [
  { name: '서울특별시', lat: 37.5665, lon: 126.978 },
  { name: '부산광역시', lat: 35.1796, lon: 129.0756 },
  { name: '대구광역시', lat: 35.8714, lon: 128.6014 },
  { name: '인천광역시', lat: 37.4563, lon: 126.7052 },
  { name: '광주광역시', lat: 35.1595, lon: 126.8526 },
  { name: '대전광역시', lat: 36.3504, lon: 127.3845 },
  { name: '울산광역시', lat: 35.5384, lon: 129.3114 },
  { name: '세종특별자치시', lat: 36.48, lon: 127.289 },
  { name: '경기도', lat: 37.275, lon: 127.0095 },
  { name: '강원특별자치도', lat: 37.8854, lon: 127.7298 },
  { name: '충청북도', lat: 36.6357, lon: 127.4913 },
  { name: '충청남도', lat: 36.6588, lon: 126.6728 },
  { name: '전북특별자치도', lat: 35.8203, lon: 127.1088 },
  { name: '전라남도', lat: 34.8161, lon: 126.4629 },
  { name: '경상북도', lat: 36.576, lon: 128.5056 },
  { name: '경상남도', lat: 35.2383, lon: 128.6924 },
  { name: '제주특별자치도', lat: 33.4996, lon: 126.5312 },
] as const;

/**
 * 예전 이름으로 저장된 주소를 지금 이름에 잇는다.
 *
 * 강원도와 전라북도가 특별자치도로 바뀌었다. 이름이 바뀌었다고 그 학교
 * 날씨가 사라지면 안 된다.
 */
const ALIASES: Record<string, string> = {
  강원도: '강원특별자치도',
  전라북도: '전북특별자치도',
};

/**
 * 주소에서 시·도를 찾는다. 모르면 null.
 *
 * NEIS의 `ORG_RDNMA`는 늘 시·도로 시작한다 — `인천광역시 남동구 …`.
 * 던지지 않는다. 주소 하나를 못 읽었다고 머리띠가 사라지면 안 된다.
 */
export function regionOfAddress(address: string): Region | null {
  const head = address.trim().split(/\s+/)[0] ?? '';
  if (head === '') return null;

  const name = ALIASES[head] ?? head;
  return REGIONS.find((region) => region.name === name) ?? null;
}
```

- [ ] **Step 4: 통과를 본다**

- [ ] **Step 5: 변이로 확인한다**

| 변이 | 실패해야 하는 시험 |
|---|---|
| 아무 좌표의 위도 앞자리를 바꾼다 (37 → 47) | 전부 대한민국 범위 안이다 |
| `ALIASES`를 비운다 | 옛 이름도 받아 준다 |
| `split` 대신 주소 전체로 찾는다 | 첫 낱말로 찾는다 |

- [ ] **Step 6: 커밋**

```bash
git add -A && git commit -m "feat: 시·도 좌표와 주소에서 지역 뽑기"
```

---

### Task 2: 학교 주소를 담아 둔다

**Files:**
- Modify: `src/shared/domain/types.ts` (`SchoolProfile.schoolAddress`)
- Modify: `src/shared/storage/schema.ts`
- Modify: `src/features/settings/SettingsPage.tsx` (학교를 고를 때 주소도 담는다)
- Test: `tests/settings/SchoolSearch.test.tsx` (이미 있는 파일에 더한다)

**Interfaces:**
- Consumes: `SchoolHit.address` (이미 있다)
- Produces: `SuiteData.profile.schoolAddress?: string`

- [ ] **Step 1: 지금 무엇이 담기는지 확인한다**

`SettingsPage.tsx`의 `onPick`이 지금 `schoolName`·`officeCode`·`schoolCode` 셋만 담는다. `SchoolHit`에는 `address`가 이미 있는데 버리고 있다.

- [ ] **Step 2: 타입과 스키마**

`SchoolProfile`에 더한다.

```ts
  /**
   * 학교 도로명 주소. 날씨 지역을 여기서 뽑는다.
   *
   * 교사가 직접 치지 않는다 — 학교를 고를 때 NEIS가 준 것을 그대로 담는다.
   * 없어도 앱은 돈다(날씨만 안 뜬다). 그래서 선택 항목이다.
   */
  schoolAddress?: string;
```

`schema.ts`의 `parseProfile`에서 다른 선택 항목과 같은 꼴로 읽는다.

- [ ] **Step 3: 고를 때 함께 담는다**

`SettingsPage.tsx`의 `onPick`에 `schoolAddress: hit.address,`를 더한다.

- [ ] **Step 4: 시험**

```ts
it('학교를 고르면 주소도 함께 담긴다', async () => {
  // 날씨 지역이 여기서 나온다. 주소를 안 담으면 교사가 지역을 따로 골라야 한다.
  ...
  expect(saved.profile.schoolAddress).toBe('경기도 성남시 수정구 위례동로 55');
});
```

`tests/storage/`에 왕복 시험도 더한다 — 저장하고 다시 읽어도 남는지.

- [ ] **Step 5: `npm run verify`** exit 0

- [ ] **Step 6: 커밋**

```bash
git add -A && git commit -m "feat: 학교를 고를 때 주소도 담는다"
```

---

### Task 3: 날씨를 받아 온다

**Files:**
- Create: `src/shared/external/weatherParse.ts`
- Create: `src/shared/external/WeatherSource.ts`
- Modify: `src-tauri/capabilities/default.json` (open-meteo 다시 허용)
- Test: `tests/external/weatherParse.test.ts`, `tests/external/WeatherSource.test.ts`

**Interfaces:**
- Consumes: `HttpClient`, `Region` (Task 1)
- Produces: `Weather`, `parseWeather`, `WeatherSource`

- [ ] **Step 1: 타입과 파서**

```ts
export interface Weather {
  /** 지금 기온. 소수 한 자리까지 온다 */
  temperature: number;
  /** 오늘 최저·최고 */
  low: number;
  high: number;
  /** WMO 날씨 코드. 0=맑음, 1~3=구름, 45~48=안개, 51~67=비, 71~77=눈, 80~99=소나기·뇌우 */
  code: number;
}
```

`parseWeather(raw: unknown): Weather | null` — **던지지 않는다.** 하나라도 못 읽으면 `null`.

- [ ] **Step 2: 부르는 곳**

```ts
const BASE = 'https://api.open-meteo.com/v1/forecast';

export class WeatherSource {
  constructor(private readonly http: HttpClient) {}

  /** 못 읽으면 null. 못 물어봤으면 던진다 — 급식과 같은 약속이다. */
  async fetchWeather(region: Region): Promise<Weather | null> {
    const url =
      `${BASE}?latitude=${region.lat}&longitude=${region.lon}` +
      `&current=temperature_2m,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&timezone=Asia%2FSeoul&forecast_days=1`;

    return parseWeather(await this.http.getJson(url));
  }
}
```

- [ ] **Step 3: 권한을 다시 연다**

`src-tauri/capabilities/default.json`의 `http:default`에 더한다.

```json
{ "url": "https://api.open-meteo.com/*" }
```

> 2-가에서 **안 쓰는 주소를 열어 두지 않으려고 지웠던 것**이다. 이제 실제로 쓴다. `geocoding-api.open-meteo.com`은 **다시 열지 않는다** — 못 쓴다는 것을 확인했다.

- [ ] **Step 4: 시험**

`weatherParse.test.ts` — 진짜 응답 모양으로. 담을 것: 정상, 칸 하나가 없음, 숫자가 아님, `daily` 배열이 빔, 응답이 통째로 딴것.

`WeatherSource.test.ts` — `MemoryHttpClient`로. 담을 것: 주소에 좌표가 제자리에 들어가는지, 통신 실패는 던지는지.

- [ ] **Step 5: 변이 확인** — 좌표 둘을 맞바꾸기, `parseWeather`가 던지게 하기

- [ ] **Step 6: `npm run verify`** exit 0 · **커밋**

---

### Task 4: 한 시간 담아 둔다

**Files:**
- Modify: `src/shared/storage/CacheStore.ts`
- Test: `tests/storage/CacheStore.test.ts` (이미 있는 파일에 더한다)

**Interfaces:**
- Produces: `CacheStore.getWeather(regionName)` / `putWeather(regionName, weather)`

- [ ] **Step 1: 모양**

`CacheShape`에 더한다.

```ts
  /** 지역 이름 → 받아 온 것과 받은 때. 한 시간만 쓴다. */
  weather?: Record<string, { at: string; value: Weather }>;
```

**급식과 다른 점 둘.** 급식은 날짜가 열쇠고 하루가 지나면 뜻이 없다. 날씨는 **지역**이 열쇠고 **한 시간**이면 낡는다. 그리고 `school`이 바뀌어도 날씨는 안 버린다 — 지역이 같으면 같은 날씨다.

- [ ] **Step 2: 시험**

- 담은 것을 한 시간 안에 꺼내면 그대로다
- **한 시간이 지나면 `null`이다**
- 다른 지역은 안 섞인다
- 다시 열어도 남아 있다
- 학교를 바꿔도 날씨는 안 버린다 (급식과 다르다)

- [ ] **Step 3: 변이 확인** — 한 시간 검사 지우기, 지역 열쇠 무시하기

- [ ] **Step 4: `npm run verify`** exit 0 · **커밋**

---

### Task 5: 머리띠에 띄운다

**Files:**
- Create: `src/features/home/todayWeather.ts`
- Create: `src/features/home/WeatherBadge.tsx`
- Modify: `src/app/AppShell.tsx`
- Test: `tests/home/todayWeather.test.ts`, `tests/home/WeatherBadge.test.tsx`, `tests/home/weatherWiring.test.tsx`

**Interfaces:**
- Consumes: 앞 네 과제 전부
- Produces: `WeatherState`, `loadTodayWeather`, `WeatherBadge`

> **이미 학교를 고른 선생님도 날씨가 떠야 한다.** Task 2 구현자가 짚은 것이다.
> 주소는 이번 판에 새로 담기 시작한 칸이라, 그 전에 학교를 고른 사람에게는
> 없다. 그대로 두면 **기존 사용자 전원에게 이 기능이 안 보인다.**
>
> 다시 고르라고 하지 않는다. **NEIS에 학교 코드로 물으면 주소가 온다** —
> 확인했다.
>
> ```
> GET .../schoolInfo?Type=json&pIndex=1&pSize=5
>       &ATPT_OFCDC_SC_CODE=E10&SD_SCHUL_CODE=7341236
> → 1행, ORG_RDNMA = "인천광역시 남동구 서창남순환로 190-28"
> ```
>
> 그러니 이렇게 한다 — **학교 코드는 있는데 주소가 없으면 한 번 받아 와
> `update()`로 담는다.** 한 번 담기면 다시 안 묻는다. 실패하면 조용히
> 넘어간다(날씨만 안 뜬다). `NeisSource`에 `fetchAddress(officeCode,
> schoolCode)`를 더하고, 그 시험도 함께 쓴다.

- [ ] **Step 1: 판단 (순수)**

```ts
export type WeatherState =
  | { kind: 'no-school' }      // 학교를 안 정했거나 주소를 못 읽는다
  | { kind: 'loading' }
  | { kind: 'ready'; region: string; weather: Weather }
  | { kind: 'failed' };
```

급식(`MealState`)과 같은 결이다. **`no-school`과 `failed`를 가르는 까닭도 같다** — 교사가 할 일이 다르다.

- [ ] **Step 2: 화면**

머리띠 오른쪽에 한 줄. `☁ 25° · 경기도` 꼴이다.

**지역 이름을 함께 띄운다.** 시·도 단위라 거친데, 그것을 감추면 교사가 그 숫자를 자기 학교 마당의 온도로 여긴다. 이름이 보이면 어느 정도로 믿을지 스스로 안다.

WMO 코드를 아이콘으로 옮기는 표를 둔다. **모르는 코드는 아이콘 없이 온도만** 보인다 — 던지거나 빈 자리를 남기지 않는다.

`failed`와 `no-school`은 **아무것도 안 그린다.** 머리띠는 늘 보이는 자리라, 거기에 오류 문구를 띄우면 하루 종일 눈에 걸린다. 급식 카드와 다른 판단이고, 그 까닭을 주석에 적어라.

> **한 시간마다 다시 물어야 한다.** Task 4 구현자가 짚은 것이다. 낡음 검사가
> `getWeather()` 안에 있으므로 **아무도 다시 안 물으면 아침 온도가 하루 종일
> 머리띠에 박힌다.** G-board는 교실 컴퓨터에서 종일 켜져 있는 것이 전제라
> 이건 실제로 일어난다.
>
> `useNow()`(1분마다 깨는 갈고리)가 이미 있다. 그것을 그대로 쓰되 **매분
> 묻지는 마라** — 캐시가 신선하면 `getWeather()`가 곧바로 돌려주므로 바깥
> 요청은 한 시간에 한 번만 나간다. 다만 **매분 `CacheStore.open()`을 부르면
> 파일을 매분 읽는다.** 그것이 값싼지 판단하고, 아니면 다른 방법을 정해라.
> 무엇을 골랐든 보고서에 적어라.
>
> 캐시 열쇠는 `Region`이 아니라 `region.name`이다.

- [ ] **Step 3: 붙인다**

`AppShell`의 머리띠. **`isDesktop()` 분기가 필요하다** — 웹에서는 안 그린다. 급식과 같은 사정이다.

`isDesktop()`을 인라인으로 쓰지 말고 `HomePage`의 `TodayMeal` 붙이는 방식을 그대로 따라라. **Tauri를 건드리는 모듈은 전부 `await import(...)` 안에.**

- [ ] **Step 4: 배선 시험**

이 판에서 다섯 번 겪은 자리다. `weatherWiring.test.tsx`가 **실제로 그려서** 확인한다.

- 학교 주소가 있으면 그 지역 좌표로 부른다
- 받아 온 온도가 머리띠에 뜬다
- 캐시가 있으면 다시 안 묻는다
- 주소를 못 읽으면 아무것도 안 그리고 **묻지도 않는다**
- 통신이 실패해도 머리띠가 안 깨진다

- [ ] **Step 5: 변이 확인**

| 변이 | 실패해야 하는 시험 |
|---|---|
| `regionOfAddress`를 안 거치고 늘 서울을 쓴다 | 그 지역 좌표로 부른다 |
| 캐시를 안 본다 | 캐시가 있으면 다시 안 묻는다 |
| `no-school`에도 부른다 | 묻지도 않는다 |

**하나 더 스스로 만들어라.**

- [ ] **Step 6: `npm run verify`** exit 0 · **커밋**

---

## Self-Review

**1. 설계 덮기**
- 학교 하나만 물으면 날씨가 따라온다 → Task 2 (주소를 함께 담는다) ✓
- 지역을 따로 안 묻는다 → Task 1 (주소에서 뽑는다) ✓
- 날씨는 캐시고 1시간 → Task 4 ✓
- 백업에 안 들어간다 → `cache.json`에 담으므로 저절로 ✓
- 머리띠에 뜬다 → Task 5 ✓

**2. 빈칸 없음** — Task 3~5의 시험 목록은 담을 것만 적었다. 구현자가 채운다.

**3. 이름 일치** — `Region`/`REGIONS`/`regionOfAddress`/`Weather`/`parseWeather`/`WeatherSource`/`WeatherState`/`loadTodayWeather`/`WeatherBadge`가 과제 사이에서 같은 철자다.

**4. 이 계획이 못 잡는 것** — 시·도 단위가 교실에서 쓸 만큼 맞는지는 **써 봐야 안다.** 시험은 "좌표가 대한민국 안이다"까지만 본다.
