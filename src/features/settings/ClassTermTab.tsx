import { Archive, ArchiveRestore, CalendarRange, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';

import type { ClassRoom, Term } from '../../shared/domain/types';
import {
  addClassRoom,
  addTerm,
  countClassData,
  deleteClassRoom,
  setTermArchived,
  updateClassRoom,
  updateTerm,
  visibleTerms,
  type ClassDataCount,
} from '../../shared/roster/classOps';
import { useSuite } from '../../shared/roster/SuiteDataProvider';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Modal, useToast } from '../../shared/ui';

/**
 * 학급·학기 관리.
 *
 * 처음 설정 마법사 뒤로는 학급을 늘릴 방법이 없었다. 이 화면이 그 길이다.
 * 학기 초에 한 번 쓰는 화면이라 설정 안에 둔다.
 */

/**
 * 삭제 확인창에 보여 줄 문장.
 *
 * 프로필 셋과 dutyCompletions는 넣지 않는다. 교사가 만든 적 없는 내부 자료라
 * 개수를 알려 줘도 판단에 도움이 안 된다. 지우는 것과 세는 것은 일치해야
 * 하지만, 세는 것과 보여 주는 것은 다를 수 있다.
 */
function deleteSummary(count: ClassDataCount): string {
  const parts = [
    count.students > 0 ? `학생 ${count.students}명` : null,
    count.groups > 0 ? `모둠 ${count.groups}개` : null,
    count.dutyRoles > 0 ? `역할 ${count.dutyRoles}개` : null,
    count.scoreEntries > 0 ? `점수 기록 ${count.scoreEntries}건` : null,
    count.scoreGoals > 0 ? `목표 ${count.scoreGoals}개` : null,
    count.assignments > 0 ? `과제 ${count.assignments}개` : null,
  ].filter((part): part is string => part !== null);

  return parts.length === 0
    ? '이 학급에는 아직 자료가 없습니다.'
    : `${parts.join(' · ')}가 함께 사라집니다.`;
}

