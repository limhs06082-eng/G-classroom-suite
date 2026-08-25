# G-board 2판-가 구현 계획 — 학교를 등록하면 급식이 뜬다

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 설치형에서 학교 이름을 검색해 고르면, 홈 화면에 오늘 급식이 뜬다.

**Architecture:** NEIS를 `tauri-plugin-http`로 부른다. 그 `fetch`는 전부 IPC로 나가므로 webview가 직접 요청하지 않고, 그래서 CORS를 안 받는다. 응답 파싱은 순수 함수로 떼어 시험하고, 통신은 `HttpClient` 이음매 뒤에 두어 시험에서 갈아 끼운다. 급식은 자료가 아니라 캐시라 `cache.json`에 따로 담는다.

**Tech Stack:** Tauri 2.11, `tauri-plugin-http`, Vite 6, React 19, TypeScript 5.8 strict, Vitest

**설계 문서:** `docs/superpowers/specs/2026-08-22-gboard-desktop-design.md` — 특히 '바깥에서 받아 오는 것'과 '1판이 가르쳐 준 것' 절을 먼저 읽는다.

## Global Constraints

- **기준 시험 수는 794개다.** 각 과업 끝에서 `npm run verify`가 종료 코드 0으로 통과해야 한다.
- **`npm run verify`는 번들 순수성까지 검사한다** (`scripts/check-bundle-purity.mjs`): 웹 빌드에 `__TAURI_INTERNALS__`·`__TAURI_TO_IPC_KEY__`가 없어야 하고, 설치형 빌드에는 `__TAURI_INTERNALS__`가 있어야 하며, 웹 첫 화면 청크가 400KB 이하여야 한다.
- **모든 Tauri import은 동적(`await import(...)`)이고 `isDesktop()`이 참일 때만 닿아야 한다.** 정적 import 하나면 웹 번들이 오염되고 verify가 실패한다.
- **분기 규칙:** 평범한 분기는 `isDesktop()`. 그 안에 `lazy()`나 `import()`가 있어 청크가 실리면 안 되는 경우에는 **인라인 `import.meta.env.VITE_TARGET === 'desktop'`**. 함수 호출은 모듈 경계를 넘어 Rollup이 상수로 접지 못한다. `src/shared/platform/target.ts`의 주석이 이 규칙을 설명한다.
- **웹 빌드의 동작을 바꾸지 않는다.** 웹에서는 이 판의 기능이 전부 없는 것처럼 보여야 한다. 시험은 늘 웹 대상으로 도므로, 그것이 이 제약을 지키는 증거다.
- TypeScript는 `strict` + `noUncheckedIndexedAccess`. 배열·인덱스 접근은 `T | undefined`가 된다.
- **주석은 한국어로, 무엇이 아니라 왜를 적는다.** 주변 코드의 밀도와 말투를 따른다.
- **실패를 화면에 드러내는 것을 기능과 함께 만든다.** 인터넷이 끊기고 NEIS가 느린 날은 반드시 온다. `window.dispatchEvent(new CustomEvent('gboard-write-error', { detail: { message } }))`를 쓰면 `WriteErrorToast.tsx`가 자동으로 띄운다.
- 다음 파일은 고치지 않는다: `LocalStorageAdapter.ts`, `backup.ts`, `schema.ts`, `StorageAdapter.ts`, `FileBackedStorage.ts`, `TauriFileStore.ts`, `SuiteDataProvider.tsx`, `useExternalChanges.ts`, `router.tsx`, `openBoard.ts`.

---

## 파일 구조

새로 만드는 것:

| 파일 | 책임 |
|---|---|
| `src/shared/external/HttpClient.ts` | 통신 이음매. 구현을 갈아 끼운다 |
| `src/shared/external/MemoryHttpClient.ts` | 시험용 구현. 응답과 실패를 미리 심는다 |
| `src/shared/external/TauriHttpClient.ts` | 진짜 구현. `@tauri-apps/plugin-http` |
| `src/shared/external/neisParse.ts` | NEIS 응답 → 우리 타입. 순수 함수 |
| `src/shared/external/NeisSource.ts` | 학교 검색·급식 조회. `HttpClient`를 받는다 |
| `src/shared/storage/CacheStore.ts` | `cache.json`. 백업 안 하고 오래되면 버린다 |
| `src/features/settings/SchoolSearch.tsx` | 이름으로 찾아 코드를 자동으로 채운다 |
| `src/features/home/MealCard.tsx` | 홈의 오늘 급식 카드 |

고치는 것:

| 파일 | 무엇을 |
|---|---|
| `src-tauri/tauri.conf.json` | CSP를 조인다. 이번 판 동안 devtools를 켠다 |
| `src-tauri/Cargo.toml` · `src/lib.rs` | `tauri-plugin-http` 등록 |
| `src-tauri/capabilities/default.json` | 세 호스트만 허용 |
| `src/features/settings/SettingsPage.tsx` | 코드 직접 입력 → 이름 검색 |
| `src/features/home/HomePage.tsx` | `급식 · 시간표` 안내 카드 → 진짜 급식 |
| `package.json` | `@tauri-apps/plugin-http` |

---

## Task 1: CSP를 조이고 개발자 도구를 켠다

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`

**Interfaces:**
- Produces: 설치형에 CSP가 걸리고, 배포 빌드에서도 `Ctrl+Shift+I`가 열린다

기능을 바꾸지 않는 단계다. 앱이 깨지면 원인이 하나뿐이라 맨 앞에 둔다.

### 왜 devtools를 켜는가

CSP 위반은 **개발자 도구에만** 나타난다. 배포 빌드에서 도구가 안 열리면 증상이 "빈 화면"뿐이고 원인을 알 길이 없다. 이번 판은 바깥에서 자료를 받는 판이라 NEIS가 느리거나 응답이 다를 때도 같은 문제를 겪는다.

**3판에서 반드시 끈다.** 그때 `docs/gboard-before-release.md`에 적을 것이다.

- [ ] **Step 1: `Cargo.toml`에서 devtools를 켠다**

`src-tauri/Cargo.toml`의 `tauri` 의존성 줄을 바꾼다. 지금은 이렇다:

```toml
tauri = { version = "2.11.3", features = [] }
```

이렇게 바꾼다:

```toml
# devtools는 2판 동안만 켠다. CSP 위반과 NEIS 응답 문제는 개발자 도구
# 없이는 증상이 "빈 화면"뿐이라 원인을 짚을 수 없다. 3판에서 뺀다.
tauri = { version = "2.11.3", features = ["devtools"] }
```

- [ ] **Step 2: `tauri.conf.json`에 CSP를 넣는다**

`app.security`를 아래로 바꾼다. 지금은 `"csp": null`이다.

```json
    "security": {
      "csp": "default-src 'self'; connect-src 'self' ipc: http://ipc.localhost; img-src 'self' data: asset: http://asset.localhost; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'"
    }
