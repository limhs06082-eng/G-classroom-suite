/** 조건부 클래스 결합. clsx를 쓸 만큼 복잡하지 않아 직접 둔다. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
