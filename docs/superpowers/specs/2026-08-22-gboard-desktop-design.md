# G-board 설치형 배포 설계

## 무엇을 만드나

지금의 웹앱을 **윈도우 설치형 프로그램**으로도 내놓는다. 이름은 **G-board**.

받아 가시는 선생님이 할 일은 설치 파일을 받아 더블클릭하는 것뿐이다.
계정도, 콘솔도, 설정값도 없다. 자료는 그 컴퓨터 안에만 있다.

쌤핀·스쿨보드가 같은 길을 갔고, 둘 다 **GitHub Releases 배포 · 자동 갱신 ·
코드 서명 없음 · 로컬 저장**이라는 같은 모양이다. 그 모양을 따른다.

## 웹앱과의 관계

둘은 **따로 드리는 별개의 것**이다. 하나가 다른 하나를 대체하지 않는다.

| | 웹앱 (`G-classroom-suite`) | G-board |
|---|---|---|
| 받는 법 | fork | 설치 파일 |
| 준비 | `firebaseConfig.ts` 여섯 줄 | 없음 |
| 자료 | 클라우드 (여러 기기) | 이 컴퓨터 파일 |
| 형성평가 | 있음 | **없음** |
| 대상 | 연수 참가자 중 직접 손보실 분 | 그냥 쓰고 싶은 분 |

두 갈래를 오가는 길은 **설정 → 백업·복원**이다. 웹에서 내려받고 G-board에서
가져오면 된다. 이미 있는 기능이라 새로 만들 것이 없다.

## 무엇이 안 바뀌나

이게 이 설계의 핵심이다.

```
안 바뀜  기능 논리 전부 — 자리 배치, 당번 배정, 점수 계산, 과제 판정…
안 바뀜  src/shared/domain, ui, roster
안 바뀜  745개 테스트
```

`StorageAdapter` 인터페이스가 이미 저장 방식을 갈라 두었다. FirestoreAdapter를
넣을 때 기능 코드를 한 줄도 안 고쳤고, 파일 저장도 같은 자리에 들어간다.

**다만 `src/features/` 아래가 글자 그대로 안 바뀌지는 않는다.** 두 가지가 있다.

1. 전자칠판을 여는 여섯 곳의 `target="_blank"` → `openBoard()` 호출로
2. 홈의 형성평가 카드 → 설치형에서는 안내 카드로

둘 다 **자료를 어떻게 다루는지가 아니라 화면을 어떻게 여는지**에 대한 것이다.
기능 논리는 그대로다. 이 구분을 흐리지 않으려고 여기 적어 둔다.

## 1. 껍데기 — Tauri

| | Tauri | Electron |
|---|---|---|
| 설치본 | **~12MB** | ~290MB (쌤핀이 이 크기) |
| 화면 엔진 | 윈도우의 WebView2 | 크롬 동봉 |
| 최종 사용자 준비물 | 없음 (Win10 1803+ 기본 탑재) | 없음 |

웹 자산이 4.7MB이므로 설치본은 12MB 안팎이 된다. 연수 마지막에 여러 분이
동시에 받는 상황을 생각하면 이 차이가 크다.

빌드에 필요한 Rust와 Visual Studio 2022 빌드 도구는 개발 컴퓨터에 이미 있다
(rustc 1.96.1 확인). 최종 사용자에게는 아무 준비물도 없다.

## 2. 웹과 설치형을 가르는 방법 — 빌드 시점

```
npm run build          → 웹 (형성평가 포함, LocalStorageAdapter)
npm run build:desktop  → 설치형 (형성평가 제외, FileSystemAdapter)
```

`import.meta.env.VITE_TARGET`이 빌드 때 글자로 치환되므로 안 쓰는 가지가
통째로 사라진다. **설치형 바이너리에 형성평가 코드가 아예 안 들어가고,
웹 빌드에 Tauri 코드가 아예 안 들어간다.**

이 저장소에 이미 같은 선례가 있다 — `router.tsx`가 `import.meta.env.DEV`로
개발용 갤러리 라우트를 통째로 지운다.

