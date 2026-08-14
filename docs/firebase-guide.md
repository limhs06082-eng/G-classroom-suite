# Firebase 붙이기 안내

여러 기기에서 같은 학급 자료를 쓰고 싶을 때만 하면 됩니다.
**안 해도 앱은 완전히 동작합니다.** 한 대의 브라우저에서만 쓴다면 이 문서는 건너뛰세요.

이 문서는 **AI 스튜디오에 그대로 붙여넣는 지시문**을 포함합니다.

---

## 하기 전에 알아 둘 것

### 무료로 충분한가 — 네, 여유롭습니다

교사 1명 / 학생 25명 기준 하루 사용량입니다.

| 항목 | 하루 예상 | 무료 한도 | 사용률 |
|---|---:|---:|---:|
| 읽기 | 1,000~3,000 | 50,000 | 2~6% |
| 쓰기 | 200~400 | 20,000 | 1~2% |
| 저장 | 5MB (1년치) | 1GB | 0.5% |

학급을 10개 관리해도 한도에 닿지 않습니다.

### 설정값은 비밀이 아닙니다

Firebase 웹 설정(`apiKey` 등)은 **공개를 전제로 만들어진 값**입니다.
어차피 배포된 자바스크립트 파일 안에 그대로 들어갑니다. 환경변수에 넣어도 똑같습니다.

**실제로 자료를 지키는 것은 보안 규칙(Firestore Security Rules)입니다.**
아래 4단계를 건너뛰지 마세요.

### 무료 요금제의 제약

- **Cloud Functions를 못 씁니다.** 서버 코드 없이 브라우저에서만 동작하도록 만들어야 합니다.
  이 앱은 원래 그렇게 설계돼 있으니 그대로 두면 됩니다.
- 저장소를 **공개**로 두면 모르는 사람이 요청을 보내 할당량을 소진시킬 수 있습니다.
  5단계의 App Check를 함께 켜거나, fork본을 비공개로 두세요. (비공개여도 Vercel 배포는 됩니다.)

---

## 1. Firebase 프로젝트 만들기

