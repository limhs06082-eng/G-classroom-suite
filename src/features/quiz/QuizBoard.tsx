import { Check, Eye, EyeOff, Flag } from 'lucide-react';

import { Button, cx, EmptyState } from '../../shared/ui';
import { QuestionTimer } from './QuestionTimer';
import { correctChoiceText, QUESTION_TYPE_LABELS } from './quizCore';
import { useSessionResponses } from './session/useSessionResponses';
import { useQuiz } from './useQuiz';

/**
 * 전자칠판용 퀴즈 진행.
 *
 * 학생이 보는 화면이면서 교사가 조작하는 화면이기도 하다.
 * 문제는 크게, 조작 버튼은 손가락으로 누를 만큼 크게 둔다.
 */
export function QuizBoard() {
  const quiz = useQuiz();
  /*
   * 세션 코드는 quizRun에 들어 있다. 칠판은 별도 창이라
   * 저장 자료를 거치지 않으면 세션을 찾을 길이 없다.
   */
  const responses = useSessionResponses(quiz.run?.sessionCode ?? null);

  if (quiz.run === null || quiz.runningSet === null) {
    return (
      <EmptyState
        title="진행 중인 퀴즈가 없습니다"
        description="형성평가 화면에서 퀴즈 시작을 누르면 여기에 표시됩니다."
      />
    );
  }

  const { run, runningSet } = quiz;
  const question = runningSet.questions[run.questionIndex];

  if (question === undefined) {
    return <EmptyState title="문제가 없습니다" description="형성평가 화면에서 문제를 추가해 주세요." />;
  }

  const marked = run.correctTeamsByQuestion[question.id] ?? [];
  const isLast = run.questionIndex >= runningSet.questions.length - 1;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-control bg-slate-900 px-4 py-1.5 text-board-sm font-bold text-white">
          {QUESTION_TYPE_LABELS[question.type]}
        </span>
        <span className="text-board-sm text-slate-500">
          {run.questionIndex + 1} / {runningSet.questions.length}
        </span>
        <span className="text-board-sm text-slate-500">{question.points}점</span>

        {/* 제한 시간이 없는 문항(0)에는 아무것도 안 그린다. */}
        <div className="ml-auto">
          <QuestionTimer
            questionId={question.id}
            timeLimitSec={question.timeLimitSec}
            revealed={run.revealed}
          />
        </div>
      </div>

      <h2 className="text-board-lg font-black text-slate-900">{question.text}</h2>

      {question.type === 'choice' ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {question.choices.map((choice, index) => {
            const isAnswer = run.revealed && question.answer === String(index);
            return choice.trim() === '' ? null : (
              <li
                key={index}
                className={cx(
                  'flex items-center gap-3 rounded-card border-4 p-4 text-board-base',
                  isAnswer ? 'border-success-500 bg-success-50' : 'border-slate-200 bg-surface',
                )}
              >
                <span className="font-black text-slate-400">{index + 1}</span>
                <span className="min-w-0 flex-1">{choice}</span>
                {isAnswer ? <Check className="size-10 shrink-0 text-success-500" aria-label="정답" /> : null}
              </li>
            );
          })}
        </ul>
      ) : question.type === 'ox' ? (
        <div className="flex gap-4">
          {(['O', 'X'] as const).map((value) => {
            const isAnswer = run.revealed && question.answer === value;
            return (
              <div
                key={value}
                className={cx(
                  'flex flex-1 items-center justify-center rounded-card border-4 py-8 text-board-2xl font-black',
                  isAnswer ? 'border-success-500 bg-success-50 text-success-700' : 'border-slate-200 text-slate-400',
                )}
              >
                {value}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-card border-4 border-dashed border-slate-200 p-6 text-center">
          {run.revealed ? (
            <p className="text-board-lg font-black text-success-700">{question.answer}</p>
          ) : (
            <p className="text-board-base text-slate-400">답을 적어 보세요</p>
          )}
        </div>
      )}

      {run.revealed && question.explanation !== '' ? (
        <p className="text-board-sm text-slate-600">{question.explanation}</p>
      ) : null}

      {run.revealed && question.type === 'choice' ? (
        <p className="text-board-sm text-slate-500">정답: {correctChoiceText(question)}</p>
      ) : null}

      {/* 맞힌 팀 체크. 교사가 칠판 앞에서 바로 누른다. */}
      <div className="mt-auto flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {quiz.teams.map((team, teamIndex) => {
            const isMarked = marked.includes(team);
            const hasSubmitted = responses.some(
              (row) => row.questionId === question.id && row.teamIndex === teamIndex,
            );

            return (
              <Button
                key={team}
                size="lg"
                variant={isMarked ? 'primary' : 'secondary'}
                aria-pressed={isMarked}
                onClick={() => quiz.markCorrect(team)}
              >
                {hasSubmitted ? (
                  // 정답 공개 전에는 냈다는 것만 보인다. 답을 보여 주면 베낀다.
                  <span
                    aria-label="제출함"
                    className="mr-2 inline-block size-2.5 rounded-full bg-success-500"
                  />
                ) : null}
                {team} {quiz.scores[team] ?? 0}점
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={quiz.goPrevQuestion} disabled={run.questionIndex === 0}>
            이전 문제
          </Button>
          <Button
            size="lg"
            icon={run.revealed ? EyeOff : Eye}
            variant={run.revealed ? 'secondary' : 'primary'}
            onClick={quiz.reveal}
          >
            {run.revealed ? '정답 가리기' : '정답 공개'}
          </Button>
          {isLast ? (
            <Button size="lg" icon={Flag} variant="primary" onClick={quiz.finishRun}>
              퀴즈 끝내기
            </Button>
          ) : (
            <Button size="lg" variant="primary" onClick={quiz.goNextQuestion}>
              다음 문제
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