대안을 재어 보고 버린 것:

- *한 벌로 만들고 실행 중에 판단* — 빌드는 단순하나 설치형에 안 쓸 코드가
  실린다. 무엇보다 두 갈래를 시험으로 갈라내기 어렵다.
- *코드를 복제해 따로 관리* — 고칠 때마다 두 번 해야 한다.

### 형성평가를 빼는 이유와 그 뒤처리

설치형에는 서버가 없어 학생 폰이 들어올 길이 없다. 기능을 반쯤 살려 두면
"되는 줄 알았는데 안 되는" 자리가 생긴다. 통째로 뺀다.

다만 **사라지는 것으로 보이면 안 된다.** 설치형 홈의 '수업·업무 도구' 줄에
안내 카드를 둔다: "형성평가는 웹에서 쓰실 수 있습니다" + 웹 주소 링크.

자료 스키마에서는 퀴즈 관련 칸(`quizSets`, `quizResults`, `quizRun`,
`quizTeams`)을 **빼지 않는다.** 두 갈래가 같은 백업 파일을 주고받아야 하므로
스키마는 하나여야 한다. 설치형은 그 칸을 안 볼 뿐이다.

## 3. 자료 저장 — FileSystemAdapter

### 어디에

```
%APPDATA%\G-board\
  data.json                          학급 자료 전체
  backups\
    2026-08-21T09-14-02.json         학기 전환·초기화 직전 스냅샷
```

한 파일에 통째로 담는다. 지금 localStorage에 담는 것과 같은 모양이라
스키마를 바꿀 필요가 없고, **선생님이 그 파일 하나만 복사해 두면 백업이 끝난다.**

### 반쪽 파일을 만들지 않는다

`localStorage.setItem`은 통째로 성공하거나 실패한다. 파일 쓰기는 다르다 —
쓰는 도중에 앱이 죽으면 반쯤 쓰인 파일이 남고, 그건 JSON도 아니다.
한 해치 학급 자료가 그렇게 사라진다.

그래서 **임시 파일에 먼저 쓰고 이름을 바꿔 치운다.**

```
1. data.json.tmp 에 쓴다
2. 다 썼으면 data.json 으로 이름을 바꾼다   ← 운영체제가 쪼갤 수 없는 한 동작
```

어느 순간에 죽어도 남는 것은 옛 파일 아니면 새 파일이지 반쪽짜리가 아니다.

### 백업 보관

지금 `LocalStorageAdapter`의 백업 규칙(자동 백업 최소 간격 10분, 하루가
바뀌면 즉시 한 번)을 그대로 쓴다.

버리는 기준만 바뀐다. localStorage에서는 **공간이 모자라서** 오래된 것부터
버렸다. 파일 시스템에는 5MB 한계가 없으니 그 이유가 사라진다. 대신
**최근 20개**라는 개수로 자른다 — 무한정 쌓이면 폴더를 여신 선생님이
어느 것이 무엇인지 알 수 없다. 자동 백업이 10분에 한 번이니 하루 수업에서
대여섯 개가 쌓이고, 20개면 사나흘 치가 남는다.

### 시험할 수 있게 만들기

파일 시스템을 직접 부르면 테스트에서 못 돌린다. 작은 인터페이스로 감싼다.

```ts
interface FileStore {
  read(path: string): Promise<string | null>;
  writeAtomic(path: string, text: string): Promise<void>;
  list(dir: string): Promise<string[]>;
  remove(path: string): Promise<void>;
}
```

`TauriFileStore`가 실제 구현이고, 테스트는 `MemoryFileStore`를 끼운다 —
`LocalStorageAdapter`가 `MemoryStorage`로 시험받는 것과 같은 방식이다.

**쓰기 도중에 죽는 상황을 반드시 시험한다.** 그게 이 어댑터의 존재 이유다.

## 4. 전자칠판 — 두 번째 창

지금 여섯 곳이 `<Link target="_blank">`로 전자칠판을 연다. 데스크톱에서
이 링크는 **앱 창이 아니라 크롬을 연다.** 그 크롬은 `%APPDATA%`의 파일을
볼 수 없어 빈 전자칠판이 뜬다. 안 고치면 전자칠판 기능 전체가 죽는다.

