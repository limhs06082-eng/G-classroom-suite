/**
 * 고유 id.
 *
 * factories.ts 안에 있던 것을 여기로 뺐다. id를 만드는 일은 엔티티를 만드는
 * 일과 다르고, 2단계 도구함에서 옮겨 온 코드도 이 경로를 쓴다.
 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 구형 브라우저 폴백. 충돌 가능성은 학급 규모에서 무시할 수 있다.
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
