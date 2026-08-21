# 두 앱을 하나로 합칠 수 있나 — 점검 결과

**점검일** 2026-08-21
**대상** `G-classroom-suite` + `G-teacher-toolkit`
**계기** 수강생이 fork → AI 스튜디오에서 Firebase 부착 → 배포하는 흐름이라면,
앱이 둘이면 그 과정을 두 번 해야 한다.

---

## 결론: 합칠 수 있다. 그리고 지금이 가장 싸다.

충돌이 거의 없다. 처음부터 같은 뿌리에서 복사해 만든 두 앱이라 그렇다.

| 확인한 것 | 결과 |
|---|---|
| 도메인 타입 이름 충돌 | **2개** — `SchoolProfile`, `CURRENT_SCHEMA_VERSION` |
| 라우트 충돌 | **3개** — `settings`, `*`, `board/:feature` |
| 기능 id 충돌 | **`home` 하나** (나머지 8개는 안 겹침) |
| CSS 토큰 | 양쪽 57개, **이름이 같은 것은 값까지 동일** |
| 의존성 차이 | 3개 (`qrcode`, `@types/qrcode`, `@testing-library/user-event`) |
| `shared/ui` 14개 파일 | **5줄짜리 안내 주석만 다름** |

`board/:feature`는 충돌처럼 보이지만 아니다. 기능 이름이
`seating·duty·reward·assignment` 대 `lesson·quiz·task·message`로 완전히 갈려서,
`navigation.ts` 하나만 합치면 **전자칠판 라우트는 저절로 둘 다 처리한다.**

---

## 일의 크기

| 갈래 | 파일 | 줄 |
|---|---:|---:|
| toolkit에만 있는 것 — **그대로 이사** | 30 | 5,509 |
| suite에만 있는 것 — **손댈 것 없음** | 52 | 11,777 |
| 양쪽에 있어 **합쳐야 하는 것** | 13 | 2,212 |

합친 뒤 약 **23,700줄 / 116파일**, 테스트 **731개**가 된다.

### 합쳐야 하는 13개

| 파일 | toolkit 줄 | 성격 |
|---|---:|---|
| `shared/siblingApp.ts` | 45 | **삭제** — 합치면 존재 이유가 사라진다 |
| `main.tsx` | 23 | Provider 하나로 |
| `features/board/BoardPage.tsx` | 35 | 안내 문구만 |
| `app/router.tsx` | 53 | 라우트 9개로 |
| `app/navigation.ts` | 68 | 기능 목록 9개로 |
| `app/AppShell.tsx` | 94 | 헤더 하나로 |
| `shared/storage/StorageAdapter.ts` | 97 | 인터페이스는 거의 같다 |
| `shared/domain/factories.ts` | 158 | 이어 붙이기 |
| `features/home/HomePage.tsx` | 206 | 카드 합치기 |
| `shared/domain/types.ts` | 236 | 데이터 루트 하나로 |
| `shared/storage/schema.ts` | 346 | **여기가 제일 조심할 곳** |
| `features/settings/SettingsPage.tsx` | 425 | 탭 합치기 |
| `shared/storage/LocalStorageAdapter.ts` | 426 | 저장소 키 하나로 |

**정말 조심할 것은 셋뿐이다** — `schema.ts`, `LocalStorageAdapter.ts`, `SettingsPage.tsx`.
나머지는 기계적이다. 앞서 한 묶음 두어 개와 비슷한 크기다.

---

## 합치면 좋아지는 것 — 단순히 하나가 되는 게 아니다

**1. 수강생이 하는 일이 절반이 된다.**
fork 1회, Firebase 부착 1회, 배포 1회. `siblingApp.ts`에 주소를 넣는 단계와
**그것을 안 바꿨을 때 남의 앱으로 가는 함정**이 통째로 사라진다.

**2. 학교 정보를 한 번만 입력한다.**
`SchoolProfile`이 유일한 진짜 타입 충돌인데, 이건 장애물이 아니라 **합칠 이유다.**
지금은 학교 이름을 두 앱에 따로 넣는다.

| | suite | toolkit |
|---|---|---|
| `schoolName`·`teacherName` | 있음 | 있음 |
| `officeCode`·`schoolCode` (NEIS) | 있음 | — |
| `grade`·`classNo` (문구 치환용) | — | 있음 |

합치면 toolkit의 `grade`·`classNo`를 **활성 학급에서 그대로 가져올 수 있다.**
지금은 손으로 또 적는다.

**3. 퀴즈가 진짜 모둠을 쓴다.**
지금 퀴즈 팀은 `1모둠~4모둠` 기본값에서 시작한다. 합치면 자리·모둠에서 편성한
`Group[]`을 그대로 쓸 수 있다. **두 앱으로 나뉘어 있어서 못 하던 것이다.**

**4. 백업이 하나가 된다.** Firebase 문서도 둘에서 하나로 준다.

---

## 위험과 값

