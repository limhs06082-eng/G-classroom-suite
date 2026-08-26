import { CalendarDays } from 'lucide-react';
import { useId, useState } from 'react';

import { MAX_PERIOD, type ClassRoom } from '../../shared/domain/types';
import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { normalizeSubject, subjectTint } from '../../shared/subjects';
import { Button, Card, ConfirmDialog, cx, EmptyState } from '../../shared/ui';
import {
  WEEKDAY_NAMES,
  cellSubject,
  clearTimetable,
  paintCell,
  subjectButtons,
} from './timetableCore';

const PERIODS = Array.from({ length: MAX_PERIOD }, (_, index) => index + 1);

/*
 * 열두 줄을 그대로 적어 둔다.
 *
 * `bg-subject-${n}`처럼 지어 쓰면 Tailwind가 소스에서 그 글자를 못 찾아
 * 해당 CSS를 **한 줄도 안 내보낸다.** 그러면 색만 조용히 안 먹는데,
 * 빌드도 시험도 아무 말을 안 해서 화면을 눈으로 볼 때까지 모른다.
 */
const TINT_CLASS: readonly string[] = [
  'bg-subject-1',
  'bg-subject-2',
  'bg-subject-3',
  'bg-subject-4',
  'bg-subject-5',
  'bg-subject-6',
  'bg-subject-7',
  'bg-subject-8',
  'bg-subject-9',
  'bg-subject-10',
  'bg-subject-11',
  'bg-subject-12',
];

/** 그 과목을 칠할 배경 유틸리티. 모르는 값이면 안 칠한다. */
function tintClass(subject: string): string {
  return TINT_CLASS[subjectTint(subject) - 1] ?? 'bg-slate-50';
}

/**
 * 우리 반 시간표를 짠다.
 *
 * 칸마다 과목을 고르게 하면 서른다섯 칸에 일흔 번을 움직여야 한다. 뒤집었다 —
 * **과목을 먼저 고르고 칸을 찍는다.** 국어를 고르고 국어 칸 여섯을 찍고,
 * 수학을 고르고 넷을 찍는다. 고르는 횟수가 과목 수만큼으로 줄어든다.
 *
 * `isDesktop()` 분기를 두지 않는다. 시간표는 바깥 통신이 없어 웹에서도
 * 설치형에서도 똑같이 돈다.
 */
export function TimetableTab() {
  const activeClass = useActiveClass();

  if (activeClass === null) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="학급을 먼저 만들어 주세요"
        description="시간표는 학급마다 한 벌입니다. 학급·학기 탭에서 만든 뒤 돌아오세요."
      />
    );
  }

  /*
   * 학급이 바뀌면 통째로 다시 마운트한다.
   *
   * 아래가 들고 있는 '고른 과목'과 '직접 친 과목'은 학급마다 다른 것인데,
   * 그냥 두면 2반에서 친 `즐거운생활`이 5반 단추 줄에 그대로 남는다.
   * ClassSwitcher는 머리띠에 늘 있어서 이 탭을 열어 둔 채로 학급이 바뀐다.
   */
  return <TimetableEditor key={activeClass.id} room={activeClass} />;
}

