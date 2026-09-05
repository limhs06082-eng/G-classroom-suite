import { AI_PROVIDERS, type AiConfig, type AiProvider } from './providers';

/**
 * AI 설정 — 회사·키·모델. **이 컴퓨터에만** 산다.
 *
 * 학급 자료(SuiteData)와 백업에는 절대 넣지 않는다. 백업 파일은 USB와
 * 메일로 오가는데, 거기에 교사 개인의 결제 키가 실리면 안 된다. NEIS 키와
 * 같은 원칙이다.
 */
export const AI_CONFIG_STORAGE = 'classroom-suite:v1:ai-config';

export type { AiConfig, AiProvider };

export function defaultModelFor(provider: AiProvider): string {
  return AI_PROVIDERS.find((item) => item.id === provider)?.defaultModel ?? '';
}

function isProvider(value: unknown): value is AiProvider {
  return AI_PROVIDERS.some((item) => item.id === value);
}

/** 키가 없거나 깨졌으면 null. 모델이 비어 있으면 기본 모델. */
export function readAiConfig(): AiConfig | null {
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const provider = record['provider'];
    const apiKey = typeof record['apiKey'] === 'string' ? record['apiKey'].trim() : '';
    if (!isProvider(provider) || apiKey === '') return null;
    const model = typeof record['model'] === 'string' ? record['model'].trim() : '';
    return { provider, apiKey, model: model === '' ? defaultModelFor(provider) : model };
  } catch {
    return null;
  }
}

export function saveAiConfig(config: AiConfig): void {
  try {
    window.localStorage.setItem(
      AI_CONFIG_STORAGE,
      JSON.stringify({
        provider: config.provider,
        apiKey: config.apiKey.trim(),
        model: config.model.trim(),
      }),
    );
  } catch {
    // 저장이 안 되는 환경이면 이 세션 동안만 쓰인다.
  }
}

export function clearAiConfig(): void {
  try {
    window.localStorage.removeItem(AI_CONFIG_STORAGE);
  } catch {
    // 무시
  }
}

export function hasAiConfig(): boolean {
  return readAiConfig() !== null;
}
