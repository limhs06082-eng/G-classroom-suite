import { describe, expect, it } from 'vitest';

import { AI_PROVIDERS, cleanComment, requestFor, textFrom } from '../../src/shared/ai/providers';

const PROMPT = { system: '규칙', user: '사실' };

describe('requestFor — 회사별 요청 모양', () => {
  it('Gemini는 주소에 모델, 머리에 키', () => {
    const req = requestFor({ provider: 'gemini', apiKey: 'K1', model: 'gemini-2.5-flash' }, PROMPT);

    expect(req.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    expect(req.headers['x-goog-api-key']).toBe('K1');
    expect(JSON.stringify(req.body)).toContain('사실');
    expect(JSON.stringify(req.body)).toContain('규칙');
  });

  it('OpenAI는 Bearer 키와 messages', () => {
    const req = requestFor({ provider: 'openai', apiKey: 'K2', model: 'gpt-4o-mini' }, PROMPT);

    expect(req.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(req.headers['Authorization']).toBe('Bearer K2');
    const body = req.body as { model: string; messages: { role: string; content: string }[] };
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages.map((m) => m.role)).toEqual(['system', 'user']);
  });

  it('Anthropic은 x-api-key와 브라우저 직접 호출 머리, system 칸', () => {
    const req = requestFor({ provider: 'anthropic', apiKey: 'K3', model: 'claude-sonnet-5' }, PROMPT);

    expect(req.url).toBe('https://api.anthropic.com/v1/messages');
    expect(req.headers['x-api-key']).toBe('K3');
    expect(req.headers['anthropic-version']).toBeTruthy();
    expect(req.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    const body = req.body as { model: string; system: string; max_tokens: number };
    expect(body.system).toBe('규칙');
    expect(body.max_tokens).toBeGreaterThan(0);
  });

  it('회사 목록에는 셋이 있고 기본 모델이 비어 있지 않다', () => {
    expect(AI_PROVIDERS.map((p) => p.id)).toEqual(['gemini', 'openai', 'anthropic']);
    for (const provider of AI_PROVIDERS) expect(provider.defaultModel).not.toBe('');
  });
});

describe('textFrom — 응답에서 글 꺼내기', () => {
  it('세 회사의 응답 모양을 안다', () => {
    expect(
      textFrom('gemini', { candidates: [{ content: { parts: [{ text: '성실함.' }] } }] }),
    ).toBe('성실함.');
    expect(textFrom('openai', { choices: [{ message: { content: '밝음.' } }] })).toBe('밝음.');
    expect(textFrom('anthropic', { content: [{ type: 'text', text: '꼼꼼함.' }] })).toBe('꼼꼼함.');
  });

  it('엉뚱한 모양이면 null', () => {
    expect(textFrom('gemini', { error: { message: 'x' } })).toBeNull();
    expect(textFrom('openai', null)).toBeNull();
    expect(textFrom('anthropic', { content: [] })).toBeNull();
  });
});

describe('cleanComment — 붙여 넣을 수 있게', () => {
  it('따옴표·머리말·줄바꿈을 걷어낸다', () => {
    expect(cleanComment('"성실하고 밝음."')).toBe('성실하고 밝음.');
    expect(cleanComment('행동특성 및 종합의견: 성실함.\n\n친구를 도움.')).toBe('성실함. 친구를 도움.');
    expect(cleanComment('  꼼꼼함.  ')).toBe('꼼꼼함.');
  });
});
