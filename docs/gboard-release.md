# G-board 배포하기

만드는 사람용이다. 설치 파일을 남에게 드리는 절차와, 아직 못 갖춘 것.

---

## 한 번만 하는 준비

### 1. GitHub Actions를 켠다

저장소 → Settings → Actions → General → **Allow all actions**.

작업 흐름 파일은 이미 저장소에 있다.

| 파일 | 언제 도나 | 무엇을 하나 |
|---|---|---|
| `.github/workflows/verify.yml` | `main`에 밀 때, PR | `npm run verify` 하나. 설치 파일은 안 만든다 |
| `.github/workflows/release.yml` | `v*` 태그를 밀 때 | 설치 파일을 만들어 **릴리스 초안**에 올린다 |

**따로 만들 비밀값이 없다.** `GITHUB_TOKEN`은 GitHub가 알아서 준다.

### 2. 처음 한 번은 손으로 확인한다

작업 흐름이 실제로 도는지는 밀어 봐야 안다. 첫 태그는 아무 때나 붙여 보고, Actions 탭에서 초록불이 뜨는지, Releases에 초안이 생기는지 보면 된다.

---

## 새 판을 낼 때마다

### 1. 판 번호를 세 곳에서 올린다

```
package.json              "version": "0.6.0"
src-tauri/tauri.conf.json "version": "0.6.0"
src-tauri/Cargo.toml      version = "0.6.0"
```

세 곳이 어긋나면 `npm run check:release`가 잡는다. 설치 파일 이름은 `tauri.conf.json`을 따르는데 **Windows가 기존 설치를 덮어쓸지 말지도 그 번호로 정하므로**, 어긋나면 덮어쓰기가 조용히 안 된다.

### 2. 검사를 돌린다

```bash
npm run verify
```

```bash
npm run check:release
```

`check:release`가 보는 것.

| | |
|---|---|
| 디버그 빌드 | `--debug`로 만들고 있지 않은가 (그러면 features와 무관하게 개발자 도구가 산다) |
| 개발자 도구 | `features`에서 꺼졌는가 |
| CSP | 비어 있지 않고, `*`나 `unsafe-eval`로 넓히지 않았는가 |
| 판 번호 | 세 파일이 같은가. 태그를 밀 때는 태그와도 같은가 |
| 바깥 주소 | `capabilities/` **전부**를 훑어, 실제로 부르는 두 곳뿐인가 |
| 권한 | 아는 열넷뿐인가 (`shell:allow-execute`가 조용히 늘어나는 것을 막는다) |

> `tauri.conf.json`의 `beforeBuildCommand`가 이 검사를 먼저 돌린다. **`npx tauri build`든 `cargo tauri build`든 GitHub Actions든 전부 여기를 지나간다.** `tauri dev`는 안 걸린다 — 개발 중에 개발자 도구를 켜는 것은 정상이다.

### 3. 태그를 붙여 민다

```bash
git tag v0.6.0
```

```bash
git push origin v0.6.0
```

Actions가 십 분쯤 돌고 나면 Releases에 **초안**이 생긴다.

### 4. 초안을 받아서 직접 설치해 본다

**자동으로 공개되지 않는다.** 이 앱은 학생 이름을 담으므로 아무도 안 본 설치 파일이 저절로 남에게 가는 자리를 두지 않았다.

`docs/gboard-before-release.md`의 **'사람이 눈으로 봐야 하는 것'** 목록을 돌린 뒤, 릴리스 화면에서 **[Publish release]**를 누르면 그때부터 남에게 보인다.

> `docs/gboard-first-run.md`는 **받으시는 분용**이다. 확인 목록은 거기 없다.

---

## 아직 못 갖춘 것

### 코드 서명 — 파란 창이 뜬다

받는 분이 처음 실행하면 Windows가 **"Windows의 PC 보호"** 창을 띄운다. **추가 정보 → 실행**을 누르면 되고, 앱에 문제가 있다는 뜻은 아니다. 서명 인증서가 없는 모든 프로그램에 나온다.

