import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AI_CONFIG_STORAGE,
  clearAiConfig,
  defaultModelFor,
  readAiConfig,
  saveAiConfig,
} from '../../src/shared/ai/aiSettings';
import { writeCommentWithAi } from '../../src/shared/ai/writeComment';

beforeEach(() => {
  window.localStorage.removeItem(AI_CONFIG_STORAGE);
});

/*
 * 키는 이 컴퓨터에만 산다. 백업(SuiteData)에는 절대 안 들어간다 — 그래서
 * localStorage이고, 그래서 여기서만 검사한다.
 */
describe('AI 설정 — 이 기기에만', () => {
  it('저장했다 읽으면 그대로고, 지우면 null이다', () => {
    saveAiConfig({ provider: 'openai', apiKey: 'sk-1', model: 'gpt-4o-mini' });
    expect(readAiConfig()).toEqual({ provider: 'openai', apiKey: 'sk-1', model: 'gpt-4o-mini' });

    clearAiConfig();
    expect(readAiConfig()).toBeNull();
    expect(window.localStorage.getItem(AI_CONFIG_STORAGE)).toBeNull();
  });

  it('키가 비었거나 회사를 모르거나 깨진 값이면 null, 모델이 비면 기본 모델', () => {
    saveAiConfig({ provider: 'gemini', apiKey: '  ', model: '' });
    expect(readAiConfig()).toBeNull();

    window.localStorage.setItem(AI_CONFIG_STORAGE, JSON.stringify({ provider: 'bogus', apiKey: 'x' }));
    expect(readAiConfig()).toBeNull();

    window.localStorage.setItem(AI_CONFIG_STORAGE, '{not json');
    expect(readAiConfig()).toBeNull();

    saveAiConfig({ provider: 'gemini', apiKey: 'g-1', model: '   ' });
    expect(readAiConfig()?.model).toBe(defaultModelFor('gemini'));
  });
});

describe('writeCommentWithAi — 전송을 끼워 넣어 본다', () => {
  const facts = {
    attendance: 'perfect' as const,
    absentDays: 0,
    lateDays: 0,
    earlyDays: 0,
    fieldTripDays: 0,
    praise: [{ reason: '도움 주기', count: 2 }],
    dutyCount: 1,
    assignments: { total: 1, submitted: 1 },
    observations: [{ date: '2026-04-01', text: '친구를 도왔다' }],
  };
  const config = { provider: 'openai' as const, apiKey: 'sk-1', model: 'gpt-4o-mini' };

  it('응답 글을 다듬어 돌려준다', async () => {
    const post = vi.fn(async () => ({
      status: 200,
      json: { choices: [{ message: { content: '"친구를 잘 돕고 성실함."' } }] },
    }));

    const result = await writeCommentWithAi(facts, config, post);

    expect(result).toEqual({ ok: true, text: '친구를 잘 돕고 성실함.' });
    expect(post).toHaveBeenCalledOnce();
    // 이름은 애초에 facts에 없다. 보낸 본문에도 키 말고는 비밀이 없다.
    const [url, headers] = post.mock.calls[0] as unknown as [string, Record<string, string>];
    expect(url).toContain('openai.com');
    expect(headers['Authorization']).toBe('Bearer sk-1');
  });

  it('401·429·모양 이상·연결 실패를 사람 말로 돌려준다', async () => {
    expect(await writeCommentWithAi(facts, config, async () => ({ status: 401, json: {} }))).toEqual({
      ok: false,
      error: expect.stringContaining('키'),
    });
    expect(await writeCommentWithAi(facts, config, async () => ({ status: 429, json: {} }))).toEqual({
      ok: false,
      error: expect.stringContaining('잠시'),
    });
    expect(await writeCommentWithAi(facts, config, async () => ({ status: 200, json: { nope: 1 } }))).toEqual({
      ok: false,
      error: expect.stringContaining('응답'),
    });
    expect(
      await writeCommentWithAi(facts, config, async () => {
        throw new Error('offline');
      }),
    ).toEqual({ ok: false, error: expect.stringContaining('연결') });
  });
});