function TimetableEditor({ room }: { room: ClassRoom }) {
  const { data, update } = useSuite();
  const [picked, setPicked] = useState('');
  const [typed, setTyped] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [clearing, setClearing] = useState(false);
  const baseId = useId();

  const classId = room.id;

  /*
   * 단추 줄의 임자는 **저장된 시간표**다(`subjectButtons`). `added`는 그 앞의
   * 짧은 틈만 메운다 — 방금 친 과목은 아직 어느 칸에도 안 찍혀 자료에 없는데,
   * 더하기를 누른 순간 단추로 보여야 하기 때문이다. 한 칸이라도 찍으면
   * 그때부터는 자료가 임자고 `added`는 겹쳐도 걸러진다.
   *
   * 그래서 한 칸도 안 찍은 채 탭을 떠나면 그 과목은 사라진다. 담을 자리가
   * 없어서다 — 칸 없는 과목을 남기려면 빈 글자 항목을 만들어야 하는데, 그건
   * '그 교시가 없다'와 '과목을 안 적었다'를 뒤섞는 짓이다. 찍으면 남는다.
   */
  const fromData = subjectButtons(data.timetableEntries, classId, room.grade);
  const filled = data.timetableEntries.filter((entry) => entry.classId === classId).length;
  const buttons = [...fromData, ...added.filter((subject) => !fromData.includes(subject))];

  /*
   * 고른 과목은 반드시 `added`에도 넣는다.
   *
   * 안 그러면 이런 일이 난다. 지난 학기에 친 '즐거운생활'이 세 칸에 있어
   * 단추로 보인다(자료가 임자다). 그걸 골라 세 칸을 눌러 지우면, 마지막
   * 칸이 사라지는 순간 자료에서 빠져 **단추가 없어진다.** 그런데 `picked`는
   * 그대로다. 아무것도 도드라지지 않은 채로 다음 칸을 누르면 보이지도 않는
   * 과목이 국어를 덮는다. 아래 tap()이 막는 '아무 일도 안 일어남'의 반대편 —
   * 까닭 없이 무슨 일이 일어나는 쪽이라 더 나쁘다.
   */
  const pick = (subject: string): void => {
    setPicked(subject);
    setAdded((current) => (current.includes(subject) ? current : [...current, subject]));
    setNote('');
  };

  const tap = (weekday: number, period: number): void => {
    if (picked === '') {
      // 아무 일도 안 일어나면 선생님은 앱이 고장 났다고 여긴다.
      setNote('과목을 먼저 고르세요.');
      return;
    }
    setNote('');

    // data가 아니라 current에서 읽는다. 빠르게 연달아 찍을 때 화면이 아직
    // 못 따라온 옛 목록을 바탕으로 덮어쓰면 방금 찍은 칸이 되돌아간다.
    update((current) => ({
      ...current,
      timetableEntries: paintCell(current.timetableEntries, classId, weekday, period, picked),
    }));
  };

  const addTyped = (): void => {
    /*
     * normalizeSubject를 쓴다. trim만 하면 길이 제한이 없어, 어딘가에서
     * 긴 글을 붙여 넣은 교사가 표를 찌그러뜨리는 단추 하나를 만들게 된다.
     * 수업 흐름·문제 세트가 이미 이 규칙(12자)을 쓰고 있어 결도 맞는다.
     */
    const name = normalizeSubject(typed);
    if (name === '') return;

    setAdded((current) => (current.includes(name) ? current : [...current, name]));
    // 더하기 다음에 할 일은 늘 찍기다. 여기서 또 고르게 하면 손이 한 번 는다.
    pick(name);
    setTyped('');
    setNote('');
  };

  return (
    <Card title="우리 반 시간표" icon={CalendarDays}>
      <p className="text-sm text-slate-500">{room.name}</p>

      <div className="mt-3 flex flex-wrap gap-1">
        {buttons.map((subject) => (
          <button
            key={subject}
            type="button"
            aria-pressed={picked === subject}
            onClick={() => {
              pick(subject);
              setNote('');
            }}
            /*
             * 단추와 칸이 같은 색이라야 색으로 찾는 것이 성립한다. 고른
             * 단추만 진하게 둔다 — 지금 무엇을 찍고 있는지가 색보다 먼저다.
             */
            className={cx(
              'rounded-control border px-3 py-1 text-sm',
              picked === subject
                ? 'border-brand-600 bg-brand-600 font-medium text-white'
                : cx('border-slate-300 text-slate-700', tintClass(subject)),
            )}
          >
            {subject}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-end gap-2">
        <label className="text-sm">
          <span className="text-slate-700">직접 입력</span>
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            // 엔터로도 더해진다. 여러 과목을 잇달아 칠 때 손이 자판을 안 떠난다.
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              addTyped();
            }}
            placeholder="예: 즐거운생활"
            className="mt-1 h-9 w-40 rounded-control border border-slate-300 px-2"
          />
        </label>
        <Button onClick={addTyped}>더하기</Button>
      </div>

      {/*
       * 비어 있어도 늘 그린다. aria-live 영역은 글이 바뀌기 **전에** 이미
       * 화면에 있어야 낭독기가 읽는다 — 필요할 때 만들어 넣으면 늦다.
       * min-h-5는 글이 들고 날 때 표가 위아래로 튀지 않게 한다.
       */}
      <p role="status" className="mt-2 min-h-5 text-sm text-danger-700">
        {note}
      </p>

      <table className="mt-2 w-full table-fixed border-collapse">
        <caption className="sr-only">요일과 교시로 짜는 우리 반 시간표</caption>
        <thead>
          <tr>
            <th className="w-10">
              <span className="sr-only">교시</span>
            </th>
            {WEEKDAY_NAMES.map((name) => (
              <th key={name} scope="col" className="pb-1 text-sm font-medium text-slate-600">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period) => (
            <tr key={period}>
              <th scope="row" className="text-sm font-normal text-slate-500">
                {period}
              </th>
              {WEEKDAY_NAMES.map((name, index) => {
                const weekday = index + 1;
                const subject = cellSubject(data.timetableEntries, classId, weekday, period);
                const subjectId = `${baseId}-${weekday}-${period}`;

                return (
                  <td key={name} className="p-0.5">
                    <button
                      type="button"
                      /*
                       * 이름은 자리다. 낭독기로 표를 훑을 때 알아야 하는 것은
                       * '여기가 어디냐'이고, 무슨 과목인지는 그다음이라
                       * describedby로 붙인다 — 이름에 섞으면 자리가 묻힌다.
                       */
                      aria-label={`${name}요일 ${period}교시`}
                      {...(subject === '' ? {} : { 'aria-describedby': subjectId })}
                      onClick={() => tap(weekday, period)}
                      className={cx(
                        'h-9 w-full rounded-control border text-sm',
                        subject === ''
                          ? 'border-dashed border-slate-200 hover:bg-slate-50'
                          : cx('border-slate-300 text-slate-900', tintClass(subject)),
                      )}
                    >
                      {subject === '' ? null : <span id={subjectId}>{subject}</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          빈 칸은 그날 그 교시가 없다는 뜻입니다. 찍은 칸을 다시 누르면 지웁니다.
        </p>

        {/* 한 칸도 없으면 지울 것이 없다. 누를 수 있는데 아무 일도 안 일어나면
            선생님은 앱이 고장 났다고 여긴다. */}
        {filled === 0 ? null : (
          <Button variant="ghost" onClick={() => setClearing(true)}>
            전체 지우기
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={clearing}
        title="시간표를 전부 지울까요?"
        description={`${room.name} 시간표 ${filled}칸이 사라집니다. 옆 반 시간표는 그대로입니다.`}
        destructive
        confirmLabel="전부 지우기"
        onCancel={() => setClearing(false)}
        onConfirm={() => {
          update((current) => ({
            ...current,
            timetableEntries: clearTimetable(current.timetableEntries, classId),
          }));
          setClearing(false);
          setNote('');
        }}
      />
    </Card>
  );
}
