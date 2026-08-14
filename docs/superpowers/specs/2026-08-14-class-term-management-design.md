# 학급·학기 관리 설계

**날짜** 2026-08-14
**적용 대상** `G-classroom-suite`
**계기** [`../../reference/missing-features-audit.md`](../../reference/missing-features-audit.md) B-2 — B 목록 개선 묶음 1

---

## 1. 문제

**학급을 만드는 경로가 처음 설정 마법사(`SetupPage`) 하나뿐이다.**
그 뒤로는 학급을 늘리거나 이름을 고칠 방법이 없다.

헤더의 `ClassSwitcher`는 이미 여러 학급 사이를 **전환**할 수 있게 만들어져 있다.
쓸 일이 없었을 뿐이다. 학급이 하나뿐이라.

`ClassRoom.grade`·`classNo`와 `Term.archivedAt`이 미사용으로 남아 있던 것도
필드를 빠뜨려서가 아니라 **그것들이 살 화면이 없어서**다.

---

## 2. 어디에 두나 — 설정에 탭 하나

`설정`에 **`학급·학기`** 탭을 더한다. 새 라우트를 만들지 않는다.
학기 초에 한 번 쓰는 화면이고, 이미 있는 `학교 정보`·`백업·복원`과 성격이 같다.

`ClassSwitcher`에 **`학급 관리`** 링크를 붙여 이 탭으로 보낸다.
학급을 바꾸러 온 교사가 "새 학급을 만들려면 어디로 가나"를 묻지 않게 한다.

---

## 3. 순수 함수부터 — `classOps.ts`

화면이 아니라 함수가 규칙을 갖는다. `rosterOps.ts`와 나란한 자리에 둔다.

```ts
addClassRoom(data, input: { termId; name; grade?; classNo? }, now?): SuiteData
updateClassRoom(data, classId, patch: { name?; grade?; classNo? }, now?): SuiteData
deleteClassRoom(data, classId): SuiteData
countClassData(data, classId): ClassDataCount

addTerm(data, input: { schoolYear; semester; name?; startDate; endDate }, now?): SuiteData
updateTerm(data, termId, patch: { name?; startDate?; endDate? }, now?): SuiteData
setTermArchived(data, termId, archived: boolean, now?): SuiteData
```

---

## 4. 삭제 — 14개 배열을 직접 지운다

### 4.1 무엇이 딸려 있나 (실측)

`classId`를 **직접** 가진 타입은 10종이다.

```
Student · Group · SeatingState · DutyRole · DutyRound · DutyCompletion
BehaviorPreset · ScoreEntry · ScoreGoal · Assignment
```

나머지 4종은 **간접 참조**다. 이쪽이 빠뜨리기 쉽다.

| 배열 | 어떻게 딸려 있나 |
|---|---|
| `seatingProfiles` · `dutyProfiles` · `rewardProfiles` | `studentId` — 지워지는 학생의 것 |
| `submissions` | `assignmentId` — 지워지는 과제의 것 |

**모두 14개 배열이다.**

### 4.2 왜 직접 지워야 하나

불변조건 검사에 고아를 정리하는 규칙이 이미 있다(`cleanProfiles`, `submissions.filter`).
그래서 `classId`만 지워도 결국 정합성은 맞는다.

그런데 그 정리는 **"자료가 깨졌으니 고쳤다"는 복구 경보를 띄운다.**
교사가 학급을 지웠을 뿐인데 "자리배치 프로필 25개를 정리했습니다" 같은 알림이 뜨면
사고로 읽힌다. **정상 삭제 경로는 조용해야 한다.**

같은 이유로 학생도 직접 지운다. 학급만 지우고 학생을 남기면 불변조건 검사가
학생들을 **`복구된 학급`이라는 낯선 반으로 조용히 옮긴다**(`RECOVERY_CLASS_NAME`).
그것은 저장 자료가 깨졌을 때를 위한 안전망이지 정상 경로가 아니다.

### 4.3 지우기 전에 센다

**세는 항목과 지우는 항목이 어긋나면 안 된다.** 교사가 못 본 자료가 사라진다.
그래서 14개 배열을 전부 센다.

```ts
interface ClassDataCount {
  students: number;
  groups: number;
  seatingStates: number;
  seatingProfiles: number;
  dutyProfiles: number;
  rewardProfiles: number;
  dutyRoles: number;
  dutyRounds: number;
  dutyCompletions: number;
  behaviorPresets: number;
  scoreEntries: number;
  scoreGoals: number;
  assignments: number;
  submissions: number;
}
```

