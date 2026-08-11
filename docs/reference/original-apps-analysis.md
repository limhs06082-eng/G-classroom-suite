# 원본 앱 10종 분석 노트

2026-08-11 조사. 통합 작업 중 원본을 다시 뒤지지 않도록 사실만 기록한다.
**원본 저장소는 읽기 전용이다. 절대 수정하지 않는다.**

## 공통 스택 (10/10 동일)

```
Vite 6.2 · React 19.0 · TypeScript 5.8 · Tailwind 4.1(@tailwindcss/vite)
lucide-react 0.546 · motion 12.23 · @google/genai 2.4
```

- `package.json`이 사실상 동일 (`name: "react-example"`까지 같음)
- 구조: `src/main.tsx` → `src/App.tsx` → `src/components/*`
- **라우터 없음.** 모든 앱이 `App.tsx`의 `useState`로 화면 전환
- `@` alias가 `vite.config.ts`에 정의돼 있으나 **실사용 0건** (AI Studio 잔재). 모든 import가 상대경로 → 폴더 이동에 안전
- `index.css`가 대부분 1줄(`@import "tailwindcss"`). 예외: dashboard 257줄, seating 62줄, task-manager 38줄

## 인벤토리

| 원본 저장소 | 앱 이름 | 줄 수 | 파일 | 학생명단 | 저장 | 특이사항 |
|---|---|---:|---:|:---:|---|---|
| `G-class-dashboard` | 우리 반 종합 대시보드 | 6,404 | 36 | ✗ | localStorage + NEIS API | **유일하게** base path 로직 + `.github/workflows/deploy.yml` + NEIS dev 프록시 보유. `StorageAdapter` 인터페이스 있음 |
| `G-seat-group-maker` | 자리배치·모둠 편성 | 11,998 | 38 | ✅ | localStorage | 최대 규모. `IStorageService` + 자동 백업 보유 |
| `G-class-duty-manager` | 역할·당번·청소구역 | 9,260 | 28 | ✅ | localStorage | 이중 백업키 + `DataRecoveryView` + `errorLogger` |
| `G-class-reward` | 활동·보상·공동목표 | 9,776 | 29 | ✅ | localStorage | `InitialSetupWizard` 보유 (설정 마법사 재활용 대상) |
| `G-assignment-tracker` | 과제 제출 현황 | 7,159 | 20 | ✅ | localStorage(**8개 키 분산**) | 유일하게 다중 학급 + 데이터 분산 저장 |
| `G-lesson-flow-board` | 수업 활동 진행판 | 4,295 | 26 | ✗ | localStorage | 2단계 |
| `G-formative-quiz` | 형성평가·퀴즈 | 8,111 | 25 | ✗ | localStorage(**일반 키**) | 2단계. 유일하게 Google Fonts CDN 사용 |
| `G-task-manager` | 회의·업무 체크리스트 | 6,823 | 24 | ✗ | localStorage | 2단계 |
| `G-school-message-templates` | 문서·문구 템플릿 | 5,696 | 21 | ✗ | localStorage | 2단계. **유일하게 `server.ts`(express) 보유** — Gemini 서버사이드 호출 |
| `G-call-teachers` | 교무실 선생님 호출 | 6,995 | 44 | ✗ | **Firestore** | **통합 대상 아님.** Firebase Auth + 보안규칙 + `vercel.json` |

합계 76,517줄 / 291파일. 1단계 통합 대상(상위 5개) 44,597줄.

## localStorage 키 전수

| 앱 | 키 |
|---|---|
| dashboard | `class_master_dashboard_data_v1`, `class_master_meal_cache_v1`, `class_master_neis_key` |
| seating | `SEATING_HELPER_APP_DATA_V1`, `SEATING_HELPER_AUTO_BACKUPS_V1` |
| duty | `class_duty_manager_app_data_v2`, `class_duty_manager_backup_v2`, `class_duty_manager_metadata_v2`, `class_duty_manager_recovery_v2`, `class_duty_manager_error_logs_v2` (구버전 `..._v1` 마이그레이션 코드 존재) |
| reward | `class_activity_manager_v1_data`, `class_activity_temp_restore_backup` |
| assignment | `student_tracker_terms_v1`, `..._classes_v1`, `..._students_v1`, `..._assignments_v1`, `..._submissions_v1`, `..._templates_v1`, `..._selected_term_id_v1`, `..._selected_class_id_v1` |
| lesson-flow | `class_board_templates_v1`, `class_board_active_id_v1`, `class_board_active_session_v1`, `class_board_runtime_v1_{templateId}` |
| quiz | ⚠ `quizSets`, `quizResults`, `settings`, `activeQuizSession` — **접두사 없음. 2단계 통합 시 충돌 위험** |
| task-manager | `teacher_task_checklist_app_data_v2` (구버전 `_v1` 마이그레이션 존재) |
| call-teachers | `teacher_call_sound_enabled`, `school_call_student_info` |

