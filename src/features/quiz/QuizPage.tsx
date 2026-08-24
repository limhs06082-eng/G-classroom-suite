import { AlertTriangle, CheckSquare, Monitor, Play, Plus, Square, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { QuizQuestion, QuizSet } from '../../shared/domain/types';
import { Badge, Button, Card, ConfirmDialog, cx, EmptyState, Modal, Tabs, useToast } from '../../shared/ui';
import { openBoard } from '../../shared/window/openBoard';
import { questionStats, QUESTION_TYPE_LABELS } from './quizCore';
import { TitleSubjectFields } from '../../shared/TitleSubjectFields';
import { QuizSessionPanel } from './QuizSessionPanel';
import { MAX_TEAMS, MIN_TEAMS, renameTeam, resizeTeams } from './teamsCore';
import { useQuiz } from './useQuiz';

type QuizTab = 'sets' | 'results';

/**
 * 형성평가·퀴즈.
 *
 * 수업 중에는 전자칠판이 주 화면이고, 이 화면은 문제를 만드는 곳이다.
 * 진행 상태는 저장되므로 두 화면이 같은 상태를 본다.
 */
export default function QuizPage() {
  const quiz = useQuiz();
  const toast = useToast();

  const [tab, setTab] = useState<QuizTab>('sets');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<QuizSet | null>(null);

  const editing = quiz.sets.find((set) => set.id === editingId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">형성평가</h1>
        {quiz.runningSet === null ? null : (
          <Badge tone="success">진행 중: {quiz.runningSet.title}</Badge>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          <Button icon={Plus} variant="primary" onClick={() => setAddOpen(true)}>
            문제 세트 만들기
          </Button>
          {quiz.runningSet === null ? null : (
            <>
              <Button variant="secondary" icon={Monitor} onClick={() => openBoard('/board/quiz')}>
                전자칠판
              </Button>
              <Button icon={Square} variant="ghost" onClick={quiz.stopRun}>
                진행 중단
              </Button>
            </>
          )}
        </div>
      </div>

      {quiz.run !== null && quiz.runningSet !== null ? (
        <QuizSessionPanel
          set={quiz.runningSet}
          questionIndex={quiz.run.questionIndex}
          teams={quiz.teams}
          onResponses={quiz.applyAutoGrading}
          onSessionCode={quiz.setSessionCode}
        />
      ) : null}

      <Tabs
        items={[
          { id: 'sets', label: '문제 세트', count: quiz.sets.length },
          { id: 'results', label: '지난 결과', count: quiz.results.length },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as QuizTab)}
      >
        {tab === 'sets' ? (
          <div className="flex flex-col gap-4">
          <TeamSettings quiz={quiz} />

          {quiz.sets.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="아직 문제 세트가 없습니다"
              description="객관식·OX·단답형 문제를 만들어 두면 수업 중에 바로 띄울 수 있습니다."
              action={
                <Button variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>
                  문제 세트 만들기
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {quiz.sets.map((set) => {
                const validation = quiz.validate(set);
                return (
                  <li key={set.id}>
                    <Card
                      title={set.title}
                      action={
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Trash2}
                          iconOnly
                          aria-label={`${set.title} 삭제`}
                          onClick={() => setDeleting(set)}
                        />
                      }
                    >
                      {/* 제목은 h2 안이라 truncate된다. 과목 배지는 본문 첫 줄에 둔다. */}
                      <p className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        {set.subject === '' ? null : <Badge tone="neutral">{set.subject}</Badge>}
                        <span>문제 {set.questions.length}개</span>
                      </p>

                      {validation.issues.length > 0 ? (
                        <p className="mt-2 flex items-start gap-1.5 text-sm text-warning-700">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                          손볼 곳 {validation.issues.length}군데가 있어 아직 진행할 수 없습니다.
                        </p>
                      ) : null}

                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          icon={Play}
                          disabled={!validation.isPlayable}
                          onClick={() => {
                            quiz.startRun(set.id);
                            toast.success(`${set.title} 퀴즈를 시작했습니다. 전자칠판을 띄워 주세요.`);
                          }}
                        >
                          퀴즈 시작
                        </Button>
                        <Button size="sm" onClick={() => setEditingId(set.id)}>
                          문제 편집
                        </Button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
          </div>
        ) : null}

        {tab === 'results' ? <ResultsTab quiz={quiz} /> : null}
      </Tabs>

      <QuestionEditor set={editing} quiz={quiz} onClose={() => setEditingId(null)} />

      <AddSetModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(title) => {
          const id = quiz.addSet(title);
          setAddOpen(false);
          setEditingId(id);
          toast.success(`${title} 문제 세트를 만들었습니다.`);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`${deleting?.title ?? ''} 문제 세트를 지울까요?`}
        description="문제가 모두 사라집니다. 지난 결과 기록은 남습니다. 지우기 직전 상태는 자동으로 백업됩니다."
        destructive
        confirmLabel="삭제"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting === null) return;
          void (async () => {
            await quiz.deleteSet(deleting.id);
            toast.warning(`${deleting.title} 문제 세트를 지웠습니다.`);
            setDeleting(null);
          })();
        }}
      />
    </div>
  );
}

/**
 * 모둠 설정.
 *
 * 원본에서는 팀이 `1모둠~4모둠` 넷으로 고정이었다. 모둠이 여섯인 학급은
 * 두 모둠이 퀴즈에 참여할 수 없었다.
 *
 * 진행 중에는 잠근다. 팀 이름이 기록의 열쇠라서 도중에 바꾸면 앞 문제에서
 * 맞힌 점수가 어느 모둠 것인지 알 수 없게 된다.
 */
function TeamSettings({ quiz }: { quiz: ReturnType<typeof useQuiz> }) {
  const teams = quiz.savedTeams;
  const locked = quiz.isTeamsLocked;

  return (
    <Card title="모둠" icon={Users}>
      {locked ? (
        <p className="mb-3 text-sm text-warning-700">
          퀴즈를 진행하는 동안에는 모둠을 바꿀 수 없습니다. 지금까지의 점수가 어느 모둠 것인지
          알 수 없게 됩니다. 진행을 멈춘 뒤 바꿔 주세요.
        </p>
      ) : quiz.teamSource === 'groups' ? (
        <p className="mb-3 text-sm text-slate-600">
          <strong>자리·모둠에서 편성한 {teams.length}모둠</strong>을 그대로 씁니다. 거기서 모둠을
          바꾸면 여기도 함께 바뀝니다. 아래에서 고치면 이 퀴즈만의 팀이 됩니다.
        </p>
      ) : quiz.teamSource === 'manual' ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-slate-600">직접 정한 팀을 씁니다.</p>
          <Button size="sm" variant="ghost" onClick={quiz.useGroupTeams}>
            자리·모둠 따라가기
          </Button>
        </div>
      ) : (
        <p className="mb-3 text-sm text-slate-500">
          아직 편성한 모둠이 없어 기본 팀을 씁니다.{' '}
          <Link to="/seating" className="font-medium text-brand-600 hover:text-brand-700">
            자리·모둠
          </Link>
          에서 편성하면 그것을 그대로 씁니다.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-control border border-slate-200 px-1.5 py-1">
          <span className="text-xs text-slate-500">모둠 수</span>
          <Button
            size="sm"
            variant="ghost"
            aria-label="모둠 수 줄이기"
            disabled={locked || teams.length <= MIN_TEAMS}
            onClick={() => quiz.setTeams(resizeTeams(teams, teams.length - 1))}
            className="size-6 p-0"
          >
            −
          </Button>
          <span className="w-5 text-center font-mono text-sm text-slate-800">{teams.length}</span>
          <Button
            size="sm"
            variant="ghost"
            aria-label="모둠 수 늘리기"
            disabled={locked || teams.length >= MAX_TEAMS}
            onClick={() => quiz.setTeams(resizeTeams(teams, teams.length + 1))}
            className="size-6 p-0"
          >
            +
          </Button>
        </div>

        <ul className="flex flex-wrap gap-2">
          {teams.map((team, index) => (
            <li key={index}>
              <input
                type="text"
                /*
                 * 값을 열쇠에 넣어야 한다. defaultValue는 처음 그릴 때만 읽히므로,
                 * '자리·모둠 따라가기'로 바탕 값이 바뀌어도 칸은 옛 글자를 붙들고 있다.
                 */
                key={`${index}-${team}`}
                defaultValue={team}
                disabled={locked}
                onBlur={(event) => {
                  const next = renameTeam(teams, index, event.target.value);
                  quiz.setTeams(next);
                }}
                aria-label={`${index + 1}번째 모둠 이름`}
                className="h-9 w-24 rounded-control border border-slate-300 px-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
              />
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function ResultsTab({ quiz }: { quiz: ReturnType<typeof useQuiz> }) {
  if (quiz.results.length === 0) {
    return (
      <EmptyState
        title="아직 진행한 기록이 없습니다"
        description="퀴즈를 끝내면 팀별 점수와 문항별 정답률이 여기에 남습니다."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {quiz.results.map((result) => {
        const set = quiz.sets.find((item) => item.id === result.quizSetId);
        const stats = set === undefined ? [] : questionStats(set, result);
        const hardest = [...stats].sort((a, b) => a.ratio - b.ratio)[0];

        return (
          <li key={result.id}>
            <Card
              title={set?.title ?? '(지워진 문제 세트)'}
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  iconOnly
                  aria-label="결과 삭제"
                  onClick={() => quiz.deleteResult(result.id)}
                />
              }
            >
              <p className="text-sm text-slate-500">
                {result.playedAt.slice(0, 10)} · {result.totalTeams}팀
              </p>

              <ul className="mt-2 flex flex-wrap gap-2">
                {Object.entries(result.teamScores)
                  .sort(([, a], [, b]) => b - a)
                  .map(([team, score]) => (
                    <li key={team}>
                      <Badge tone="neutral">
                        {team} {score}점
                      </Badge>
                    </li>
                  ))}
              </ul>

              {hardest === undefined ? null : (
                <p className="mt-2 text-sm text-slate-600">
                  가장 어려웠던 문제: {hardest.question.text || '(내용 없음)'} — 정답{' '}
                  {hardest.correctCount}/{hardest.totalTeams}팀
                </p>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function QuestionEditor({
  set,
  quiz,
  onClose,
}: {
  set: QuizSet | null;
  quiz: ReturnType<typeof useQuiz>;
  onClose: () => void;
}) {
  if (set === null) return null;

  const validation = quiz.validate(set);
  const issueFor = (questionId: string): string[] =>
    validation.issues.filter((issue) => issue.questionId === questionId).map((issue) => issue.message);

  return (
    <Modal
      open
      onClose={onClose}
      title={`${set.title} 편집`}
      size="xl"
      footer={
        <Button variant="primary" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <TitleSubjectFields
          title={set.title}
          subject={set.subject}
          titleLabel="문제 세트 이름"
          onTitleChange={(value) => quiz.renameSet(set.id, value)}
          onSubjectChange={(value) => quiz.setQuizSubject(set.id, value)}
        />

        <div className="flex flex-wrap gap-2">
          {(Object.keys(QUESTION_TYPE_LABELS) as Array<QuizQuestion['type']>).map((type) => (
            <Button key={type} size="sm" icon={Plus} onClick={() => quiz.addQuestion(set.id, type)}>
              {QUESTION_TYPE_LABELS[type]} 추가
            </Button>
          ))}
          {validation.isPlayable ? (
            <Badge tone="success" className="self-center">
              진행할 수 있습니다
            </Badge>
          ) : (
            <Badge tone="warning" className="self-center">
              손볼 곳 {validation.issues.length}군데
            </Badge>
          )}
        </div>

        {set.questions.length === 0 ? (
          <EmptyState title="문제가 없습니다" description="위 버튼으로 문제를 추가해 주세요." />
        ) : (
          <ul className="flex flex-col gap-3">
            {set.questions.map((question, index) => (
              <QuestionRow
                key={question.id}
                question={question}
                index={index}
                issues={issueFor(question.id)}
                onChange={(patch) => quiz.updateQuestion(set.id, question.id, patch)}
                onRemove={() => quiz.removeQuestion(set.id, question.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function QuestionRow({
  question,
  index,
  issues,
  onChange,
  onRemove,
}: {
  question: QuizQuestion;
  index: number;
  issues: string[];
  onChange: (patch: Partial<QuizQuestion>) => void;
  onRemove: () => void;
}) {
  return (
    <li
      className={cx(
        'rounded-card border p-3',
        issues.length > 0 ? 'border-warning-200 bg-warning-50' : 'border-slate-200 bg-white',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">
          {index + 1}. {QUESTION_TYPE_LABELS[question.type]}
        </Badge>

        <input
          defaultValue={question.text}
          onBlur={(event) => onChange({ text: event.target.value })}
          placeholder="문제 내용"
          aria-label={`${index + 1}번 문제 내용`}
          className="min-w-40 flex-1 rounded-control border border-slate-300 px-2 py-1 text-sm"
        />

        <label className="flex items-center gap-1 text-sm text-slate-600">
          <input
            type="number"
            min={1}
            defaultValue={question.points}
            onBlur={(event) => {
              const points = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(points) && points >= 1) onChange({ points });
            }}
            aria-label={`${index + 1}번 배점`}
            className="h-8 w-14 rounded-control border border-slate-300 px-2 text-sm"
          />
          점
        </label>

        {/* 배점과 나란히 둔다. 둘 다 '이 문제를 어떻게 낼 것인가'이고 숫자 하나다. */}
        <label className="flex items-center gap-1 text-sm text-slate-600">
          <input
            type="number"
            min={0}
            step={5}
            defaultValue={question.timeLimitSec}
            onBlur={(event) => {
              const seconds = Number.parseInt(event.target.value, 10);
              onChange({ timeLimitSec: Number.isFinite(seconds) && seconds > 0 ? seconds : 0 });
            }}
            aria-label={`${index + 1}번 제한 시간(초). 0이면 제한 없음`}
            className="h-8 w-16 rounded-control border border-slate-300 px-2 text-sm"
          />
          초
        </label>

        <Button
          size="sm"
          variant="ghost"
          icon={Trash2}
          iconOnly
          aria-label={`${index + 1}번 문제 삭제`}
          onClick={onRemove}
        />
      </div>

      {question.type === 'choice' ? (
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {question.choices.map((choice, choiceIndex) => (
            <li key={choiceIndex} className="flex items-center gap-1.5">
              <input
                type="radio"
                name={`answer-${question.id}`}
                checked={question.answer === String(choiceIndex)}
                onChange={() => onChange({ answer: String(choiceIndex) })}
                aria-label={`${choiceIndex + 1}번 보기를 정답으로`}
                className="size-4 shrink-0"
              />
              <input
                defaultValue={choice}
                onBlur={(event) => {
                  const choices = [...question.choices];
                  choices[choiceIndex] = event.target.value;
                  onChange({ choices });
                }}
                placeholder={`보기 ${choiceIndex + 1}`}
                aria-label={`${index + 1}번 보기 ${choiceIndex + 1}`}
                className="h-8 min-w-0 flex-1 rounded-control border border-slate-300 px-2 text-sm"
              />
            </li>
          ))}
        </ul>
      ) : question.type === 'ox' ? (
        <div className="mt-2 flex gap-2">
          {(['O', 'X'] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={question.answer === value ? 'primary' : 'secondary'}
              aria-pressed={question.answer === value}
              onClick={() => onChange({ answer: value })}
            >
              정답 {value}
            </Button>
          ))}
        </div>
      ) : (
        <label className="mt-2 block text-sm">
          <span className="text-slate-700">인정할 답</span>
          <input
            defaultValue={question.answer}
            onBlur={(event) => onChange({ answer: event.target.value })}
            placeholder="서울, 서울특별시"
            aria-label={`${index + 1}번 인정할 답`}
            className="mt-1 h-9 w-full rounded-control border border-slate-300 px-2 text-sm"
          />
          <span className="mt-1 block text-slate-500">
            쉼표로 여러 개를 적을 수 있습니다. 띄어쓰기와 대소문자는 자동으로 맞춰 줍니다.
          </span>
        </label>
      )}

      {issues.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-0.5">
          {issues.map((issue) => (
            <li key={issue} className="text-sm text-warning-700">
              · {issue}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function AddSetModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string) => void;
}) {
  const [title, setTitle] = useState('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="문제 세트 만들기"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            disabled={title.trim() === ''}
            onClick={() => {
              onAdd(title.trim());
              setTitle('');
            }}
          >
            만들기
          </Button>
        </>
      }
    >
      <label className="block text-sm">
        <span className="text-slate-700">문제 세트 이름</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="수학 3단원 형성평가"
          className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
        />
      </label>
    </Modal>
  );
}
