import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useLesson, type LessonView } from '../../src/features/lesson/useLesson';
import { useQuiz, type QuizView } from '../../src/features/quiz/useQuiz';
import {
  createEmptySuiteData,
  createLessonTemplate,
  createQuestion,
  createQuizSet,
  createStage,
} from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider, useSuite } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

function seeded(): SuiteData {
  return {
    ...createEmptySuiteData(),
    lessonTemplates: [
      createLessonTemplate({
        id: 'tpl-1',
        title: '3단원 흐름',
        subject: '수학',
        stages: [createStage({ id: 'st-1', phase: 'intro', title: '동기 유발', minutes: 5 })],
      }),
    ],
    quizSets: [
      createQuizSet({
        id: 'set-1',
        title: '3단원 확인',
        subject: '',
        questions: [createQuestion({ id: 'q-1', type: 'ox', text: '지구는 둥글다', answer: 'O' })],
      }),
    ],
  };
}

let lessonView: LessonView | null = null;
let quizView: QuizView | null = null;

function Probe() {
  /*
   * 자료를 다 불러온 뒤에만 'ready'를 내건다.
   *
   * 처음에는 이 표시가 첫 렌더부터 있었다. 그러면 findByTestId가 곧바로
   * 통과해 버려서, 아래 훅 값들이 아직 안 채워진 채로 단언이 돌 수 있다.
   * 보통은 로드가 먼저 끝나 통과하지만 기계가 바쁘면 순서가 미끄러진다 —
   * 실제로 전체 시험을 돌리는 중에 세 번 그렇게 깨졌다.
   *
   * 기다리는 척이 아니라 진짜로 기다리게 한다.
   */
  const { isLoading } = useSuite();
  lessonView = useLesson();
  quizView = useQuiz();

  return isLoading ? null : <p data-testid="ready">ok</p>;
}

async function mount(): Promise<void> {
  lessonView = null;
  quizView = null;

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

  await screen.findByTestId('ready');
}

const lesson = (): LessonView => {
  if (lessonView === null) throw new Error('훅이 아직 안 붙었다');
  return lessonView;
};

const quiz = (): QuizView => {
  if (quizView === null) throw new Error('훅이 아직 안 붙었다');
  return quizView;
};

describe('수업 흐름 이름·과목', () => {
  it('이름을 고치면 저장된다', async () => {
    await mount();

    await act(async () => {
      lesson().renameTemplate('tpl-1', '4단원 흐름');
    });

    expect(lesson().templates[0]?.title).toBe('4단원 흐름');
  });

  it('빈 이름으로는 안 고친다', async () => {
    // 이름 없는 흐름은 목록에서 고를 수 없다.
    await mount();

    await act(async () => {
      lesson().renameTemplate('tpl-1', '   ');
    });

    expect(lesson().templates[0]?.title).toBe('3단원 흐름');
  });

  it('과목을 비우면 지워진다', async () => {
    // 이름과 규칙이 다르다. 과목이 없는 흐름이 정상이다.
    await mount();

    await act(async () => {
      lesson().setTemplateSubject('tpl-1', '');
    });

    expect(lesson().templates[0]?.subject).toBe('');
  });

  it('과목을 바꾸면 앞뒤 공백이 다듬어진다', async () => {
    await mount();

    await act(async () => {
      lesson().setTemplateSubject('tpl-1', '  과학  ');
    });

    expect(lesson().templates[0]?.subject).toBe('과학');
  });

  it('이름·과목을 고쳐도 단계는 그대로다', async () => {
    await mount();

    await act(async () => {
      lesson().renameTemplate('tpl-1', '바뀐 이름');
    });
    await act(async () => {
      lesson().setTemplateSubject('tpl-1', '사회');
    });

    expect(lesson().templates[0]?.stages).toHaveLength(1);
    expect(lesson().templates[0]?.stages[0]?.title).toBe('동기 유발');
  });
});

describe('문제 세트 이름·과목', () => {
  it('이름을 고치면 저장된다', async () => {
    await mount();

    await act(async () => {
      quiz().renameSet('set-1', '4단원 확인');
    });

    expect(quiz().sets[0]?.title).toBe('4단원 확인');
  });

  it('빈 이름으로는 안 고친다', async () => {
    await mount();

    await act(async () => {
      quiz().renameSet('set-1', '  ');
    });

    expect(quiz().sets[0]?.title).toBe('3단원 확인');
  });

  it('비어 있던 과목을 채울 수 있다', async () => {
    await mount();

    expect(quiz().sets[0]?.subject).toBe('');

    await act(async () => {
      quiz().setQuizSubject('set-1', '수학');
    });

    expect(quiz().sets[0]?.subject).toBe('수학');
  });

  it('이름·과목을 고쳐도 문제는 그대로다', async () => {
    await mount();

    await act(async () => {
      quiz().renameSet('set-1', '바뀐 이름');
    });
    await act(async () => {
      quiz().setQuizSubject('set-1', '과학');
    });

    expect(quiz().sets[0]?.questions).toHaveLength(1);
    expect(quiz().sets[0]?.questions[0]?.text).toBe('지구는 둥글다');
  });
});
