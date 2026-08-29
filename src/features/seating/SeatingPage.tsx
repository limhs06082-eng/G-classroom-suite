import { Bookmark, Eraser, Grid3x3, Monitor, Printer, Shuffle, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  MAX_SEAT_COLS,
  MAX_SEAT_ROWS,
  MIN_SEAT_COLS,
  MIN_SEAT_ROWS,
} from '../../shared/domain/types';
import { useActiveClass, useSuite } from '../../shared/roster/SuiteDataProvider';
import { Badge, Button, Card, ConfirmDialog, cx, EmptyState, PrintLayout, Tabs, usePrint, useToast } from '../../shared/ui';
import { openBoard } from '../../shared/window/openBoard';
import { ClassroomGrid, type GridMode } from './ClassroomGrid';
import { GroupingPanel } from './GroupingPanel';
import { useSeating } from './useSeating';

/**
 * 자리 배치 화면.
 *
 * 원본 G-seat-group-maker를 이식하면서 조작 방식을 하나 바꿨다.
 * 원본은 끌어다 놓기(drag & drop)였는데, 전자칠판은 손가락으로 누르고
 * 교사는 서서 조작한다. 눌러서 고르고 눌러서 바꾸는 방식이 더 잘 맞는다.
 */
type SeatingTab = 'seats' | 'groups';