**`schema.ts` 병합이 가장 위험하다.** 저장된 자료를 지키는 방어선이라
여기가 틀리면 교사 자료가 조용히 사라진다. 다만 두 파서가 다루는 배열이
완전히 겹치지 않아 실제로는 이어 붙이기에 가깝고, 양쪽 테스트가 그대로 따라온다.

**저장소 키가 하나로 바뀐다.** 기존 자료를 이어받는 코드가 필요하다.
`shared/migration/legacyImport.ts`가 이미 같은 일을 한다 — 그 패턴을 쓴다.

**지금이 가장 싸다.** 아직 아무도 fork하지 않았다. 연수가 시작된 뒤에 합치면
수강생마다 이미 각자 고친 저장소가 있어 되돌릴 수 없다.

**"25,000줄이라 AI 스튜디오에서 무겁다"는 걱정은 줄어들었다.**
수강생이 AI 스튜디오에서 하는 일은 Firebase 부착이고, 그건
`firebaseConfig.ts` · `FirestoreAdapter.ts` · `main.tsx` 세 파일만 건드린다.
`firebase-guide.md`가 이미 "`features/` 아래는 한 줄도 고치지 마"라고 못 박고 있다.
저장소 전체 크기는 그 작업에 거의 영향이 없다.

---

## 권고

**합치는 것을 권한다.** 순서는 이렇게 한다.

| 단계 | 내용 | 왜 이 순서인가 |
|---|---|---|
| 1 | 도메인 합치기 — `types` · `factories` | 나머지가 전부 여기에 기댄다 |
| 2 | 저장 계층 — `schema` · `LocalStorageAdapter` · 기존 자료 이어받기 | 제일 위험한 곳을 이른 단계에, 테스트가 많을 때 |
| 3 | 기능 파일 30개 이사 | 기계적. 여기서 `npm run verify`가 다 잡는다 |
| 4 | 껍데기 — `navigation` · `router` · `AppShell` · `HomePage` · `SettingsPage` | 화면은 마지막. 아래가 안정된 뒤에 |
| 5 | `siblingApp.ts` 삭제, 문서 정리 | 합쳤다는 증거 |

각 단계마다 `npm run verify`가 통과해야 다음으로 간다. 테스트 731개가
안전망이 된다.

**새 저장소를 만들지 않는다.** `G-classroom-suite`를 합치는 쪽으로 삼는다.
파일이 더 많고(52 대 30) 이름도 학급 운영이 중심이라 자연스럽다.
`G-teacher-toolkit`은 남겨 두되 README에 "합쳐졌습니다" 안내를 단다.


---

## 실제로 합친 결과 (2026-08-21)

점검한 대로 됐다. 다섯 단계로 나눠 각 단계마다 `npm run verify`를 통과시켰다.

| 단계 | 테스트 |
|---|---|
| 1. 도메인 — `SchoolProfile` 합침, 타입 4묶음, `SuiteData` 24→32필드 | 500 |
| 2. 저장 계층 — 해석기 200줄, `adoptSplitApps` 이어받기 | 500 |
| 3. 기능 파일 28개 + 테스트 18개 이사 | 717 |
| 4. 껍데기 — 기능 9개, 색 토큰 12개, 홈 카드 10개 | 718 |
| 5. `siblingApp` 삭제 | 711 |
| 덤. 퀴즈가 진짜 모둠을 쓴다 | **722** |

최종 **115파일 · 22,549줄**. 점검 때 예상한 23,700줄보다 조금 적다 —
중복되던 공통 계층이 사라진 만큼이다.

### 예상과 달랐던 것

**처음 잰 `shared/ui` 차이가 파일마다 80~500줄로 나왔다.** CRLF/LF 때문에
모든 줄이 바뀐 것처럼 보인 착시였고, 정규화하니 파일당 5줄(안내 주석)이었다.
**줄바꿈을 정규화하지 않은 diff는 병합 견적에 쓸 수 없다.**

**테스트가 실제 버그를 잡았다.** `홈을 제외한 모든 기능이 전자칠판을 지원한다`가
깨져서 보니 `BoardPage`가 `lesson`·`quiz`를 몰랐다. `hasBoardView: true`인데
그리는 곳이 없었다. 그 단정 자체도 이제 거짓이라(업무·문구는 학생에게 띄울 것이
없다) 사실에 맞게 다시 썼다.

**`createId`가 양쪽에서 다른 파일에 살았는데 구현은 글자까지 같았다.**
`ids.ts`로 모으고 `factories`가 재수출하게 하니 이사 온 파일의 import를
한 줄도 고치지 않아도 됐다.

### 합쳐서 비로소 된 것

퀴즈 팀이 자리·모둠에서 편성한 `Group[]`을 그대로 쓴다. 예전에는
`1모둠~4모둠` 넷으로 고정이라 모둠이 여섯인 학급은 둘이 참여할 수 없었다.
"두 앱으로 나뉘어 있어서 못 하던 것"의 첫 사례다.
