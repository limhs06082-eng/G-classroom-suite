/**
 * AI 다듬기 호출.
 *
 * 키는 이 브라우저에만 둔다. 내보내기(백업 파일)에도 들어가지 않는다.
 * 서버로는 요청할 때만 실려 가고 저장되지 않는다.
 */

export const GEMINI_KEY_STORAGE = 'teacher-toolkit:v1:gemini-key';

export type RefineResult = { ok: true; text: string } | { ok: false; error: string };

function readKey(): string {
  try {
    return (window.localStorage.getItem(GEMINI_KEY_STORAGE) ?? '').trim();
  } catch {
    return '';
  }
}

export function hasGeminiKey(): boolean {
  return readKey() !== '';
}

export function saveGeminiKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (trimmed === '') window.localStorage.removeItem(GEMINI_KEY_STORAGE);
    else window.localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
  } catch {
    // 저장이 막혀 있으면 이번 세션에서만 못 쓴다. 앱 자체는 계속 동작한다.
  }
}

export async function refineText(
  text: string,
  options: { tone?: string; length?: string } = {},
): Promise<RefineResult> {
  const apiKey = readKey();
  if (apiKey === '') {
    return { ok: false, error: 'Gemini API 키가 없습니다. 설정 화면에서 넣어 주세요.' };
  }

  try {
    const response = await fetch('/api/refine', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        apiKey,
        tone: options.tone ?? 'polite',
        length: options.length ?? 'normal',
      }),
    });

    const payload = (await response.json()) as { text?: string; error?: string };

    if (!response.ok || typeof payload.text !== 'string') {
      return { ok: false, error: payload.error ?? '문장을 다듬지 못했습니다.' };
    }
    return { ok: true, text: payload.text };
  } catch {
    /*
     * 개발 서버(vite)에는 /api 함수가 없다. 그때도 앱이 멈추면 안 되므로
     * 실패를 알리고 원래 문구를 그대로 둔다.
     */
    return { ok: false, error: '다듬기 기능에 연결하지 못했습니다. 배포된 주소에서 다시 시도해 주세요.' };
  }
}
