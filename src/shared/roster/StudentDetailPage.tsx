import { ArrowLeft, Printer, Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { STATUS_LABELS } from '../../features/attendance/attendanceCore';
import { Badge, Button, Card, EmptyState, PrintLayout, usePrint } from '../ui';
import { BehaviorCommentCard } from './BehaviorCommentCard';
import { addObservation, removeObservation } from './observationCore';
import { summarizeStudent } from './studentSummary';
import { useActiveClass, useSuite } from './SuiteDataProvider';

/**
 * 학생 한눈에.
 *
 * 출결·점수·과제·당번·관찰·쿠폰을 한 학생 기준으로 모아 보는 화면이자,
 * **학부모 상담 자료를 뽑는 화면**이다. 여섯 기능을 오가며 한 학생을
 * 찾던 일을 없앤다. 자료는 읽기만 하고(summarizeStudent), 여기서
 * 고칠 수 있는 것은 관찰 기록뿐이다 — 상담 중에 적게 되는 것이 그것이라서.
 */
export default function StudentDetailPage() {
  const { studentId = '' } = useParams<{ studentId: string }>();
  const { data, update } = useSuite();
  const activeClass = useActiveClass();
  const printNow = usePrint();
  const [text, setText] = useState('');

  /*
   * 기본은 '이번 학기만'. 상담에서 묻는 것은 대개 이번 학기고, 학년말
   * 생활기록부는 통산이 필요하니 토글로 둘 다 본다. 학기 정보가 없으면
   * 통산뿐이다.
   */
  const term = data.terms.find((item) => item.id === data.activeTermId) ?? null;
  const [termOnly, setTermOnly] = useState(true);
  const range =
    termOnly && term !== null && term.startDate !== '' && term.endDate !== ''
      ? { from: term.startDate, to: term.endDate }
      : undefined;

  const student = data.students.find((item) => item.id === studentId) ?? null;
  const summary =
    student === null
      ? null
      : summarizeStudent(data, student.id, range === undefined ? {} : { range });

  if (student === null || summary === null) {
    return (
      <Card>
        <EmptyState
          icon={UserRound}
          title="학생을 찾지 못했습니다"
          description="명단에서 이름을 눌러 들어와 주세요."
          action={
            <Link
              to="/roster"
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-press"
            >
              명단으로
            </Link>
          }
        />
      </Card>
    );
  }

  const room = data.classRooms.find((item) => item.id === student.classId);
  const submitRate =
    summary.assignments.total === 0
      ? null
      : Math.round((summary.assignments.submitted / summary.assignments.total) * 100);

  const addNote = (): void => {
    if (text.trim() === '') return;
    update((suite) => ({
      ...suite,
      observations: addObservation(suite.observations, {
        classId: student.classId,
        studentId: student.id,
        text,
      }),
    }));
    setText('');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/roster"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="size-4" aria-hidden /> 명단
        </Link>
        <h1 className="text-xl font-bold text-slate-900">
          <span data-numeric className="mr-2 text-base font-normal text-slate-400">
            {student.number}번
          </span>
          {student.name}
        </h1>
        {room === undefined ? null : <p className="text-sm text-slate-500">{room.name}</p>}
        {student.status === 'inactive' ? <Badge tone="neutral">전출·제외</Badge> : null}

        <div className="ml-auto flex items-center gap-2">
          {term !== null ? (
            <div className="inline-flex gap-0.5 rounded-control border border-slate-200 p-0.5" role="group" aria-label="집계 기간">
              <Button
                size="sm"
                variant={termOnly ? 'primary' : 'ghost'}
                aria-pressed={termOnly}
                onClick={() => setTermOnly(true)}
              >
                {term.name}
              </Button>
              <Button
                size="sm"
                variant={termOnly ? 'ghost' : 'primary'}
                aria-pressed={!termOnly}
                onClick={() => setTermOnly(false)}
              >
                통산
              </Button>
            </div>
          ) : null}
          <Button variant="secondary" icon={Printer} onClick={printNow}>
            상담 자료 인쇄
          </Button>
        </div>
      </div>

      {/* 숫자 넷. 상담 첫마디가 여기서 나온다. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="출결"
          value={summary.attendance.marked === 0 ? '전원 출석' : `${summary.attendance.marked}일`}
          note={
            summary.attendance.marked === 0
              ? '기록된 결석·지각이 없습니다'
              : (['absent', 'late', 'early', 'fieldTrip'] as const)
                  .filter((status) => summary.attendance.byStatus[status] > 0)
                  .map((status) => `${STATUS_LABELS[status]} ${summary.attendance.byStatus[status]}`)
                  .join(' · ')
          }
        />
        <Stat
          label="점수"
          value={`${summary.reward.earned}점`}
          note={summary.reward.spent > 0 ? `쿠폰 ${summary.reward.spent}점 사용 · 잔액 ${summary.reward.balance}` : '통산 획득'}
        />
        <Stat
          label="과제 제출"
          value={submitRate === null ? '—' : `${submitRate}%`}
          note={
            summary.assignments.total === 0
              ? '과제가 없습니다'
              : `${summary.assignments.submitted}/${summary.assignments.total} · 미제출 ${summary.assignments.missing.length}`
          }
        />
        <Stat label="당번" value={`${summary.dutyCount}회`} note="지금까지 맡은 횟수" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="관찰 기록">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) addNote();
            }}
            placeholder="예: 모둠 활동에서 친구를 먼저 도왔다 — Enter로 저장"
            aria-label={`${student.name} 관찰 기록 추가`}
            className="h-10 w-full rounded-control border border-slate-300 px-3 text-sm"
          />
          {summary.observations.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">아직 기록이 없습니다.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1">
              {summary.observations.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-2 rounded-control border border-slate-200 px-2.5 py-1.5"
                >
                  <span data-numeric className="shrink-0 pt-0.5 text-xs text-slate-400">
                    {entry.date}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-slate-800">{entry.text}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    iconOnly
                    aria-label={`${entry.date} 관찰 기록 삭제`}
                    onClick={() =>
                      update((suite) => ({
                        ...suite,
                        observations: removeObservation(suite.observations, entry.id),
                      }))
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="최근 점수">
          {summary.reward.recent.length === 0 ? (
            <p className="text-sm text-slate-500">아직 점수 기록이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {summary.reward.recent.map((entry) => (
                <li
                  key={entry.id}
                  className={
                    entry.revokedAt === undefined
                      ? 'flex items-center gap-2 text-sm'
                      : 'flex items-center gap-2 text-sm text-slate-400 line-through'
                  }
                >
                  <span data-numeric className="w-20 shrink-0 text-xs text-slate-400">
                    {entry.occurredAt.slice(0, 10)}
                  </span>
                  <span
                    data-numeric
                    className={
                      entry.points > 0 ? 'w-10 shrink-0 font-semibold text-success-700' : 'w-10 shrink-0 font-semibold text-danger-700'
                    }
                  >
                    {entry.points > 0 ? `+${entry.points}` : entry.points}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-800">{entry.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="출결 기록">
          {summary.attendance.dates.length === 0 ? (
            <p className="text-sm text-slate-500">기록된 결석·지각·조퇴·체험학습이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {summary.attendance.dates.map((entry) => (
                <li key={entry.date} className="flex items-center gap-2 text-sm">
                  <span data-numeric className="w-24 shrink-0 text-slate-500">
                    {entry.date}
                  </span>
                  <Badge tone={entry.status === 'absent' ? 'danger' : entry.status === 'late' ? 'warning' : 'neutral'}>
                    {STATUS_LABELS[entry.status]}
                  </Badge>
                  {entry.note === '' ? null : <span className="text-slate-600">{entry.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="미제출 과제">
          {summary.assignments.missing.length === 0 ? (
            <p className="text-sm text-slate-500">미제출인 진행 중 과제가 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {summary.assignments.missing.map((assignment) => (
                <li key={assignment.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-slate-800">{assignment.title}</span>
                  <span data-numeric className="shrink-0 text-xs text-slate-400">
                    {assignment.dueDate === '' ? '기한 없음' : `기한 ${assignment.dueDate}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* 쌓인 기록의 끝 — 학기말에 나이스로 옮겨 적는 글. 상담 자료 인쇄에는 넣지 않는다. */}
      {/* key — 학생을 옮기면 카드가 새로 선다. AI 응답을 기다리던 글상자가 다음 학생에게 남으면 안 된다. */}
      <BehaviorCommentCard key={student.id} student={student} {...(range === undefined ? {} : { range })} />

      {/*
        상담 자료 인쇄. 숫자·출결·관찰·미제출을 한 장에. 점수 개별 기록은
        넣지 않는다 — 학부모 앞에 "지도 -2점"이 줄줄이 찍힌 종이를 두는 것은
        상담이 아니라 고발이다. 합계만 적는다.
      */}
      <PrintLayout
        title={`${student.name} 학생 상담 자료`}
        subtitle={[room?.name, activeClass?.name === room?.name ? undefined : activeClass?.name]
          .filter(Boolean)
          .join(' · ')}
        footer={[data.profile.schoolName, data.profile.teacherName].filter(Boolean).join(' · ')}
      >
        <table className="mb-4 w-full border-collapse text-sm">
          <tbody>
            <tr>
              <th className="w-28 border border-black px-2 py-1 text-left">출결</th>
              <td className="border border-black px-2 py-1">
                {summary.attendance.marked === 0
                  ? '결석·지각 없음'
                  : (['absent', 'late', 'early', 'fieldTrip'] as const)
                      .filter((status) => summary.attendance.byStatus[status] > 0)
                      .map((status) => `${STATUS_LABELS[status]} ${summary.attendance.byStatus[status]}회`)
                      .join(', ')}
              </td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-1 text-left">학급 점수</th>
              <td className="border border-black px-2 py-1">통산 {summary.reward.earned}점</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-1 text-left">과제 제출</th>
              <td className="border border-black px-2 py-1">
                {summary.assignments.total === 0
                  ? '—'
                  : `${summary.assignments.submitted}/${summary.assignments.total} (${submitRate}%)`}
              </td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-1 text-left">당번</th>
              <td className="border border-black px-2 py-1">{summary.dutyCount}회</td>
            </tr>
          </tbody>
        </table>

        {summary.observations.length > 0 ? (
          <>
            <h2 className="mb-1 text-base font-bold">관찰 기록</h2>
            <ul className="mb-4 flex flex-col gap-0.5 text-sm">
              {summary.observations.map((entry) => (
                <li key={entry.id}>
                  {entry.date} — {entry.text}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {summary.attendance.dates.length > 0 ? (
          <>
            <h2 className="mb-1 text-base font-bold">출결 기록</h2>
            <ul className="flex flex-col gap-0.5 text-sm">
              {summary.attendance.dates.map((entry) => (
                <li key={entry.date}>
                  {entry.date} {STATUS_LABELS[entry.status]}
                  {entry.note === '' ? '' : ` (${entry.note})`}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </PrintLayout>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p data-numeric className="mt-1 text-2xl font-bold text-slate-900">
        {value}
      </p>
      <p className="mt-0.5 truncate text-xs text-slate-500">{note}</p>
    </Card>
  );
}
