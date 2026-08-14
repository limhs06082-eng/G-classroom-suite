# 자리·모둠 강화 설계

**날짜** 2026-08-14
**적용 대상** `G-classroom-suite` — `features/seating`
**계기** [`../../reference/missing-features-audit.md`](../../reference/missing-features-audit.md) B 목록 개선 묶음 2

---

## 1. 무엇을 만드나

원본 `G-seat-group-maker`에 있었으나 통합 때 빠진 셋을 되살린다.

| 기능 | 원본에서 하던 일 |
|---|---|
| 교사 시점 전환 | 자리표를 교탁에서 본 방향으로 뒤집기 |
| 균형 모둠 편성 | 성별·특성을 고르게 나눠 편성 |
| 자리표 저장·불러오기 | 배치에 이름을 붙여 저장하고 나중에 꺼냄 |

---

## 2. 교사 시점 전환 — 좌석 배열만 뒤집는다

`SeatingState`에 `perspective: 'student' | 'teacher'`를 더한다. 기본은 `'student'`(지금 동작).

`buildSeats`가 **행 우선 순서**로 좌석을 만들고 `ClassroomGrid`가 그 순서대로 그린다.
그래서 **배열을 통째로 뒤집으면 정확히 180도 회전**이 된다.
칠판 표시도 아래로 내려간다 — 교탁에서 보면 칠판이 등 뒤다.

뒤집기는 순수 함수로 뺀다.

```ts
export function flipSeats(seats: readonly Seat[]): Seat[];
```

좌석 격자를 뒤집는 것은 인덱스 계산이라 조용히 틀리기 쉽다.
화면에 섞어 두면 "왜 한 칸씩 밀렸지"를 눈으로 찾게 된다.

**`seat.id`·`row`·`column` 값은 바꾸지 않는다.** 배열 순서만 뒤집는다.
`ClassroomGrid`는 순서대로 그리고, 좌석 클릭은 `id`로 처리한다.
그래서 뒤집어도 **누른 자리와 실제 자리가 어긋나지 않는다.**
값까지 바꾸면 저장된 `positions`와 어긋나 학생이 엉뚱한 자리로 간다.

### 2.1 한 곳만 고치면 셋이 따라온다

원본은 화면·인쇄·학생 공개 화면 **세 곳에 각각** 시점 처리를 넣었다.
우리는 셋 다 `ClassroomGrid` 하나를 쓴다. 1단계 통합에서 "교사 화면용과
학생 공개용 두 벌"을 하나로 합쳐 둔 것이 여기서 값을 한다.

**`isDisabled`는 좌석 id를 따라간다.** 뒤집어도 사용 안 함 자리는 같은 자리에 남는다.
뒤집는 것은 보는 방향이지 교실 구조가 아니다.

---

## 3. 균형 모둠 편성 — 성별 + 특성 태그

`performBalancedGrouping`을 `performRandomGrouping` **옆에** 둔다.
기존 함수는 그대로 둔다. 교사가 "그냥 무작위"를 고를 수 있어야 한다.

```ts
export interface BalancedInput {
  studentId: string;
  gender: Gender;
  tags: string[];
}

export function performBalancedGrouping(
  students: readonly BalancedInput[],
  classId: string,
  targetGroupCount: number,
  existingGroups: readonly Group[],
  lockedStudentIds: readonly string[],
  now: string,
  rng?: Rng,
): GroupingResult;
```

반환 타입은 `performRandomGrouping`과 같은 `GroupingResult`다.
화면이 둘을 갈아 끼울 수 있어야 한다.

### 3.1 배분 규칙

1. 고정(`isGroupLocked`)된 학생이 먼저 제 모둠에 앉는다. 기존 함수와 같다.
2. 남은 학생을 **성별로 나눠** 각각 섞는다.
3. 각 성별 무리를 **뱀 순서**(1→2→3→3→2→1)로 모둠에 넣는다.
   한 방향으로만 돌리면 앞 모둠에 인원이 몰린다.
4. **같은 태그를 가진 학생은 서로 다른 모둠을 먼저 고른다.**
   그 태그가 이미 있는 모둠은 뒤로 미룬다. 갈 곳이 없으면 그냥 넣는다.

### 3.2 약속하지 않는 것

**"완벽한 균형"을 약속하지 않는다.**
25명을 4모둠으로 나누면 6·6·6·7이고, 남학생이 3명뿐이면 한 모둠은 남학생이 없다.
태그가 4개인데 모둠이 3개면 어딘가는 겹친다.

