# 「우리 반」 학급 운영 통합 앱 — 설계 문서

- 작성일: 2026-08-11
- 저장소: `G-classroom-suite` (신규)
- 상태: 확정

---

## 1. 배경과 목적

쌤동네 연수를 위해 Google AI Studio로 제작한 교사용 웹앱 10종이 각각 별도의 GitHub 저장소에 있다.
각 앱은 독립적으로는 동작하지만, 실제 교실에서 함께 쓸 때 다음 문제가 있다.

- **같은 학생 명단을 4번 입력해야 한다** (자리배치·당번·보상·과제)
- 자리배치에서 만든 모둠을 보상 앱에서 다시 만들어야 한다
- 학기 개념이 앱마다 따로 존재해 학기 전환을 세 번 해야 한다
- 데이터 백업·복원 방식이 앱마다 달라, 사고 시 복구 경로를 그때 배우게 된다

이 문서는 이 중 **학생 명단을 공유하는 5개 앱을 하나의 앱으로 통합**하는 설계를 정의한다.

### 주 사용자

연수 참여 교사가 저장소를 **fork하여 각자 학교에서 실제로 사용**한다.
따라서 시연용이 아니라 **운영 품질**이 목표다. 특히 다음이 기능 개수보다 우선한다.

1. 데이터를 잃지 않을 것 (백업·복원·자동 스냅샷)
2. 한 기능이 죽어도 나머지가 살아 있을 것 (오류 격리)
3. 설정 없이 fork 즉시 동작할 것 (환경변수·서버·계정 불필요)

---

## 2. 범위

### 2.1 이번 단계(1단계)에 포함

`G-classroom-suite` 저장소를 새로 만들고, 아래 5개 앱을 통합한다.

| 원본 저장소 | 통합 후 위치 | 규모 |
|---|---|---|
| `G-class-dashboard` | `features/home` (일부) + 전역 도구 툴바 | 6,404줄 |
| `G-seat-group-maker` | `features/seating` | 11,998줄 |
| `G-class-duty-manager` | `features/duty` | 9,260줄 |
| `G-class-reward` | `features/reward` | 9,776줄 |
| `G-assignment-tracker` | `features/assignment` | 7,159줄 |

합계 약 44,600줄.

### 2.2 이번 단계에서 제외

| 대상 | 사유 |
|---|---|
| `G-lesson-flow-board`, `G-formative-quiz`, `G-task-manager`, `G-school-message-templates` | 학생 명단을 공유하지 않음. **2단계** `G-teacher-toolkit`으로 별도 통합 |
| `G-call-teachers` | 사용자군(학교 전체)·인증(Firebase Auth)·배포 단위가 다름. **병합하지 않고 현행 유지** |
| Firebase 연동 | 3단계. 단, 1단계에서 **어댑터 인터페이스를 준비**해 둔다 (§7) |
| 기존 10개 저장소 수정 | **일절 건드리지 않는다.** 읽기 전용 참조만 한다 |

---

## 3. 저장소 전략

```
limhs06082-eng/
├─ G-class-dashboard          ← 유지 (원본, 교보재)
├─ G-seat-group-maker         ← 유지
├─ G-class-duty-manager       ← 유지
├─ G-class-reward             ← 유지
├─ G-assignment-tracker       ← 유지
├─ G-lesson-flow-board        ← 유지
├─ G-formative-quiz           ← 유지
├─ G-task-manager             ← 유지
├─ G-school-message-templates ← 유지
├─ G-call-teachers            ← 유지 (통합 대상 아님)
│
├─ G-classroom-suite   ★ 신규 — 1단계, 이 문서의 대상
└─ G-teacher-toolkit   ☆ 신규 — 2단계, 이후
```

원본 10개는 "AI 스튜디오로 앱 하나 만드는 법" 교보재로 남고,
통합본 2개는 "만든 앱들을 묶는 법" 심화 교보재가 된다. 연수생은 원하는 쪽을 fork한다.

---