없애려면 **코드 서명 인증서**가 필요하다. 이건 내가 대신 못 한다 — 신원 확인을 거쳐 발급받는 것이고, 열쇠는 만드는 사람이 가지고 있어야 한다.

| | |
|---|---|
| 무엇 | OV 또는 EV 코드 서명 인증서 |
| 어디서 | Sectigo, DigiCert, GlobalSign 등 |
| 값 | 대략 연 20~40만 원 (EV는 더 비싸고 USB 토큰이 온다) |
| 걸리는 시간 | 신원 확인에 며칠 |
| EV의 차이 | 파란 창이 **처음부터** 안 뜬다. OV는 다운로드 수가 쌓여야 사라진다 |

**지금은 안 하는 것을 권한다.** 연수에서 나눠 드리는 정도라면 "추가 정보 → 실행"을 안내문에 한 줄 적는 편이 낫다. 받는 분이 수백 명이 되면 그때 다시 판단할 일이다.

인증서가 생기면 `release.yml`의 `tauri-action` 단계에 이렇게 붙는다.

```yaml
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # 인증서를 base64로 만들어 저장소 비밀값에 넣는다
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.WINDOWS_CERTIFICATE }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
```

### 자동 갱신 — 아직 안 붙였다

새 판이 나오면 앱이 스스로 알아채고 받아 두는 기능이다. 붙이려면 두 가지가 필요하다.

**1. 갱신용 서명 열쇠 한 쌍.** 코드 서명 인증서와 **다른 것**이고, 돈이 안 든다. 다만 **개인 열쇠는 만드는 사람이 가지고 있어야 한다** — 그 열쇠를 쥔 사람은 모든 설치본에 아무 코드나 밀어 넣을 수 있으므로, 내가 만들어 저장소에 넣어 두면 안 된다.

만드는 명령은 이렇다. **직접 돌리시고, 나온 개인 열쇠는 저장소에 올리지 마세요.**

```bash
npx tauri signer generate -w %USERPROFILE%\.tauri\gboard.key
```

- 나온 **공개 열쇠**는 `tauri.conf.json`의 `plugins.updater.pubkey`에 넣는다
- 나온 **개인 열쇠**와 암호는 GitHub 저장소 비밀값(`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`)에 넣는다

**2. 갱신 정보를 둘 자리.** GitHub Releases를 그대로 쓸 수 있다.

이 둘이 갖춰지면 `tauri-plugin-updater`를 붙이고 "새 판이 있습니다" 알림을 어디에 띄울지 정하는 일이 남는다. **열쇠가 있어야 시작할 수 있는 일이라 여기까지 적어 두고 멈춘다.**

> 자동 갱신이 없어도 배포는 된다. 새 판이 나오면 설치 파일 주소를 다시 알려 드리고, 받는 분이 덮어씌우면 자료는 그대로 남는다. 지금까지 0.1.0부터 0.5.0까지 그렇게 해 왔다.

---

## 지금 할 수 있는 것과 없는 것

| | 상태 |
|---|---|
| 검사가 자동으로 돈다 | ✅ `verify.yml` |
| 설치 파일이 자동으로 만들어진다 | ✅ `release.yml` |
| 배포 전 막을 것을 검사기가 센다 | ✅ `check:release` |
| 릴리스 주소를 드릴 수 있다 | ✅ 태그를 밀면 된다 |
| 파란 창이 안 뜬다 | ❌ 인증서가 필요하다 |
| 앱이 스스로 갱신한다 | ❌ 열쇠가 필요하다 |

---

## 아직 안 해 본 것

작업 흐름 두 개는 **한 번도 안 돌았다.** GitHub Actions가 아직 안 켜져 있어서다. 파일은 문법과 액션 판을 확인해 두었지만, 처음 미실 때 한두 가지가 걸릴 수 있다. 걸리면 Actions 탭의 빨간 줄에 무엇이 문제인지 나온다.

먼저 `main`에 한 번 밀어 `verify.yml`이 도는지 보시는 편이 낫다. 그게 초록이면 `release.yml`의 앞부분(체크아웃·노드·npm)은 이미 검증된 셈이고, 남는 것은 Rust 빌드와 릴리스 올리기뿐이다.
