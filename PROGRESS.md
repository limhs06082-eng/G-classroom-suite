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
| 4 | `shared/ui` — 디자인 토큰·공통 컴포넌트·BoardScreen·PrintLayout | ⬜ **다음** |
| 5 | `shared/roster` + `setup` — 명단 단일 원본, CSV, 설정 마법사 | ⬜ |
| 6 | `features/home` — 새 홈 골격 | ⬜ |
| 7 | `features/seating` 이식 | ⬜ |
| 8 | `features/duty` 이식 | ⬜ |
| 9 | `features/reward` 이식 (seating 모둠 소비) | ⬜ |
| 10 | `features/assignment` 이식 | ⬜ |
| 11 | `features/tools` + dashboard 카드, 홈 요약 카드 연결 | ⬜ |
| 12 | 마이그레이션 + 배포 설정 + README | ⬜ |

현재 테스트 61개 (도메인 21 · 저장소 34 · 라우팅 6).

## 다음 작업: 4단계 `shared/ui`

**목표** — 5개 앱의 화면을 얹을 공통 컴포넌트 세트를 만든다. 여기가 없으면
기능을 이식할 때마다 Toast·Modal·인쇄가 또 4벌씩 생긴다.

**만들 것**

1. `src/index.css`의 `@theme` 토큰 확장 (지금은 최소 골격만 있음)
   - 이중 스케일: `desk`(교사 노트북) / `board`(전자칠판, 3~8m 거리 판독)
2. `src/shared/ui/` 컴포넌트
   - `Button` `Modal` `ConfirmDialog` `Toast`(+ ToastProvider) `Card` `Table` `EmptyState` `Badge` `Tabs`
   - `BoardScreen` — 전자칠판 프레임. `/board/:feature` 라우트가 쓴다
   - `PrintLayout` — 인쇄 프레임. 원본 3개 앱의 PrintModal을 대체한다
3. 컴포넌트 확인용 갤러리 라우트 (개발 전용, 프로덕션 빌드에서 제외)

**참고할 원본** (읽기 전용)
- Toast 4종 비교: `seating/src/components/Toast.tsx`, `duty/.../Toast.tsx`,
  `reward/.../Toast.tsx`, `assignment/.../ToastContainer.tsx`
- 인쇄: `seating/src/components/PrintDocument.tsx` + `PrintModal.tsx` (가장 완성도 높음)
- 전자칠판: `duty/src/components/SmartboardModal.tsx`,
  `seating/src/components/StudentPublicViewModal.tsx`,
  `dashboard/src/components/tools/FocusScreenModal.tsx`

**주의**
- 색상 하드코딩 금지. 반드시 `@theme` 토큰 경유
- 원본의 화면 구조와 용어는 유지하고 시각 요소만 통일한다 (설계 문서 §16-2)

## 결정 대기 (사용자 확인 필요)

- [ ] **GitHub 저장소 생성** — `G-classroom-suite`를 공개로 만들지 비공개로 만들지 미정.
      결정 전까지 로컬 커밋만 쌓는다. 결정되면 아래로 진행:
      ```bash
      gh repo create G-classroom-suite --private --source=. --remote=origin --push
      ```
      (공개로 할 경우 `--private`를 `--public`으로)

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