이음매를 하나 더 둔다.

```ts
// src/shared/window/openBoard.ts
export function openBoard(path: string): void
//   웹     → window.open(path, '_blank')
//   설치형 → 새 Tauri 창 (전체 화면, 같은 자료)
```

고칠 곳은 다섯이다 — `SeatingPage`, `DutyPage`, `RewardPage`,
`AssignmentPage`, `LessonPage`. 여섯 번째인 `QuizPage`는 설치형에서
통째로 빠지므로 웹에서만 쓰이지만, 한 벌의 코드이니 함께 바꾼다.

화면 코드는 어느 쪽인지 모른다.

### 두 창이 같은 자료를 보게 하기

브라우저는 `storage` 이벤트로 창끼리 알려 주지만, Tauri 창 둘은 각자 다른
webview라 그런 것이 없다. `StorageAdapter.subscribe()`를 Tauri의 창 간
이벤트로 채운다 — **이미 인터페이스에 있는 자리라 새로 만들 것이 없다.**

```
교사 창에서 자리를 바꿈
  → data.json 저장
  → 'suite-changed' 이벤트 발신
  → 전자칠판 창이 받아서 다시 그린다
```

내가 보낸 이벤트가 나에게 되돌아오면 화면이 덜컥거린다. `FirestoreAdapter`가
쓴 것과 같은 방법으로 막는다 — 직전에 보낸 글자와 같으면 버린다.

## 5. 배포와 자동 갱신

### 만들고 내보내는 흐름

```
git tag v1.0.0 && git push --tags
          ↓
GitHub Actions (tauri-apps/tauri-action)
  · npm run build:desktop
  · cargo build --release  (+ 서명)
          ↓
GitHub Releases
  · G-board_1.0.0_x64-setup.exe
  · G-board_1.0.0_x64-setup.exe.sig
  · latest.json
```

정식 배포는 CI에 맡긴다. 매번 같은 환경에서 나오고, 비공개 열쇠가 개발
컴퓨터를 떠나지 않는다. 개발 중에는 로컬에서 `npm run tauri dev`로 돌린다.

### 갱신 설정

| 어디 | 무엇 |
|---|---|
| `latest.json` | `https://github.com/{소유자}/G-board/releases/latest/download/latest.json` — `latest`가 늘 최신을 가리키므로 주소가 안 바뀐다 |
| 공개 열쇠 | `tauri.conf.json`의 `plugins.updater.pubkey`에 박아 배포 |
| 비공개 열쇠 | GitHub Secrets `TAURI_SIGNING_PRIVATE_KEY` |

쓰는 것: `@tauri-apps/plugin-updater` (JS) + `tauri-plugin-updater` (Rust).
열쇠 생성: `npm run tauri signer generate`.
번들 설정: `bundle.createUpdaterArtifacts: true`.

앱은 켤 때 `check()`로 확인하고, 새 버전이 있으면 알린 뒤 단추 하나로
`downloadAndInstall()`한다. 서명이 안 맞으면 거부한다 — 남이 가짜 갱신을
밀어 넣지 못한다.

> **비공개 열쇠를 잃으면 되돌릴 수 없다.** 새 열쇠로 서명한 갱신은 이미
> 깔린 앱이 거부한다. 그러면 쓰시던 모든 분께 새로 받으시라고 일일이
> 알려야 한다. **열쇠를 만드는 그 자리에서 비밀번호 관리자에 넣는다.**
> 나중에 할 수 있는 일이 아니다.

### 코드 서명은 하지 않는다

쌤핀·스쿨보드 둘 다 안 하고 안내로 넘긴다. 인증서 값을 지금 치를 이유가 없다.
대신 **첫 실행 안내를 제대로 쓴다** — 윈도우가 "알 수 없는 게시자"라고 하면
`추가 정보 → 실행`. 받는 분이 처음 마주칠 화면이라 여기서 막히면 아무 소용이 없다.

