import {
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Copy,
  ChevronUp,
  ClipboardCheck,
  Megaphone,
  Monitor,
  Printer,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { createClassEvent } from '../../shared/domain/factories';
import { createId } from '../../shared/ids';
import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { useToday } from '../../shared/state/useToday';
import { Badge, Button, Card, EmptyState, Modal, PrintLayout, usePrint, useToast } from '../../shared/ui';
import { openBoard } from '../../shared/window/openBoard';
import { ddayLabel, daysUntil, eventPhrase, eventsSoon, pastEvents, shortDate, upcomingEvents } from './eventsCore';
import { assignmentsDueSoon, frequentPhrases, itemsFor, noticeText, setItems } from './noticeCore';
import { schoolWeek } from './weekCore';
import { WeeklySheet } from './WeeklySheet';

/**
 * 알림장.
 *
 * 종례 때 적고 전자칠판에 띄우는 그날의 전달 사항이다. 기본은 오늘이지만
 * 날짜를 고를 수 있다 — 5교시에 내일 것을 미리 적어 두기도 하고,
 * 학부모가 "어제 알림장에 뭐라고 했나요"라고 묻기도 한다.
 *
 * 내일까지인 과제는 손으로 안 적어도 아래에 자동으로 붙는다.
 */
export default function NoticePage() {
  const { data, update } = useSuite();
  const activeClass = useActiveClass();
  const today = useToday();
  const toast = useToast();
  const printNow = usePrint();
  const [text, setText] = useState('');
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  /*
   * 주간 안내문. 인쇄 포털은 마운트된 것을 전부 찍으므로, 주간 것을 찍는 동안은
   * 하루 알림장 포털을 내리고 주간 포털만 올린다. 창을 닫으면 되돌린다.
   */
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [weeklyWhich, setWeeklyWhich] = useState<'this' | 'next'>('this');
  const [weeklyMessage, setWeeklyMessage] = useState('');
  const [weeklyPrint, setWeeklyPrint] = useState<{ week: string[]; message: string } | null>(null);
  const closeWeekly = (): void => {
    setWeeklyOpen(false);
    setWeeklyPrint(null);
  };

  // 날짜를 안 골랐으면 오늘. 자정이 지나면 저절로 다음 날로 넘어간다.
  const date = pickedDate ?? today;

  if (activeClass === null) {
    return (
      <Card>
        <EmptyState
          icon={Megaphone}
          title="학급을 먼저 만들어 주세요"
          description="학급이 있어야 알림장을 적을 수 있습니다."
          action={
            <Link
              to="/setup"
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-press"
            >
              처음 설정 시작하기
            </Link>
          }
        />
      </Card>
    );
  }

  const classId = activeClass.id;
  const items = itemsFor(data.notices, classId, date);
  const dueSoon = assignmentsDueSoon(data.assignments, classId, date);
  // 최근에 자주 적은 글줄. 오늘 이미 적은 것은 칩에서도 뺀다.
  const phrases = frequentPhrases(data.notices, classId, date).filter(
    (text) => !items.some((item) => item.text === text),
  );
  // 이레 안 학급 일정. 종례에서 "내일 현장학습, 도시락"을 빠뜨리지 않게 칩으로 내민다.
  const eventPhrases = eventsSoon(data.classEvents, classId, date, 7)
    .map((event) => ({ id: event.id, text: eventPhrase(date, event) }))
    .filter(({ text: phrase }) => !items.some((item) => item.text === phrase));

  const replaceItems = (next: typeof items): void => {
    update((suite) => ({ ...suite, notices: setItems(suite.notices, classId, date, next) }));
  };

  /** 한 줄 덧붙이기. 목록은 suite에서 다시 읽는다 — 칩을 연달아 눌러도 한 줄이 안 사라진다. */
  const appendItem = (value: string): void => {
    update((suite) => ({
      ...suite,
      notices: setItems(suite.notices, classId, date, [
        ...itemsFor(suite.notices, classId, date),
        { id: createId(), text: value },
      ]),
    }));
  };

  const addItem = (): void => {
    const trimmed = text.trim();
    if (trimmed === '') return;
    appendItem(trimmed);
    setText('');
  };

  const editItem = (id: string, nextText: string): void => {
    const trimmed = nextText.trim();
    // 빈 글로 고치는 것은 지우기가 아니다. 지우기는 휴지통이 따로 있다.
    if (trimmed === '') return;
    replaceItems(items.map((item) => (item.id === id ? { ...item, text: trimmed } : item)));
  };

  const removeItem = (id: string): void => {
    const index = items.findIndex((item) => item.id === id);
    const target = items[index];
    if (target === undefined) return;

    replaceItems(items.filter((item) => item.id !== id));
    /*
     * 되돌리기는 지운 **그 항목 하나**를 지금 목록의 제자리에 돌려놓는다.
     * 지우기 전 목록을 통째로 되돌리면, 토스트가 떠 있는 동안 추가·수정한
     * 다른 항목까지 소리 없이 사라진다(지운 것을 또 지우면 살아나고).
     */
    toast.info(`'${target.text}' 항목을 지웠습니다.`, {
      actionLabel: '실행 취소',
      onAction: () =>
        update((suite) => {
          const current = itemsFor(suite.notices, classId, date);
          if (current.some((item) => item.id === id)) return suite;
          const next = [...current];
          next.splice(Math.min(index, next.length), 0, target);
          return { ...suite, notices: setItems(suite.notices, classId, date, next) };
        }),
    });
  };

  /** 항목을 한 칸 위/아래로. 번호가 붙는 목록이라 순서가 곧 내용이다. */
  const moveItem = (id: string, delta: -1 | 1): void => {
    const index = items.findIndex((item) => item.id === id);
    const target = index + delta;
    if (index === -1 || target < 0 || target >= items.length) return;

    const next = [...items];
    const a = next[index];
    const b = next[target];
    if (a === undefined || b === undefined) return;
    next[index] = b;
    next[target] = a;
    replaceItems(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">알림장</h1>
        <input
          type="date"
          value={date}
          onChange={(event) => {
            const value = event.target.value;
            // 지우면 빈 글자('')가 온다. 그대로 두면 날짜 ''에 알림장이 쌓인다.
            setPickedDate(value === '' || value === today ? null : value);
          }}
          aria-label="알림장 날짜"
          className="h-9 rounded-control border border-slate-300 px-2 text-sm"
        />
        {date !== today ? (
          <>
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setPickedDate(null)}>
              오늘로
            </Button>
            <Badge tone={date > today ? 'info' : 'neutral'}>
              {date > today ? '미리 적는 알림장입니다' : '지난 알림장입니다'}
            </Badge>
          </>
        ) : null}

        <div className="ml-auto flex flex-wrap gap-2">
          <Button icon={Monitor} variant="secondary" onClick={() => openBoard('/board/notice')}>
            전자칠판에 띄우기
          </Button>
          {/* 금요일마다 손으로 만들던 주간 학습 안내 — 있는 자료를 모아 한 장으로. */}
          <Button icon={CalendarRange} variant="secondary" onClick={() => setWeeklyOpen(true)}>
            주간 안내문
          </Button>
          {/* e알리미·카톡·하이클래스에 붙여 넣는 담임에게 인쇄는 답이 아니다. */}
          <Button
            icon={Copy}
            variant="secondary"
            disabled={items.length === 0 && dueSoon.length === 0}
            onClick={() => {
              void (async () => {
                try {
                  await navigator.clipboard.writeText(
                    noticeText({
                      className: activeClass.name,
                      date,
                      items,
                      dueSoon,
                      events: eventPhrases.map((event) => event.text),
                    }),
                  );
                  toast.success('복사했습니다. 문자·앱에 붙여 넣으세요.');
                } catch {
                  toast.error('복사하지 못했습니다. 글을 직접 선택해 복사해 주세요.');
                }
              })();
            }}
          >
            문자로 복사
          </Button>
          <Button icon={Printer} variant="secondary" disabled={items.length === 0 && dueSoon.length === 0} onClick={printNow}>
            인쇄
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              // 한글 조합을 마치는 Enter(IME)에 제출되면 마지막 글자가 잘린다.
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) addItem();
            }}
            placeholder="예: 내일 색연필 가져오기 — Enter로 계속 추가"
            aria-label="알림장 항목 추가"
            className="h-10 min-w-0 flex-1 rounded-control border border-slate-300 px-3 text-sm"
          />
          <Button variant="primary" disabled={text.trim() === ''} onClick={addItem}>
            추가
          </Button>
        </div>

        {/* 다가오는 학급 일정 — 누르면 "내일 현장학습 — 도시락"이 한 줄로 들어간다. */}
        {eventPhrases.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className="text-xs text-slate-500">다가오는 일정</span>
            {eventPhrases.map(({ id, text: phrase }) => (
              <button key={id} type="button" onClick={() => appendItem(phrase)}>
                <Badge tone="info">+ {phrase}</Badge>
              </button>
            ))}
          </div>
        ) : null}

        {/* 자주 쓰는 문구 — 누르면 바로 한 줄 추가. 매주 치던 '우유갑 정리'를 다시 안 친다. */}
        {phrases.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className="text-xs text-slate-500">자주 쓰는 문구</span>
            {phrases.map((phrase) => (
              <button key={phrase} type="button" onClick={() => appendItem(phrase)}>
                <Badge tone="neutral">+ {phrase}</Badge>
              </button>
            ))}
          </div>
        ) : null}

        {items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            아직 적은 것이 없습니다. 준비물·안내 사항을 한 줄씩 적어 주세요.
          </p>
        ) : (
          <ol className="mt-3 flex flex-col gap-1" aria-label="알림장 항목">
            {items.map((item, index) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-control border border-slate-200 px-3 py-1.5"
              >
                <span data-numeric className="w-5 shrink-0 text-right text-sm text-slate-400">
                  {index + 1}
                </span>
                {/*
                  글을 바로 고친다. 삭제 후 재입력은 순서까지 어긋난다 —
                  모둠 이름·역할 이름과 같은 defaultValue+onBlur 인라인 편집.
                */}
                <input
                  key={`${item.id}:${item.text}`}
                  defaultValue={item.text}
                  onBlur={(event) => editItem(item.id, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.currentTarget.blur();
                    }
                  }}
                  aria-label={`${index + 1}번 항목 수정`}
                  className="h-8 min-w-0 flex-1 rounded-control border border-transparent px-1.5 text-sm text-slate-800 hover:border-slate-200 focus:border-slate-300"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={ChevronUp}
                  iconOnly
                  disabled={index === 0}
                  aria-label={`${index + 1}번 항목 위로`}
                  onClick={() => moveItem(item.id, -1)}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={ChevronDown}
                  iconOnly
                  disabled={index === items.length - 1}
                  aria-label={`${index + 1}번 항목 아래로`}
                  onClick={() => moveItem(item.id, 1)}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  iconOnly
                  aria-label={`${item.text} 삭제`}
                  onClick={() => removeItem(item.id)}
                />
              </li>
            ))}
          </ol>
        )}
      </Card>

      {dueSoon.length > 0 ? (
        <Card title="내일까지인 과제" icon={ClipboardCheck}>
          <p className="mb-2 text-sm text-slate-500">
            과제 제출에서 가져와 자동으로 붙습니다. 칠판에도 함께 나옵니다.
          </p>
          <ul className="flex flex-col gap-1">
            {dueSoon.map((assignment) => (
              <li key={assignment.id} className="flex items-center gap-2 text-sm text-slate-800">
                <Badge tone={assignment.dueDate === date ? 'danger' : 'warning'}>
                  {assignment.dueDate === date ? '오늘까지' : '내일까지'}
                </Badge>
                <span className="min-w-0 flex-1 truncate">{assignment.title}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <ClassEventsCard classId={classId} today={today} />

      <Modal
        open={weeklyOpen}
        onClose={closeWeekly}
        title="주간 안내문"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeWeekly}>
              닫기
            </Button>
            <Button
              variant="primary"
              icon={Printer}
              onClick={() => {
                setWeeklyPrint({ week: schoolWeek(today, weeklyWhich), message: weeklyMessage });
                // 주간 포털이 그려진 다음에 인쇄 창을 연다.
                window.setTimeout(printNow, 80);
              }}
            >
              인쇄
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="inline-flex gap-0.5 self-start rounded-control border border-slate-200 p-0.5" role="group" aria-label="어느 주">
            <Button size="sm" variant={weeklyWhich === 'this' ? 'primary' : 'ghost'} aria-pressed={weeklyWhich === 'this'} onClick={() => setWeeklyWhich('this')}>
              이번 주
            </Button>
            <Button size="sm" variant={weeklyWhich === 'next' ? 'primary' : 'ghost'} aria-pressed={weeklyWhich === 'next'} onClick={() => setWeeklyWhich('next')}>
              다음 주
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            {shortDate(schoolWeek(today, weeklyWhich)[0] ?? today)} ~ {shortDate(schoolWeek(today, weeklyWhich)[4] ?? today)} · 시간표(하루
            바꾸기 반영)·학급 일정·자주 쓴 알림장 문구가 A4 한 장으로 나갑니다.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-700">학부모님께 한마디</span>
            <textarea
              rows={4}
              value={weeklyMessage}
              onChange={(event) => setWeeklyMessage(event.target.value)}
              aria-label="학부모님께 한마디"
              placeholder="예: 다음 주 수요일은 현장체험학습입니다. 도시락과 물을 챙겨 주세요."
              className="rounded-control border border-slate-300 p-2 text-sm leading-relaxed"
            />
          </label>
        </div>
      </Modal>
      {weeklyPrint !== null ? <WeeklySheet week={weeklyPrint.week} message={weeklyPrint.message} /> : null}

      {/* 인쇄 전용. 결석한 학생 가정으로 보내거나 교실 뒤에 붙이는 종이다. 주간 안내문을 찍는 동안은 내린다. */}
      {weeklyPrint === null ? (
      <PrintLayout
        title={`${activeClass.name} 알림장`}
        subtitle={date}
        footer={[data.profile.schoolName, data.profile.teacherName].filter(Boolean).join(' · ')}
      >
        <ol className="flex flex-col gap-2 text-base">
          {items.map((item, index) => (
            <li key={item.id}>
              {index + 1}. {item.text}
            </li>
          ))}
          {dueSoon.map((assignment) => (
            <li key={assignment.id}>
              ({assignment.dueDate === date ? '오늘까지' : '내일까지'}) {assignment.title}
            </li>
          ))}
        </ol>
        {/* 항목으로 넣지 않은 일정도 종이에는 나간다. 넣은 것은 위에 이미 있으니 두 번 찍지 않는다. */}
        {eventPhrases.length > 0 ? (
          <section className="print-keep mt-4">
            <h2 className="mb-1 text-sm font-semibold">다가오는 일정</h2>
            <ul className="flex flex-col gap-1 text-base">
              {eventPhrases.map(({ id, text: phrase }) => (
                <li key={id}>· {phrase}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </PrintLayout>
      ) : null}
    </div>
  );
}

/**
 * 학급 일정.
 *
 * 수행평가·현장학습·상담 주간처럼 날짜가 정해진 일을 적어 두면 홈에
 * D-day로, 오늘 보드에는 그날 일정으로 나온다. 알림장 화면에 두는
 * 까닭은 "내일 뭐 있지"를 종례 때 함께 보기 때문이다.
 *
 * 지난 일정은 지우지 않고 접어 둔다 — 학기말에 "언제 뭘 했나"를 돌아본다.
 */
function ClassEventsCard({ classId, today }: { classId: string; today: string }) {
  const { data, update } = useSuite();
  const toast = useToast();
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [showPast, setShowPast] = useState(false);

  const upcoming = upcomingEvents(data.classEvents, classId, today);
  const past = pastEvents(data.classEvents, classId, today);

  const add = (): void => {
    const trimmed = title.trim();
    if (trimmed === '' || date === '') return;
    update((suite) => ({
      ...suite,
      classEvents: [
        ...suite.classEvents,
        createClassEvent({ classId, date, title: trimmed, note: note.trim() }),
      ],
    }));
    setTitle('');
    setNote('');
  };

  const remove = (id: string): void => {
    const target = data.classEvents.find((event) => event.id === id);
    if (target === undefined) return;
    update((suite) => ({
      ...suite,
      classEvents: suite.classEvents.filter((event) => event.id !== id),
    }));
    toast.info(`'${target.title}' 일정을 지웠습니다.`, {
      actionLabel: '실행 취소',
      onAction: () =>
        update((suite) =>
          suite.classEvents.some((event) => event.id === id)
            ? suite
            : { ...suite, classEvents: [...suite.classEvents, target] },
        ),
    });
  };

  return (
    <Card title="학급 일정" icon={CalendarDays}>
      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-label="일정 날짜"
          className="h-10 rounded-control border border-slate-300 px-2 text-sm"
        />
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) add();
          }}
          placeholder="예: 수학 수행평가"
          aria-label="일정 이름"
          className="h-10 min-w-40 flex-1 rounded-control border border-slate-300 px-3 text-sm"
        />
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) add();
          }}
          placeholder="메모 (선택) — 준비물, 장소"
          aria-label="일정 메모"
          className="h-10 min-w-40 flex-1 rounded-control border border-slate-300 px-3 text-sm"
        />
        <Button variant="primary" disabled={title.trim() === '' || date === ''} onClick={add}>
          추가
        </Button>
      </div>

      {upcoming.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          다가오는 일정이 없습니다. 적어 두면 홈에 D-day로 나옵니다.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {upcoming.map((event) => {
            const days = daysUntil(today, event.date);
            return (
              <li
                key={event.id}
                className="flex items-center gap-2 rounded-control border border-slate-200 px-3 py-1.5"
              >
                <Badge tone={days === 0 ? 'danger' : days <= 3 ? 'warning' : 'neutral'}>
                  {ddayLabel(today, event.date)}
                </Badge>
                <span data-numeric className="shrink-0 text-xs text-slate-400">
                  {event.date}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                  {event.title}
                  {event.note === '' ? null : (
                    <span className="ml-2 text-xs text-slate-500">{event.note}</span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  iconOnly
                  aria-label={`${event.title} 일정 삭제`}
                  onClick={() => remove(event.id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {past.length > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowPast((value) => !value)}
            aria-expanded={showPast}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            지난 일정 {past.length}개 {showPast ? '접기' : '보기'}
          </button>
          {showPast ? (
            <ul className="mt-1 flex flex-col gap-0.5">
              {past.map((event) => (
                <li key={event.id} className="flex items-center gap-2 px-1 text-sm text-slate-500">
                  <span data-numeric className="shrink-0 text-xs text-slate-400">
                    {event.date}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{event.title}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    iconOnly
                    aria-label={`${event.title} 일정 삭제`}
                    onClick={() => remove(event.id)}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