export default function SeatingPage() {
  const activeClass = useActiveClass();
  const { data } = useSuite();
  const toast = useToast();
  const seating = useSeating();
  const printNow = usePrint();

  const [tab, setTab] = useState<SeatingTab>('seats');
  const [mode, setMode] = useState<GridMode>('assign');
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  const [confirmDeleteLayoutId, setConfirmDeleteLayoutId] = useState<string | null>(null);

  if (activeClass === null) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          title="학급을 먼저 만들어 주세요"
          description="학급과 명단이 있어야 자리를 배치할 수 있습니다."
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

  if (seating.roster.length === 0) {
    return (
      <Card title="자리 배치" icon={Grid3x3} accentClass="text-seating-500">
        <EmptyState
          icon={Users}
          title="학생 명단이 비어 있습니다"
          description="명단을 등록하면 무작위 배치를 바로 쓸 수 있습니다."
          action={
            <Link
              to="/roster"
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-press"
            >
              명단 등록하기
            </Link>
          }
        />
      </Card>
    );
  }

  const availableSeats = seating.seats.filter((seat) => !seat.isDisabled).length;
  const shortage = seating.roster.length - availableSeats;
  const groupCount = data.groups.filter((group) => group.classId === activeClass.id).length;

  const handleSeatClick = (seatId: string): void => {
    if (mode === 'layout') {
      seating.toggleSeatDisabled(seatId);
      return;
    }

    // 미배치 학생을 고른 상태면 그 자리에 앉힌다.
    if (selectedStudentId !== null) {
      seating.assignStudent(selectedStudentId, seatId);
      setSelectedStudentId(null);
      return;
    }

    if (selectedSeatId === null) {
      setSelectedSeatId(seatId);
      return;
    }

    if (selectedSeatId === seatId) {
      setSelectedSeatId(null);
      return;
    }

    seating.swapSeats(selectedSeatId, seatId);
    setSelectedSeatId(null);
  };

  const handleShuffle = (): void => {
    const result = seating.shuffleSeats();
    if (result.ok) {
      const lockedCount = seating.lockedStudentIds.size;
      toast.success(
        lockedCount > 0
          ? `자리를 새로 배치했습니다. 고정한 ${lockedCount}명은 그대로 두었습니다.`
          : '자리를 새로 배치했습니다.',
      );
      setSelectedSeatId(null);
      setSelectedStudentId(null);
    } else {
      toast.error(result.message ?? '자리를 배치하지 못했습니다.');
    }
  };

  const handleSaveLayout = (): void => {
    if (seating.saveCurrentLayout(layoutName)) {
      toast.success(`'${layoutName.trim()}' 자리표를 저장했습니다.`);
      setLayoutName('');
    } else {
      toast.error('자리표 이름을 입력해 주세요.');
    }
  };

  const handleLoadLayout = (layout: { id: string; name: string }): void => {
    const { droppedStudents } = seating.loadLayout(layout.id);

    toast.success(
      droppedStudents > 0
        ? `'${layout.name}' 자리표를 불러왔습니다. 지금 명단에 없는 ${droppedStudents}명은 자리에서 뺐습니다.`
        : `'${layout.name}' 자리표를 불러왔습니다.`,
    );
    setSelectedSeatId(null);
    setSelectedStudentId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-slate-900">자리·모둠</h1>

      <Tabs
        items={[
          { id: 'seats', label: '자리 배치' },
          { id: 'groups', label: '모둠 편성', count: groupCount },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id === 'groups' ? 'groups' : 'seats')}
      >
        {tab === 'groups' ? (
          <GroupingPanel />
        ) : (
          <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">
          학생 {seating.roster.length}명 · 자리 {availableSeats}개
        </Badge>
        {shortage > 0 ? <Badge tone="danger">자리 {shortage}개 부족</Badge> : null}
        {seating.lockedStudentIds.size > 0 ? (
          <Badge tone="brand">고정 {seating.lockedStudentIds.size}명</Badge>
        ) : null}

        <div className="ml-auto flex flex-wrap gap-2">
          <Button icon={Shuffle} variant="primary" onClick={handleShuffle}>
            무작위 배치
          </Button>
          <Button variant="secondary" icon={Monitor} onClick={() => openBoard('/board/seating')}>
            전자칠판
          </Button>
          <Button variant="secondary" icon={Printer} onClick={printNow}>
            자리표 인쇄
          </Button>
        </div>
      </div>

      {/*
        인쇄 전용 자리표. 화면에는 안 보이고 #print-root 포털로만 나간다.
        학부모 상담 주간에 교탁에 붙여 두는 종이가 이것이다.
      */}
      <PrintLayout
        title={`${activeClass.name} 자리 배치표`}
        subtitle={new Date().toISOString().slice(0, 10)}
        footer={[data.profile.schoolName, data.profile.teacherName].filter(Boolean).join(' · ')}
      >
        <p className="mb-2 text-center text-sm font-semibold">▲ 칠판 쪽</p>
        <table className="w-full border-collapse text-center text-sm">
          <tbody>
            {Array.from({ length: seating.rows }, (_, rowIndex) => rowIndex + 1).map((row) => (
              <tr key={row}>
                {Array.from({ length: seating.cols }, (_, colIndex) => colIndex + 1).map((col) => {
                  const id = `r${row}c${col}`;
                  const student = seating.studentBySeat.get(id);
                  const disabled = seating.seats.find((seat) => seat.id === id)?.isDisabled === true;

                  return (
                    <td
                      key={id}
                      className={cx('h-14 border border-black px-1', disabled && 'bg-slate-200')}
                    >
                      {disabled ? '' : (student?.name ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </PrintLayout>

      <Card
        title={activeClass.name}
        icon={Grid3x3}
        accentClass="text-seating-500"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex gap-0.5 rounded-control border border-slate-200 p-0.5"
              role="group"
              aria-label="자리표 보는 방향"
            >
              <Button
                size="sm"
                variant={seating.perspective === 'student' ? 'primary' : 'ghost'}
                aria-pressed={seating.perspective === 'student'}
                onClick={() => seating.setPerspective('student')}
              >
                학생 시점
              </Button>
              <Button
                size="sm"
                variant={seating.perspective === 'teacher' ? 'primary' : 'ghost'}
                aria-pressed={seating.perspective === 'teacher'}
                onClick={() => seating.setPerspective('teacher')}
              >
                교사 시점
              </Button>
            </div>
            <SizeStepper
              label="행"
              value={seating.rows}
              min={MIN_SEAT_ROWS}
              max={MAX_SEAT_ROWS}
              onChange={(next) => seating.setSize(next, seating.cols)}
            />
            <SizeStepper
              label="열"
              value={seating.cols}
              min={MIN_SEAT_COLS}
              max={MAX_SEAT_COLS}
              onChange={(next) => seating.setSize(seating.rows, next)}
            />
            <Button
              size="sm"
              variant={mode === 'layout' ? 'primary' : 'secondary'}
              aria-pressed={mode === 'layout'}
              onClick={() => {
                setMode(mode === 'layout' ? 'assign' : 'layout');
                setSelectedSeatId(null);
                setSelectedStudentId(null);
              }}
            >
              {mode === 'layout' ? '편집 끝내기' : '교실 편집'}
            </Button>
            <Button size="sm" variant="ghost" icon={Eraser} onClick={() => setConfirmClear(true)}>
              배치 지우기
            </Button>
          </div>
        }
      >
        {seating.perspective === 'teacher' ? (
          <p className="mb-2 text-sm text-brand-700">
            교탁에서 본 방향입니다. 칠판이 아래에 있습니다. 전자칠판에는 학생 시점으로 나갑니다.
          </p>
        ) : null}

        <p className="mb-3 text-sm text-slate-500">
          {mode === 'layout'
            ? '자리를 누르면 사용 안 함으로 바뀝니다. 책상이 없는 자리를 표시해 주세요.'
            : selectedStudentId !== null
              ? '앉힐 자리를 눌러 주세요.'
              : selectedSeatId !== null
                ? '바꿀 자리를 한 번 더 눌러 주세요. 같은 자리를 누르면 취소됩니다.'
                : '자리를 누르면 선택되고, 다른 자리를 누르면 서로 바뀝니다.'}
        </p>

        <ClassroomGrid
          seats={seating.seats}
          cols={seating.cols}
          studentBySeat={seating.studentBySeat}
          lockedStudentIds={seating.lockedStudentIds}
          perspective={seating.perspective}
          mode={mode}
          selectedSeatId={selectedSeatId}
          onSeatClick={handleSeatClick}
          onToggleLock={
            mode === 'assign'
              ? (studentId) => {
                  seating.toggleLock(studentId);
                }
              : undefined
          }
        />
      </Card>

      {seating.unseated.length > 0 ? (
        <Card title={`아직 자리가 없는 학생 ${seating.unseated.length}명`} icon={Users}>
          <p className="mb-3 text-sm text-slate-500">
            학생을 고른 뒤 앉힐 자리를 누르면 배치됩니다.
          </p>
          <ul className="flex flex-wrap gap-2">
            {seating.unseated.map((student) => {
              const selected = selectedStudentId === student.id;
              return (
                <li key={student.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedStudentId(selected ? null : student.id);
                      setSelectedSeatId(null);
                      setMode('assign');
                    }}
                    className={cx(
                      'inline-flex items-baseline gap-1.5 rounded-control border px-2.5 py-1.5 text-sm',
                      selected
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-surface text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    <span className="font-mono text-xs text-slate-400">{student.number}</span>
                    {student.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card title="저장한 자리표" icon={Bookmark}>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-48 flex-1 text-sm text-slate-600">
            자리표 이름
            <input
              type="text"
              value={layoutName}
              onChange={(event) => setLayoutName(event.target.value)}
              placeholder="예: 3월 자리, 시험 대형"
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
            />
          </label>
          <Button variant="secondary" onClick={handleSaveLayout}>
            지금 배치 저장
          </Button>
        </div>

        {seating.layouts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            저장한 자리표가 없습니다. 자리를 배치한 뒤 이름을 붙여 저장하면 나중에 그대로
            불러올 수 있습니다. 교실 크기와 사용 안 함 자리도 함께 저장됩니다.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {seating.layouts.map((layout) => (
              <li
                key={layout.id}
                className="flex flex-wrap items-center gap-2 rounded-control border border-slate-200 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                  {layout.name}
                </span>
                <span className="text-xs text-slate-400" data-numeric>
                  {layout.rows}행 {layout.cols}열 · {layout.positions.length}명
                </span>
                <Button size="sm" variant="secondary" onClick={() => handleLoadLayout(layout)}>
                  불러오기
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDeleteLayoutId(layout.id)}
                >
                  삭제
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
          </div>
        )}
      </Tabs>

      <ConfirmDialog
        open={confirmClear}
        title="자리 배치를 지울까요?"
        description="모든 학생이 자리에서 빠집니다. 교실 모양과 고정 설정은 그대로 남습니다. 지우기 직전 상태는 자동으로 백업됩니다."
        confirmLabel="배치 지우기"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          void (async () => {
            await seating.clearSeats();
            setConfirmClear(false);
            setSelectedSeatId(null);
            toast.info('자리 배치를 지웠습니다.');
          })();
        }}
      />

      <ConfirmDialog
        open={confirmDeleteLayoutId !== null}
        title="저장한 자리표를 지울까요?"
        description="지금 교실 배치는 그대로 남습니다. 저장해 둔 자리표만 사라집니다."
        confirmLabel="자리표 지우기"
        onCancel={() => setConfirmDeleteLayoutId(null)}
        onConfirm={() => {
          if (confirmDeleteLayoutId !== null) seating.removeLayout(confirmDeleteLayoutId);
          setConfirmDeleteLayoutId(null);
          toast.info('저장한 자리표를 지웠습니다.');
        }}
      />
    </div>
  );
}

function SizeStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-control border border-slate-200 px-1.5 py-1">
      <span className="text-xs text-slate-500">{label}</span>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`${label} 줄이기`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="size-6 p-0"
      >
        −
      </Button>
      <span className="w-5 text-center font-mono text-sm text-slate-800">{value}</span>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`${label} 늘리기`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="size-6 p-0"
      >
        +
      </Button>
    </div>
  );
}