1. [console.firebase.google.com](https://console.firebase.google.com) 접속 (구글 계정으로 로그인)
2. **프로젝트 추가** → 이름은 아무거나 (예: `우리반-3학년2반`)
3. Google 애널리틱스는 **사용 안 함**으로 두어도 됩니다
4. 프로젝트가 만들어지면 **빌드 → Firestore Database → 데이터베이스 만들기**
   - 위치는 `asia-northeast3 (서울)`
   - **프로덕션 모드로 시작**을 고르세요 (규칙은 4단계에서 넣습니다)
5. **빌드 → Authentication → 시작하기 → 이메일/비밀번호** 사용 설정

## 2. 웹 앱 등록하고 설정값 복사

1. 프로젝트 개요 옆 **⚙️ → 프로젝트 설정**
2. 아래로 내려 **내 앱 → 웹(`</>`)** 아이콘 클릭
3. 앱 닉네임 아무거나 입력 → **앱 등록**
4. 나오는 코드에서 `firebaseConfig` 부분을 **통째로 복사**해 둡니다

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "....firebaseapp.com",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## 3. AI 스튜디오에서 코드 붙이기

fork한 저장소를 AI 스튜디오로 연 뒤, **아래 내용을 그대로 붙여넣으세요.**

> 이 프로젝트에 Firebase Firestore 동기화를 추가해 줘. 다음 조건을 반드시 지켜:
>
> 1. `src/shared/storage/firebaseConfig.ts` 파일 **하나만** 새로 만들고, 거기에 내 Firebase 설정값을 넣어. 설정값을 다른 파일에 흩어 놓지 마.
> 2. `src/shared/storage/FirestoreAdapter.ts`를 만들어. 이미 있는 `src/shared/storage/StorageAdapter.ts` 인터페이스를 **그대로 구현**해야 해. 인터페이스를 바꾸지 마.
> 3. `src/features/` 아래 파일은 **한 줄도 고치지 마.** 화면 코드는 어댑터만 알고 있어야 해.
> 4. `src/main.tsx`에서 `SuiteDataProvider`에 어댑터를 넘길 때, Firebase 설정이 채워져 있으면 `FirestoreAdapter`를, 비어 있으면 지금처럼 `LocalStorageAdapter`를 쓰도록 해. 설정이 없어도 앱이 그대로 동작해야 해.
> 5. Firestore 경로는 `teachers/{uid}/suite/data` 한 문서에 `SuiteData` 전체를 저장하는 방식으로 해. 문서 1MB 제한이 있으니, 저장 직전에 크기를 재서 900KB를 넘으면 사용자에게 알림을 띄우고 저장은 계속 진행해.
> 6. 로그인은 이메일/비밀번호로 하고, 로그인 화면을 `/login` 경로에 만들어. 로그인하지 않으면 `LocalStorageAdapter`로 동작하게 해.
> 7. Cloud Functions는 쓰지 마. 무료 요금제에서 배포할 수 없어.
> 8. 다 만든 뒤 `npm run verify`를 실행해서 타입 검사·테스트·빌드가 모두 통과하는지 확인해.

작업이 끝나면 `firebaseConfig.ts`에 2단계에서 복사한 값을 채워 넣으세요.

## 4. 보안 규칙 넣기 — 건너뛰지 마세요

Firebase 콘솔 **Firestore Database → 규칙** 탭에 아래를 **그대로** 붙여넣고 **게시**하세요.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 내 자료는 나만 읽고 쓴다. 그 외에는 전부 막는다.
    match /teachers/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

이 규칙이 실제 자물쇠입니다. 학생 이름이 담기는 자료이므로 반드시 넣으세요.

> **주의:** 인터넷에서 본 규칙 중 `allow read, write: if request.auth != null;`처럼
> 로그인만 확인하는 것이 있습니다. 그건 **로그인한 누구나 남의 자료를 볼 수 있다**는 뜻입니다.
> 위의 `request.auth.uid == uid` 부분이 반드시 있어야 합니다.

## 5. App Check 켜기 (저장소를 공개로 둔 경우)

1. Firebase 콘솔 **빌드 → App Check**
2. 웹 앱 선택 → **reCAPTCHA v3** 등록
3. AI 스튜디오에 이어서 요청:

> App Check를 reCAPTCHA v3로 초기화하는 코드를 `firebaseConfig.ts`에 추가해 줘. 사이트 키는 내가 채울 수 있게 상수로 빼 줘.

## 6. 커밋하고 배포

```bash
git add -A
git commit -m "feat: Firebase 동기화 추가"
git push
```

Vercel이 자동으로 다시 배포합니다. 배포가 끝나면 `/login`에서 계정을 만들고 로그인하세요.

---

## 잘 됐는지 확인하기

- [ ] 로그인 후 학급을 만들고 새로고침해도 자료가 남아 있다
- [ ] 다른 브라우저(또는 휴대폰)에서 같은 계정으로 로그인하면 같은 자료가 보인다
- [ ] 로그아웃하면 이 브라우저에만 저장되는 모드로 돌아간다
- [ ] Firebase 콘솔 → Firestore에 `teachers/{내 uid}/suite/data` 문서가 보인다

## 막혔을 때

| 증상 | 확인할 것 |
|---|---|
| `Missing or insufficient permissions` | 4단계 보안 규칙을 게시했는지 |
| 로그인이 안 됨 | 1단계에서 이메일/비밀번호 로그인을 켰는지 |
| 자료가 동기화되지 않음 | `firebaseConfig.ts`에 값이 채워져 있는지, 로그인했는지 |
| 배포 후 흰 화면 | Vercel 배포 로그에서 빌드 오류 확인. `npm run verify`가 로컬에서 통과하는지 |

---

## 여러 기기에서 함께 쓸 때

앱은 다른 창·기기의 변경을 **구독해서 바로 화면에 반영합니다.**
교실 PC에서 점수를 주면 노트북 화면도 따라 바뀝니다.

그래서 `FirestoreAdapter`를 만들 때 `subscribe`를 **반드시 함께 구현해야 합니다.**
이것을 빠뜨리면 전자칠판이 수업 중에 따라오지 않고,
한 창의 저장이 다른 창의 변경을 조용히 덮습니다.

```ts
subscribe(listener: (data: SuiteData) => void): () => void {
  return onSnapshot(this.docRef, (snapshot) => {
    // Firestore는 자기가 쓴 것도 되돌려 준다. 이것을 거르지 않으면
    // 저장할 때마다 자기 자신을 되받아 무한 반영이 일어난다.
    if (snapshot.metadata.hasPendingWrites) return;

    const raw = snapshot.data();
    if (raw === undefined) return;

    listener(parseSuiteData(raw).data);
  });
}
```

문서가 `teachers/{uid}/suite/data` **하나뿐**이라 리스너도 하나입니다.
무료 한도를 걱정하지 않아도 됩니다.

**남는 한계:** 거의 같은 순간에 양쪽에서 같은 것을 고치면 마지막에 저장한 쪽이 이깁니다.
상대 변경이 즉시 화면에 뜨므로 바로 알아차릴 수 있습니다.

설계 근거: [`superpowers/specs/2026-08-13-cross-window-sync-design.md`](superpowers/specs/2026-08-13-cross-window-sync-design.md)