```

`style-src`의 `'unsafe-inline'`은 감수한다. Tailwind와 React가 인라인 스타일을 쓰고, 없애려면 화면 코드를 크게 흔들어야 한다. **`script-src`에는 절대 넣지 않는다** — 거기가 진짜 문이다.

`connect-src`에 바깥 주소가 없는 것이 핵심이다. NEIS 요청은 IPC로 나가므로 여기 적을 필요가 없다.

- [ ] **Step 3: Rust가 컴파일되는지 확인한다**

```bash
cd src-tauri && cargo check 2>&1 | tail -5
```

Expected: `Finished` — 오류 없음. devtools 기능이 새로 붙으므로 처음엔 몇 분 걸린다 (타임아웃 900000ms).

- [ ] **Step 4: 전체 확인**

Run: `npm run verify`
Expected: **794** tests, 종료 코드 0, 양쪽 번들 검사 통과.

CSP는 Tauri 설정이라 웹 빌드와 무관하다. 시험 수가 안 바뀌는 것이 정상이다.

- [ ] **Step 5: 설치본을 만든다**

```bash
npm run desktop:build
```

Expected: `src-tauri/target/release/bundle/nsis/G-board_0.1.0_x64-setup.exe`

빌드는 10~20분 걸릴 수 있다 (타임아웃 1200000ms). **`npm run desktop:dev`나 `npx tauri dev`는 절대 돌리지 않는다 — 끝나지 않는다.**

- [ ] **Step 6: 사람이 확인할 것을 적어 둔다**

`docs/gboard-first-run.md`의 사람 확인 목록에 두 줄을 더한다:

```
- `Ctrl+Shift+I`로 개발자 도구가 열린다 (2판 동안만. 3판에서 끈다)
- 개발자 도구 콘솔에 `Content Security Policy` 위반이 하나도 없다
```

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: CSP를 조이고 2판 동안 개발자 도구를 켠다"
```

---

## Task 2: 통신 이음매와 시험용 구현

**Files:**
- Create: `src/shared/external/HttpClient.ts`
- Create: `src/shared/external/MemoryHttpClient.ts`
- Create: `tests/external/MemoryHttpClient.test.ts`

**Interfaces:**
- Produces: `interface HttpClient { getJson(url: string): Promise<unknown> }`, `class MemoryHttpClient implements HttpClient`

통신을 직접 부르면 시험이 인터넷과 NEIS 사정에 매인다. 이음매로 감싸고 시험에서는 메모리 구현을 끼운다. `FileStore`/`MemoryFileStore`가 1판에서 같은 자리를 맡았다.

- [ ] **Step 1: 실패하는 시험을 쓴다**

`tests/external/MemoryHttpClient.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryHttpClient } from '../../src/shared/external/MemoryHttpClient';

let http: MemoryHttpClient;

beforeEach(() => {
  http = new MemoryHttpClient();
});

describe('MemoryHttpClient', () => {
  it('심어 둔 응답을 그대로 돌려준다', async () => {
    http.put('https://example.test/a', { hello: 'world' });

    expect(await http.getJson('https://example.test/a')).toEqual({ hello: 'world' });
  });

  it('안 심은 주소는 던진다', async () => {
    // 시험이 실수로 진짜 주소를 부르면 조용히 통과하지 않고 바로 드러나야 한다.
    await expect(http.getJson('https://example.test/none')).rejects.toThrow('심어 두지 않은 주소');
  });

  it('실패를 심을 수 있다', async () => {
    http.fail('https://example.test/b', '인터넷 연결 없음');

    await expect(http.getJson('https://example.test/b')).rejects.toThrow('인터넷 연결 없음');
  });

  it('부른 주소를 순서대로 기록한다', async () => {
    http.put('https://example.test/a', {});
    http.put('https://example.test/b', {});

    await http.getJson('https://example.test/a');
    await http.getJson('https://example.test/b');

    expect(http.calls).toEqual(['https://example.test/a', 'https://example.test/b']);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/external/MemoryHttpClient.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 이음매를 만든다**

`src/shared/external/HttpClient.ts`:

```ts
/**
 * 바깥에서 자료를 받아 오는 통로.
 *
 * `StorageAdapter`가 저장 방식을, `FileStore`가 파일 접근을 가른 것처럼
 * 이것은 통신을 가른다. 실제 구현은 Tauri를 부르고, 시험은 메모리 구현을
 * 끼운다 — 시험이 인터넷과 NEIS 사정에 매이면 안 된다.
 *
 * GET만 둔다. NEIS도 날씨도 조회뿐이라 더 필요하지 않고, 쓸 일이 없는
 * 메서드를 미리 두면 구현할 때마다 빈 껍데기를 채워야 한다.
 */
export interface HttpClient {
  /**
   * JSON을 받아 온다.
   *
   * 실패하면 던진다. 받는 쪽이 사람에게 무엇을 보일지 정한다 —
   * 여기서 조용히 null을 돌려주면 "왜 급식이 안 뜨지"를 알 길이 없다.
   */
  getJson(url: string): Promise<unknown>;
}
```

- [ ] **Step 4: 메모리 구현을 만든다**

`src/shared/external/MemoryHttpClient.ts`:

```ts
import type { HttpClient } from './HttpClient';

/**
 * 시험용 통신.
 *
 * 응답을 미리 심어 두고, 실패도 심을 수 있다. 실패를 만들어 봐야
 * "인터넷이 끊긴 날"의 화면을 확인할 수 있다.
 */
export class MemoryHttpClient implements HttpClient {
  private responses = new Map<string, unknown>();
  private failures = new Map<string, string>();

  /** 실제로 부른 주소를 순서대로. 무엇을 몇 번 불렀는지 확인할 때 쓴다. */
  readonly calls: string[] = [];

  put(url: string, body: unknown): void {
    this.responses.set(url, body);
  }

  fail(url: string, message: string): void {
    this.failures.set(url, message);
  }

