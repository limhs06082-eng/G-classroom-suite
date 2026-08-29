import { Dices, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';

import { useActiveClass, useRoster, useSuite } from '../../shared/roster/SuiteDataProvider';
import { useToday } from '../../shared/state/useToday';
import { Badge, Button, cx, Modal } from '../../shared/ui';
import { absentToday } from '../attendance/attendanceCore';
import { systemRng } from '../seating/rng';
import { drawOne, remainingPool } from './pickerCore';

/**
 * 발표자 뽑기.
 *
 * 뽑은 이름은 전자칠판 크기로 크게 띄운다 — 프로젝터 앞에서 쓰는
 * 도구라서다. 뽑힌 학생을 제외할지는 토글이고, 오늘 결석·체험학습인
 * 학생은 항상 빠진다.
 *
 * 아무것도 저장하지 않는다. 닫으면 처음부터다.
 *
 * 다른 도구 모달과 달리 **열렸을 때만 마운트된다**(ToolsBar 참고).
 * 닫혔다 열리면 마운트가 새로 되므로 지난 수업의 뽑힌 목록이 저절로
 * 비워지고, 명단이 필요 없는 화면(예: 갤러리)이 툴바를 그릴 때
 * SuiteDataProvider를 요구하지 않는다.
 */
export function PickerModal({ onClose }: { onClose: () => void }) {
  const { data } = useSuite();
  const activeClass = useActiveClass();
  const roster = useRoster();
  const today = useToday();

  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [excludePicked, setExcludePicked] = useState(true);
  const [current, setCurrent] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  const absentIds = activeClass === null ? [] : absentToday(data.attendanceRecords, activeClass.id, today);
  const pool = remainingPool(roster, absentIds, pickedIds, excludePicked);
  const pickedStudents = pickedIds
    .map((id) => roster.find((student) => student.id === id))
    .filter((student) => student !== undefined);
  const currentStudent = roster.find((student) => student.id === current) ?? null;

  const draw = (): void => {
    const student = drawOne(pool, systemRng);
    if (student === null) return;
    setCurrent(student.id);
    setPickedIds((ids) => (ids.includes(student.id) ? ids : [...ids, student.id]));
    setRevealing(true);
  };

  return (
    <>
      <Modal
        open={!revealing}
        onClose={onClose}
        title="발표자 뽑기"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              닫기
            </Button>
            <Button variant="primary" icon={Dices} disabled={pool.length === 0} onClick={draw}>
              뽑기
            </Button>
          </>
        }
      >
        {roster.length === 0 ? (
          <p className="text-sm text-slate-500">
            학생 명단이 있어야 뽑을 수 있습니다. 명단을 먼저 등록해 주세요.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>
                남은 학생 <strong data-numeric>{pool.length}</strong>명
              </span>
              {absentIds.length > 0 ? (
                <Badge tone="neutral">결석·체험학습 {absentIds.length}명 제외</Badge>
              ) : null}
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={excludePicked}
                onChange={(event) => setExcludePicked(event.target.checked)}
                className="size-4 rounded border-slate-300"
              />
              한 번 뽑힌 학생은 제외
            </label>

            {pool.length === 0 && roster.length > 0 ? (
              <p className="text-sm text-slate-500">
                모두 한 번씩 뽑혔습니다. 처음부터 다시 하려면 아래를 눌러 주세요.
              </p>
            ) : null}

            {pickedStudents.length > 0 ? (
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-xs font-medium text-slate-500">지금까지 뽑힌 순서</p>
                  <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setPickedIds([])}>
                    처음부터
                  </Button>
                </div>
                <ol className="flex flex-wrap gap-1">
                  {pickedStudents.map((student, index) => (
                    <li key={student.id}>
                      <Badge tone={student.id === current ? 'brand' : 'neutral'}>
                        {index + 1}. {student.name}
                      </Badge>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      {/*
        뽑은 이름의 전체 화면 공개. NoticeModal의 '크게 띄우기'와 같은 이유,
        같은 방식이다 — 뒷자리에서도 읽혀야 한다.
      */}
      {revealing && currentStudent !== null
        ? createPortal(
            <div
              role="dialog"
              aria-label="뽑힌 학생"
              className="no-print fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-surface p-8"
            >
              <p className={cx('text-center font-black text-slate-900', 'animate-pick-reveal text-board-xl')}>
                {currentStudent.name}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="lg" icon={Dices} variant="primary" disabled={pool.length === 0} onClick={draw}>
                  한 명 더
                </Button>
                <Button size="lg" icon={X} onClick={() => setRevealing(false)}>
                  닫기
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
