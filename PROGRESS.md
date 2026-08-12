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
| 6 | `features/home` — 새 홈 골격 | ⬜ **다음** |
| 7 | `features/seating` 이식 | ⬜ |
| 8 | `features/duty` 이식 | ⬜ |
| 9 | `features/reward` 이식 (seating 모둠 소비) | ⬜ |
| 10 | `features/assignment` 이식 | ⬜ |
| 11 | `features/tools` + dashboard 카드, 홈 요약 카드 연결 | ⬜ |
| 12 | 마이그레이션 + 배포 설정 + README | ⬜ |

현재 테스트 148개 (도메인 21 · 저장소 34 · UI 24 · 명단 54 · 상태 9 · 라우팅 6).

개발 중 컴포넌트 확인: `npm run dev` 후 <http://localhost:3000/dev/gallery>
(프로덕션 빌드에서는 제외된다)

## 다음 작업: 6단계 `features/home`

**목표** — 5개 기능 요약을 얹은 새 홈. 지금은 자리표시자다.

**만들 것**
1. 요약 카드 5종 — 오늘의 당번 / 이번 주 자리·모둠 / 학급 점수 / 마감 임박 과제 / 급식·시간표
   각 카드는 해당 기능으로 가는 링크이자 요약 위젯이다
2. 기능이 아직 이식되지 않은 카드는 "준비 중" 상태로 두고, 7~10단계에서 실데이터를 연결한다
3. 명단이 비어 있으면 홈 전체를 설정 유도 화면으로 바꾼다 (isFirstRun 활용)
4. 하단 도구 툴바 자리만 잡아 둔다 (실제 도구는 11단계)

**참고할 원본**
- `dashboard/src/components/dashboard/*` — 급식·시간표·공지·준비물 카드
- `dashboard/src/services/neis/*` — NEIS 클라이언트 (프록시는 12단계에 api/neis.ts로)

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
