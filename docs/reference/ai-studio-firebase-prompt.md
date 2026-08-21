# AI 스튜디오로 Firebase 붙이기 — 지시문과 함정 일곱

이 문서는 **연수용 재료**입니다. 완성된 앱을 쓰시는 분은 볼 필요가 없습니다
(`docs/firebase-guide.md`를 보세요).

AI 스튜디오 같은 도구에 "Firebase를 붙여 줘"라고만 하면 그럴듯한 코드가
나옵니다. 그런데 그 코드가 실제로 배포까지 가는지는 별개입니다.
아래 지시문은 실제로 한 번 끝까지 따라가 보고 걸린 것들을 되먹인 결과입니다.

## 지시문

> 이 프로젝트에 Firebase Firestore 동기화를 추가해 줘. 다음 조건을 반드시 지켜:
>
> 1. `src/shared/storage/firebaseConfig.ts` 파일 **하나만** 새로 만들고, 거기에 내 Firebase 설정값을 넣어. 설정값을 다른 파일에 흩어 놓지 마. 그 파일에서 설정 객체에 `as const`를 붙이지 말고 타입을 따로 적어 줘. `as const`를 붙이면 값을 채우는 순간 빈 값 비교가 타입 오류가 돼.
> 2. `src/shared/storage/FirestoreAdapter.ts`를 만들어. 이미 있는 `src/shared/storage/StorageAdapter.ts` 인터페이스를 **그대로 구현**해야 해. 인터페이스를 바꾸지 마.
> 3. `src/features/` 아래 파일은 **한 줄도 고치지 마.** 화면 코드는 어댑터만 알고 있어야 해.
> 4. `src/main.tsx`에서 `SuiteDataProvider`에 어댑터를 넘길 때, Firebase 설정이 채워져 있으면 `FirestoreAdapter`를, 비어 있으면 지금처럼 `LocalStorageAdapter`를 쓰도록 해. 설정이 없어도 앱이 그대로 동작해야 해.
> 5. Firestore 경로는 `teachers/{uid}/suite/data` 한 문서에 `SuiteData` 전체를 저장하는 방식으로 해. 문서 1MB 제한이 있으니, 저장 직전에 크기를 재서 900KB를 넘으면 사용자에게 알림을 띄우고 저장은 계속 진행해.
> 6. 로그인은 이메일/비밀번호로 하고, 로그인 화면을 `/login` 경로에 만들어. 로그인하지 않으면 `LocalStorageAdapter`로 동작하게 해.
> 7. **처음 로그인했을 때 원격 문서가 비어 있으면, 이 브라우저에 저장돼 있던 자료를 그대로 올려.** 원격에 이미 자료가 있으면 원격 것을 쓰고 덮어쓰지 마. 이걸 빠뜨리면 몇 달 쓰던 교사가 로그인하자마자 빈 화면을 보게 돼.
> 8. **`firebase` 꾸러미는 정적으로 import하지 말고 `await import(...)`로 불러.** 정적으로 부르면 첫 화면 번들이 364KB에서 1,028KB로 커지고, Firebase를 안 쓰는 사람도 그 664KB를 내려받게 돼. `firebaseConfig.ts`가 비어 있으면 꾸러미를 아예 건드리지 않아야 해.
> 9. **`SuiteData`를 객체 그대로 문서에 넣지 마.** `SuiteData`에는 `officeCode?: string`처럼 값이 없을 수 있는 칸이 있는데 Firestore는 `undefined`를 거부해. `JSON.stringify`한 글자 하나를 `json` 칸에 담아. 배열 안의 배열도 Firestore가 막으니 이 방법이 안전해.
> 10. **백업(`listBackups`·`createBackup` 등)은 원격에 올리지 말고 `LocalStorageAdapter`에 맡겨.** 백업 스냅샷까지 같이 올리면 문서 하나가 바로 1MB를 넘어. `FirestoreAdapter`는 본 자료만 원격에 두고, 백업 관련 메서드는 안에 품은 `LocalStorageAdapter`에 넘겨. 원격에서 읽어 온 자료는 이 기기에도 적어 둬서 인터넷이 끊겨도 쓸 수 있게 해.
> 11. 로그인 화면은 `src/features/` 가 아니라 `src/app/LoginPage.tsx`에 만들어. 3번 조건과 부딪히지 않아야 해.
> 12. `src/main.tsx`에서 **최상위 `await`를 쓰지 마.** 타입 검사와 테스트는 통과하지만 빌드 목표가 es2020이라 빌드에서 막혀. `.then()`으로 받아.
> 13. Cloud Functions는 쓰지 마. 무료 요금제에서 배포할 수 없어.
> 14. 다 만든 뒤 `npm run verify`를 실행해서 타입 검사·테스트·빌드가 **모두** 통과하는지 확인해. 셋 중 하나만 돌리면 안 돼 — 타입 검사와 테스트를 통과하고 빌드에서만 깨지는 경우가 실제로 있어.

## 함정 일곱과, 무엇이 그것을 잡아 주는가

| # | 함정 | 무엇이 잡나 |
|---|---|---|
| 1 | `src/main.tsx`의 최상위 `await` | `npm run verify` — 타입·테스트는 통과하고 **빌드에서** 막힌다 |
| 2 | `firebase`를 정적 import | **아무것도 안 잡음.** 첫 화면이 364KB → 1,028KB로 커진다 |
| 3 | `SuiteData`를 객체 그대로 저장 | **아무것도 안 잡음.** 실제 Firestore에 쓸 때 `undefined`가 거부된다 |
| 4 | 설정 객체에 `as const` | `npm run verify` — **값을 채운 뒤에만** 깨진다 |
| 5 | 백업까지 원격에 저장 | **아무것도 안 잡음.** 몇 달 뒤 문서가 1MB를 넘는다 |
| 6 | App Check 적용을 코드보다 먼저 켬 | **아무것도 안 잡음.** 배포 직후 자료만 안 보인다 |
| 7 | `/login`으로 가는 링크 없음 | **아무것도 안 잡음.** 코드는 완벽한데 아무도 못 간다 |

일곱 중 다섯을 도구가 못 잡습니다. 그래서 확인 목록을 '통과했나'가 아니라
**직접 해 보는 행동**으로 만들어야 합니다.

- `npm run build` 뒤 `dist/assets`에서 가장 큰 `.js`가 400KB 안쪽인지 **눈으로**
- 주소를 치지 않고 **화면 안의 링크만 눌러서** 로그인 화면에 가 보기
- **로그아웃한 뒤** 자료가 남아 있는지

## 참고 구현

`trial/firebase-guide` 가지에 이 지시문을 그대로 따라 만든 코드가 있습니다.
막혔을 때 견주어 보세요.
