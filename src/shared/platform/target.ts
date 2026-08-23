/**
 * 값 하나를 빌드 대상으로 옮긴다.
 *
 * 이 함수를 따로 두는 이유는 시험할 수 있게 하기 위해서다. TARGET을 바로
 * 만들면 그 값이 빌드 때 글자로 박혀서, 시험이 도는 동안에는 늘 'web'이다.
 * 그러면 설치형 갈래가 통째로 깨져도 시험은 통과한다.
 */
export function resolveTarget(raw: string | undefined): 'web' | 'desktop' {
  return raw === 'desktop' ? 'desktop' : 'web';
}

/**
 * 지금 웹인가 설치형인가.
 *
 * 이 판단을 여기 한 곳에만 둔다. 화면마다 `import.meta.env`를 읽으면
 * 나중에 조건이 바뀔 때 고치다 빠뜨리는 곳이 생긴다.
 *
 * ## 화면을 가르는 분기에는 isDesktop(), 청크를 가르는 분기에는 리터럴
 *
 * 예전 버전의 이 문서는 "안 쓰는 쪽은 번들에서 통째로 사라진다"고
 * 적었다. 무엇을 렌더할지·어느 API를 부를지를 가르는 보통 if/삼항에는
 * 맞는 말이지만, `lazy()`나 `import()`로 청크 자체를 만드는 분기에는
 * 틀렸다 — Task 6·8에서 실제 빌드 산출물로 깨졌고, 그 결과 `router.tsx`
 * (quiz·join 조건부 라우트)와 `BoardPage.tsx`(QuizBoard 선택)는 규칙을
 * 어기고 `isDesktop()` 대신 `import.meta.env.VITE_TARGET === 'desktop'`을
 * 직접 쓴다.
 *
 * 이유는 이렇다. `VITE_TARGET`은 빌드 때 각 파일 안에서 글자 그대로
 * 치환된다 — target.ts에서도, 그걸 직접 쓰는 다른 파일에서도 각자.
 * 하지만 `isDesktop()`은 그 치환된 값을 돌려주는 함수 **호출**이다.
 * 호출하는 쪽 파일이 target.ts와 다른 청크로 갈리면(예: 여러 lazy
 * 라우트가 함께 쓰는 공유 모듈), 그 호출은 청크 경계를 넘는 참조가
 * 되고 Rollup은 함수 몸통을 건너 값을 상수로 접지 못한다. 그러면 안
 * 쓰는 쪽의 if 분기가 죽은 코드로 지워지지 않고 런타임 검사로 남고,
 * 그 안의 `lazy()`/`import()`가 청크로 그대로 나와 실제 번들에 실린다
 * — "안 쓰는 코드는 사라진다"는 전제가 깨지는 자리다.
 *
 * 그래서 규칙은 무엇을 가르느냐로 정한다.
 *
 *   - 렌더링·분기 로직처럼 **화면을 가르는 분기**는 `isDesktop()`을
 *     쓴다. 함수 호출로 남아도 상관없다 — 런타임에 한 번 갈리는 if일
 *     뿐, 어느 코드가 어느 청크에 실리는지에는 영향을 주지 않는다.
 *   - 그 분기 안에 `lazy()`나 `import()`가 있어서 안 쓰는 쪽의 **청크
 *     자체가 번들에서 빠져야** 한다면 `isDesktop()`을 쓰면 안 된다.
 *     `import.meta.env.VITE_TARGET === 'desktop'`을 그 자리에 직접
 *     쓴다. `router.tsx`의 조건부 라우트가 실물 예제다 — 그 파일 안
 *     주석에 이 이유가 다시 설명되어 있다.
 *
 * 헷갈리거나 깜빡했을 때를 위한 안전망은 `scripts/check-bundle-purity.mjs`다.
 * 빌드 산출물을 직접 열어 안 쓰는 쪽 청크가 실제로 빠졌는지(웹) /
 * 필요한 쪽이 실제로 실렸는지(설치형) 확인한다. `npm run verify`가
 * 매번 돌린다.
 *
 * 값이 없으면 웹이다. 설정 없이 fork해 배포하는 것이 기본 흐름이다.
 */
export const TARGET: 'web' | 'desktop' = resolveTarget(import.meta.env.VITE_TARGET);

export function isDesktop(): boolean {
  return TARGET === 'desktop';
}
