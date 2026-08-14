# 빠진 입력 화면 붙이기 설계

**날짜** 2026-08-14
**적용 대상** `G-classroom-suite`
**계기** [`../../reference/missing-features-audit.md`](../../reference/missing-features-audit.md) A 목록

---

## 1. 무엇을 만드나

통합 과정에서 **모델은 옮겼는데 입력 화면을 안 만든 것**들에 화면을 붙인다.
저장·백업·복원·스키마 파싱이 이미 검증돼 있어, 화면을 붙이는 순간 기존 자료도 그대로 살아난다.

**새 화면은 만들지 않는다.** 이미 있는 세 곳을 넓힌다.

| 화면 | 더할 것 |
|---|---|
| 명단 → 학생 정보 수정 모달 | 성별 · 특성 태그 · 별명 · 고정 역할 |
| 보상 → `점수 주기` 탭 | 통산 점수 표시 · 월 기준 |
| 설정 → 학교 정보 | 교육청 코드 · 학교 코드 |

---

## 2. 학생 수정 모달 — 한 곳에서 끝낸다

지금 번호·이름만 있는 모달을 넓힌다. 네 가지가 서로 다른 기능에 속하지만
교사에게는 전부 **"이 학생의 정보"** 다. 명단을 한 번만 등록한다는 통합의 전제와 같은 논리다.

| 항목 | 저장 위치 | 입력 방식 |
|---|---|---|
| 성별 | `SeatingProfile.gender` | 남 · 여 · 지정 안 함 |
| 특성 태그 | `SeatingProfile.tags` | 자유 입력 + 이미 쓴 태그에서 고르기 |
| 별명 | `RewardProfile.nickname` | 한 줄 |
| 고정 역할 | `DutyProfile.fixedRoleId` | 현재 학급 역할 중 하나, 없음 가능 |

### 2.1 세 프로필을 한 번에 쓴다

`update`를 세 번 나눠 부르지 않는다. 중간에 실패하면 학생 정보가 반쪽이 된다.
순수 함수 하나가 `SuiteData`를 받아 세 프로필을 함께 갱신한 새 `SuiteData`를 돌려준다.

```ts
export interface StudentDetailPatch {
  gender?: Gender;
  tags?: string[];
  nickname?: string;
  fixedRoleId?: string | null;
}

export function applyStudentDetail(
  data: SuiteData,
  studentId: string,
  patch: StudentDetailPatch,
): SuiteData;
```

### 2.2 지키는 것

- **고정 역할 목록은 현재 학급 역할만** 보여 준다. 다른 학급 역할을 고르면 참조가 깨지고,
  기존 불변조건 검사가 그것을 조용히 되돌린다. 고를 수 없게 해서 애초에 막는다.
- `applyStudentDetail`은 넘어온 `fixedRoleId`가 그 학생 학급의 역할이 아니면 **`null`로 만든다.**
  화면을 우회해 들어오는 값(가져오기 등)까지 막는다.
- **태그는 다듬어 저장한다.** 앞뒤 공백 제거, 빈 문자열 제외, 중복 제거.
  같은 태그가 두 번 들어가면 배치 조건 계산이 어긋난다.
- 프로필이 없는 학생이면 만들어서 넣는다. 명단 가져오기 경로에 따라 없을 수 있다.

### 2.3 `SeatingProfile.note`는 넣지 않는다

원본에서 이 메모는 자리 배치 참고용 자유 메모이고, 실제로는 **학생 개인 특기사항이
저장되는 자리**다. 개인정보 성격이 강하고, 연수생이 fork해 쓰는 앱에 넣으려면
백업 파일에 무엇이 들어가는지 따로 안내해야 한다.
태그(자리 배치 조건)와 성격이 다르므로 분리해서 나중에 결정한다.

---

## 3. 점수 주기 — 정직하게 되는 둘만

처음에는 미사용 3종을 모두 넣으려 했으나, 확인해 보니 난이도가 크게 다르다.

| 설정 | 실제 필요한 일 | 이번에 |
|---|---|---|
| `showLifetimeCumulative` | 표시 토글뿐. 계산은 이미 `전체` 기간으로 있다 | **한다** |
| `monthlyType` | `1st_to_end`·`specific_day`는 한 줄. `teacher_manual`은 주기 관리 화면이 통째로 필요 | **앞의 둘만 한다** |
| `weeklyStartDayApplyMode` | **바꾼 시점을 저장할 필드가 모델에 없다** | **하지 않는다** |

### 3.1 지키지 못할 선택지는 타입에서 뺀다

`weeklyStartDayApplyMode`가 함정이다. "다음 주기부터 적용"을 하려면 언제 바꿨는지를
저장해야 하는데 `ScoreCycle`에 그 자리가 없다. **선택지는 옮겨 왔는데 그 선택지를 지키는 데
필요한 필드는 안 옮겼다.** 지금 화면만 붙이면 교사가 "다음 주기부터"를 골라도 즉시 적용돼
**거짓말하는 설정**이 된다.

