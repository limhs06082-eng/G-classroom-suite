import { QrCode, Square, Users } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

import type { QuizSet } from '../../shared/domain/types';
import { Badge, Button, Card, useToast } from '../../shared/ui';
import { submittedTeamCount } from './session/sessionCore';
import type { QuizResponse } from './session/types';
import { useQuizSession } from './session/useQuizSession';

/**
 * 학생 응답 받기 패널.
 *
 * Firebase가 없으면 QR을 보여 주지 않는다. 학생 폰이 들어올 수 없기 때문이다.
 * 대신 같은 브라우저에서 시험해 볼 수 있게 학생 화면을 새 탭으로 연다.
 */
export function QuizSessionPanel(props: {
  set: QuizSet;
  questionIndex: number;
  teams: string[];
  /** 응답이 바뀌면 부른다. QuizPage가 자동 채점을 붙인다. */
  onResponses?: (rows: QuizResponse[]) => void;
  /** 세션 코드가 바뀌면 부른다. QuizPage가 저장 자료에 남겨 칠판이 찾게 한다. */
  onSessionCode?: (code: string | null) => void;
}) {
  const { set, questionIndex, teams, onResponses, onSessionCode } = props;
  const session = useQuizSession();
  const toast = useToast();

  const [choosing, setChoosing] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const joinUrl = session.code === null ? '' : `${window.location.origin}/join/${session.code}`;

  /*
   * 자동 채점을 여기서 부르지 않고 위로 올린다.
   * 이 컴포넌트가 ToolkitData를 몰라야 공급자 없이 테스트할 수 있다.
   */
  useEffect(() => {
    onResponses?.(session.responses);
  }, [session.responses, onResponses]);

  useEffect(() => {
    onSessionCode?.(session.code);
  }, [session.code, onSessionCode]);

  useEffect(() => {
    if (session.code === null || !session.isAvailable) {
      setQr(null);
      return;
    }

    let cancelled = false;
    void QRCode.toDataURL(joinUrl, { width: 240, margin: 1 }).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [session.code, session.isAvailable, joinUrl]);

  // 교사가 문제를 넘기면 학생 화면도 따라간다.
  useEffect(() => {
    void session.syncOpenQuestions(set, questionIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, set.id]);

  if (session.code === null) {
    return (
      <Card title="학생 응답" icon={Users}>
        {choosing ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => {
                void session.start({ set, mode: 'teacher', questionIndex, teams }).then(() => {
                  setChoosing(false);
                });
              }}
            >
              수업 중 함께 풀기
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void session.start({ set, mode: 'student', questionIndex, teams }).then(() => {
                  setChoosing(false);
                });
              }}
            >
              모둠별로 각자 풀기
            </Button>
            <Button variant="ghost" onClick={() => setChoosing(false)}>
              취소
            </Button>
          </div>
        ) : (
          <Button variant="primary" icon={QrCode} onClick={() => setChoosing(true)}>
            학생 응답 받기
          </Button>
        )}
      </Card>
    );
  }

  const question = set.questions[questionIndex];
  const submitted = question === undefined ? 0 : submittedTeamCount(session.responses, question.id);

  return (
    <Card
      title="학생 응답 받는 중"
      icon={Users}
      action={
        <Button size="sm" variant="ghost" icon={Square} onClick={() => void session.stop()}>
          받기 종료
        </Button>
      }
    >
      <div className="flex flex-wrap items-start gap-4">
        {qr === null ? null : <img src={qr} alt="학생 접속 QR" className="size-40 shrink-0" />}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm text-slate-600">학생에게 이 코드를 알려 주세요.</p>
          <p
            data-testid="session-code"
            className="font-mono text-3xl font-bold tracking-widest tabular-nums text-slate-900"
          >
            {session.code}
          </p>

          <Badge tone={submitted > 0 ? 'success' : 'neutral'}>
            {submitted} / {teams.length} 모둠 제출
          </Badge>

          {session.isAvailable ? (
            <p className="truncate text-sm text-slate-500">{joinUrl}</p>
          ) : (
            <div className="flex flex-col gap-1 text-sm text-warning-700">
              <p>Firebase를 붙이기 전에는 학생 폰이 들어올 수 없습니다.</p>
              <Button
                size="sm"
                variant="secondary"
                className="self-start"
                onClick={() => {
                  window.open(joinUrl, '_blank', 'noopener');
                  toast.info('이 브라우저의 새 탭에서 학생 화면을 열었습니다.');
                }}
              >
                이 브라우저에서 시험해 보기
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
