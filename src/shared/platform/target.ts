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
export const TARGET: 'web' | 'desktop' =
  import.meta.env.VITE_TARGET === 'desktop' ? 'desktop' : 'web';

export function isDesktop(): boolean {
  return TARGET === 'desktop';
}