## 4. 아키텍처

### 4.1 방식 선택

**단일 SPA 병합**을 채택한다. (모노레포·허브페이지 대안 대비)

근거:
- 통합의 실질 가치가 **명단·모둠·학기 공유**에 몰려 있는데, 이는 같은 번들·같은 상태 트리 안에 있어야 자연스럽다. 모노레포는 앱 간 이동 시 전체 리로드가 발생해 이 가치를 얻지 못한다.
- 10개 앱의 스택이 **완전히 동일**하다(Vite 6 / React 19 / TS 5.8 / Tailwind 4 / lucide-react / motion). 모노레포의 유일한 장점인 "마찰 회피"가 무의미하다.
- 모든 import가 상대경로다(`@` alias는 설정만 있고 실사용 0건). 폴더째 이동해도 경로가 깨지지 않는다.

단일 번들의 초기 로딩 부담은 **라우트 단위 `React.lazy` 코드 분할**로 해소한다.

### 4.2 디렉터리 구조

```
G-classroom-suite/
├─ api/
│  └─ neis.ts                    Vercel 서버리스 — NEIS 급식/시간표 프록시
├─ docs/
│  ├─ superpowers/specs/         설계 문서
│  └─ reference/                 원본 앱 분석 노트
├─ src/
│  ├─ app/
│  │  ├─ router.tsx              라우트 정의 + lazy 로딩
│  │  ├─ AppShell.tsx            공통 레이아웃(헤더·네비·툴바)
│  │  ├─ RootErrorBoundary.tsx   전역 오류 격리
│  │  └─ providers.tsx           Suite 상태 Provider 조합
│  ├─ shared/
│  │  ├─ domain/                 ★ 공통 도메인 모델 (§6)
│  │  │  ├─ types.ts
│  │  │  ├─ invariants.ts        불변조건 검증
│  │  │  └─ migrate.ts           원본 앱 데이터 가져오기 (§9)
│  │  ├─ storage/                ★ 저장·백업 (§7)
│  │  │  ├─ StorageAdapter.ts    인터페이스
│  │  │  ├─ LocalStorageAdapter.ts
│  │  │  ├─ backup.ts            자동 스냅샷 · 복원
│  │  │  └─ schema.ts            버전·검증·복구
│  │  ├─ roster/                 ★ 학생 명단 단일 원본
│  │  │  ├─ RosterProvider.tsx
│  │  │  ├─ RosterManager.tsx    명단 관리 UI (원본 4곳 통합)
│  │  │  └─ csvImport.ts         CSV·붙여넣기 파서
│  │  ├─ setup/
│  │  │  └─ SetupWizard.tsx      최초 1회 설정
│  │  └─ ui/                     ★ 디자인 시스템 (§8)
│  │     ├─ theme.css            Tailwind 4 @theme 토큰
│  │     ├─ Button / Modal / Toast / Card / Table / EmptyState
│  │     ├─ BoardScreen.tsx      전자칠판 전체화면 프레임
│  │     └─ PrintLayout.tsx      인쇄 프레임
│  ├─ features/
│  │  ├─ home/                   새 홈 (§10)
│  │  ├─ seating/                ← G-seat-group-maker
│  │  ├─ duty/                   ← G-class-duty-manager
│  │  ├─ reward/                 ← G-class-reward
│  │  ├─ assignment/             ← G-assignment-tracker
│  │  └─ tools/                  타이머·스톱워치·커튼·집중화면 (← dashboard)
│  ├─ index.css
│  └─ main.tsx
├─ tests/                        Vitest
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
└─ vercel.json
```

### 4.3 라우팅

원본 앱들은 라우터가 없고 `App.tsx` 내부 `useState`로 화면을 전환한다.
통합본은 **React Router**를 도입하고, 각 feature 내부의 기존 화면 전환 상태는 그대로 둔다.

