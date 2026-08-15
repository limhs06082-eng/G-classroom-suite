# 목표 달성 기록과 축하 설계

**날짜** 2026-08-14
**적용 대상** `G-classroom-suite` — `features/reward`
**계기** [`../../reference/missing-features-audit.md`](../../reference/missing-features-audit.md) B 목록 개선 묶음 4

---

## 1. 범위를 잡으며 확인한 것

묶음 4는 원래 셋이었다. 코드를 읽어 보니 하나는 이미 있고, 대신
**점수 계산 자체에 결함이 둘** 있었다. 그 둘을 먼저 고치지 않으면
"달성 시각"을 틀린 숫자 위에 박게 된다.

| 원래 계획 | 확인 결과 |
|---|---|
| 빠른 점수 입력 | **이미 된다.** 항목을 고르면 선택이 유지되고 학생을 계속 눌러 연속 입력할 수 있다 — 오탐 |
| 목표 달성 축하 화면 | 없다. 만든다 |
| `ScoreGoal.achievedAt` 기록 | 없다. 만든다 |
| — | **결함 A: 주기 경계가 시간대를 무시한다** |
| — | **결함 B: 목표 진행률이 화면의 기간 탭에 따라 달라진다** |

---

## 2. 결함 A — 아침에 준 점수가 이번 주에서 빠진다

`cycleRangeFor`가 `since`를 `'2026-08-17T00:00:00.000'`이라는 **글자열**로 만들고,
`computeScores`가 `entry.occurredAt < since`로 **글자 비교**한다.

그런데 `occurredAt`은 `new Date().toISOString()` — **UTC**다.
한국(UTC+9)에서 월요일 아침 7시에 준 점수는 `2026-08-16T22:00:00.000Z`로 적힌다.
글자로 비교하면 `2026-08-16…` < `2026-08-17…`이라 **빠진다.**

> 확인: `new Date(2026,7,17,7,0).toISOString()` → `2026-08-16T22:00:00.000Z`
> `'2026-08-16T22:00:00.000Z' >= '2026-08-17T00:00:00.000'` → `false`

**한국 시간 자정부터 오전 9시 사이에 준 점수가 그 주기에서 통째로 빠진다.**
교사가 점수를 가장 많이 주는 아침 활동 시간이 여기다.

### 2.1 고치는 법

`since`를 **지역 자정에 해당하는 UTC 순간**으로 만든다.

```ts
function startOfDayIso(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  // 읽을 수 없는 날짜는 지금까지처럼 둔다. 부르는 쪽이 이미 걸러낸다.
  if (date === null) return `${dateStr}T00:00:00.000Z`;
  return date.toISOString();
}
```

`parseLocalDate`는 `new Date(년, 월-1, 일)`을 만든다. 그것이 지역 자정이고,
`.toISOString()`이 같은 순간의 UTC 표기다. 한국이면 `2026-08-16T15:00:00.000Z`.
이제 아침 7시 기록(`22:00Z`)이 안에 들어온다.

**`computeScores`는 안 고친다.** 글자 비교는 양쪽이 같은 UTC 표기면 정확하다.
문제는 비교가 아니라 한쪽만 지역 시간이었던 것이다.

---

## 3. 결함 B — 목표가 화면 탭을 따라간다

`useReward`가 `goalProgress(goal, totals)`를 부르는데, 그 `totals`는
화면 위 `이번 주 · 이번 달 · 전체` 버튼으로 정해진 기간의 합계다.

그래서 **같은 목표가 탭마다 다른 진행률을 보인다.** "우리 반 100점 모으기"가
`이번 주`에서는 12점, `전체`에서는 340점이다. 어느 쪽이 맞는지 화면은 말해 주지 않는다.

`ScoreGoal`에는 `startDate`가 있다. 목표를 만든 날이 들어간다.
**그런데 화면도 계산도 이 필드를 한 번도 읽지 않는다.**

### 3.1 고치는 법

목표는 **자기 `startDate`부터** 센다. 화면의 기간 탭과 무관하다.

```ts
// useReward
const goals = useMemo(
  () =>
    classGoals.map((goal) =>
      goalProgress(goal, computeScores(entries, groups, { since: startOfDay(goal.startDate) })),
    ),
  [classGoals, entries, groups],
);
```

목표마다 합계를 다시 계산한다. 목표는 보통 한 학급에 한둘이고 많아야 대여섯이라
비용이 문제되지 않는다. 기록이 수천 건이어도 합산은 한 번 훑기다.

