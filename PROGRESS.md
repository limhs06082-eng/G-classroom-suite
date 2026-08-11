# 진행 상황

설계 문서: [`docs/superpowers/specs/2026-08-11-classroom-suite-design.md`](docs/superpowers/specs/2026-08-11-classroom-suite-design.md)
원본 분석: [`docs/reference/original-apps-analysis.md`](docs/reference/original-apps-analysis.md)

## 검증 게이트

각 단계는 아래를 모두 통과해야 커밋한다. 실패하면 고친 뒤 다시 통과시키고 넘어간다.

```bash
npm run verify   # = lint(tsc --noEmit) && test(vitest) && build(vite)
```

## 단계별 상태

| 단계 | 내용 | 상태 |
|---:|---|---|
| 0 | 설계 문서 | ✅ 완료 (`4e572ba`) |
| 1 | 프로젝트 스캐폴딩 — Vite/TS/Tailwind/Router/Vitest, 앱 셸 | ✅ 완료 |
| 2 | `shared/domain` — 타입·불변조건 + 테스트 | ⬜ 다음 |
| 3 | `shared/storage` — 어댑터·백업·스키마 + 테스트 | ⬜ |
| 4 | `shared/ui` — 디자인 토큰·공통 컴포넌트·BoardScreen·PrintLayout | ⬜ |
| 5 | `shared/roster` + `setup` — 명단 단일 원본, CSV, 설정 마법사 | ⬜ |
| 6 | `features/home` — 새 홈 골격 | ⬜ |
| 7 | `features/seating` 이식 | ⬜ |
| 8 | `features/duty` 이식 | ⬜ |
| 9 | `features/reward` 이식 (seating 모둠 소비) | ⬜ |
| 10 | `features/assignment` 이식 | ⬜ |
| 11 | `features/tools` + dashboard 카드, 홈 요약 카드 연결 | ⬜ |
| 12 | 마이그레이션 + 배포 설정 + README | ⬜ |

## 결정 대기 (사용자 확인 필요)

- [ ] **GitHub 저장소 생성** — `G-classroom-suite`를 공개로 만들지 비공개로 만들지 미정.
      결정 전까지 로컬 커밋만 쌓는다. 결정되면 `gh repo create` 후 push.

## 참고

- 원본 저장소 클론 위치(읽기 전용, 임시):
  `C:\Users\Hansol\AppData\Local\Temp\claude\C--Users-Hansol-Documents----------\ce964e07-9a67-4892-9788-5e34a5805140\scratchpad\repos\`
  세션이 바뀌어 사라졌으면 `git clone --depth 1 https://github.com/limhs06082-eng/<repo>.git`로 다시 받는다.
- **원본 10개 저장소는 절대 수정하지 않는다.**