| 경로 | 화면 |
|---|---|
| `/` | 홈 (5개 요약 카드) |
| `/seating` | 자리배치·모둠 |
| `/duty` | 역할·당번 |
| `/reward` | 활동·보상 |
| `/assignment` | 과제 제출 현황 |
| `/roster` | 학생 명단 관리 |
| `/settings` | 통합 설정 |
| `/setup` | 최초 설정 마법사 |
| `/board/:feature` | 전자칠판 전체화면 (헤더·네비 없음) |

`/board/:feature`를 별도 라우트로 분리하는 이유: 전자칠판은 별도 창·별도 모니터에 띄우는 경우가 많고, URL로 직접 열 수 있어야 한다.

---

## 5. 기능 중복 해소

원본 5개 앱에서 발견된 중복과 통합 방침.

### 5.1 개념 충돌 (설계 결정 필요했던 3곳)

| # | 중복 | 원본 | 결정 |
|---|---|---|---|
| ① | **학기** | `duty.OperationPeriod`, `assignment.Term` (필드 거의 동일) / `reward.PeriodSettings` (성격이 다름) | 앞의 둘을 공통 `Term`으로 통합. `reward.PeriodSettings`는 "점수 리셋 주기"이므로 **`ScoreCycle`로 개명**하여 학기와 명확히 분리 |
| ② | **모둠** | `seating.Group` (완전판: `studentIds[]`, `leaderId`, `color`) / `reward.Group` (축약판) + `Student.groupId` | seating 쪽을 상위집합으로 채택. **`Group.studentIds[]` 방향으로 통일**하고 `Student.groupId`는 폐기 |
| ③ | **반** | `seating.ClassRoom`, `assignment.ClassGroup` = 다중 학급 / `duty`, `reward` = 단일 학급 전제 | **다중 학급을 지원하되 전역 '활성 학급' 하나를 선택**. 담임은 반 1개만 만들고 이 개념을 인지하지 않음. 교과 전담은 여러 반을 등록해 헤더에서 전환 |

### 5.2 순수 중복 (통합만 하면 되는 6곳)

| 중복 | 원본 위치 | 통합 후 |
|---|---|---|
| 학생 관리 UI ×4 | `seating.StudentManagerModal`, `duty.StudentManager`, `assignment.ClassManagement`+`StudentView`, `reward.studentUtils` | `shared/roster/RosterManager` |
| Toast ×4 (구현 4종) | `seating.Toast`, `duty.Toast`, `reward.Toast`, `assignment.ToastContainer` | `shared/ui/Toast` |
| 설정 화면 ×4 | `dashboard.SettingsDrawer`, `seating.SettingsModal`, `duty.SettingsModal`, `reward.SettingsView` | `/settings` + 기능별 탭 |
| 인쇄 ×3 | `seating.PrintModal`+`PrintDocument`, `duty.PrintModal`, `assignment.PrintModal` | `shared/ui/PrintLayout` + 콘텐츠 주입 |
| 전자칠판/공개화면 ×3 | `dashboard.FocusScreenModal`/`FullscreenNoticeModal`/`FullscreenQuoteModal`, `duty.SmartboardModal`, `seating.StudentPublicViewModal` | `shared/ui/BoardScreen` + `/board/:feature` |
| ErrorBoundary ×3 · 백업 ×5(전부 다른 방식) | dashboard·seating·duty에만 EB 존재 | 전역+라우트별 EB, 통합 백업 엔진 |

**중복 제거로 8,000~11,000줄 감소 예상.** 다만 디자인 통일 작업이 그만큼을 채우므로 최종 규모는 원본과 비슷하고, 품질·유지보수성이 개선된다.

---

## 6. 공통 도메인 모델

`src/shared/domain/types.ts`. **모든 feature가 이것만 바라본다.**

