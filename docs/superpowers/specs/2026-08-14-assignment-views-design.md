# 과제 화면 보강 설계

**날짜** 2026-08-14
**적용 대상** `G-classroom-suite` — `features/assignment`
**계기** [`../../reference/missing-features-audit.md`](../../reference/missing-features-audit.md) B 목록 개선 묶음 3

---

## 1. 무엇을 만드나

| 기능 | 왜 |
|---|---|
| 표 보기 | 학생 × 과제 격자. 지금은 과제를 하나씩 골라야 전체가 안 보인다 |
| 학생별 보기 | 한 학생의 전체 제출 이력. 상담·가정 연락 때 쓴다 |
| 보완 사유 입력 | `Submission.note`가 **어느 화면에도 없다** |
| 과제 안내 표시 | `Assignment.description`을 **입력만 받고 버린다** |

뒤의 둘은 계획에 없던 것인데, 작업하며 확인해 보니 그냥 빠져 있었다.

**입력만 받고 안 보여 주는 것이 가장 나쁘다.** 교사는 "안내"를 적어 넣었고
저장도 됐다. 화면 어디에도 안 나올 뿐이다. 다음에 열어 보면 자기가 적은 것이
사라졌다고 생각한다.

---

## 2. 화면 — 탭 셋

`자리·모둠`이 이미 쓰는 `Tabs`를 같은 방식으로 쓴다.

| 탭 | 무엇 |
|---|---|
| `과제별` | 지금 화면 그대로. 과제 하나를 골라 학생 격자를 본다 |
| `표 보기` | 학생 행 × 과제 열 |
| `학생별` | 학생 하나를 골라 과제 전부를 본다 |

세 탭은 **같은 자료를 다르게 보는 것**이지 다른 기능이 아니다.
어느 탭에서 상태를 바꿔도 나머지 둘에 즉시 반영된다.

---

## 3. 표 보기

행이 학생, 열이 과제. 칸을 누르면 `과제별` 탭과 똑같이
미제출 → 제출 → 보완 → 완료로 돈다.

### 3.1 칸에는 한 글자만

과제 20개를 한 화면에 넣으려면 `미제출` 세 글자가 들어갈 자리가 없다.
`SUBMISSION_LABELS`의 첫 글자를 쓴다 — **미 · 제 · 보 · 완**.

**색만으로 구분하지 않는다.** 색각 이상인 교사가 제출과 보완을 못 가린다.
글자 + 색을 함께 쓰고, `aria-label`에는 `홍길동, 독서 감상문, 제출`처럼
줄인 것 없이 넣는다.

### 3.2 학생 이름 열은 따라다닌다

과제가 많으면 가로로 스크롤한다. 이름 열이 밀려 나가면
지금 누르는 칸이 누구 것인지 알 수 없다. `sticky left-0`로 고정한다.

가로 스크롤은 **표 안에서만** 일어난다. 페이지 전체가 옆으로 밀리면 안 된다.

### 3.3 줄 끝과 열 머리에 합계

행 끝에 그 학생이 낸 수(`3/5`), 열 머리 과제 제목 아래에 그 과제를 낸 수.
격자만 있으면 "누가 많이 밀렸나"를 눈으로 세어야 한다.

---

## 4. 학생별 보기

학생을 고르면 그 학생의 과제가 전부 나온다. 줄마다:

> 과제 제목 · 기한 · 상태 버튼 · **보완 사유** 입력칸

위에는 요약 뱃지 — 제출 n · 보완 n · 미제출 n, 그리고 **기한이 지났는데
안 낸 과제 수**.

### 4.1 보완 사유가 여기 사는 이유

`setNote`는 훅에 이미 있다. `setAll`은 "전원 제출"을 눌러도 메모를 지키려고
애쓴다. 정작 **넣을 데가 없었다.**

보완 사유는 "이 학생이 이 과제를 왜 다시 내야 하나"다. 과제별 격자에서는
한 학생만 골라 적을 자리가 없고, 표 보기 칸에는 더 없다. 학생 하나를 펼쳐
보는 이 화면이 제자리다.

---

## 5. 과제 안내 표시

`과제별` 탭에서 고른 과제 카드에 `description`을 보여 준다.
비어 있으면 아무것도 그리지 않는다.

---

## 6. 순수 함수

`assignmentCore.ts`에 셋을 더한다. 기존 `statusOf`·`summarize`는 그대로 둔다.

```ts
export const SUBMISSION_SHORT: Record<SubmissionStatus, string>;

/** `assignmentId|studentId` → 상태. 표 보기가 칸마다 배열을 훑지 않게 한다. */
export function submissionIndex(submissions: readonly Submission[]): Map<string, SubmissionStatus>;
export function statusFromIndex(index, assignmentId, studentId): SubmissionStatus;

export interface StudentProgress {
  student: Student;
  counts: Record<SubmissionStatus, number>;
  total: number;
  doneRatio: number;
  /** 기한이 지났는데 아직 안 낸 과제 수 */
  overdueCount: number;
}
export function summarizeStudent(student, assignments, submissions, today): StudentProgress;
```

`summarizeStudent`는 `summarize`를 학생 쪽으로 뒤집은 것이다. 같은 자료를
가로로 세느냐 세로로 세느냐의 차이라 셈법도 같게 맞춘다 —
**보완은 끝난 것으로 세지 않는다.**

인덱스를 따로 두는 이유: 24명 × 과제 20개면 칸이 480개고, 칸마다
`submissions.find`를 부르면 배열을 480번 훑는다. 지금 학급 크기에서는
느려지지 않지만, 이런 것은 나중에 원인을 찾기 어렵다.

---

## 7. 범위 밖 — 과제 마감·보관

`Assignment.status`에 `closed`·`archived`가 있고 `updateAssignment`도 훅에
있는데, **부르는 곳이 하나도 없다.** 과제는 만들면 영원히 `active`다.

이건 표 보기·학생별과 다른 문제다. 과제 목록을 관리하는 화면이 따로 있어야
하고, 마감한 과제를 표에서 뺄지 말지도 정해야 한다. 이번 묶음에 끼워 넣지
않고 점검 문서에 남긴다.

같은 이유로 **과제 수정**(제목·기한 고치기)도 범위 밖이다.

---

## 8. 테스트

**`submissionIndex` · `statusFromIndex`**
- 기록이 없으면 미제출
- 같은 학생·과제 기록이 둘이면 먼저 것을 쓴다 (불변조건 검사가 막지만 여기서도 정해 둔다)

**`summarizeStudent`**
- 상태별로 센다
- **보완은 끝난 것으로 세지 않는다** — `summarize`와 같은 셈법
- 기한이 지났는데 안 낸 과제만 `overdueCount`에 든다
- 기한 없는 과제는 지연이 아니다
- 과제가 하나도 없으면 `doneRatio`가 0이고 나누기 오류가 없다

**표 보기 화면**
- 학생 수 × 과제 수만큼 칸이 그려진다
- 칸의 `aria-label`에 학생·과제·상태가 줄임 없이 들어간다
- 이름 열에 `sticky`가 붙는다

**학생별 화면**
- 학생을 고르면 그 학생 과제가 전부 나온다
- 보완 사유를 적으면 저장된다