  getJson(url: string): Promise<unknown> {
    this.calls.push(url);

    const failure = this.failures.get(url);
    if (failure !== undefined) return Promise.reject(new Error(failure));

    if (!this.responses.has(url)) {
      /*
       * 안 심은 주소를 부르면 던진다. 조용히 빈 값을 돌려주면 시험이
       * 통과해 버리고, 정작 진짜 주소를 잘못 만들었다는 것을 못 잡는다.
       */
      return Promise.reject(new Error(`심어 두지 않은 주소: ${url}`));
    }

    return Promise.resolve(this.responses.get(url));
  }
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run tests/external/MemoryHttpClient.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: 전체 확인**

Run: `npm run verify`
Expected: **798** tests, 종료 코드 0

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: 바깥 통신을 가르는 이음매와 시험용 구현"
```

---

## Task 3: NEIS 응답 파싱

**Files:**
- Create: `src/shared/external/neisParse.ts`
- Create: `tests/external/neisParse.test.ts`

**Interfaces:**
- Produces: `interface SchoolHit`, `interface MealMenu`, `interface MealDish`, `parseSchoolSearch(raw: unknown): SchoolHit[]`, `parseMeals(raw: unknown): MealMenu[]`

순수 함수라 값싸게 시험할 수 있다. 실제 응답을 그대로 넣어 확인한다.

### 실제 응답의 모양 — 확인한 것

**학교 검색** (`schoolInfo`)

```json
{ "schoolInfo": [ { "head": [...] }, { "row": [ {
  "ATPT_OFCDC_SC_CODE": "J10",
  "ATPT_OFCDC_SC_NM": "경기도교육청",
  "SD_SCHUL_CODE": "7551281",
  "SCHUL_NM": "위례한빛초등학교",
  "ORG_RDNMA": "경기도 성남시 수정구 위례동로 55",
  "SCHUL_KND_SC_NM": "초등학교"
} ] } ] }
```

**급식** (`mealServiceDietInfo`)

```json
{ "mealServiceDietInfo": [ { "head": [...] }, { "row": [ {
  "MMEAL_SC_NM": "중식",
  "MLSV_YMD": "20260601",
  "DDISH_NM": "홍국쌀밥 <br/>두부새우젓국 (5.9.18)<br/>도토리묵야채무침 (5.6.13)",
  "CAL_INFO": "489.7 Kcal"
} ] } ] }
```

**결과가 없을 때** — 위 모양이 아니라 이것이 온다:

```json
{ "RESULT": { "CODE": "INFO-200", "MESSAGE": "해당하는 데이터가 없습니다." } }
```

- [ ] **Step 1: 실패하는 시험을 쓴다**

`tests/external/neisParse.test.ts`:

```ts
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
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/external/neisParse.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현한다**

`src/shared/external/neisParse.ts`:

```ts
/**
 * NEIS 응답을 우리 타입으로 옮긴다.
 *
 * 순수 함수로 떼어 둔 이유는 시험 때문이다. 통신과 섞어 두면 응답 모양이
 * 맞는지 확인하려고 매번 인터넷을 타야 한다.
 *
 * **무엇이 와도 던지지 않는다.** 서버가 점검 중이라 HTML을 주는 날도 있고,
 * 급식이 없는 날은 아예 다른 모양으로 답한다. 그때마다 앱이 죽으면
 * 선생님은 급식을 못 보는 게 아니라 앱을 못 쓴다. 못 읽으면 빈 목록이다.
 */

export interface SchoolHit {
  officeCode: string;
  officeName: string;
  schoolCode: string;
  schoolName: string;
  address: string;
  kind: string;
}

export interface MealDish {
  name: string;
  /** 알레르기 유발 식품 번호. 화면에서 접었다 펼 수 있게 이름과 갈라 둔다. */
  allergens: number[];
}

export interface MealMenu {
  /** 조식 · 중식 · 석식 */
  kind: string;
  /** YYYY-MM-DD */
  date: string;
  dishes: MealDish[];
  /** "489.7 Kcal" 같은 글자 그대로. 계산할 일이 없어 숫자로 바꾸지 않는다. */
  calories: string;
}

/**
 * NEIS 응답에서 `row` 배열을 꺼낸다.
 *
 * 모양이 `{ 이름: [ {head}, {row: [...]} ] }`로 두 겹이라 매번 더듬어야 한다.
 * 결과가 없는 날은 `{ RESULT: {...} }`가 와서 이 구조가 아예 없다.
 */
function rowsOf(raw: unknown, key: string): Record<string, unknown>[] {
  if (typeof raw !== 'object' || raw === null) return [];

  const wrapper = (raw as Record<string, unknown>)[key];
  if (!Array.isArray(wrapper)) return [];

  for (const part of wrapper) {
    if (typeof part !== 'object' || part === null) continue;
    const rows = (part as Record<string, unknown>).row;
    if (Array.isArray(rows)) {
      return rows.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null);
    }
  }

  return [];
}

function text(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  return typeof value === 'string' ? value : '';
}

export function parseSchoolSearch(raw: unknown): SchoolHit[] {
  return rowsOf(raw, 'schoolInfo').map((row) => ({
    officeCode: text(row, 'ATPT_OFCDC_SC_CODE'),
    officeName: text(row, 'ATPT_OFCDC_SC_NM'),
    schoolCode: text(row, 'SD_SCHUL_CODE'),
    schoolName: text(row, 'SCHUL_NM'),
    address: text(row, 'ORG_RDNMA'),
    kind: text(row, 'SCHUL_KND_SC_NM'),
  }));
}

/** `20260601` → `2026-06-01`. 못 읽으면 그대로 둔다. */
function toIsoDate(compact: string): string {
  if (!/^\d{8}$/.test(compact)) return compact;
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

/**
 * `두부새우젓국 (5.9.18)` → 이름과 번호로 가른다.
 *
 * 화면에는 이름만 보여야 읽히고, 번호는 알레르기가 있는 학생을 둔
 * 선생님에게 필요하다. 버리지 않고 갈라 둔다.
 */
function toDish(piece: string): MealDish {
  const match = /^(.*?)\s*\(([\d.\s]+)\)\s*$/.exec(piece.trim());
  if (match === null) return { name: piece.trim(), allergens: [] };

  const name = (match[1] ?? '').trim();
  const allergens = (match[2] ?? '')
    .split('.')
    .map((n) => Number.parseInt(n.trim(), 10))
    .filter((n) => Number.isFinite(n));

  return { name, allergens };
}

export function parseMeals(raw: unknown): MealMenu[] {
  return rowsOf(raw, 'mealServiceDietInfo').map((row) => ({
    kind: text(row, 'MMEAL_SC_NM'),
    date: toIsoDate(text(row, 'MLSV_YMD')),
    dishes: text(row, 'DDISH_NM')
      .split(/<br\s*\/?>/i)
      .map((piece) => toDish(piece))
      .filter((dish) => dish.name !== ''),
    calories: text(row, 'CAL_INFO'),
  }));
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/external/neisParse.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: 전체 확인**

Run: `npm run verify`
Expected: **806** tests, 종료 코드 0

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: NEIS 응답을 우리 타입으로 옮긴다"
```

---

## Task 4: 학교 검색과 급식 조회

**Files:**
- Create: `src/shared/external/NeisSource.ts`
- Create: `tests/external/NeisSource.test.ts`

**Interfaces:**
- Consumes: `HttpClient` (Task 2), `parseSchoolSearch`/`parseMeals`/`SchoolHit`/`MealMenu` (Task 3)
- Produces: `class NeisSource`, `searchSchools(name: string): Promise<SchoolHit[]>`, `fetchMeals(officeCode: string, schoolCode: string, date: string): Promise<MealMenu[]>`

주소를 만들고 파싱을 부르는 얇은 층이다. 여기서 확인할 것은 **주소를 제대로 만드는가**와 **실패가 위로 올라가는가** 둘이다.

- [ ] **Step 1: 실패하는 시험을 쓴다**

`tests/external/NeisSource.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryHttpClient } from '../../src/shared/external/MemoryHttpClient';
import { NeisSource } from '../../src/shared/external/NeisSource';

let http: MemoryHttpClient;
let neis: NeisSource;

beforeEach(() => {
  http = new MemoryHttpClient();
  neis = new NeisSource(http);
});

const emptyResult = { RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } };

describe('학교 검색', () => {
  it('이름을 주소에 넣어 부른다', async () => {
    http.put(
      'https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=20&SCHUL_NM=%ED%95%9C%EB%B9%9B%EC%B4%88',
      emptyResult,
    );

    await neis.searchSchools('한빛초');

    expect(http.calls[0]).toContain('SCHUL_NM=%ED%95%9C%EB%B9%9B%EC%B4%88');
  });

  it('앞뒤 공백은 떼고 보낸다', async () => {
    http.put(
      'https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=20&SCHUL_NM=%ED%95%9C%EB%B9%9B%EC%B4%88',
      emptyResult,
    );

    await neis.searchSchools('  한빛초  ');

    expect(http.calls).toHaveLength(1);
  });

  it('이름이 비면 부르지 않는다', async () => {
    // 빈 검색은 NEIS가 전국 학교를 돌려준다. 부를 이유가 없다.
    expect(await neis.searchSchools('   ')).toEqual([]);
    expect(http.calls).toEqual([]);
  });

  it('통신이 실패하면 그대로 던진다', async () => {
    http.fail(
      'https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=20&SCHUL_NM=%ED%95%9C%EB%B9%9B%EC%B4%88',
      '인터넷 연결 없음',
    );

    /*
     * 여기서 삼키면 화면이 "결과 없음"을 보여 준다. 이름을 잘못 친 것과
     * 인터넷이 끊긴 것은 선생님이 할 일이 다르다.
     */
    await expect(neis.searchSchools('한빛초')).rejects.toThrow('인터넷 연결 없음');
  });
});

describe('급식 조회', () => {
  const url =
    'https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=10' +
    '&ATPT_OFCDC_SC_CODE=J10&SD_SCHUL_CODE=7551281&MLSV_YMD=20260601';

  it('날짜에서 하이픈을 떼어 부른다', async () => {
    // NEIS는 YYYYMMDD를 받는데 우리는 YYYY-MM-DD로 다닌다.
    http.put(url, emptyResult);

    await neis.fetchMeals('J10', '7551281', '2026-06-01');

    expect(http.calls[0]).toBe(url);
  });

  it('학교 코드가 없으면 부르지 않는다', async () => {
    expect(await neis.fetchMeals('', '7551281', '2026-06-01')).toEqual([]);
    expect(await neis.fetchMeals('J10', '', '2026-06-01')).toEqual([]);
    expect(http.calls).toEqual([]);
  });

  it('통신이 실패하면 그대로 던진다', async () => {
    http.fail(url, 'NEIS가 응답하지 않음');

    await expect(neis.fetchMeals('J10', '7551281', '2026-06-01')).rejects.toThrow(
      'NEIS가 응답하지 않음',
    );
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/external/NeisSource.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현한다**

`src/shared/external/NeisSource.ts`:

```ts
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
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/external/NeisSource.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 전체 확인**

Run: `npm run verify`
Expected: **813** tests, 종료 코드 0

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: 학교 검색과 급식 조회"
```

---

## Task 5: 진짜 통신을 붙인다

**Files:**
- Create: `src/shared/external/TauriHttpClient.ts`
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`, `package.json`

**Interfaces:**
- Consumes: `HttpClient` (Task 2)
- Produces: `class TauriHttpClient implements HttpClient`

### 권한을 반드시 확인한다

1판에서 창 권한이 빠져 앱이 안 꺼지고 전자칠판이 무반응이었다. **Tauri는 기본으로 거부한다.** 이번에도 열거하고, 빌드된 결과에서 실제로 들어갔는지 확인한다.

- [ ] **Step 1: 꾸러미를 설치한다**

```bash
npm install @tauri-apps/plugin-http
```

`src-tauri/Cargo.toml`의 `[dependencies]`에 더한다:

```toml
tauri-plugin-http = "2"
```

- [ ] **Step 2: Rust에 등록한다**

`src-tauri/src/lib.rs`에서 `.plugin(tauri_plugin_fs::init())` 바로 아래에 더한다:

```rust
    .plugin(tauri_plugin_http::init())
```

단일 인스턴스 플러그인은 그대로 맨 앞에 둔다 — 두 번째 프로세스가 다른 초기화보다 먼저 넘겨주고 죽어야 한다.

- [ ] **Step 3: 세 호스트만 연다**

`src-tauri/capabilities/default.json`의 `permissions` 배열에 더한다:

```json
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://open.neis.go.kr/*" },
        { "url": "https://api.open-meteo.com/*" },
        { "url": "https://geocoding-api.open-meteo.com/*" }
      ]
    }
```

날씨 두 곳은 2판-나에서 쓴다. 지금 함께 여는 이유는 권한 목록을 두 번 손대지 않기 위해서다. **그 밖에는 아무 데도 못 부른다.**

- [ ] **Step 4: 진짜 구현을 만든다**

`src/shared/external/TauriHttpClient.ts`:

```ts
import type { HttpClient } from './HttpClient';

/**
 * Tauri를 통해 바깥으로 나간다.
 *
 * 이름은 `fetch`지만 표준 `fetch`가 아니다. 소스를 열어 확인했더니
 * `invoke('plugin:http|fetch')`로 IPC를 탄다 — webview가 직접 요청하지
 * 않고 Rust가 대신 나간다. NEIS가 `Access-Control` 헤더를 안 주는데도
 * 되는 이유이고, CSP의 `connect-src`를 조여도 되는 이유다.
 *
 * 꾸러미는 동적으로 가져온다. 정적으로 부르면 웹 번들에 실려
 * `npm run verify`의 번들 검사가 막는다.
 */
export class TauriHttpClient implements HttpClient {
  async getJson(url: string): Promise<unknown> {
    const { fetch } = await import('@tauri-apps/plugin-http');

    const response = await fetch(url, { method: 'GET' });

    if (!response.ok) {
      /*
       * 상태 코드를 문구에 남긴다. 403이면 권한 범위 밖 주소를 부른 것이고
       * 500이면 NEIS 쪽 문제다 — 선생님께 보일 말은 다르지만, 우리가
       * 원인을 짚으려면 숫자가 필요하다.
       */
      throw new Error(`받아 오지 못했습니다 (${response.status})`);
    }

    return (await response.json()) as unknown;
  }
}
```

- [ ] **Step 5: 컴파일과 시험을 확인한다**

```bash
cd src-tauri && cargo check 2>&1 | tail -5
```

Expected: `Finished` (타임아웃 900000ms — 새 크레이트를 받아 컴파일한다)

Run: `npm run verify`
Expected: **813** tests, 종료 코드 0, 양쪽 번들 검사 통과

시험 수가 안 는다. `TauriHttpClient`는 Tauri 없이 못 돌리므로 단위 시험을 쓰지 않는다 — `TauriFileStore`와 같은 자리다.

- [ ] **Step 6: 권한이 빌드에 실제로 들어갔는지 확인한다**

```bash
npm run desktop:build
node -e "
const fs=require('fs');
const raw=fs.readFileSync('src-tauri/gen/schemas/capabilities.json','utf8');
console.log('http 권한 있음:', raw.includes('http:default'));
console.log('neis 허용:', raw.includes('open.neis.go.kr'));
console.log('날씨 허용:', raw.includes('api.open-meteo.com'));
"
```

Expected: 셋 다 `true`. 빌드는 10~20분 걸릴 수 있다 (타임아웃 1200000ms).

하나라도 `false`면 권한 형식이 틀린 것이다. **여기서 멈추고 보고한다** — 1판에서 이걸 놓쳐 기능이 통째로 안 됐다.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: NEIS를 부를 수 있게 통신을 붙인다"
```

---

## Task 6: 급식 캐시

**Files:**
- Create: `src/shared/storage/CacheStore.ts`
- Create: `tests/storage/CacheStore.test.ts`

**Interfaces:**
- Consumes: `FileStore` (1판), `MemoryFileStore` (1판)
- Produces: `class CacheStore`, `CacheStore.open(files: FileStore, clock?: () => string): Promise<CacheStore>`, `getMeals(date: string): MealMenu[] | null`, `putMeals(date: string, meals: MealMenu[]): Promise<void>`

급식은 자료가 아니라 캐시다. 백업 파일에 지난주 급식이 섞이면 안 되고, 지워도 다시 받으면 그만이다. 그래서 `data.json`이 아니라 `cache.json`에 담는다.

**학교 인터넷은 끊긴다.** 캐시가 있으면 그런 날에도 오늘 급식이 보인다.

- [ ] **Step 1: 실패하는 시험을 쓴다**

`tests/storage/CacheStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import type { MealMenu } from '../../src/shared/external/neisParse';
import { CacheStore } from '../../src/shared/storage/CacheStore';
import { MemoryFileStore } from '../../src/shared/storage/MemoryFileStore';

let files: MemoryFileStore;

const T0 = '2026-06-01T09:00:00.000Z';

function menu(name: string): MealMenu[] {
  return [{ kind: '중식', date: '2026-06-01', dishes: [{ name, allergens: [] }], calories: '' }];
}

beforeEach(() => {
  files = new MemoryFileStore();
});

async function open(now = T0): Promise<CacheStore> {
  return CacheStore.open(files, () => now);
}

describe('CacheStore — 담고 꺼내기', () => {
  it('없는 날은 null이다', async () => {
    const cache = await open();

    expect(cache.getMeals('2026-06-01')).toBeNull();
  });

  it('담은 것을 꺼낸다', async () => {
    const cache = await open();

    await cache.putMeals('2026-06-01', menu('홍국쌀밥'));

    expect(cache.getMeals('2026-06-01')?.[0]?.dishes[0]?.name).toBe('홍국쌀밥');
  });

  it('다시 열어도 남아 있다', async () => {
    const first = await open();
    await first.putMeals('2026-06-01', menu('홍국쌀밥'));

    // 앱을 껐다 켠 것과 같다. 인터넷이 끊긴 날에도 오늘 급식이 보여야 한다.
    const second = await open();

    expect(second.getMeals('2026-06-01')?.[0]?.dishes[0]?.name).toBe('홍국쌀밥');
  });

  it('급식이 없는 날도 기억한다', async () => {
    const cache = await open();

    // 방학이라 빈 목록인 것과, 아직 안 물어본 것은 다르다.
    await cache.putMeals('2026-06-01', []);

    expect(cache.getMeals('2026-06-01')).toEqual([]);
  });
});

describe('CacheStore — 오래된 것은 버린다', () => {
  it('7일이 지난 날짜는 안 돌려준다', async () => {
    const cache = await open('2026-06-01T09:00:00.000Z');
    await cache.putMeals('2026-05-20', menu('옛날 급식'));

    expect(cache.getMeals('2026-05-20')).toBeNull();
  });

  it('7일 안쪽은 그대로 있다', async () => {
    const cache = await open('2026-06-01T09:00:00.000Z');
    await cache.putMeals('2026-05-28', menu('지난주 급식'));

    expect(cache.getMeals('2026-05-28')?.[0]?.dishes[0]?.name).toBe('지난주 급식');
  });

  it('다시 열 때 오래된 것을 파일에서도 지운다', async () => {
    const first = await open('2026-06-01T09:00:00.000Z');
    await first.putMeals('2026-05-20', menu('옛날'));
    await first.putMeals('2026-06-01', menu('오늘'));

    await open('2026-06-01T09:00:00.000Z');

    // 무한정 쌓이면 파일이 계속 커진다. 열 때 한 번 치운다.
    const raw: unknown = JSON.parse((await files.read('cache.json')) ?? '{}');
    const meals = (raw as { meals?: Record<string, unknown> }).meals ?? {};
    expect(Object.keys(meals)).toEqual(['2026-06-01']);
  });
});

describe('CacheStore — 깨져도 앱을 막지 않는다', () => {
  it('파일이 깨져 있으면 빈 캐시로 시작한다', async () => {
    await files.writeAtomic('cache.json', '{ 이건 JSON이 아니다');

    const cache = await open();

    // 캐시는 다시 받으면 그만이다. 여기서 던지면 앱이 안 뜬다.
    expect(cache.getMeals('2026-06-01')).toBeNull();
  });

  it('쓰기가 실패해도 메모리에는 남는다', async () => {
    const cache = await open();
    files.failNextWrite = true;

    await cache.putMeals('2026-06-01', menu('홍국쌀밥'));

    // 파일에 못 써도 오늘 화면에는 급식이 떠야 한다.
    expect(cache.getMeals('2026-06-01')?.[0]?.dishes[0]?.name).toBe('홍국쌀밥');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/storage/CacheStore.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현한다**

`src/shared/storage/CacheStore.ts`:

```ts
import type { MealMenu } from '../external/neisParse';
import type { FileStore } from './FileStore';

/** 며칠 치를 남길 것인가. 지난주 급식을 볼 일은 없지만, 끊긴 날을 넘길 만큼은 든다. */
const KEEP_DAYS = 7;

interface CacheShape {
  meals: Record<string, MealMenu[]>;
}

/**
 * 급식·날씨처럼 다시 받으면 그만인 것을 담는다.
 *
 * `data.json`과 갈라 두는 이유가 둘이다. 첫째, 백업 파일에 지난주 급식이
 * 섞이면 안 된다. 둘째, 오래되면 버려야 하는데 학급 자료는 그러면 안 된다.
 * 기준이 다르면 파일도 달라야 한다.
 *
 * **여기서 던지지 않는다.** 캐시가 깨졌다고 앱이 안 뜨면 안 된다.
 * 못 읽으면 없는 셈 치고 다시 받는다.
 */
export class CacheStore {
  private meals = new Map<string, MealMenu[]>();

  private constructor(
    private readonly files: FileStore,
    private readonly clock: () => string,
  ) {}

  static async open(files: FileStore, clock?: () => string): Promise<CacheStore> {
    const store = new CacheStore(files, clock ?? (() => new Date().toISOString()));

    const raw = await files.read('cache.json');
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        const meals = (parsed as CacheShape | null)?.meals;
        if (typeof meals === 'object' && meals !== null) {
          for (const [date, value] of Object.entries(meals)) {
            if (Array.isArray(value)) store.meals.set(date, value as MealMenu[]);
          }
        }
      } catch {
        // 깨졌으면 없는 셈 친다. 다시 받으면 된다.
      }
    }

    // 열 때 한 번 치운다. 안 그러면 파일이 한 해 내내 커진다.
    const dropped = store.forget();
    if (dropped > 0) await store.persist();

    return store;
  }

  /** 오래된 날짜를 버린다. 버린 개수를 돌려준다. */
  private forget(): number {
    const limit = this.oldestKept();
    let dropped = 0;

    for (const date of [...this.meals.keys()]) {
      if (date < limit) {
        this.meals.delete(date);
        dropped += 1;
      }
    }

    return dropped;
  }

  /** 이 날짜보다 앞선 것은 버린다. `YYYY-MM-DD`라 글자 비교로 충분하다. */
  private oldestKept(): string {
    const now = new Date(this.clock());
    now.setDate(now.getDate() - KEEP_DAYS);
    return now.toISOString().slice(0, 10);
  }

  getMeals(date: string): MealMenu[] | null {
    if (date < this.oldestKept()) return null;
    return this.meals.get(date) ?? null;
  }

  async putMeals(date: string, meals: MealMenu[]): Promise<void> {
    this.meals.set(date, meals);
    await this.persist();
  }

  private async persist(): Promise<void> {
    const shape: CacheShape = { meals: Object.fromEntries(this.meals) };

    try {
      await this.files.writeAtomic('cache.json', JSON.stringify(shape));
    } catch {
      /*
       * 못 써도 조용히 넘어간다. 캐시를 파일에 못 남긴 것이지 오늘 급식을
       * 못 보는 것은 아니다. 메모리에는 들어 있다. 자료 저장 실패와 달리
       * 선생님께 알릴 일이 아니다 — 잃을 것이 없다.
       */
    }
  }
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/storage/CacheStore.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: 전체 확인**

Run: `npm run verify`
Expected: **822** tests, 종료 코드 0

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: 급식 캐시를 cache.json에 담는다"
```

---

## Task 7: 학교 이름으로 찾기

**Files:**
- Create: `src/features/settings/SchoolSearch.tsx`
- Create: `tests/settings/SchoolSearch.test.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`

**Interfaces:**
- Consumes: `NeisSource` (Task 4), `SchoolHit` (Task 3), `MemoryHttpClient` (Task 2)
- Produces: `<SchoolSearch />` — 고르면 `profile`의 `schoolName`·`officeCode`·`schoolCode`를 한꺼번에 채운다

지금 설정은 **시도교육청 코드와 학교 코드를 직접 입력**하게 한다. 그 코드를 아는 교사는 없다.

- [ ] **Step 1: 실패하는 시험을 쓴다**

`tests/settings/SchoolSearch.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryHttpClient } from '../../src/shared/external/MemoryHttpClient';
import { NeisSource } from '../../src/shared/external/NeisSource';
import { SchoolSearch } from '../../src/features/settings/SchoolSearch';
import type { SchoolHit } from '../../src/shared/external/neisParse';

const hit: SchoolHit = {
  officeCode: 'J10',
  officeName: '경기도교육청',
  schoolCode: '7551281',
  schoolName: '위례한빛초등학교',
  address: '경기도 성남시 수정구 위례동로 55',
  kind: '초등학교',
};

const searchUrl =
  'https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=20' +
  '&SCHUL_NM=%ED%95%9C%EB%B9%9B%EC%B4%88';

function withHit() {
  return {
    schoolInfo: [
      { head: [] },
      {
        row: [
          {
            ATPT_OFCDC_SC_CODE: hit.officeCode,
            ATPT_OFCDC_SC_NM: hit.officeName,
            SD_SCHUL_CODE: hit.schoolCode,
            SCHUL_NM: hit.schoolName,
            ORG_RDNMA: hit.address,
            SCHUL_KND_SC_NM: hit.kind,
          },
        ],
      },
    ],
  };
}

let http: MemoryHttpClient;

beforeEach(() => {
  http = new MemoryHttpClient();
});

describe('학교 이름으로 찾기', () => {
  it('찾은 학교를 목록으로 보여 준다', async () => {
    http.put(searchUrl, withHit());
    const user = userEvent.setup();

    render(<SchoolSearch source={new NeisSource(http)} onPick={() => {}} />);

    await user.type(screen.getByLabelText('학교 이름'), '한빛초');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(await screen.findByText('위례한빛초등학교')).toBeInTheDocument();
    // 같은 이름의 학교가 여럿이라 교육청과 주소가 있어야 고를 수 있다.
    expect(screen.getByText(/경기도교육청/)).toBeInTheDocument();
  });

  it('고르면 코드까지 한꺼번에 넘긴다', async () => {
    http.put(searchUrl, withHit());
    const picked = vi.fn();
    const user = userEvent.setup();

    render(<SchoolSearch source={new NeisSource(http)} onPick={picked} />);

    await user.type(screen.getByLabelText('학교 이름'), '한빛초');
    await user.click(screen.getByRole('button', { name: '찾기' }));
    await user.click(await screen.findByRole('button', { name: /위례한빛초등학교/ }));

    // 교사가 코드를 알 필요가 없어야 한다는 것이 이 화면의 존재 이유다.
    expect(picked).toHaveBeenCalledWith(hit);
  });

  it('결과가 없으면 그렇게 말한다', async () => {
    http.put(searchUrl, { RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } });
    const user = userEvent.setup();

    render(<SchoolSearch source={new NeisSource(http)} onPick={() => {}} />);

    await user.type(screen.getByLabelText('학교 이름'), '한빛초');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(await screen.findByText(/찾지 못했습니다/)).toBeInTheDocument();
  });

  it('통신이 실패하면 결과 없음과 다르게 말한다', async () => {
    http.fail(searchUrl, '인터넷 연결 없음');
    const user = userEvent.setup();

    render(<SchoolSearch source={new NeisSource(http)} onPick={() => {}} />);

    await user.type(screen.getByLabelText('학교 이름'), '한빛초');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    /*
     * 이름을 잘못 친 것과 인터넷이 끊긴 것은 선생님이 할 일이 다르다.
     * 둘 다 "찾지 못했습니다"로 보이면 이름만 자꾸 고쳐 보게 된다.
     */
    expect(await screen.findByText(/연결하지 못했습니다/)).toBeInTheDocument();
  });

  it('찾는 동안 단추를 잠근다', async () => {
    http.put(searchUrl, withHit());
    const user = userEvent.setup();

    render(<SchoolSearch source={new NeisSource(http)} onPick={() => {}} />);

    await user.type(screen.getByLabelText('학교 이름'), '한빛초');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /찾/ })).toBeEnabled();
    });
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/settings/SchoolSearch.test.tsx`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 화면을 만든다**

`src/features/settings/SchoolSearch.tsx`:

```tsx
import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import type { NeisSource } from '../../shared/external/NeisSource';
import type { SchoolHit } from '../../shared/external/neisParse';
import { Button } from '../../shared/ui';

/**
 * 학교를 이름으로 찾는다.
 *
 * 지금까지는 시도교육청 코드와 학교 코드를 직접 입력하게 했다. 그 코드를
 * 아는 교사는 없다. 이름을 넣고 목록에서 고르면 코드가 한꺼번에 채워진다.
 *
 * 같은 이름의 학교가 여럿이라(전국에 '한빛초등학교'가 셋) 교육청과 주소를
 * 함께 보여 줘야 고를 수 있다.
 */
export function SchoolSearch({
  source,
  onPick,
}: {
  source: NeisSource;
  onPick: (hit: SchoolHit) => void;
}) {
  const [name, setName] = useState('');
  const [hits, setHits] = useState<SchoolHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const search = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setHits(null);

    try {
      setHits(await source.searchSchools(name));
    } catch {
      /*
       * 이름을 잘못 친 것과 인터넷이 끊긴 것을 가른다. 둘 다 "찾지
       * 못했습니다"로 보이면 선생님은 이름만 자꾸 고쳐 보게 된다.
       */
      setError('NEIS에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <form className="flex items-end gap-2" onSubmit={(event) => void search(event)}>
        <label className="block flex-1 text-sm">
          <span className="text-slate-700">학교 이름</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: 한빛초"
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>

        <Button type="submit" variant="primary" icon={Search} disabled={busy}>
          {busy ? '찾는 중' : '찾기'}
        </Button>
      </form>

      {error === '' ? null : (
        <p role="alert" className="text-sm font-medium text-danger-600">
          {error}
        </p>
      )}

      {hits !== null && hits.length === 0 ? (
        <p className="text-sm text-slate-500">
          그 이름으로는 찾지 못했습니다. 앞 두 글자만 넣어 보세요 — `한빛초`처럼.
        </p>
      ) : null}

      {hits !== null && hits.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {hits.map((found) => (
            <li key={`${found.officeCode}-${found.schoolCode}`}>
              <button
                type="button"
                onClick={() => onPick(found)}
                className="w-full rounded-control border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="block text-sm font-medium text-slate-900">
                  {found.schoolName}
                </span>
                <span className="block text-xs text-slate-500">
                  {found.officeName} · {found.address}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/settings/SchoolSearch.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: 설정 화면에 끼운다**

`src/features/settings/SettingsPage.tsx`의 `SchoolTab`에서, 지금 있는 **교육청 코드·학교 코드 입력 두 칸을 감싼 `<div className="border-t border-slate-100 pt-3">` 블록 전체**를 아래로 바꾼다.

```tsx
        <div className="border-t border-slate-100 pt-3">
          {isDesktop() ? (
            <>
              <p className="mb-2 text-sm text-slate-600">
                급식을 받아 오려면 학교를 정해야 합니다. 이름으로 찾으면 코드가
                저절로 채워집니다.
              </p>

              <SchoolSearch
                source={neisSource()}
                onPick={(hit) => {
                  update((current) => ({
                    ...current,
                    profile: {
                      ...current.profile,
                      schoolName: hit.schoolName,
                      officeCode: hit.officeCode,
                      schoolCode: hit.schoolCode,
                    },
                  }));
                  toast.success(`${hit.schoolName}으로 정했습니다.`);
                }}
              />

              {data.profile.schoolCode === undefined || data.profile.schoolCode === '' ? null : (
                <p className="mt-2 text-sm text-slate-500">
                  지금 정해진 학교: <strong>{data.profile.schoolName}</strong>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">
              급식·시간표는 설치형 G-board에서만 받아 옵니다. NEIS가 브라우저의
              직접 요청을 막기 때문입니다.
            </p>
          )}
        </div>
```

`SchoolTab` 위쪽에 도우미를 하나 둔다:

```tsx
/**
 * 설치형에서 쓸 NeisSource를 만든다.
 *
 * 화면이 통신 구현을 직접 아는 것은 좋지 않지만, 이 하나를 위해 Provider를
 * 새로 세우는 것도 과하다. 화면이 아는 것은 `NeisSource`까지고 그 아래
 * `TauriHttpClient`는 이 함수 안에만 있다.
 */
function neisSource(): NeisSource {
  return new NeisSource(new TauriHttpClient());
}
```

import을 더한다:

```tsx
import { NeisSource } from '../../shared/external/NeisSource';
import { TauriHttpClient } from '../../shared/external/TauriHttpClient';
import { SchoolSearch } from './SchoolSearch';
```

`isDesktop`은 이 파일에 이미 import되어 있다.

> **주의:** `TauriHttpClient`는 정적으로 import해도 된다 — 그 안의 Tauri 호출이 `await import(...)`이기 때문이다. 하지만 웹 번들에 클래스 껍데기가 실린다. `npm run verify`의 번들 검사가 `__TAURI_INTERNALS__`를 찾으므로 이 정도는 통과한다. **검사가 실패하면** `SchoolSearch`를 `lazy()`로 바꾸고 인라인 `import.meta.env.VITE_TARGET === 'desktop'`으로 감싼다.

- [ ] **Step 6: 전체 확인**

Run: `npm run verify`
Expected: **827** tests, 종료 코드 0, 양쪽 번들 검사 통과

**기존 시험은 안 깨질 것이다.** 확인해 봤다 — `tests/` 어디에도 `교육청 코드`나 `학교 코드` 입력 칸을 단언하는 곳이 없고, `tests/settings/desktopSettings.test.ts`가 보는 것은 탭 존재와 브라우저 문구뿐이라 `SchoolTab` 안쪽과 무관하다.

그래도 깨지는 것이 나오면 **멈추고 보고한다.** 예상 못 한 결합이 있다는 뜻이고, 단언을 약하게 만들어 넘기면 그 결합이 숨는다.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: 학교를 이름으로 찾아 코드를 자동으로 채운다"
```

---

## Task 8: 홈에 오늘 급식

**Files:**
- Create: `src/features/home/MealCard.tsx`
- Create: `tests/home/MealCard.test.tsx`
- Modify: `src/features/home/HomePage.tsx`
- Modify: `docs/gboard-first-run.md`

**Interfaces:**
- Consumes: `NeisSource` (Task 4), `CacheStore` (Task 6), `MealMenu` (Task 3)
- Produces: `<MealCard />` — 홈에서 오늘 급식을 보여 준다

이 판의 목적지다. **학교를 정하면 홈에 오늘 급식이 뜬다.**

지금 홈에는 `급식 · 시간표` 안내 카드가 있고 "학교를 등록하고 **NEIS 키를 넣으면**"이라고 쓰여 있다. 키는 필요 없으니 그 문구부터 거짓이다.

- [ ] **Step 1: 실패하는 시험을 쓴다**

`tests/home/MealCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MealCard } from '../../src/features/home/MealCard';
import type { MealMenu } from '../../src/shared/external/neisParse';

const lunch: MealMenu[] = [
  {
    kind: '중식',
    date: '2026-06-01',
    dishes: [
      { name: '홍국쌀밥', allergens: [] },
      { name: '두부새우젓국', allergens: [5, 9, 18] },
    ],
    calories: '489.7 Kcal',
  },
];

describe('오늘 급식 카드', () => {
  it('메뉴를 보여 준다', () => {
    render(<MealCard state={{ kind: 'ready', meals: lunch }} />);

    expect(screen.getByText('홍국쌀밥')).toBeInTheDocument();
    expect(screen.getByText('두부새우젓국')).toBeInTheDocument();
  });

  it('알레르기 번호는 화면을 어지럽히지 않는다', () => {
    render(<MealCard state={{ kind: 'ready', meals: lunch }} />);

    // 이름 안에 번호가 섞여 있으면 한눈에 안 읽힌다.
    expect(screen.getByText('두부새우젓국')).toBeInTheDocument();
    expect(screen.queryByText(/두부새우젓국 \(/)).not.toBeInTheDocument();
  });

  it('학교를 안 정했으면 무엇을 하면 되는지 말한다', () => {
    render(<MealCard state={{ kind: 'no-school' }} />);

    expect(screen.getByText(/학교를 정하면/)).toBeInTheDocument();
  });

  it('급식이 없는 날은 그렇게 말한다', () => {
    // 방학·주말. 오류가 아니다.
    render(<MealCard state={{ kind: 'ready', meals: [] }} />);

    expect(screen.getByText(/오늘은 급식이 없습니다/)).toBeInTheDocument();
  });

  it('못 받아 왔으면 결과 없음과 다르게 말한다', () => {
    render(<MealCard state={{ kind: 'failed' }} />);

    /*
     * "급식이 없는 날"과 "인터넷이 끊긴 날"은 다르다. 같은 말로 보이면
     * 선생님은 급식이 없는 줄 알고 넘어간다.
     */
    expect(screen.getByText(/받아 오지 못했습니다/)).toBeInTheDocument();
  });

  it('받아 오는 중임을 알린다', () => {
    render(<MealCard state={{ kind: 'loading' }} />);

    expect(screen.getByText(/불러오는 중/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/home/MealCard.test.tsx`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 카드를 만든다**

`src/features/home/MealCard.tsx`:

```tsx
import { UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { MealMenu } from '../../shared/external/neisParse';
import { Card } from '../../shared/ui';

/**
 * 급식 카드가 처할 수 있는 상태.
 *
 * 다섯을 가르는 이유는 **선생님이 할 일이 저마다 다르기** 때문이다.
 * 학교를 안 정한 것과 인터넷이 끊긴 것과 방학이라 급식이 없는 것을
 * 같은 말로 보이면, 무엇을 해야 할지 알 수 없다.
 */
export type MealState =
  | { kind: 'no-school' }
  | { kind: 'loading' }
  | { kind: 'ready'; meals: MealMenu[] }
  | { kind: 'failed' };

export function MealCard({ state }: { state: MealState }) {
  return (
    <Card title="오늘 급식" icon={UtensilsCrossed}>
      {state.kind === 'no-school' ? (
        <p className="text-sm text-slate-500">
          학교를 정하면 오늘 급식이 여기 나옵니다.{' '}
          <Link to="/settings" className="font-medium text-brand-700 underline">
            학교 찾기
          </Link>
        </p>
      ) : null}

      {state.kind === 'loading' ? (
        <p className="text-sm text-slate-500">불러오는 중…</p>
      ) : null}

      {state.kind === 'failed' ? (
        <p className="text-sm text-slate-600">
          급식을 받아 오지 못했습니다. 인터넷 연결을 확인해 주세요.
        </p>
      ) : null}

      {state.kind === 'ready' && state.meals.length === 0 ? (
        <p className="text-sm text-slate-500">오늘은 급식이 없습니다.</p>
      ) : null}

      {state.kind === 'ready' && state.meals.length > 0 ? (
        <div className="flex flex-col gap-3">
          {state.meals.map((menu) => (
            <div key={`${menu.date}-${menu.kind}`}>
              {state.meals.length > 1 ? (
                <p className="mb-1 text-xs font-medium text-slate-500">{menu.kind}</p>
              ) : null}

              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {menu.dishes.map((dish) => (
                  <li key={dish.name} className="text-sm text-slate-800">
                    {dish.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
```

알레르기 번호는 지금 화면에 안 보인다. 자료에는 들어 있으므로 2판-나에서 접었다 펴는 방식으로 붙인다. **버린 것이 아니라 아직 안 보여 주는 것**이다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/home/MealCard.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: 홈에 붙인다**

`src/features/home/HomePage.tsx`에서 `급식 · 시간표` `SummaryCard` 블록(`label="급식 · 시간표"`가 있는 것) 전체를 아래로 바꾼다.

```tsx
        {isDesktop() ? (
          <TodayMeal />
        ) : (
          <SummaryCard
            to="/settings"
            label="급식 · 시간표"
            icon={UtensilsCrossed}
            accentClass="text-brand-600"
            tintClass="bg-brand-50"
            pending
            cta="학교 정보 설정"
          >
            <PendingNote>
              급식과 시간표는 설치형 G-board에서 받아 옵니다.
            </PendingNote>
          </SummaryCard>
        )}
```

웹 쪽 문구에서 **"NEIS 키를 넣으면"을 뺀다.** 키는 필요 없고, 웹에서는 아예 안 되는 기능이다.

같은 파일 아래쪽에 `TodayMeal`을 더한다:

```tsx
/**
 * 오늘 급식을 받아 온다.
 *
 * 캐시를 먼저 보고, 없으면 NEIS에 묻는다. 학교 인터넷은 끊긴다 —
 * 어제 받아 둔 것이 있으면 그날도 보인다.
 *
 * 설치형에서만 그린다. NEIS가 `Access-Control` 헤더를 안 줘서 브라우저는
 * 직접 못 부르고, 그 제약은 우리가 어쩔 수 없다.
 */
function TodayMeal() {
  const { data } = useSuite();
  const [state, setState] = useState<MealState>({ kind: 'loading' });

  const officeCode = data.profile.officeCode ?? '';
  const schoolCode = data.profile.schoolCode ?? '';

  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (officeCode === '' || schoolCode === '') {
      setState({ kind: 'no-school' });
      return;
    }

    let cancelled = false;
    setState({ kind: 'loading' });

    void (async () => {
      const [{ NeisSource }, { TauriHttpClient }, { CacheStore }, { TauriFileStore }] =
        await Promise.all([
          import('../../shared/external/NeisSource'),
          import('../../shared/external/TauriHttpClient'),
          import('../../shared/storage/CacheStore'),
          import('../../shared/storage/TauriFileStore'),
        ]);

      const cache = await CacheStore.open(new TauriFileStore());

      const cached = cache.getMeals(date);
      if (cached !== null) {
        if (!cancelled) setState({ kind: 'ready', meals: cached });
        return;
      }

      try {
        const meals = await new NeisSource(new TauriHttpClient()).fetchMeals(
          officeCode,
          schoolCode,
          date,
        );
        await cache.putMeals(date, meals);
        if (!cancelled) setState({ kind: 'ready', meals });
      } catch {
        // 조용히 넘어가지 않는다. 카드가 왜 비었는지 말해 줘야 한다.
        if (!cancelled) setState({ kind: 'failed' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [officeCode, schoolCode, date]);

  return <MealCard state={state} />;
}
```

import을 더한다:

```tsx
import { isDesktop } from '../../shared/platform/target';
import { MealCard, type MealState } from './MealCard';
```

`useEffect`·`useState`는 이 파일에 이미 import되어 있다. `isDesktop`도 3차 수정에서 이미 들어와 있다.

- [ ] **Step 6: 전체 확인**

Run: `npm run verify`
Expected: **833** tests, 종료 코드 0, 양쪽 번들 검사 통과

- [ ] **Step 7: 웹 번들이 안 커졌는지 본다**

```bash
npm run build
ls -S dist/assets/*.js | head -1 | xargs du -k
```

Expected: 400KB 이하. `npm run verify`의 검사가 이미 보지만, 숫자를 직접 확인해 보고한다.

- [ ] **Step 8: 사람이 확인할 것을 적는다**

`docs/gboard-first-run.md`의 사람 확인 목록에 더한다:

```
- 설정 → 학교 정보에서 학교 이름으로 검색하면 목록이 뜨고, 고르면 코드가 저절로 채워진다
- 학교를 정한 뒤 홈에 오늘 급식이 뜬다
- 인터넷을 끊고 앱을 다시 켜도 어제 본 급식이 그대로 보인다
- 방학·주말이면 "오늘은 급식이 없습니다"라고 나온다 (오류가 아니다)
```

- [ ] **Step 9: 설치본을 만든다**

```bash
npm run desktop:build
```

Expected: `G-board_0.1.0_x64-setup.exe` — 경로와 크기를 보고한다. 1판이 5.1MB였다.

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "feat: 학교를 정하면 홈에 오늘 급식이 뜬다"
```

---

## 2판-가가 끝나면

- 설정에서 학교를 **이름으로** 찾아 고르면 코드가 저절로 채워진다
- 홈에 **오늘 급식**이 뜬다
- 인터넷이 끊긴 날에도 어제 받아 둔 것이 보인다
- 학교 미설정 · 불러오는 중 · 급식 없음 · 받아오기 실패가 **저마다 다른 말**을 한다
- CSP가 걸렸고, 2판 동안 개발자 도구가 열린다
- 웹앱은 그대로 (첫 화면 400KB 이하)

**아직 아닌 것:** 시간표·날씨·오늘 보드·'지금' 카드는 2판-나, 테마 넷은 2판-다.

## 자체 점검 기록

**설계 항목 대응**

| 설계 | 과업 |
|---|---|
| CSP 조이기 | Task 1 |
| `tauri-plugin-http`, 세 호스트만 허용 | Task 5 |
| 학교 찾기 — 코드를 묻지 않는다 | Task 7 |
| 급식 받아 오기 | Task 3, 4 |
| 캐시를 `cache.json`에 (백업 X, 오래되면 버림) | Task 6 |
| 홈에 급식 | Task 8 |

**설계에 있으나 이 판에 없는 것** — 2판-나·다 몫이라 의도한 것이다: 시간표(`TimetableEntry`, `source: 'neis' | 'manual'`), 날씨, `TodayPage`, '지금' 카드, 일과 시간, 유도형 설정 띠, 테마 넷, `prefs.json`.

**1판이 가르쳐 준 것을 어디에 반영했나**

| 배운 것 | 어디에 |
|---|---|
| 권한은 기본이 읽기만 | Task 5 Step 6이 빌드 결과에서 확인한다 |
| 웹에서 맞던 게 설치형에서 함정 | Task 7·8이 웹 갈래를 따로 두고 문구를 가른다 |
| 앱이 자기 상태를 잘못 말함 | Task 8이 "NEIS 키를 넣으면"이라는 거짓 문구를 걷어낸다 |
| **조용한 실패가 가장 비싸다** | `MealState`를 다섯으로 가른 것이 이 판의 핵심 설계다 |
| 시험이 기다리는 척만 할 수 있다 | Task 7·8이 `findBy`로 실제 상태 전이를 기다린다 |

**미리 짚어 둔 위험**

- **CSP가 뭔가를 막을 수 있다.** 그래서 Task 1에서 devtools를 함께 켠다. 빈 화면이 뜨면 콘솔이 어느 지시어인지 정확히 말해 준다.
- **`http:default` 권한 형식이 틀릴 수 있다.** Task 5 Step 6이 빌드 결과를 직접 열어 확인하고, 틀리면 거기서 멈춘다.
- **`TauriHttpClient`를 정적 import하면 웹 번들이 커질 수 있다.** Task 7이 그 경우의 대응을 미리 적어 뒀다.
- 시험 누적: 794 → 798 → 806 → 813 → 813 → 822 → 827 → 833.

**계획을 쓰며 확인한 것** (추측이 아니라 파일을 열어 봤다)

- `HomePage.tsx`에 `useEffect`·`useState`·`isDesktop`·`UtensilsCrossed`·`PendingNote`·`useSuite`가 **이미 import되어 있다.** Task 8이 import을 새로 더할 것은 `MealCard`뿐이다.
- `SettingsPage.tsx:11`에 `isDesktop`이 이미 있다.
- 기준 시험 수가 **794**임을 직접 돌려 확인했다.
- 코드 입력 칸을 단언하는 시험이 없다 — Task 7이 기존 시험을 안 깨뜨린다.
- NEIS 응답의 칸 이름(`ATPT_OFCDC_SC_CODE`, `SD_SCHUL_CODE`, `DDISH_NM`, `MMEAL_SC_NM`, `CAL_INFO`, `ORG_RDNMA`)을 **실제 응답에서** 확인했다. 급식이 없는 날은 `{ RESULT: { CODE, MESSAGE } }`가 온다는 것도 확인했다.
- `@tauri-apps/plugin-http`의 `fetch`가 `invoke('plugin:http|fetch')`로 IPC를 탄다는 것을 **소스를 열어** 확인했다.