```ts
// ── 전역 ──────────────────────────────────────────
interface SchoolProfile {
  schoolName: string;
  officeCode?: string;      // NEIS 시도교육청코드
  schoolCode?: string;      // NEIS 표준학교코드
  teacherName: string;
}

// ── 학기 (duty.OperationPeriod + assignment.Term 통합) ──
interface Term {
  id: string;
  schoolYear: string;                            // "2026"
  semester: string;                              // "1학기"
  name: string;                                  // "2026학년도 1학기"
  startDate: string;                             // YYYY-MM-DD
  endDate: string;
  status: 'active' | 'ended' | 'archived';
  createdAt: string;
  archivedAt?: string;
}

// ── 반 (seating.ClassRoom + assignment.ClassGroup 통합) ──
interface ClassRoom {
  id: string;
  termId: string;
  name: string;                                  // "3학년 2반"
  grade?: number;
  classNo?: number;
  createdAt: string;
  updatedAt: string;
}

// ── 학생 (단일 원본) ──────────────────────────────
type StudentStatus = 'active' | 'inactive';

interface Student {
  id: string;
  classId: string;
  number: number;                                // 학생 번호
  name: string;
  status: StudentStatus;
  statusChangedAt?: string;
  statusMemo?: string;                           // 전출·장기결석 사유
  createdAt: string;
  updatedAt: string;
}

// ── 모둠 (seating.Group 채택) ─────────────────────
interface Group {
  id: string;
  classId: string;
  name: string;
  color: string;
  studentIds: string[];
  leaderId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 6.1 기능별 확장 프로필

원본 앱마다 `Student` 타입이 달랐던 부분은 **코어에서 분리해 `studentId` 참조 테이블**로 둔다.
이렇게 하면 명단은 하나인데 기능별 부가정보는 독립적으로 커질 수 있다.

```ts
type Gender = 'male' | 'female' | 'other' | 'none';       // ← seating 원본 그대로

interface ExclusionPeriod {                                // ← duty 원본 그대로
  id: string;
  startDate: string;   // YYYY-MM-DD
  endDate: string;
  reason: string;
}

interface SeatingProfile {          // ← G-seat-group-maker
  studentId: string;
  gender: Gender;
  tags: string[];
  note: string;
  isLocked: boolean;                // 자리 고정
}

interface DutyProfile {             // ← G-class-duty-manager
  studentId: string;
  order: number;                    // 순환 배정 순서
  excludedRoleIds: string[];
  excludedWeekdays: number[];
  excludedDates: string[];
  exclusionPeriods: ExclusionPeriod[];
  fixedRoleId?: string;
  roleSpecificExclusions?: Record<string, { weekdays?: number[]; dates?: string[] }>;
}

interface RewardProfile {           // ← G-class-reward
  studentId: string;
  nickname: string;
}
// reward.Student.groupId → Group.studentIds[] 로 흡수 (5.1-② 결정)
```

### 6.2 불변조건

`src/shared/domain/invariants.ts`에서 검증하고, 위반 시 자동 복구 + 사용자에게 보고한다.

1. `Student.classId`는 존재하는 `ClassRoom`을 가리킨다
2. `ClassRoom.termId`는 존재하는 `Term`을 가리킨다
3. **한 학생은 같은 반에서 최대 한 모둠에만 속한다** (`Group.studentIds[]` 채택에 따른 필수 조건)
4. `Group.leaderId`는 `null`이거나 해당 `Group.studentIds`에 포함된다
5. `Student.number`는 같은 반 안에서 유일하다
6. 기능별 프로필의 `studentId`는 존재하는 `Student`를 가리킨다 (고아 프로필은 정리 대상)
7. `status: 'inactive'`(전출) 학생의 **기존 기록은 삭제하지 않는다.** 신규 배정 대상에서만 제외한다

---

## 7. 저장·백업

### 7.1 StorageAdapter

원본 두 곳에 이미 어댑터 인터페이스가 있다
(`dashboard/services/storage/StorageAdapter.ts`, `seating/services/storage/IStorageService.ts`).
이 둘을 합쳐 통합 인터페이스로 정의한다.

```ts
interface StorageAdapter {
  load(): Promise<{ data: SuiteData; repairs: string[] }>;
  save(data: SuiteData): Promise<void>;

