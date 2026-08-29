import { ClipboardCheck, Megaphone, Monitor, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { createId } from '../../shared/ids';
import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { useToday } from '../../shared/state/useToday';
import { Badge, Button, Card, EmptyState } from '../../shared/ui';
import { openBoard } from '../../shared/window/openBoard';
import { assignmentsDueSoon, itemsFor, setItems } from './noticeCore';

/**
 * 알림장.
 *
 * 종례 때 적고 전자칠판에 띄우는 그날의 전달 사항이다. 날짜는 항상
 * 오늘이다 — 어제 알림장을 고칠 일은 없고, 내일 것은 내일 적으면 된다.
 *
 * 내일까지인 과제는 손으로 안 적어도 아래에 자동으로 붙는다.
 */
export default function NoticePage() {
  const { data, update } = useSuite();
  const activeClass = useActiveClass();
  const today = useToday();
  const [text, setText] = useState('');

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
  const items = itemsFor(data.notices, classId, today);
  const dueSoon = assignmentsDueSoon(data.assignments, classId, today);

  const addItem = (): void => {
    const trimmed = text.trim();
    if (trimmed === '') return;
    update((suite) => ({
      ...suite,
      notices: setItems(suite.notices, classId, today, [
        ...itemsFor(suite.notices, classId, today),
        { id: createId(), text: trimmed },
      ]),
    }));
    setText('');
  };

  const removeItem = (id: string): void => {
    update((suite) => ({
      ...suite,
      notices: setItems(
        suite.notices,
        classId,
        today,
        itemsFor(suite.notices, classId, today).filter((item) => item.id !== id),
      ),
    }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">알림장</h1>
        <p className="text-sm text-slate-500">{today}</p>

        <Button
          icon={Monitor}
          variant="secondary"
          className="ml-auto"
          onClick={() => openBoard('/board/notice')}
        >
          전자칠판에 띄우기
        </Button>
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
                className="flex items-center gap-2 rounded-control border border-slate-200 px-3 py-2"
              >
                <span data-numeric className="w-5 shrink-0 text-right text-sm text-slate-400">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm text-slate-800">{item.text}</span>
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
                <Badge tone={assignment.dueDate === today ? 'danger' : 'warning'}>
                  {assignment.dueDate === today ? '오늘까지' : '내일까지'}
                </Badge>
                <span className="min-w-0 flex-1 truncate">{assignment.title}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
