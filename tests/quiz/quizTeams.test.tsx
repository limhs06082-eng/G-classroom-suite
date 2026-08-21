import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useQuiz, type QuizView } from '../../src/features/quiz/useQuiz';
import { createQuestion, createQuizSet, createEmptySuiteData } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

function seeded(): SuiteData {
  const set = createQuizSet({
    id: 'set-1',
    title: '3단원 확인',
    questions: [
      createQuestion({
        id: 'q-1',
        type: 'ox',
        text: '지구는 둥글다',
        answer: 'O',
      }),
    ],
  });

  return { ...createEmptySuiteData(), quizSets: [set] };
}

/** 훅을 화면 없이 들여다본다. */
let view: QuizView | null = null;

function Probe() {
  view = useQuiz();
  return <p data-testid="teams">{view.savedTeams.join(',')}</p>;
}

async function mount(): Promise<void> {
  view = null;
  render(
    <ToastProvider>
      <SuiteDataProvider
        adapter={stubAdapter({
          load: async () => ({ data: seeded(), repairs: [], isFirstRun: false }),
        })}
      >
        <Probe />
      </SuiteDataProvider>
    </ToastProvider>,
  );

  await screen.findByTestId('teams');
}

const current = (): QuizView => {
  if (view === null) throw new Error('훅이 아직 안 붙었다');
  return view;
};

describe('퀴즈 모둠 설정', () => {
  it('한 번도 안 정했으면 기본 넷을 쓴다', async () => {
    await mount();

    expect(current().savedTeams).toEqual(['1모둠', '2모둠', '3모둠', '4모둠']);
    expect(current().isTeamsLocked).toBe(false);
  });

  it('모둠을 바꾸면 저장된다', async () => {
    await mount();

    await act(async () => {
      current().setTeams(['독수리', '호랑이', '거북이', '토끼', '여우', '사슴']);
    });

    expect(screen.getByTestId('teams').textContent).toBe(
      '독수리,호랑이,거북이,토끼,여우,사슴',
    );
  });

  it('저장할 때 빈 이름과 중복을 다듬는다', async () => {
    await mount();

    await act(async () => {
      current().setTeams(['독수리', '  ', '독수리']);
    });

    // 이름 없는 모둠은 칠판에서 누를 수 없고, 같은 이름이 둘이면 점수가 섞인다.
    expect(current().savedTeams).toEqual(['독수리', '2모둠', '독수리 (2)']);
  });

  it('저장한 모둠으로 퀴즈가 시작된다', async () => {
    await mount();

    await act(async () => {
      current().setTeams(['가', '나', '다']);
    });
    await act(async () => {
      current().startRun('set-1');
    });

    expect(current().teams).toEqual(['가', '나', '다']);
    expect(current().run?.teams).toEqual(['가', '나', '다']);
  });

  it('진행 중에는 모둠이 잠기고 바뀌지 않는다', async () => {
    await mount();

    await act(async () => {
      current().startRun('set-1');
    });

    expect(current().isTeamsLocked).toBe(true);

    await act(async () => {
      current().setTeams(['바뀔까', '안바뀜']);
    });

    /*
     * 팀 이름이 correctTeamsByQuestion의 열쇠다. 도중에 바꾸면 앞 문제에서
     * 맞힌 기록이 어느 팀 것인지 알 수 없게 된다.
     */
    expect(current().savedTeams).toEqual(['1모둠', '2모둠', '3모둠', '4모둠']);
    expect(current().teams).toEqual(['1모둠', '2모둠', '3모둠', '4모둠']);
  });

  it('진행을 멈추면 다시 바꿀 수 있다', async () => {
    await mount();

    await act(async () => {
      current().startRun('set-1');
    });
    await act(async () => {
      current().stopRun();
    });

    expect(current().isTeamsLocked).toBe(false);

    await act(async () => {
      current().setTeams(['가', '나']);
    });

    expect(current().savedTeams).toEqual(['가', '나']);
  });
});
