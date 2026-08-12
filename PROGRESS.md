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
| 8 | `features/duty` 이식 | ⬜ **다음** |
| 9 | `features/reward` 이식 (seating 모둠 소비) | ⬜ |
| 10 | `features/assignment` 이식 | ⬜ |
| 11 | `features/tools` + dashboard 카드, 홈 요약 카드 연결 | ⬜ |
| 12 | 마이그레이션 + 배포 설정 + README | ⬜ |

현재 테스트 154개 (도메인 21 · 저장소 34 · UI 24 · 명단 54 · 상태 9 · 홈 6 · 라우팅 6).

개발 중 컴포넌트 확인: `npm run dev` 후 <http://localhost:3000/dev/gallery>
(프로덕션 빌드에서는 제외된다)

## 다음 작업: 7단계 `features/seating` 이식

**목표** — 원본 `G-seat-group-maker`(11,998줄, 최대 규모)를 이식한다.
이식 순서가 seating부터인 이유는 **모둠을 만드는 쪽**이기 때문이다.
9단계 reward가 그 모둠을 소비한다.

**해야 할 일**
1. 원본 `src/components/*`를 `src/features/seating/`으로 옮기고
   Student·Group·ClassRoom을 `shared/domain`의 것으로 교체
2. 원본의 `Student.gender/tags/note/isLocked`는 `SeatingProfile`에서 읽는다
3. 원본 `Toast`/`ConfirmDialog`/`PrintModal`/`StudentPublicViewModal`을
   `shared/ui`의 것으로 교체 (중복 제거의 첫 실전)
4. `services/storage/LocalStorageService`는 버린다. `useSuite().update`로 대체
5. 순수 알고리즘(`grouping.ts`, `conditionAlgorithms.ts`, `shuffle.ts`)에
   테스트를 먼저 붙인다 — 조용히 틀린 결과를 내는 부분이다
6. `/board/seating` 전자칠판 화면을 `BoardScreen`으로 연결
7. 홈의 자리·모둠 카드에 실제 모둠 수를 연결

**주의**
- 원본은 `Student.gender`를 직접 들고 있었다. 코어에는 성별이 없다.
  자리 배치 조건에서만 쓰이므로 `SeatingProfile`에 있는 것이 맞다
- 모둠 편성 결과를 저장할 때 "한 학생 = 한 모둠" 불변조건을 지켜야 한다

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