화면은 결과를 보여 주고 교사가 손으로 고칠 수 있게 한다. 그 기능은 이미 있다.
**알고리즘이 못 지킨 것을 지켰다고 말하지 않는다.**

### 3.3 총원 보존

가장 중요한 불변이다. **어떤 조건에서도 학생이 한 명도 빠지거나 겹치면 안 된다.**
태그 회피를 하다가 "갈 곳이 없어" 누락되는 것이 이 알고리즘의 전형적 사고다.
테스트로 못 박는다.

---

## 4. 자리표 저장·불러오기

새 타입 하나와 `SuiteData` 배열 하나.

```ts
export interface SavedLayout {
  id: string;
  classId: string;
  name: string;
  rows: number;
  cols: number;
  disabledSeatIds: string[];
  positions: StudentPosition[];
  createdAt: string;
}
```

순수 함수는 `features/seating/layoutOps.ts`에 둔다.

```ts
saveLayout(data, classId, name, now?): SuiteData
deleteLayout(data, layoutId): SuiteData
applyLayout(data, layoutId): { data: SuiteData; droppedStudents: number }
```

### 4.1 불러올 때 없는 학생을 뺀다

저장 뒤 전학 간 학생이 자리를 차지하고 있으면 안 된다.
**지금 명단에 없는 학생은 자리에서 뺀다.** 몇 명이 빠졌는지 돌려주고 화면이 알린다.

교실 크기(`rows`·`cols`)도 저장본 것으로 되돌린다.
자리표는 크기까지가 한 벌이다. 크기를 안 바꾸면 저장할 때와 다른 그림이 나온다.

### 4.2 학급 삭제 연쇄에 넣는다

`classOps.deleteClassRoom`이 지우는 배열이 **14개에서 15개가 된다.**

안 넣으면 학급을 지운 뒤 고아 자리표가 남고, 이미 만들어 둔
**"삭제 뒤 `validateAndRepair`가 아무것도 고치지 않는다"** 테스트가 잡는다.
`countClassData`에도 `savedLayouts`를 더한다 — 세는 것과 지우는 것은 일치해야 한다.

**다만 삭제 확인창 문장에는 넣지 않는다.** 자리표는 교사가 만든 것이지만
"학생 25명이 사라진다"에 비하면 판단에 영향을 주지 않는다.

---

## 5. 화면

`자리·모둠` 화면에 셋을 붙인다.

| 기능 | 어디에 |
|---|---|
| 시점 전환 | 자리표 위 `학생 시점` · `교사 시점` 두 버튼 |
| 균형 편성 | 모둠 편성 패널의 `무작위 편성` 옆에 `균형 편성` |
| 자리표 저장 | 자리표 위 `저장` · `불러오기` |

균형 편성 버튼 아래에 한 줄 단다.

> 성별과 특성 태그를 고르게 나눕니다. 태그는 명단에서 넣습니다.

태그를 안 넣은 교사가 "왜 무작위랑 같지"를 묻지 않게 한다.

---

## 6. 테스트

**`flipSeats`**
- 4×5 격자가 정확히 뒤집힌다 (첫 좌석이 마지막이 된다)
- 홀수 열에서도 맞는다
- `isDisabled`가 좌석을 따라간다

**`performBalancedGrouping`**
- **총원이 보존된다** — 학생이 빠지거나 겹치지 않는다
- 성별이 고르게 퍼진다
- 같은 태그가 서로 다른 모둠으로 흩어진다
- 고정된 학생은 제 모둠에 남는다
- 태그가 없어도 동작한다 (성별만으로)
- 한쪽 성별만 있어도 깨지지 않는다
- 모둠 수가 학생 수보다 많아도 깨지지 않는다

**`layoutOps`**
- 저장하고 불러오면 자리가 같다
- 교실 크기도 함께 되돌아온다
- 지금 명단에 없는 학생은 빠지고 그 수가 돌아온다
- 학급을 지우면 그 학급 자리표가 함께 사라진다

**회귀**
- `deleteClassRoom` 뒤 `validateAndRepair`가 아무것도 고치지 않는다 (기존 테스트)

---

## 7. 범위 밖

배치 조건(원본 `ConditionManagerModal`) · 자리표 인쇄 시 시점 별도 설정 ·
모둠별 좌석 묶기 · 자리표 이름 수정.
