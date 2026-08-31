import {
  ChevronDown,
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

import { createId } from '../../shared/ids';
import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { useToday } from '../../shared/state/useToday';
import { Badge, Button, Card, EmptyState, PrintLayout, usePrint, useToast } from '../../shared/ui';
import { openBoard } from '../../shared/window/openBoard';
import { assignmentsDueSoon, itemsFor, setItems } from './noticeCore';

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

  const replaceItems = (next: typeof items): void => {
    update((suite) => ({ ...suite, notices: setItems(suite.notices, classId, date, next) }));
  };

  const addItem = (): void => {
    const trimmed = text.trim();
    if (trimmed === '') return;
    update((suite) => ({
      ...suite,
      notices: setItems(suite.notices, classId, date, [
        ...itemsFor(suite.notices, classId, date),
        { id: createId(), text: trimmed },
      ]),
    }));
    setText('');
  };

  const editItem = (id: string, nextText: string): void => {
    const trimmed = nextText.trim();
    // 빈 글로 고치는 것은 지우기가 아니다. 지우기는 휴지통이 따로 있다.
    if (trimmed === '') return;
    replaceItems(items.map((item) => (item.id === id ? { ...item, text: trimmed } : item)));
  };

  const removeItem = (id: string): void => {
    const removed = items;
    replaceItems(items.filter((item) => item.id !== id));
    const target = items.find((item) => item.id === id);
    // 종례 직전에 적은 다섯 줄 중 하나를 잘못 지우면 다시 타이핑이다.
    toast.info(`'${target?.text ?? ''}' 항목을 지웠습니다.`, {
      actionLabel: '실행 취소',
      onAction: () => replaceItems(removed),
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
          onChange={(event) => setPickedDate(event.target.value === today ? null : event.target.value)}
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
              if (event.key === 'Enter') addItem();
            }}
            placeholder="예: 내일 색연필 가져오기 — Enter로 계속 추가"
            aria-label="알림장 항목 추가"
            className="h-10 min-w-0 flex-1 rounded-control border border-slate-300 px-3 text-sm"
          />
          <Button variant="primary" disabled={text.trim() === ''} onClick={addItem}>
            추가
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            아직 적은 것이 없습니다. 준비물·안내 사항을 한 줄씩 적어 주세요.
          </p>
        ) : (
          <ol className="mt-3 flex flex-col gap-1">
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
                    if (event.key === 'Enter') event.currentTarget.blur();
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

      {/* 인쇄 전용. 결석한 학생 가정으로 보내거나 교실 뒤에 붙이는 종이다. */}
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
      </PrintLayout>
    </div>
  );
}
