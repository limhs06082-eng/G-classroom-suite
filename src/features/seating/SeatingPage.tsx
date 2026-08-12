import { Eraser, Grid3x3, Monitor, Shuffle, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  MAX_SEAT_COLS,
  MAX_SEAT_ROWS,
  MIN_SEAT_COLS,
  MIN_SEAT_ROWS,
} from '../../shared/domain/types';
import { useActiveClass } from '../../shared/roster/SuiteDataProvider';
import { Badge, Button, Card, ConfirmDialog, cx, EmptyState, useToast } from '../../shared/ui';
import { ClassroomGrid, type GridMode } from './ClassroomGrid';
import { useSeating } from './useSeating';

/**
 * 자리 배치 화면.
 *
 * 원본 G-seat-group-maker를 이식하면서 조작 방식을 하나 바꿨다.
 * 원본은 끌어다 놓기(drag & drop)였는데, 전자칠판은 손가락으로 누르고
 * 교사는 서서 조작한다. 눌러서 고르고 눌러서 바꾸는 방식이 더 잘 맞는다.
 */
export default function SeatingPage() {
  const activeClass = useActiveClass();
  const toast = useToast();
  const seating = useSeating();

  const [mode, setMode] = useState<GridMode>('assign');
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

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
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
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
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">자리 배치</h1>
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
          <Link
            to="/board/seating"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-control border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Monitor className="size-4" aria-hidden />
            전자칠판
          </Link>
        </div>
      </div>

      <Card
        title={activeClass.name}
        icon={Grid3x3}
        accentClass="text-seating-500"
        action={
          <div className="flex flex-wrap items-center gap-2">
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
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
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
