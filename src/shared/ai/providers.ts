/**
 * 회사별 요청 모양과 응답 파싱 — 순수 함수.
 *
 * 세 회사의 API는 서로 다르지만 우리가 쓰는 것은 "시스템 규칙 + 사용자
 * 글 → 글 하나"뿐이다. 그 차이를 여기 가두고, 나머지 코드는 회사를 모른다.
 * 모델 이름은 기본값만 두고 설정에서 고치게 한다 — 회사들이 이름을 자주
 * 바꾸는데, 그때마다 새 판을 내게 하지 않는다.
 */

export type AiProvider = 'gemini' | 'openai' | 'anthropic';

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

export interface AiProviderInfo {
  id: AiProvider;
  label: string;
  defaultModel: string;
  /** 키 입력칸 아래 안내 */
  keyHint: string;
  /** 설치형 capabilities에 적힌 허용 주소. 검사 스크립트와 같아야 한다. */
  host: string;
}

export const AI_PROVIDERS: readonly AiProviderInfo[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    keyHint: 'Google AI Studio에서 만든 키 (AIza…)',
    host: 'https://generativelanguage.googleapis.com',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    keyHint: 'platform.openai.com의 API 키 (sk-…)',
    host: 'https://api.openai.com',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    defaultModel: 'claude-sonnet-5',
    keyHint: 'console.anthropic.com의 API 키 (sk-ant-…)',
    host: 'https://api.anthropic.com',
  },
];

export interface AiPrompt {
  system: string;
  user: string;
}

export interface AiRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

const MAX_OUTPUT_TOKENS = 800;

export function requestFor(config: AiConfig, prompt: AiPrompt): AiRequest {
  switch (config.provider) {
    case 'gemini':
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
        headers: { 'x-goog-api-key': config.apiKey },
        body: {
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: MAX_OUTPUT_TOKENS },
        },
      };
    case 'openai':
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: {
          model: config.model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          temperature: 0.5,
          max_tokens: MAX_OUTPUT_TOKENS,
        },
      };
    case 'anthropic':
      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          // 브라우저(웹 판)에서 직접 부를 때 Anthropic이 요구하는 머리. 키는 교사 개인 것이다.
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: {
          model: config.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: prompt.system,
          messages: [{ role: 'user', content: prompt.user }],
        },
      };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function firstText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** 응답에서 글을 꺼낸다. 모양이 다르면 null — 오류 본문일 때가 대부분이다. */
export function textFrom(provider: AiProvider, json: unknown): string | null {
  if (!isRecord(json)) return null;

  switch (provider) {
    case 'gemini': {
      const candidate = Array.isArray(json['candidates']) ? json['candidates'][0] : undefined;
      const content = isRecord(candidate) ? candidate['content'] : undefined;
      const parts = isRecord(content) && Array.isArray(content['parts']) ? content['parts'] : [];
      const texts = parts.flatMap((part) => (isRecord(part) ? [firstText(part['text'])] : []));
      const joined = texts.filter((text): text is string => text !== null).join('');
      return joined === '' ? null : joined;
    }
    case 'openai': {
      const choice = Array.isArray(json['choices']) ? json['choices'][0] : undefined;
      const message = isRecord(choice) ? choice['message'] : undefined;
      return isRecord(message) ? firstText(message['content']) : null;
    }
    case 'anthropic': {
      const blocks = Array.isArray(json['content']) ? json['content'] : [];
      const texts = blocks.flatMap((block) =>
        isRecord(block) && block['type'] === 'text' ? [firstText(block['text'])] : [],
      );
      const joined = texts.filter((text): text is string => text !== null).join('');
      return joined === '' ? null : joined;
    }
  }
}

/** 응답에서 오류 문구를 꺼낸다. 없으면 null. */
export function errorMessageFrom(json: unknown): string | null {
  if (!isRecord(json)) return null;
  const error = json['error'];
  if (typeof error === 'string') return error;
  if (isRecord(error) && typeof error['message'] === 'string') return error['message'];
  return null;
}

/**
 * 나이스에 그대로 붙일 수 있게 다듬는다 — 머리말·따옴표를 걷고, 줄바꿈은
 * 한 칸 띄어쓰기로. 생활기록부 칸은 한 단락이다.
 */
export function cleanComment(text: string): string {
  return text
    .replace(/^\s*(?:행동특성\s*및\s*종합의견|행동특성|종합의견)\s*[:：]\s*/u, '')
    .trim()
    .replace(/^["“'‘]+|["”'’]+$/gu, '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
