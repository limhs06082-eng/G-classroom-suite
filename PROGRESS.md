# 진행 상황

- 설계 문서: [`docs/superpowers/specs/2026-08-11-classroom-suite-design.md`](docs/superpowers/specs/2026-08-11-classroom-suite-design.md)
- 원본 분석: [`docs/reference/original-apps-analysis.md`](docs/reference/original-apps-analysis.md)

## 검증 게이트

각 단계는 아래를 모두 통과해야 커밋한다. 실패하면 고친 뒤 다시 통과시키고 넘어간다.

```bash
npm run verify
```

`verify` = `lint`(tsc --noEmit) → `test`(vitest) → `build`(vite). 하나라도 실패하면 멈춘다.

## 단계별 상태

| 단계 | 내용 | 상태 |
|---:|---|---|
| 0 | 설계 문서 | ✅ `4e572ba` |
| 1 | 프로젝트 스캐폴딩 — Vite/TS/Tailwind/Router/Vitest, 앱 셸 | ✅ `487dcbd` |
| 2 | `shared/domain` — 타입·불변조건 + 테스트 | ✅ `7bae477` |
| 3 | `shared/storage` — 어댑터·백업·스키마 + 테스트 | ✅ `2d6fa90` |
| 4 | `shared/ui` — 디자인 토큰·공통 컴포넌트·BoardScreen·PrintLayout | ✅ 완료 (테스트 85개, 갤러리 `/dev/gallery`) |
| 5 | `shared/roster` + `setup` — 명단 단일 원본, CSV, 설정 마법사 | ✅ 완료 (테스트 148개) |
| 6 | `features/home` — 새 홈 골격 | ✅ 완료 (테스트 154개) |
| 7 | `features/seating` 이식 | ✅ 완료 (자리배치·모둠편성·전자칠판) |
| 8 | `features/duty` 이식 | ✅ 완료 (배정·공정성·전자칠판) |
| 9 | `features/reward` 이식 (seating 모둠 소비) | ✅ 완료 (점수·목표·전자칠판) |
| 10 | `features/assignment` 이식 | ✅ 완료 (제출 체크·지연·전자칠판) |
| 11 | `features/tools` + 설정·백업 화면 | ✅ 완료 |
| 12 | 마이그레이션 + 배포 설정 + README + Firebase 안내 | ✅ 완료 |

현재 테스트 154개 (도메인 21 · 저장소 34 · UI 24 · 명단 54 · 상태 9 · 홈 6 · 라우팅 6).

개발 중 컴포넌트 확인: `npm run dev` 후 <http://localhost:3000/dev/gallery>
(프로덕션 빌드에서는 제외된다)

## 1단계 완료

12단계까지 모두 끝났습니다. 남은 일은 아래 두 가지입니다.

- **저장소 공개 전환** — 연수 직전에 Settings → General → Change visibility
- **2단계 `G-teacher-toolkit`** — 명단이 필요 없는 4개 앱 통합 (별도 spec 필요)

## 저장소

- <https://github.com/limhs06082-eng/G-classroom-suite> — **비공개**, 기본 브랜치 `main`
- 완성 후 공개로 전환하면 연수생이 fork할 수 있다 (Settings → General → Change visibility)
- 각 단계 커밋 후 `git push origin main`

## 재개 방법

```bash
cd "C:\Users\Hansol\Documents\쌤동네\바이브코딩\G-classroom-suite"
npm install     # 이미 설치돼 있으면 생략
npm run verify  # 61개 테스트 통과 확인 후 4단계 시작
```

원본 저장소를 다시 봐야 하면 (수정 금지, 읽기 전용):

```bash
git clone --depth 1 https://github.com/limhs06082-eng/G-seat-group-maker.git
```

## 지켜야 할 것

- **원본 10개 저장소는 절대 수정하지 않는다.** 클론해서 읽기만 한다.
- 커밋 메시지에 큰따옴표를 쓰면 PowerShell 네이티브 인자 처리에서 깨진다.
  긴 메시지는 파일로 만들어 `git commit -F <file>`로 넘긴다.