## 중복 지도 (1단계 5개 앱)

### 개념 충돌
- **학기**: `duty.OperationPeriod{schoolYear, semesterName, startDate, endDate, status}` ≈ `assignment.Term{schoolYear, semester, name, status}` / `reward.PeriodSettings`는 점수 리셋 주기라 별개
- **모둠**: `seating.Group{classId, name, color, studentIds[], leaderId}` ⊃ `reward.Group{id, name, color?}` + `reward.Student.groupId`
- **반**: `seating.ClassRoom`, `assignment.ClassGroup` = 다중 학급 / `duty`, `reward` = 단일 학급 전제

### Student 타입 4종
| 앱 | 필드 |
|---|---|
| assignment | `id, classId, number, name, status?, createdAt` |
| seating | `id, classId, number, name, gender, tags[], note, isLocked, createdAt, updatedAt` |
| duty | `id, name, order, isExcluded, status?, excludeStartDate?, excludeEndDate?, excludeReason?, excludedWeekdays?[], excludedDates?[], exclusionPeriods?[], excludedRoleIds[], roleSpecificExclusions?, fixedRoleId?` |
| reward | `id, number, name, nickname, groupId, status?, statusChangedAt?, statusMemo?, inactiveAt?, reactivatedAt?` |

공통 코어: `{ id, number, name, status }`

### 순수 중복
- 학생 관리 UI ×4 · Toast ×4(구현 4종) · 설정 화면 ×4 · 인쇄 ×3 · 전자칠판/공개화면 ×3
- ErrorBoundary: dashboard·seating·duty·(message-templates)에만 존재. **assignment·reward·quiz·task·lesson-flow에는 없음**
- 백업: 5개 앱 전부 다른 방식

## 재활용 가능한 원본 자산

| 자산 | 위치 | 용도 |
|---|---|---|
| `StorageAdapter` 인터페이스 | `dashboard/src/services/storage/StorageAdapter.ts` | 통합 어댑터의 기반 |
| `IStorageService` (백업 포함) | `seating/src/services/storage/IStorageService.ts` | 통합 어댑터의 백업 메서드 |
| `InitialSetupWizard` | `reward/src/components/Setup/` | 최초 설정 마법사 |
| `DataRecoveryView` | `duty/src/components/` | 손상 복구 UI |
| NEIS 클라이언트 | `dashboard/src/services/neis/` | `api/neis.ts` 서버리스로 이전 |
| 순수 알고리즘 | `duty/utils/autoAssign.ts`, `seating/utils/grouping.ts`·`conditionAlgorithms.ts`·`shuffle.ts`, `reward/services/transactionEngine.ts`·`utils/autoResetEngine.ts` | **테스트 최우선 대상** |

## 보안 관찰 — `G-call-teachers` (범위 밖, 별도 처리 권고)

`firestore.rules`에 학교 간 격리가 없다.

```
match /schools/{schoolId} {
  allow read: if isSignedIn();
  allow write: if isSignedIn();        // 로그인한 누구나 아무 학교 문서에 쓰기 가능
}
function isMemberOfSchool(schoolId) {
  return isSignedIn() && (
    !exists(.../users/$(request.auth.uid)) ||   // 미등록자 무조건 통과 (fail-open)
    getUserData(schoolId).isActive == true
  );
}
```

`staff`·`locations`·`reasons`·`settings`도 모두 `if isSignedIn()`.
**이 규칙 패턴을 통합 앱에 복사하지 않는다.** 통합 앱은 `/teachers/{uid}/**` + `request.auth.uid == uid`로 간다.
