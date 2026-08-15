# 과제 마감·보관 설계

**날짜** 2026-08-14
**적용 대상** `G-classroom-suite` — `features/assignment`
**계기** [`2026-08-14-assignment-views-design.md`](./2026-08-14-assignment-views-design.md) §7에서 범위 밖으로 미뤄 둔 것

---

## 1. 문제

`AssignmentStatus`에 `active` · `closed` · `archived`가 있고 `updateAssignment`도
훅에 있는데, **부르는 곳이 하나도 없다.** 과제는 만들면 영원히 `active`다.

한 학기를 쓰면 과제가 수십 개 쌓인다. 표 보기의 열이 계속 늘어나 못 쓰게 되고,
학생별 보기도 다 지난 과제로 채워진다. **끝난 것을 치울 방법이 있어야
새 화면들이 학기 내내 쓸모를 유지한다.**

모델·팩토리·저장 계층은 이미 다 되어 있다. 화면만 없다.

---

## 2. 세 상태가 뜻하는 것

| 상태 | 뜻 | 어디에 보이나 |
|---|---|---|
| `active` | 진행 중. 아직 받는다 | 전부 |
| `closed` | 마감. 더 안 받는다 | 과제 화면 세 탭. 홈·전자칠판에서는 빠진다 |
| `archived` | 보관. 목록에서 치운다 | 보관함에서만 |

### 2.1 마감은 잠금이 아니다

**마감해도 상태를 계속 바꿀 수 있다.** 늦게 낸 학생을 체크해야 하기 때문이다.
"이제 안 받는다"는 교사가 스스로 붙이는 표시지, 앱이 교사를 막는 장치가 아니다.

그러면 마감이 무슨 일을 하나:

- 홈 화면 `마감 임박 과제` 카드와 전자칠판에서 빠진다 (`upcoming`이 `active`만 본다 — 이미 그렇게 돼 있다)
- **지연으로 세지 않는다.** 마감한 과제의 미제출자는 더 이상 독촉 대상이 아니다
- 과제 칩과 표 열 머리에 `마감` 표시가 붙는다

### 2.2 보관은 삭제가 아니다

삭제는 제출 기록까지 지운다(`deleteAssignment`가 그렇게 한다).
**보관은 아무것도 지우지 않는다.** 화면에서 치울 뿐이고 되돌릴 수 있다.

`Term.archivedAt`·`visibleTerms`와 같은 개념이고, 같은 방식으로 만든다.

---

## 3. 순수 함수

`assignmentCore.ts`에 둘을 더한다. `classOps.visibleTerms`와 대칭이다.

```ts
/** 보관하지 않은 과제. 화면은 거의 언제나 이것만 쓴다. */
export function visibleAssignments(assignments: readonly Assignment[]): Assignment[];
export function archivedAssignments(assignments: readonly Assignment[]): Assignment[];
```

### 3.1 지연 셈법을 고친다

`summarize`의 `isOverdue`와 `summarizeStudent`의 `overdueCount`는
지금 상태를 안 본다. **진행 중인 과제만 지연이 될 수 있게** 고친다.

```ts
isOverdue: assignment.status === 'active' && daysLeft !== null && daysLeft < 0 && …
```

이걸 안 고치면 마감해도 빨간 `지연` 뱃지가 그대로 남아, 마감이 아무 일도
안 하는 것처럼 보인다.

---

## 4. 훅

`useAssignment.assignments`가 **보관을 뺀 목록**으로 바뀐다.

이 한 줄이 파급의 전부다. `progress`·`submissions`·`statusIndex`·
`studentProgress`가 전부 `assignments`에서 나오므로, 세 탭이 자동으로 따라온다.

더하는 것:

```ts
/** 보관한 과제. 보관함에서만 쓴다. */
archived: Assignment[];
setAssignmentStatus: (assignmentId: string, status: AssignmentStatus) => void;
```

`setAssignmentStatus`가 `updateAssignment`를 부르는 첫 호출자가 된다.
`updateAssignment`는 그대로 둔다 — 나중에 제목·기한 수정이 붙을 자리다.

**보관한 과제의 제출 기록은 `submissions`에서 빠진다.** 화면에 안 보이니
문제가 없고, 보관을 풀면 그대로 돌아온다. 지우는 게 아니기 때문이다.

---

## 5. 화면

### 5.1 과제별 탭 — 상태 바꾸기

고른 과제 카드의 액션 줄, `전원 제출`과 삭제 사이에 넣는다.

| 지금 상태 | 보이는 버튼 |
|---|---|
| `active` | `마감하기` |
| `closed` | `다시 열기` · `보관하기` |

`active`에서 바로 `보관하기`는 두지 않는다. 진행 중인 과제를 한 번에
숨기는 것은 실수하기 쉽다. **마감을 거쳐야 보관할 수 있다.**

### 5.2 과제 칩

`마감` 뱃지를 붙인다. 지연 뱃지는 마감하면 사라진다(§3.1).

### 5.3 보관함

과제별 탭 맨 아래에 접힌 줄 하나:

> 보관한 과제 3개 — 보기

펼치면 제목·기한과 `되돌리기` 버튼만 있는 목록이 나온다.
보관함에서 상태를 체크하거나 지우지는 못한다. **되돌린 뒤에 한다.**

보관한 과제가 없으면 이 줄 자체가 안 나온다.

### 5.4 표 보기 열 머리

`마감`한 과제 열은 머리에 작은 `마감` 글자를 단다. 열을 빼지는 않는다 —
마감한 과제의 미제출자를 확인하는 것이 표 보기의 쓸모 중 하나다.

---

## 6. 테스트

**`visibleAssignments` · `archivedAssignments`**
- 보관한 것만 갈라진다
- 마감(`closed`)은 보이는 쪽에 남는다
- 원본 순서를 지킨다

**지연 셈법**
- `summarize`: 마감한 과제는 기한이 지나도 `isOverdue`가 false다
- `summarize`: 진행 중이면 지금처럼 true다
- `summarizeStudent`: 마감한 과제는 `overdueCount`에 안 든다

**화면**
- `마감하기`를 누르면 칩에 `마감`이 뜬다
- 마감한 과제도 상태를 계속 바꿀 수 있다
- 보관하면 세 탭에서 사라지고 보관함에 나타난다
- 되돌리면 다시 나타난다
- 보관해도 제출 기록은 남는다

---

## 7. 범위 밖

과제 제목·기한 수정 · 마감 일괄 처리(기한 지난 것 모두 마감) ·
보관 과제 자동 정리.
