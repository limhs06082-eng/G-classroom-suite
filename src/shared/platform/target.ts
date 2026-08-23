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
 * `VITE_TARGET`은 빌드 때 글자로 치환되므로, 아래 분기 중 안 쓰는 쪽은
 * 번들에서 통째로 사라진다. 설치형 바이너리에 웹 전용 코드가,
 * 웹 번들에 Tauri 코드가 들어가지 않는 근거가 이것이다.
 *
 * 값이 없으면 웹이다. 설정 없이 fork해 배포하는 것이 기본 흐름이다.
 */
export const TARGET: 'web' | 'desktop' = resolveTarget(import.meta.env.VITE_TARGET);

export function isDesktop(): boolean {
  return TARGET === 'desktop';
}
