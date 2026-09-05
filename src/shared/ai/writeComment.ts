import { buildCommentPrompt, type CommentFacts } from './commentPrompt';
import { cleanComment, errorMessageFrom, requestFor, textFrom, type AiConfig } from './providers';
import { postJson, type PostResult } from './transport';

export type PostFn = (url: string, headers: Record<string, string>, body: unknown) => Promise<PostResult>;

export type WriteResult = { ok: true; text: string } | { ok: false; error: string };

/** 상태 코드를 사람 말로. 회사가 준 문구가 있으면 뒤에 붙인다. */
function describeFailure(status: number, json: unknown): string {
  const detail = errorMessageFrom(json);
  // 회사가 오류 문구에 키 조각을 되돌려 줄 때가 있다. 화면에 띄우는 글이니 가린다.
  const masked = detail === null ? null : detail.replace(/\b(sk-|AIza)\S+/g, '$1…');
  const tail = masked === null ? '' : ` (${masked.slice(0, 120)})`;
  if (status === 401 || status === 403) return `API 키가 맞지 않거나 권한이 없습니다. 설정에서 키를 확인해 주세요.${tail}`;
  if (status === 404) return `모델 이름을 찾을 수 없습니다. 설정에서 모델을 확인해 주세요.${tail}`;
  if (status === 429) return `요청이 너무 잦거나 사용량이 찼습니다. 잠시 뒤 다시 해 주세요.${tail}`;
  return `AI 서버가 요청을 거절했습니다 (${status}).${tail}`;
}

/** 사실 → AI 글. 실패는 던지지 않고 돌려준다 — 서른 명을 돌리다 한 명에서 멈추면 안 된다. */
export async function writeCommentWithAi(
  facts: CommentFacts,
  config: AiConfig,
  post: PostFn = postJson,
): Promise<WriteResult> {
  const request = requestFor(config, buildCommentPrompt(facts));

  let result: PostResult;
  try {
    result = await post(request.url, request.headers, request.body);
  } catch {
    return { ok: false, error: 'AI 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.' };
  }

  if (result.status >= 400) return { ok: false, error: describeFailure(result.status, result.json) };

  const text = textFrom(config.provider, result.json);
  const cleaned = text === null ? '' : cleanComment(text);
  if (cleaned === '') {
    return { ok: false, error: 'AI 응답을 읽지 못했습니다. 설정의 모델 이름을 확인해 주세요.' };
  }
  return { ok: true, text: cleaned };
}

/** [연결 확인] — 아주 짧은 요청 하나로 키·모델이 맞는지 본다. */
export async function pingAi(config: AiConfig, post: PostFn = postJson): Promise<WriteResult> {
  const request = requestFor(config, {
    system: '한 단어로만 답하세요.',
    user: '연결 확인입니다. "확인"이라고 답해 주세요.',
  });

  let result: PostResult;
  try {
    result = await post(request.url, request.headers, request.body);
  } catch {
    return { ok: false, error: 'AI 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.' };
  }
  if (result.status >= 400) return { ok: false, error: describeFailure(result.status, result.json) };
  const text = textFrom(config.provider, result.json);
  return text === null
    ? { ok: false, error: '응답은 왔는데 글을 읽지 못했습니다. 모델 이름을 확인해 주세요.' }
    : { ok: true, text: cleanComment(text) };
}