확인창에는 **교사가 알아볼 것만** 문장으로 보여 준다.

> 학생 25명 · 모둠 6개 · 역할 8개 · 점수 기록 340건 · 과제 12개가 함께 사라집니다.

0인 항목은 문장에서 뺀다. "점수 기록 0건"은 읽는 데 방해만 된다.
프로필 세 종류와 `dutyCompletions`는 문장에 넣지 않는다 — 교사가 만든 적 없는
내부 자료라 개수를 알려 줘도 판단에 도움이 안 된다. **세되 보여 주지 않는다.**
지우는 것과 세는 것은 일치해야 하지만, 세는 것과 **보여 주는 것**은 다를 수 있다.

**학급 이름을 그대로 치게 한다** — 기존 `ConfirmDialog`의 `confirmPhrase`를 쓴다.
지우기 직전 상태는 `guard()`로 자동 백업한다.

### 4.4 막는 것

- **마지막 학급은 지울 수 없다.** 학급이 0개면 모든 화면이 "학급을 먼저 만들어 주세요"로
  바뀐다. 교사가 스스로를 막다른 곳에 넣는 버튼을 두지 않는다.
  `deleteClassRoom`이 이 경우 `data`를 그대로 돌려준다. 화면은 버튼을 비활성으로 둔다.
- **지운 학급이 활성 학급이었으면** 같은 학기의 다른 학급으로 옮긴다.
  그것도 없으면 아무 학급으로. `activeClassId`가 없는 학급을 가리키면 안 된다.

---

## 5. 학기 — 만들기·수정·보관만

**삭제는 만들지 않는다.** 학기를 지우면 그 안 학급이 전부 딸려 오고,
그건 14개 배열 × 학급 수다. 위험 대비 값이 없다.

**보관**(`Term.archivedAt`)은 목록에서 치우는 것이지 지우는 게 아니다.
보관된 학기의 학급은 `ClassSwitcher`에 뜨지 않는다. 자료는 그대로 있고 언제든 되돌린다.

**활성 학기는 보관할 수 없다.** 지금 쓰는 학기를 치우면 화면이 빈 상태가 된다.
`setTermArchived`가 이 경우 `data`를 그대로 돌려주고, 화면은 버튼을 비활성으로 둔다.

---

## 6. 학년·반

`ClassRoom.grade`·`classNo`를 학급 만들기·수정에서 받는다.

**선택 입력이다.** 이름(`3학년 2반`)만으로 충분한 교사가 많고,
필수로 만들면 같은 것을 두 번 적게 된다.

지금은 표시에만 쓴다. 나중에 NEIS 시간표를 붙일 때 학년·반이 코드로 필요해
미리 받아 둔다. 입력칸 옆에 그렇게 적는다. 아무 일도 일어나지 않는 칸이므로
설명이 없으면 교사가 고장으로 읽는다.

---

## 7. 테스트

**순수 로직** (`classOps`)
- 학급을 지우면 14개 배열에서 그 학급 것이 함께 사라진다
- **다른 학급 자료는 하나도 건드리지 않는다** (학급 둘을 만들어 한쪽만 지운다)
- `countClassData`가 실제 개수와 맞고, **`deleteClassRoom`이 실제로 지우는 수와 같다**
- 마지막 학급은 지워지지 않는다 (`data`가 그대로 온다)
- 활성 학급을 지우면 다른 학급으로 옮겨 간다
- 활성 학기는 보관되지 않는다
- 보관된 학기를 되돌릴 수 있다
- 학년·반을 안 넣어도 학급이 만들어진다

**정합성**
- **삭제 뒤 `validateAndRepair`가 아무것도 고치지 않는다.**
  고칠 게 있다면 14개 중 하나를 빠뜨린 것이다. 이 테스트가 그것을 잡는다.

**화면**
- 확인창에 실제 개수가 뜬다
- 학급 이름을 쳐야 삭제 버튼이 열린다
- 마지막 학급에서는 삭제 버튼이 비활성이다

---

## 8. 범위 밖

학기 삭제 · 학기 이월(진급) · 학급 순서 바꾸기 · 학급별 색상 ·
보관된 학기의 자료를 화면에서 보는 방법(백업 파일로만 접근).