## 6. 새로 만드는 파일

```
새로  src-tauri/tauri.conf.json          껍데기 설정
                                       · 창 1280x800, 최소 1024x700
                                       · 교사 창은 보통 크기, 전자칠판 창은 전체 화면
                                       · identifier: net.ssamdongne.gboard
새로  src-tauri/src/main.rs              진입점
새로  src-tauri/icons/                   아이콘
새로  src/shared/storage/FileStore.ts    파일 접근 인터페이스 + Tauri 구현
새로  src/shared/storage/FileSystemAdapter.ts
새로  src/shared/window/openBoard.ts
새로  .github/workflows/release.yml      태그를 밀면 설치본을 만든다
새로  tests/storage/FileSystemAdapter.test.ts
새로  tests/storage/MemoryFileStore.ts

고침  src/app/router.tsx                 형성평가 라우트 분기
고침  src/main.tsx                       빌드 대상에 따라 어댑터 선택
고침  src/features/home/HomePage.tsx     설치형에서 형성평가 카드 → 안내 카드
고침  다섯 곳의 target="_blank"          openBoard 호출로
      (+ QuizPage 한 곳. 웹 전용이지만 한 벌이라 함께)
고침  package.json                       build:desktop, tauri 스크립트
고침  vite.config.ts                     VITE_TARGET 정의
```

## 7. 시험

기존 745개는 그대로 통과해야 한다. 새로 더하는 것:

| 무엇 | 왜 |
|---|---|
| 빈 폴더에서 첫 실행 | 새로 설치한 분이 처음 만나는 상태 |
| 쓰기 도중 죽어도 옛 자료가 남는다 | 이 어댑터의 존재 이유 |
| 깨진 `data.json`이면 백업으로 되돌린다 | `LocalStorageAdapter`와 같은 보호 |
| 창 하나가 저장하면 다른 창이 따라온다 | 전자칠판 |
| 내가 보낸 이벤트를 내가 다시 받지 않는다 | 화면 덜컥거림 |
| 웹 빌드에 Tauri 코드가 없다 | 번들 검사 |
| 설치형 빌드에 형성평가 코드가 없다 | 번들 검사 |

마지막 둘은 빌드 결과물을 열어 확인한다. 타입 검사도 테스트도 못 잡는
종류라 따로 봐야 한다 — Firebase를 붙일 때 번들이 조용히 세 배가 된 적이 있다.

## 8. 하지 않는 것

- **macOS·리눅스** — 교실 컴퓨터는 윈도우다. 나중에 필요하면 그때.
- **설치 없이 쓰는 단일 실행 파일** — 자동 갱신을 붙일 수 없다. 요청이 모이면 그때.
- **설치형에서의 동기화** — 교실 컴퓨터 한 대에서 쓰는 것이 전제다.
- **코드 서명** — 위 참조.
- **형성평가의 학생 폰 참여** — 웹앱에 남는다.

## 9. 두 판으로 나눈다

한 번에 다 하지 않는다. 각 판이 끝나면 손에 잡히는 것이 나온다.

**1판 — 내 컴퓨터에서 도는 G-board**
Tauri 껍데기, `FileSystemAdapter`, 전자칠판 두 번째 창, 형성평가 분기.
끝나면 `npm run tauri dev`로 앱이 뜨고 자료가 파일에 쌓인다.
아직 아무에게도 못 드리지만 **되는지 안 되는지는 여기서 갈린다.**

**2판 — 남에게 드릴 수 있는 G-board**
GitHub Actions, 서명 열쇠, 자동 갱신, 첫 실행 안내.
끝나면 설치 파일 주소를 드릴 수 있다.

1판이 끝나야 2판이 의미가 있다. 파일에 자료가 안 쌓이는데 배포부터
갖춰 봐야 소용이 없다.

## 10. 아이콘

지금 없다. 임시로 글자 하나짜리(`G`)를 만들어 시작한다. 자료 위치와 달리
아이콘은 언제든 갈아도 아무것도 안 깨지므로 나중에 바꾸면 된다.
