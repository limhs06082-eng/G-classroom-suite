import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AI_CONFIG_STORAGE, saveAiConfig } from '../../src/shared/ai/aiSettings';
import { postJson } from '../../src/shared/ai/transport';
import {
  createClassRoom,
  createEmptySuiteData,
  createObservation,
  createStudent,
  createTerm,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import CommentsPage from '../../src/shared/roster/CommentsPage';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

vi.mock('../../src/shared/ai/transport', () => ({ postJson: vi.fn() }));
const post = vi.mocked(postJson);

const NOW = '2026-03-02T09:00:00.000Z';

function seeded(): SuiteData {
  const term = createTerm(
    { id: 'term-1', schoolYear: '2026', semester: '1학기', startDate: '2026-03-02', endDate: '2026-07-20' },
    NOW,
  );
  const room = createClassRoom({ id: 'class-1', termId: 'term-1', name: '우리 반' }, NOW);
  return {
    ...createEmptySuiteData(),
    terms: [term],
    classRooms: [room],
    students: [
      createStudent({ id: 'stu-1', classId: 'class-1', number: 1, name: '김하나' }, NOW),
      createStudent({ id: 'stu-2', classId: 'class-1', number: 2, name: '이두리' }, NOW),
    ],
    observations: [
      createObservation({ classId: 'class-1', studentId: 'stu-1', text: '발표를 잘했다', date: '2026-04-01' }, NOW),
      createObservation({ classId: 'class-1', studentId: 'stu-2', text: '청소를 열심히 한다', date: '2026-04-02' }, NOW),
    ],
    activeTermId: 'term-1',
    activeClassId: 'class-1',
  };
}

function show(): void {
  render(
    <MemoryRouter initialEntries={['/roster/comments']}>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({ load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }) })}
        >
          <Routes>
            <Route path="roster/comments" element={<CommentsPage />} />
          </Routes>
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

function box(name: string): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: `${name} 행동특성 및 종합의견` }) as HTMLTextAreaElement;
}

beforeEach(() => {
  post.mockReset();
  window.localStorage.removeItem(AI_CONFIG_STORAGE);
});

describe('학급 전체 행동특성 및 종합의견', () => {
  it('학생마다 글상자가 있고, [모두 초안 넣기]는 빈 학생만 채운다', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('heading', { name: /행동특성 및 종합의견/ });

    await user.click(box('김하나'));
    await user.keyboard('내가 쓴 글.');
    await user.tab();

    await user.click(screen.getByRole('button', { name: '모두 초안 넣기' }));

    expect(box('김하나')).toHaveValue('내가 쓴 글.');
    expect(box('이두리')).toHaveValue('청소를 열심히 한다.');
    expect(screen.getByText(/작성 2 \/ 2/)).toBeInTheDocument();
  });

  it('키가 없으면 AI 단추가 설정을 가리키고, 키를 넣으면 [AI로 모두 작성]이 빈 학생을 차례로 채운다', async () => {
    const user = userEvent.setup();
    saveAiConfig({ provider: 'openai', apiKey: 'sk-1', model: 'gpt-4o-mini' });
    post
      .mockResolvedValueOnce({ status: 200, json: { choices: [{ message: { content: '성실하고 밝음.' } }] } })
      .mockResolvedValueOnce({ status: 429, json: {} });
    show();
    await screen.findByRole('heading', { name: /행동특성 및 종합의견/ });

    await user.click(screen.getByRole('button', { name: 'AI로 모두 작성' }));

    await waitFor(() => expect(box('김하나')).toHaveValue('성실하고 밝음.'));
    // 둘째는 429 — 그 학생만 비고, 알림이 뜬다. 첫째 글은 그대로다.
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(box('이두리')).toHaveValue('');
    expect(await screen.findByText(/잠시/)).toBeInTheDocument();

    // 보낸 본문에 학생 이름이 없다.
    const bodies = post.mock.calls.map((call) => JSON.stringify(call[2]));
    for (const body of bodies) {
      expect(body).not.toContain('김하나');
      expect(body).not.toContain('이두리');
    }
    expect(bodies[0]).toContain('발표를 잘했다');
  });

  it('한 학생만 AI로 쓰고, 글이 있으면 묻는다', async () => {
    const user = userEvent.setup();
    saveAiConfig({ provider: 'gemini', apiKey: 'g-1', model: 'gemini-2.5-flash' });
    post.mockResolvedValue({
      status: 200,
      json: { candidates: [{ content: { parts: [{ text: '차분하고 꼼꼼함.' }] } }] },
    });
    show();
    await screen.findByRole('heading', { name: /행동특성 및 종합의견/ });

    const row = screen.getByRole('textbox', { name: '이두리 행동특성 및 종합의견' }).closest('li');
    if (row === null) throw new Error('row');
    await user.click(within(row).getByRole('button', { name: '이두리 AI로 작성' }));
    await waitFor(() => expect(box('이두리')).toHaveValue('차분하고 꼼꼼함.'));

    await user.click(within(row).getByRole('button', { name: '이두리 AI로 작성' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'AI 글로 바꾸기' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  });
});