그래서 타입에서 다음을 뺀다.

- `ScoreCycle.weeklyStartDayApplyMode` — 필드 자체를 지운다
- `ScoreCycle.monthlyType`의 `'teacher_manual'` — 선택지만 지운다

지우는 것이 남겨 두는 것보다 낫다. 남겨 두면 다음 사람이 "이미 있으니 화면만 붙이면 되겠네"라고
읽고 같은 함정에 빠진다. 되살릴 근거는 이 문서와 B 목록에 남는다.

### 3.1.1 지울 자리 (실측)

참조 지점이 셋뿐이고 **테스트는 걸리지 않는다.**

| 파일 | 지금 | 바꿀 것 |
|---|---|---|
| `src/shared/domain/types.ts:375` | `weeklyStartDayApplyMode` 필드 | 지운다 |
| `src/shared/domain/types.ts:376` | `monthlyType`에 `'teacher_manual'` | 선택지만 지운다 |
| `src/shared/domain/factories.ts:318` | `DEFAULT_SCORE_CYCLE`의 기본값 | 해당 줄 지운다 |
| `src/shared/storage/schema.ts:448` | `oneOf(...)`로 파싱 | 해당 블록 지운다 |
| `src/shared/storage/schema.ts:453` | `monthlyType`의 허용 목록 | `'teacher_manual'` 뺀다 |

`parseSuiteData`는 옛 저장 자료에 이 값들이 있어도 **조용히 버린다.**
`parseSuiteData`는 알고 있는 키만 읽어 새 객체를 만드는 구조라,
그 줄을 지우면 자동으로 버려진다. 따로 처리할 것이 없다.

`monthlyType`이 `'teacher_manual'`로 저장돼 있던 경우는 `oneOf`가 허용 목록에서 빠진 값을
기본값(`'1st_to_end'`)으로 되돌린다. **이건 알리지 않는다** — 화면에 그 선택지가 있던 적이
없으므로 교사가 고른 값이 아니다. 복구 알림을 띄우면 없던 일을 있었다고 말하는 셈이다.

### 3.2 `monthlyType` 계산

지금 `cycleRangeFor`는 항상 `monthlyStartDay`를 쓴다(=`specific_day`).
`1st_to_end`를 고르면 시작일을 1로 강제한다. 그것뿐이다.

---

## 4. NEIS 학교 코드 — 값만 받는다

설정 > 학교 정보에 교육청 코드·학교 코드 입력칸을 넣는다.

**조회 기능은 만들지 않는다.** 급식·시간표 연동 자체가 아직 없고 그것은 별도 작업이다.
지금은 값을 넣고 지키는 것까지만 한다.

넣는 이유는 하나다. 이 값이 없으면 나중에 연동을 붙일 때
**연수생이 이미 넣어 둔 값이 없어** 처음부터 다시 받아야 한다.

입력칸 옆에 무엇에 쓰는 값인지 한 줄로 적는다.
지금 아무 일도 일어나지 않는 칸이므로, 설명이 없으면 교사가 고장으로 읽는다.

---

## 5. 범위 밖

- `ScoreGoal.achievedAt` 기록 — 로직 누락이지 입력 화면이 아니다
- 학급·학기 관리 화면 — `ClassRoom.grade`·`classNo`, `Term.archivedAt`이 살 곳이 없다.
  **필드를 빠뜨린 게 아니라 화면이 통째로 없는 것**이므로 B 목록이다
- `SeatingProfile.note` (§2.3)
- `weeklyStartDayApplyMode` · `monthlyType`의 `teacher_manual` (§3.1)
- 급식·시간표 조회
- B 목록 전체

이번 작업 뒤 A 목록에서 남는 것은 **학년·반, 학기 보관, 목표 달성 시각** 셋이고,
셋 다 B 성격으로 재분류된다. `missing-features-audit.md`를 그렇게 고친다.

---

## 6. 테스트

**순수 로직** (`applyStudentDetail`)
- 세 프로필이 한 번에 갱신된다
- 프로필이 없던 학생에게도 만들어 넣는다
- 다른 학급 역할을 고정 역할로 주면 `null`이 된다
- 태그의 앞뒤 공백·빈 문자열·중복이 정리된다
- 넘기지 않은 항목은 그대로 남는다

**주기 계산** (`cycleRangeFor`)
- `1st_to_end`는 `monthlyStartDay`와 무관하게 1일부터다
- `specific_day`는 지금 동작 그대로다

**스키마**
- 옛 저장 자료의 `weeklyStartDayApplyMode`·`teacher_manual`이 조용히 버려진다

**화면**
- 모달에서 네 가지를 넣고 저장하면 세 프로필에 반영된다
- 고정 역할 목록에 다른 학급 역할이 보이지 않는다

---

## 7. 순서

`G-teacher-toolkit`은 이 작업과 무관하다. 학생 명단이 없는 저장소다.