`startOfDay`는 §2.1의 함수를 export해서 쓴다. 한 곳에서만 지역→UTC 변환을 한다.

### 3.2 화면에 기준을 적는다

목표 카드에 `2026-08-14부터`를 적는다. 숫자가 어디서 왔는지 화면이 말해야 한다.
기간 탭을 아무리 눌러도 이 숫자가 안 바뀌는 이유이기도 하다.

---

## 4. 달성 시각 기록

### 4.1 순수 함수로 만든다

```ts
/** 목표의 달성 상태를 지금 점수와 맞춘다. 바뀐 목표만 새 객체가 된다. */
export function syncGoalAchievements(
  goals: readonly ScoreGoal[],
  entries: readonly ScoreEntry[],
  groups: readonly Group[],
  now: string,
): { goals: ScoreGoal[]; newlyAchieved: ScoreGoal[] };
```

- 달성했는데 `achievedAt`이 없으면 → 넣는다. `newlyAchieved`에 담는다
- 달성 못 했는데 `achievedAt`이 있으면 → **뺀다**
- 그 외에는 원래 객체를 그대로 돌려준다

### 4.2 되돌리면 달성도 풀린다

이게 판단이 필요한 지점이다. 한번 축하했는데 취소되면 이상하지 않은가?

**푼다.** 이 앱의 원칙이 "기록이 유일한 원본"이기 때문이다. 점수는 언제나
기록에서 합산해 만든다. `achievedAt`만 예외로 두면 **"달성 완료인데 진행률 80%"**
라는 화면이 나온다. 그것이 훨씬 나쁘다.

실수로 준 점수로 목표를 넘겼다면 되돌렸을 때 풀리는 것이 맞다.

### 4.3 언제 부르나 — 점수를 주는 그 `update` 안에서

```ts
update((current) => {
  const withEntry = { ...current, scoreEntries: [...current.scoreEntries, entry] };
  return applyGoalSync(withEntry, classId, now);
});
```

`useEffect`로 나중에 감시하지 않는다. 두 번 저장되고, 다른 창이 같은 자료를
동시에 고칠 때 어느 쪽이 이길지 알 수 없다. **점수 추가와 달성 기록이 한 번의
저장으로 함께 일어나야 한다.**

`award` · `revoke` · `restore` 셋 다 같은 방식으로 감싼다.
점수를 움직이는 곳이 그 셋이다.

`award`는 새로 달성된 목표를 화면에 돌려준다:

```ts
award(preset, targetId, override?): { entryId: string; achieved: ScoreGoal[] } | null
```

---

## 5. 축하 화면

`award`가 `achieved`를 비어 있지 않게 돌려주면 전체 화면 축하를 띄운다.

- 목표 제목, 대상 이름, `reward`(달성하면 무엇을 하는지)
- 교사가 닫을 때까지 남는다. 자동으로 사라지지 않는다 — **학생들에게 보여 주는 화면**이다
- 목표 여러 개가 동시에 달성되면 한 화면에 나란히 적는다
- 움직임은 절제한다. `animate-rise-in` 하나면 된다

전자칠판을 따로 열지 않는다. 교사 화면에 띄우고, 교사가 그 화면을 보여 주거나
전자칠판 창을 이미 띄워 뒀으면 거기서도 목표 진행률이 갱신된다.

---

## 6. 테스트

**`startOfDayIso` (결함 A)**
- 지역 자정이 UTC 순간으로 바뀐다
- **아침에 준 점수가 그날 주기에 들어온다** — 회귀 방지의 핵심

**목표 기준 (결함 B)**
- 목표는 `startDate` 이전 기록을 세지 않는다
- 화면 기간과 무관하게 같은 값이 나온다

**`syncGoalAchievements`**
- 넘기면 `achievedAt`이 생기고 `newlyAchieved`에 담긴다
- 이미 달성한 목표는 `newlyAchieved`에 다시 안 담긴다
- 점수가 내려가면 `achievedAt`이 사라진다
- 안 바뀐 목표는 **같은 객체**를 돌려준다 (불필요한 저장을 막는다)
- `targetPoints`가 0 이하면 달성으로 본다 (`goalProgress`와 같은 셈법)

**화면**
- 목표를 넘기면 축하 화면이 뜬다
- 이미 달성한 목표에 점수를 더해도 다시 안 뜬다
- 되돌리면 달성 표시가 사라진다

---

## 7. 범위 밖

빠른 점수 입력(이미 됨) · 목표 수정 · 달성 이력 목록 ·
축하 화면의 소리·색종이 효과.
