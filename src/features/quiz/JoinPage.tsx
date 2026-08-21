import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Button, EmptyState, useToast } from '../../shared/ui';
import { getSessionRelay } from './session/QuizSessionRelay';
import type { QuizSessionQuestion, QuizSessionView } from './session/types';

/**
 * 학생 화면.
 *
 * AppShell 밖에 둔다. 학생 폰에는 교사용 내비게이션이 필요 없다.
 * 폰 화면(360px)을 기준으로 짠다.
 */

function teamStorageKey(code: string): string {
  return `teacher-toolkit:v1:join-team:${code}`;
}

export default function JoinPage() {
  const { code = '' } = useParams();
  const relay = getSessionRelay();
  const toast = useToast();

  const [session, setSession] = useState<QuizSessionView | null>(null);
  const [checked, setChecked] = useState(false);
  const [teamIndex, setTeamIndex] = useState<number | null>(null);
  const [sent, setSent] = useState<Record<string, string>>({});

  useEffect(() => {
    if (code === '') return;

    const stop = relay.watchSession(code, (view) => {
      setSession(view);
      setChecked(true);
    });
    return stop;
  }, [relay, code]);

  // 새로고침해도 모둠을 다시 고르지 않게 한다.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(teamStorageKey(code));
      if (saved !== null) setTeamIndex(Number.parseInt(saved, 10));
    } catch {
      // 저장이 막혀 있으면 매번 고르면 된다.
    }
  }, [code]);

  const chooseTeam = useCallback(
    (index: number): void => {
      setTeamIndex(index);
      try {
        window.localStorage.setItem(teamStorageKey(code), String(index));
      } catch {
        // 무시한다
      }
    },
    [code],
  );

  const submit = useCallback(
    (question: QuizSessionQuestion, answer: string): void => {
      if (teamIndex === null) return;

      void (async () => {
        try {
          await relay.submit(code, { questionId: question.id, teamIndex, answer });
          setSent((current) => ({ ...current, [question.id]: answer }));
          toast.success('제출했습니다.');
        } catch (error) {
          toast.error(error instanceof Error ? error.message : '제출하지 못했습니다.');
        }
      })();
    },
    [relay, code, teamIndex, toast],
  );

  const openQuestions = useMemo(() => {
    if (session === null) return [];
    return session.questions.filter((question) => session.openQuestionIds.includes(question.id));
  }, [session]);

  if (!checked) return null;

  if (session === null || !session.open) {
    return (
      <div className="mx-auto max-w-md p-6">
        <EmptyState
          title="받기가 끝났습니다"
          description="선생님이 응답 받기를 마쳤거나 주소가 올바르지 않습니다."
        />
      </div>
    );
  }

  if (teamIndex === null) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <header>
          <h1 className="text-xl font-bold text-slate-900">{session.title}</h1>
          <p className="mt-1 text-sm text-slate-600">우리 모둠을 골라 주세요.</p>
        </header>
        <div className="grid gap-2">
          {session.teams.map((team, index) => (
            <Button key={team} variant="secondary" onClick={() => chooseTeam(index)}>
              {team}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-slate-900">{session.title}</h1>
        <span className="text-sm text-slate-500">{session.teams[teamIndex] ?? ''}</span>
      </header>

      {openQuestions.length === 0 ? (
        <EmptyState
          title="잠시 기다려 주세요"
          description="선생님이 다음 문제를 준비하고 있습니다."
        />
      ) : (
        openQuestions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            sent={sent[question.id]}
            onSubmit={(answer) => submit(question, answer)}
          />
        ))
      )}
    </div>
  );
}

function QuestionCard(props: {
  question: QuizSessionQuestion;
  sent: string | undefined;
  onSubmit: (answer: string) => void;
}) {
  const { question, sent, onSubmit } = props;
  const [draft, setDraft] = useState('');

  return (
    <section className="rounded-card border border-slate-200 bg-white p-4">
      <p className="text-base font-medium text-slate-900">{question.text}</p>

      {question.type === 'ox' ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {['O', 'X'].map((value) => (
            <Button
              key={value}
              variant={sent === value ? 'primary' : 'secondary'}
              onClick={() => onSubmit(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      ) : question.type === 'choice' ? (
        <div className="mt-3 grid gap-2">
          {question.choices.map((choice, index) => (
            <Button
              key={`${choice}-${index}`}
              variant={sent === String(index) ? 'primary' : 'secondary'}
              onClick={() => onSubmit(String(index))}
            >
              {index + 1}. {choice}
            </Button>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="답을 적어 주세요"
            className="h-11 min-w-0 flex-1 rounded-control border border-slate-300 px-3"
          />
          <Button variant="primary" onClick={() => onSubmit(draft)}>
            제출
          </Button>
        </div>
      )}

      {sent === undefined ? null : (
        <p className="mt-2 text-sm text-success-700">제출했습니다. 다시 내면 바뀝니다.</p>
      )}
    </section>
  );
}
