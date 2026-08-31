import { Dices, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useActiveClass, useRoster, useSuite } from '../../shared/roster/SuiteDataProvider';
import { useToday } from '../../shared/state/useToday';
import { Badge, Button, cx, Modal } from '../../shared/ui';
import { absentToday } from '../attendance/attendanceCore';
import { systemRng } from '../seating/rng';
import { drawMany, remainingPool } from './pickerCore';

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
  const [count, setCount] = useState(1);
  const [current, setCurrent] = useState<string[]>([]);
  const [revealing, setRevealing] = useState(false);

  const absentIds = activeClass === null ? [] : absentToday(data.attendanceRecords, activeClass.id, today);
  const pool = remainingPool(roster, absentIds, pickedIds, excludePicked);
  const pickedStudents = pickedIds
    .map((id) => roster.find((student) => student.id === id))
    .filter((student) => student !== undefined);
  const currentStudents = current
    .map((id) => roster.find((student) => student.id === id))
    .filter((student) => student !== undefined);

  const draw = (): void => {
    const students = drawMany(pool, count, systemRng);
    if (students.length === 0) return;
    setCurrent(students.map((student) => student.id));
    setPickedIds((ids) => [...ids, ...students.map((s) => s.id).filter((id) => !ids.includes(id))]);
    setRevealing(true);
  };

  /*
   * 공개 화면의 키보드. 교실을 돌아다니며 연달아 뽑는 도구라 손이
   * 마우스에 묶이면 안 된다 — Enter/Space는 한 번 더, Esc는 닫기.
   */
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const poolEmptyRef = useRef(pool.length === 0);
  poolEmptyRef.current = pool.length === 0;

  useEffect(() => {
    if (!revealing) return;
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setRevealing(false);
      if ((event.key === 'Enter' || event.key === ' ') && !poolEmptyRef.current) {
        event.preventDefault();
        drawRef.current();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [revealing]);

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

            <div>
              <p className="mb-1 text-sm text-slate-700">몇 명 뽑을까요</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant={count === n ? 'primary' : 'secondary'}
                    aria-pressed={count === n}
                    onClick={() => setCount(n)}
                  >
                    {n}명
                  </Button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, roster.length)}
                  value={count}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (Number.isFinite(parsed) && parsed >= 1) setCount(parsed);
                  }}
                  aria-label="직접 입력 인원"
                  className="h-9 w-16 rounded-control border border-slate-300 px-2 text-center text-sm"
                />
                <span className="text-sm text-slate-500">명</span>
              </div>
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
                      <Badge tone={current.includes(student.id) ? 'brand' : 'neutral'}>
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
      {revealing && currentStudents.length > 0
        ? createPortal(
            <div
              role="dialog"
              aria-label="뽑힌 학생"
              className="no-print fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-surface p-8"
            >
              {/* 여럿을 뽑으면 이름마다 줄을 준다. 한 줄에 이어 붙이면
                  누가 뽑혔는지 뒷자리에서 세어 읽어야 한다. */}
              <div className="flex flex-col items-center gap-2">
                {currentStudents.map((student) => (
                  <p
                    key={student.id}
                    className={cx(
                      'animate-pick-reveal text-center font-black text-slate-900',
                      currentStudents.length === 1
                        ? 'text-board-xl'
                        : currentStudents.length <= 3
                          ? 'text-board-lg'
                          : 'text-board-md',
                    )}
                  >
                    {student.name}
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="lg" icon={Dices} variant="primary" disabled={pool.length === 0} onClick={draw}>
                  {count === 1 ? '한 명 더' : `${count}명 더`}
                </Button>
                <Button size="lg" icon={X} onClick={() => setRevealing(false)}>
                  닫기
                </Button>
              </div>
              <p className="text-sm text-slate-400">Enter는 한 번 더, Esc는 닫기입니다</p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