  exportJson(): Promise<string>;
  importJson(json: string): Promise<ImportResult>;
  reset(): Promise<SuiteData>;

  listBackups(): Promise<BackupItem[]>;
  createBackup(reason: string, data?: SuiteData): Promise<BackupItem | null>;
  restoreBackup(id: string): Promise<RestoreResult>;
  deleteBackup(id: string): Promise<boolean>;
  clearBackups(): Promise<void>;
}
```

1단계는 `LocalStorageAdapter`만 구현한다.
**3단계에서 `FirestoreAdapter`를 추가하면 feature 코드는 한 줄도 고치지 않는다.**

```
        StorageAdapter (인터페이스)
                 │
     ┌───────────┴────────────┐
LocalStorageAdapter     FirestoreAdapter
    (1단계)                 (3단계)
```

### 7.2 키 네임스페이스

원본 앱들은 키 규칙이 제각각이고, 특히 `G-formative-quiz`는 `'settings'`·`'quizSets'` 같은
접두사 없는 일반 키를 쓴다(2단계 통합 시 충돌 위험). 통합본은 전부 접두사를 강제한다.

```
classroom-suite:v1:data        메인 데이터
classroom-suite:v1:backups     자동 스냅샷 목록
classroom-suite:v1:meta        스키마 버전·마지막 저장 시각
classroom-suite:v1:neis-key    NEIS API 키 (내보내기에서 제외)
```

### 7.3 백업 정책

원본 5개 앱의 백업 방식이 전부 다르다
(duty는 이중 백업키+`DataRecoveryView`, seating은 자동 스냅샷, reward는 임시 백업키, assignment·dashboard는 수동 JSON).
**localStorage는 브라우저 캐시 삭제 한 번에 전부 사라지므로**, 이 통합이 프로젝트에서 가장 중요한 작업이다.

| 계층 | 내용 |
|---|---|
| 자동 스냅샷 | 저장 시 롤링 보관 — **최근 10개 + 일자별 최근 7일치 1개씩** |
| 위험 작업 전 강제 백업 | 학기 전환, 명단 일괄 변경, 자동 배정, 점수 초기화, 가져오기 직전. **별도 슬롯에 최근 5개** 보관 |
| 보관 상한 | 백업 총량 **20개 또는 2MB 중 먼저 도달하는 쪽**. 초과 시 오래된 자동 스냅샷부터 삭제(위험작업 백업은 마지막에 삭제) |
| 수동 내보내기 | 전체 JSON 1개 파일. **API 키는 제외** |
| 가져오기 | 스키마 검증 → 불변조건 검사 → 미리보기 → 확정. 실패 시 원상복구 |
| 손상 복구 | 파싱 실패 시 최근 정상 스냅샷 자동 제안 |
| 사용자 알림 | 마지막 내보내기 후 **14일** 경과 시 홈에서 백업 권유 |

localStorage 총량이 브라우저당 5~10MB이므로 백업 상한은 반드시 강제한다(§16-4).

---

## 8. 디자인 시스템

디자인을 통일한다. 원본의 커스텀 CSS는 dashboard 257줄 / seating 62줄 / task 38줄뿐이고
나머지는 `@import "tailwindcss"` 한 줄이라, 버릴 스타일 자산이 거의 없다.

### 8.1 토큰

Tailwind 4 `@theme`으로 색·간격·타이포·반경·그림자를 정의한다. 하드코딩 색상은 금지한다.

### 8.2 이중 스케일

교실 앱의 특수 요구: **전자칠판은 3~8m 거리에서 읽힌다.**
일반 화면과 칠판 화면이 같은 타이포 스케일을 쓸 수 없다.

| 스케일 | 대상 | 특징 |
|---|---|---|
| `desk` | 교사 노트북 화면(기본) | 표준 타이포, 조밀한 정보 밀도 |
| `board` | `/board/:feature` 전자칠판 | 초대형 타이포, 고대비, 큰 클릭 타깃, 장식 최소화 |

`BoardScreen` 프레임이 `board` 스케일을 적용하고, 각 feature는 콘텐츠만 주입한다.

### 8.3 공통 컴포넌트

`Button` `Modal` `ConfirmDialog` `Toast` `Card` `Table` `EmptyState` `Badge` `Tabs`
`BoardScreen` `PrintLayout` `ErrorBoundary`

---

## 9. 홈 화면

기존 `dashboard`를 그대로 홈으로 쓰지 않고, **5개 기능 요약을 얹은 새 홈**을 만든다.

```
┌─ 헤더: 2026학년도 1학기 · 3학년 2반 · 25명 · [반 전환] ─┐
├────────────────┬────────────────┬────────────────┤
│ 오늘의 당번      │ 이번 주 자리·모둠 │ 학급 점수 현황   │
│ (duty)         │ (seating)      │ (reward)       │
├────────────────┼────────────────┴────────────────┤
│ 마감 임박 과제   │ 급식 · 시간표 · 공지 · 준비물      │
│ (assignment)   │ (기존 dashboard 카드 이식)        │
└────────────────┴─────────────────────────────────┘
하단 툴바: 타이머 · 스톱워치 · 화면커튼 · 집중화면 · 빠른알림
```

- 각 카드는 해당 기능으로 이동하는 링크이자 요약 위젯이다
- 하단 툴바의 도구(`TimerModal`·`StopwatchModal`·`ScreenCurtain`·`FocusScreenModal`·`QuickAlertModal`)는 홈 전용이 아니라 **전역**이다. 어느 화면에서도 접근된다
- NEIS 급식·시간표는 API 키 미설정 시 카드가 조용히 숨는다(오류 표시 아님)

---

## 10. 데이터 마이그레이션

원본 앱을 이미 쓰던 사용자를 위해 **1회성 가져오기**를 제공한다.
`/settings` → "기존 앱에서 가져오기"에서 브라우저 localStorage를 스캔한다.

| 원본 앱 | localStorage 키 | 대상 |
|---|---|---|
| dashboard | `class_master_dashboard_data_v1` | 학교 프로필·공지·준비물·시간표 |
| seating | `SEATING_HELPER_APP_DATA_V1` | 반·학생·모둠·좌석배치 |
| duty | `class_duty_manager_app_data_v2` | 역할·당번 배정·학기 |
| reward | `class_activity_manager_v1_data` | 점수·목표·행동 프리셋 |
| assignment | `student_tracker_terms_v1`<br>`student_tracker_classes_v1`<br>`student_tracker_students_v1`<br>`student_tracker_assignments_v1`<br>`student_tracker_submissions_v1`<br>`student_tracker_templates_v1`<br>`student_tracker_selected_term_id_v1`<br>`student_tracker_selected_class_id_v1` | 학기·반·학생·과제·제출상태·템플릿 |

> **주의:** assignment-tracker만 데이터를 **8개 키로 분산 저장**한다(나머지 4개는 단일 blob).
> 마이그레이션 시 부분 손실(일부 키만 존재) 가능성을 반드시 처리해야 한다.

**병합 규칙:** 학생은 `(반, 번호, 이름)` 기준으로 동일인 판정. 충돌 시 사용자에게 선택을 요구한다(자동 병합 금지).
가져오기는 미리보기 후 확정하며, 직전에 자동 백업을 남긴다. **원본 키는 삭제하지 않는다.**

---

## 11. 배포

| 항목 | 내용 |
|---|---|
| 플랫폼 | Vercel (정적 + 서버리스 하이브리드) |
| 빌드 | `vite build` |
| base path | `/` 고정. dashboard의 GitHub Pages용 base 로직과 `deploy.yml`은 이식하지 않는다 |
| `api/neis.ts` | NEIS Open API 프록시. dashboard는 dev 프록시만 있어 프로덕션 경로가 없었다 |
| 환경변수 | **없음.** NEIS 키는 사용자가 설정 화면에서 입력하고 localStorage에 보관한다 |
| fork 절차 | fork → Vercel 연결 → 배포 끝. 추가 설정 불요 |

---

## 12. Firebase 확장 준비 (3단계)

1단계에서는 붙이지 않되, 어댑터 인터페이스(§7.1)로 길을 열어 둔다.

### 12.1 용량 검토 — 교사 1명 / 학생 25명

Spark(무료) 한도: 읽기 50,000/일, 쓰기 20,000/일, 삭제 20,000/일, 저장 1 GiB, 아웃바운드 10 GiB/월.

| 동작 | 하루 빈도 | 읽기 | 쓰기 |
|---|---|---:|---:|
| 앱 열기(명단25+역할10+과제10+설정5) | 10회 | 500 | — |
| 보상 점수 입력 | 50~100회 | — | 100 |
| 과제 제출 체크(과제 2~3개 × 25명) | — | — | 75 |
| 당번 자동배정 | 주 1회 | — | 25 |
| 자리·모둠 재배치 | 주 1회 | — | 30 |
| 전자칠판 실시간 구독 재연결 | 20회 | 500 | — |
| **합계** | | **~1,000–3,000** | **~200–400** |
| **한도 대비** | | **2–6%** | **1–2%** |

저장 용량은 학생 1명당 1년치 기록 약 200KB → 25명 5MB (1 GiB의 0.5%).
**1학급 25명은 무료 한도의 근처에도 가지 않는다. 학급 10개를 관리해도 여유롭다.**

### 12.2 실제 위험 요소

| # | 위험 | 대응 |
|---|---|---|
| ① | **Cloud Functions 사용 불가.** Spark는 함수 배포가 막혀 있고 외부 네트워크 호출도 차단된다 | 서버 로직 없이 **클라이언트 SDK + 보안 규칙**만으로 설계. 자동 배정·집계는 전부 클라이언트. NEIS 프록시는 Vercel 서버리스로 분리(Firebase와 무관) |
| ② | **실시간 리스너 오용.** 전자칠판을 종일 켜두면 절전·탭전환·네트워크 끊김마다 리스너가 재연결되며 컬렉션 전체를 다시 읽는다 | 실시간이 필요한 화면만 `onSnapshot`. 나머지는 1회 읽기 + 로컬 캐시 |
| ③ | **보안 규칙.** 기존 `G-call-teachers`의 규칙은 `allow write: if isSignedIn()`으로 학교 간 격리가 없고, `!exists(...) \|\|` 패턴이 미등록자를 통과시키는 fail-open이다 | 통합 앱은 **`/teachers/{uid}/**` 소유자 단일 경로 + `request.auth.uid == uid`**로 단순화. 학급 데이터는 교사 본인만 접근하면 되므로 복잡한 규칙이 불필요하다. 이 규칙 패턴을 복사하지 않는다 |
| ④ | **연수 현장의 진입 장벽.** fork만으로는 Firebase가 붙지 않는다(콘솔 프로젝트 생성 → 웹앱 등록 → config 복사, 1인당 15~25분) | **localStorage가 기본, Firebase는 선택.** 설정 화면에서 config를 붙여넣은 사람만 동기화가 켜진다 |

> `G-call-teachers`의 보안 규칙 수정은 이 프로젝트 범위 밖이지만, 별도로 처리할 것을 권고한다.

---

## 13. 검증 전략

원본 10개 앱에는 테스트가 하나도 없다. 통합본은 **순수 로직부터** 테스트를 붙인다.

### 13.1 자동 검증

| 계층 | 도구 | 대상 |
|---|---|---|
| 타입 | `tsc --noEmit` | 전체 |
| 단위 테스트 | Vitest | 도메인 불변조건, 마이그레이션, 백업/복원, CSV 파서, 자동배정(`autoAssign`), 모둠 편성(`grouping`·`conditionAlgorithms`), 점수 엔진(`transactionEngine`), 기간 계산(`periodUtils`·`dateUtils`) |
| 빌드 | `vite build` | 전체 |

**테스트 우선순위 근거:** 위 알고리즘들은 순수 함수이면서 실패해도 조용히 잘못된 결과를 내는 것들이다
(당번이 편중 배정되거나 점수가 어긋나도 화면상으로는 정상으로 보인다). fork 사용자가 가장 손해를 보는 지점이다.

### 13.2 수동 검증

각 feature 이식 후 시나리오 체크리스트를 실행한다.
명단 입력 → 각 기능 동작 → 전자칠판 표시 → 인쇄 → 내보내기 → 초기화 → 가져오기 복원.

### 13.3 단계별 게이트

각 작업 단계는 **타입체크 + 테스트 + 빌드 통과**를 확인한 뒤 커밋한다. 실패 시 다음 단계로 넘어가지 않는다.

---

## 14. 작업 순서

**"공통 기반 먼저, 기능은 나중에."**
앱을 하나씩 통째로 옮긴 뒤 공통화하는 방식은 금지한다 — 중복이 5중으로 쌓인 뒤에는 되돌릴 수 없다.

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **0** | 설계 문서 (이 문서) | 승인 |
| **1** | 프로젝트 스캐폴딩 — Vite/TS/Tailwind/Router/Vitest, 빈 셸 | 빌드 성공, 빈 홈 렌더 |
| **2** | `shared/domain` — 타입·불변조건 + 테스트 | 불변조건 테스트 통과 |
| **3** | `shared/storage` — 어댑터·백업·스키마 + 테스트 | 저장·복원·손상복구 테스트 통과 |
| **4** | `shared/ui` — 디자인 토큰·공통 컴포넌트·BoardScreen·PrintLayout | 컴포넌트 갤러리 확인 |
| **5** | `shared/roster` + `setup` — 명단 단일 원본, CSV, 설정 마법사 | 명단 입력→저장→복원 동작 |
| **6** | `features/home` — 새 홈 골격 (요약 카드는 빈 상태) | 라우팅·레이아웃 동작 |
| **7** | `features/seating` 이식 | 시나리오 통과 + 모둠 생성 |
| **8** | `features/duty` 이식 | 시나리오 통과 + 자동배정 테스트 |
| **9** | `features/reward` 이식 (seating의 모둠 소비) | 시나리오 통과 + 모둠 연동 확인 |
| **10** | `features/assignment` 이식 | 시나리오 통과 |
| **11** | `features/tools` + dashboard 카드 이식, 홈 요약 카드 연결 | 홈 전체 동작 |
| **12** | 마이그레이션(§10) + 배포 설정 + README | fork→배포 리허설 성공 |

**이식 순서 근거:** 의존 방향을 따른다. 모둠을 **생성**하는 seating이 먼저, 그것을 **소비**하는 reward가 나중이다.

---

## 15. 비범위

- 학생 개인 계정·학생용 화면 (교사 단독 사용 전제)
- 여러 교사 간 공동 편집 (3단계 Firebase 이후 검토)
- 모바일 전용 레이아웃 (반응형은 지원하되 태블릿·노트북 우선)
- 원본 10개 저장소의 수정
- 2단계 `G-teacher-toolkit` (별도 spec)

## 16. 미해결 리스크

| # | 리스크 | 완화 |
|---|---|---|
| 1 | 44,600줄 이식 중 원본의 미발견 버그를 함께 옮길 수 있다 | 단계별 시나리오 검증. 순수 로직은 테스트로 고정 |
| 2 | 디자인 통일로 원본 사용자의 조작 습관이 바뀐다 | 화면 구조·용어는 유지하고 시각 요소만 통일 |
| 3 | 기능별 프로필 분리로 코드가 원본보다 장황해질 수 있다 | 프로필 접근을 훅으로 감싸 호출부를 단순하게 유지 |
| 4 | localStorage 용량 한계(브라우저당 5~10MB) | 이미지·첨부는 저장하지 않는다. 용량 경고 표시 |