export function ClassTermTab() {
  const { data, update, guard } = useSuite();
  const toast = useToast();

  const [classForm, setClassForm] = useState<{ room: ClassRoom | null; termId: string } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<ClassRoom | null>(null);
  const [termForm, setTermForm] = useState<Term | null | 'new'>(null);

  const terms = visibleTerms(data);
  const archived = data.terms.filter((term) => term.archivedAt !== undefined);
  const onlyOneClass = data.classRooms.length <= 1;

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="학급"
        icon={Users}
        action={
          terms.length === 0 ? null : (
            <Button
              size="sm"
              icon={Plus}
              onClick={() => setClassForm({ room: null, termId: terms[0]?.id ?? '' })}
            >
              학급 추가
            </Button>
          )
        }
      >
        {terms.length === 0 ? (
          <EmptyState
            title="학기가 없습니다"
            description="학급은 학기에 속합니다. 아래에서 학기를 먼저 만들어 주세요."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {terms.map((term) => {
              const rooms = data.classRooms.filter((room) => room.termId === term.id);

              return (
                <section key={term.id}>
                  <h3 className="text-sm font-semibold text-slate-700">{term.name}</h3>

                  {rooms.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-500">아직 학급이 없습니다.</p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1">
                      {rooms.map((room) => {
                        const count = countClassData(data, room.id);

                        return (
                          <li
                            key={room.id}
                            className="flex flex-wrap items-center gap-2 rounded-control border border-slate-200 px-2.5 py-1.5 text-sm"
                          >
                            <span className="min-w-0 flex-1 truncate">{room.name}</span>

                            {room.grade === undefined && room.classNo === undefined ? null : (
                              <span className="shrink-0 text-slate-500">
                                {room.grade ?? '-'}학년 {room.classNo ?? '-'}반
                              </span>
                            )}

                            <Badge tone={count.students > 0 ? 'brand' : 'neutral'}>
                              {count.students}명
                            </Badge>

                            {room.id === data.activeClassId ? (
                              <Badge tone="success">보는 중</Badge>
                            ) : null}

                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Pencil}
                              iconOnly
                              aria-label={`${room.name} 수정`}
                              onClick={() => setClassForm({ room, termId: room.termId })}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Trash2}
                              iconOnly
                              disabled={onlyOneClass}
                              aria-label={`${room.name} 삭제`}
                              onClick={() => setDeleting(room)}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}

            {onlyOneClass ? (
              <p className="text-sm text-slate-500">학급이 하나뿐일 때는 지울 수 없습니다.</p>
            ) : null}
          </div>
        )}
      </Card>

      <Card
        title="학기"
        icon={CalendarRange}
        action={
          <Button size="sm" icon={Plus} onClick={() => setTermForm('new')}>
            학기 추가
          </Button>
        }
      >
        <div className="flex flex-col gap-1">
          {terms.map((term) => {
            const rooms = data.classRooms.filter((room) => room.termId === term.id).length;
            const isActive = term.id === data.activeTermId;

            return (
              <div
                key={term.id}
                className="flex flex-wrap items-center gap-2 rounded-control border border-slate-200 px-2.5 py-1.5 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{term.name}</span>
                <span className="shrink-0 text-slate-500">
                  {term.startDate} ~ {term.endDate}
                </span>
                <Badge>{rooms}개 학급</Badge>
                {isActive ? <Badge tone="success">사용 중</Badge> : null}

                <Button
                  size="sm"
                  variant="ghost"
                  icon={Pencil}
                  iconOnly
                  aria-label={`${term.name} 수정`}
                  onClick={() => setTermForm(term)}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Archive}
                  disabled={isActive}
                  aria-label={`${term.name} 보관`}
                  onClick={() => {
                    update((current) => setTermArchived(current, term.id, true));
                    toast.info(`${term.name}을(를) 보관했습니다. 자료는 그대로 남습니다.`);
                  }}
                >
                  보관
                </Button>
              </div>
            );
          })}

          {data.activeTermId === null ? null : (
            <p className="text-sm text-slate-500">
              사용 중인 학기는 보관할 수 없습니다. 보관해도 자료는 지워지지 않습니다.
            </p>
          )}

          {archived.length === 0 ? null : (
            <div className="mt-2 border-t border-slate-100 pt-2">
              <h3 className="text-sm font-semibold text-slate-500">보관한 학기</h3>
              <ul className="mt-1 flex flex-col gap-1">
                {archived.map((term) => (
                  <li
                    key={term.id}
                    className="flex flex-wrap items-center gap-2 rounded-control border border-slate-100 px-2.5 py-1.5 text-sm text-slate-500"
                  >
                    <span className="min-w-0 flex-1 truncate">{term.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={ArchiveRestore}
                      aria-label={`${term.name} 되돌리기`}
                      onClick={() => {
                        update((current) => setTermArchived(current, term.id, false));
                        toast.success(`${term.name}을(를) 목록으로 되돌렸습니다.`);
                      }}
                    >
                      되돌리기
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      <ClassFormModal
        form={classForm}
        onClose={() => setClassForm(null)}
        onSave={(input) => {
          if (classForm === null) return;

          if (classForm.room === null) {
            update((current) => addClassRoom(current, { termId: classForm.termId, ...input }));
            toast.success(`${input.name} 학급을 만들었습니다.`);
          } else {
            const roomId = classForm.room.id;
            update((current) => updateClassRoom(current, roomId, input));
            toast.success('학급 정보를 고쳤습니다.');
          }
          setClassForm(null);
        }}
      />

      <TermFormModal
        form={termForm}
        onClose={() => setTermForm(null)}
        onSave={(input) => {
          if (termForm === 'new') {
            update((current) => addTerm(current, input));
            toast.success('학기를 만들었습니다.');
          } else if (termForm !== null) {
            const termId = termForm.id;
            update((current) =>
              updateTerm(current, termId, {
                name: input.name,
                startDate: input.startDate,
                endDate: input.endDate,
              }),
            );
            toast.success('학기 정보를 고쳤습니다.');
          }
          setTermForm(null);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`${deleting?.name ?? ''} 학급을 지울까요?`}
        description={
          deleting === null
            ? ''
            : `${deleteSummary(countClassData(data, deleting.id))} 지우기 직전 상태는 자동으로 백업되니 되돌릴 수 있습니다.`
        }
        destructive
        confirmPhrase={deleting?.name}
        confirmLabel="학급 삭제"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting === null) return;
          void (async () => {
            await guard('학급 삭제 직전');
            update((current) => deleteClassRoom(current, deleting.id));
            toast.warning(`${deleting.name} 학급을 지웠습니다.`);
            setDeleting(null);
          })();
        }}
      />
    </div>
  );
}

/** 숫자 칸에 들어온 글자를 숫자로. 비었거나 숫자가 아니면 undefined. */
function toNumber(value: string): number | undefined {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function ClassFormModal({
  form,
  onClose,
  onSave,
}: {
  form: { room: ClassRoom | null; termId: string } | null;
  onClose: () => void;
  onSave: (input: { name: string; grade?: number; classNo?: number }) => void;
}) {
  const room = form?.room ?? null;
  const [name, setName] = useState(room?.name ?? '');
  const [grade, setGrade] = useState(room?.grade === undefined ? '' : String(room.grade));
  const [classNo, setClassNo] = useState(room?.classNo === undefined ? '' : String(room.classNo));

  return (
    <Modal
      // 대상이 바뀌면 다시 마운트해 입력칸을 새 값으로 채운다.
      key={room?.id ?? 'new'}
      open={form !== null}
      onClose={onClose}
      title={room === null ? '학급 추가' : '학급 수정'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            disabled={name.trim() === ''}
            onClick={() =>
              onSave({
                name: name.trim(),
                ...(toNumber(grade) === undefined ? {} : { grade: toNumber(grade) }),
                ...(toNumber(classNo) === undefined ? {} : { classNo: toNumber(classNo) }),
              })
            }
          >
            저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="block text-sm">
          <span className="text-slate-700">학급 이름</span>
          <input
            defaultValue={room?.name ?? ''}
            placeholder="3학년 2반"
            onChange={(event) => setName(event.target.value)}
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>

        <div className="flex gap-3">
          <label className="block flex-1 text-sm">
            <span className="text-slate-700">학년</span>
            <input
              type="number"
              min={1}
              defaultValue={room?.grade ?? ''}
              onChange={(event) => setGrade(event.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
            />
          </label>
          <label className="block flex-1 text-sm">
            <span className="text-slate-700">반</span>
            <input
              type="number"
              min={1}
              defaultValue={room?.classNo ?? ''}
              onChange={(event) => setClassNo(event.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
            />
          </label>
        </div>

        <p className="text-sm text-slate-500">
          학년·반은 비워 두어도 됩니다. 나중에 시간표를 불러올 때 씁니다.
        </p>
      </div>
    </Modal>
  );
}

function TermFormModal({
  form,
  onClose,
  onSave,
}: {
  form: Term | null | 'new';
  onClose: () => void;
  onSave: (input: {
    schoolYear: string;
    semester: string;
    name?: string;
    startDate: string;
    endDate: string;
  }) => void;
}) {
  const term = form === 'new' || form === null ? null : form;
  const thisYear = String(new Date().getFullYear());

  const [schoolYear, setSchoolYear] = useState(term?.schoolYear ?? thisYear);
  const [semester, setSemester] = useState(term?.semester ?? '1학기');
  const [name, setName] = useState(term?.name ?? '');
  const [startDate, setStartDate] = useState(term?.startDate ?? `${thisYear}-03-02`);
  const [endDate, setEndDate] = useState(term?.endDate ?? `${thisYear}-07-20`);

  return (
    <Modal
      key={term?.id ?? 'new'}
      open={form !== null}
      onClose={onClose}
      title={term === null ? '학기 추가' : '학기 수정'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={() => onSave({ schoolYear, semester, name, startDate, endDate })}
          >
            저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {term === null ? (
          <div className="flex gap-3">
            <label className="block flex-1 text-sm">
              <span className="text-slate-700">학년도</span>
              <input
                defaultValue={schoolYear}
                onChange={(event) => setSchoolYear(event.target.value)}
                className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
              />
            </label>
            <label className="block flex-1 text-sm">
              <span className="text-slate-700">학기</span>
              <select
                defaultValue={semester}
                onChange={(event) => setSemester(event.target.value)}
                className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
              >
                <option value="1학기">1학기</option>
                <option value="2학기">2학기</option>
              </select>
            </label>
          </div>
        ) : null}

        <label className="block text-sm">
          <span className="text-slate-700">이름</span>
          <input
            defaultValue={term?.name ?? ''}
            placeholder={`${schoolYear}학년도 ${semester}`}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>

        <div className="flex gap-3">
          <label className="block flex-1 text-sm">
            <span className="text-slate-700">시작일</span>
            <input
              type="date"
              defaultValue={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
            />
          </label>
          <label className="block flex-1 text-sm">
            <span className="text-slate-700">끝나는 날</span>
            <input
              type="date"
              defaultValue={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
            />
          </label>
        </div>

        <p className="text-sm text-slate-500">
          학기는 지울 수 없습니다. 끝난 학기는 보관해서 목록에서 치우세요.
        </p>
      </div>
    </Modal>
  );
}
