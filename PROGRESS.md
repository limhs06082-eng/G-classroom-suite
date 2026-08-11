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
| 5 | `shared/roster` + `setup` — 명단 단일 원본, CSV, 설정 마법사 | ⬜ **다음** |
| 6 | `features/home` — 새 홈 골격 | ⬜ |
| 7 | `features/seating` 이식 | ⬜ |
| 8 | `features/duty` 이식 | ⬜ |
| 9 | `features/reward` 이식 (seating 모둠 소비) | ⬜ |
| 10 | `features/assignment` 이식 | ⬜ |
| 11 | `features/tools` + dashboard 카드, 홈 요약 카드 연결 | ⬜ |
| 12 | 마이그레이션 + 배포 설정 + README | ⬜ |

현재 테스트 85개 (도메인 21 · 저장소 34 · UI 24 · 라우팅 6).

개발 중 컴포넌트 확인: `npm run dev` 후 <http://localhost:3000/dev/gallery>
(프로덕션 빌드에서는 제외된다)

## 다음 작업: 5단계 `shared/roster` + `setup`

**목표** — 학생 명단을 단일 원본으로 만든다. 통합의 실질 가치가 여기에 몰려 있다.
지금은 교사가 같은 명단을 4번 입력해야 한다.

**만들 것**

1. `src/shared/roster/`
   - `RosterProvider` — StorageAdapter를 물고 SuiteData를 앱 전역에 공급.
     저장은 디바운스, 실패 시 Toast로 알림
   - `RosterManager` — 명단 관리 UI. 원본 4곳(seating StudentManagerModal,
     duty StudentManager, assignment ClassManagement+StudentView, reward studentUtils) 통합
   - `csvImport.ts` — CSV·붙여넣기 파서. 원본 seating/assignment 두 곳 참고
   - 전입·전출 처리: `status: 'inactive'`로만 두고 기록은 절대 지우지 않는다
2. `src/shared/setup/SetupWizard` — 최초 1회 설정.
   학교/학년/반 → 명단 붙여넣기 → 완료. `reward`의 `InitialSetupWizard` 확장 재활용
3. 활성 학기·학급 전환 UI를 AppShell 헤더에 연결 (지금은 '학급 정보 미설정' 고정 문구)

**주의**
- `Group.studentIds` 방향이므로 "한 학생 = 한 모둠" 불변조건을 UI에서도 지켜야 한다
- 명단 일괄 변경 전에는 guard 백업을 남긴다 (`createBackup(reason, 'guard')`)
- 번호 중복은 저장 전에 막고, 이미 깨진 데이터는 `validateAndRepair`가 고친다

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
