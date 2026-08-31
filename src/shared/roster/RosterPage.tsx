import { Pencil, RotateCcw, Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Modal,
  Table,
  Tabs,
  useToast,
  type Column,
} from '../ui';
import type { DutyRole, Gender, Student } from '../domain/types';
import { RosterImportPanel } from './RosterImportPanel';
import {
  applyStudentDetail,
  collectTags,
  readStudentDetail,
  type StudentDetail,
} from './studentDetail';
import { createId } from '../ids';
import { addObservation, observationsOf, removeObservation } from './observationCore';
import {
  addStudent,
  applyRosterImport,
  deleteStudent,
  setStudentStatus,
  updateStudent,
} from './rosterOps';
import { useActiveClass, useSuite } from './SuiteDataProvider';

/**
 * 학생 명단 관리.
 *
 * 원본 4곳(seating StudentManagerModal, duty StudentManager,
 * assignment ClassManagement+StudentView, reward studentUtils)을 대체한다.
 * 여기서 한 번 입력한 명단을 5개 기능이 모두 쓴다.
 */
export default function RosterPage() {
  const { data, update, guard } = useSuite();
  const activeClass = useActiveClass();
  const toast = useToast();

  const [tab, setTab] = useState('list');
  const [editing, setEditing] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);

  if (activeClass === null) {
    return (
      <Card title="학생 명단">
        <EmptyState
          icon={Users}
          title="아직 학급이 없습니다"
          description="학교와 학급을 먼저 만들면 명단을 등록할 수 있습니다."
          action={
            <Link
              to="/setup"
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-press"
            >
              학급 설정하기
            </Link>
          }
        />
      </Card>
    );
  }

  const students = data.students
    .filter((student) => student.classId === activeClass.id)
    .sort((a, b) => a.number - b.number);
  const active = students.filter((student) => student.status === 'active');
  const inactive = students.filter((student) => student.status === 'inactive');

  const columns: Column<Student>[] = [
    {
      key: 'number',
      header: '번호',
      align: 'center',
      widthClass: 'w-16',
      render: (student) => <span className="font-mono text-slate-500">{student.number}</span>,
    },
    { key: 'name', header: '이름', render: (student) => student.name },
    {
      key: 'status',
      header: '상태',
      align: 'center',
      widthClass: 'w-28',
      hideOnNarrow: true,
      render: (student) =>
        student.status === 'active' ? (
          <Badge tone="success">재학</Badge>
        ) : (
          <Badge tone="neutral">전출·제외</Badge>
        ),
    },
    {
      key: 'memo',
      header: '메모',
      hideOnNarrow: true,
      render: (student) => <span className="text-slate-500">{student.statusMemo ?? ''}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      widthClass: 'w-40',
      render: (student) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            icon={Pencil}
            iconOnly
            aria-label={`${student.name} 정보 수정`}
            onClick={() => setEditing(student)}
          />
          {student.status === 'active' ? (
            <Button
              size="sm"
              variant="ghost"
              icon={UserMinus}
              iconOnly
              aria-label={`${student.name} 전출 처리`}
              onClick={() => {
                update((current) => setStudentStatus(current, student.id, 'inactive'));
                toast.info(`${student.name} 학생을 전출 처리했습니다. 기록은 그대로 남습니다.`, {
                  actionLabel: '실행 취소',
                  onAction: () =>
                    update((current) => setStudentStatus(current, student.id, 'active')),
                });
              }}
            />
          ) : (
            <Button
              size="sm"
              variant="ghost"
              icon={RotateCcw}
              iconOnly
              aria-label={`${student.name} 복귀`}
              onClick={() => {
                update((current) => setStudentStatus(current, student.id, 'active'));
                toast.success(`${student.name} 학생을 복귀시켰습니다.`);
              }}
            />
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={Trash2}
            iconOnly
            aria-label={`${student.name} 완전 삭제`}
            onClick={() => setDeleting(student)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={`${activeClass.name} 학생 명단`}
        icon={Users}
        action={
          <Button
            size="sm"
            icon={UserPlus}
            onClick={() => {
              const nextNumber = Math.max(0, ...students.map((s) => s.number)) + 1;
              /*
               * 추가하자마자 편집 모달을 연다. 전에는 "표에서 '새 학생' 행을
               * 찾아 → 연필 → 이름 고침"까지 대여섯 클릭이었다. id를 미리
               * 만들어 두는 이유는 모달이 그 학생을 가리켜야 하기 때문이다.
               */
              const id = createId();
              const now = new Date().toISOString();
              update((current) =>
                addStudent(current, activeClass.id, { id, number: nextNumber, name: '새 학생' }),
              );
              setEditing({
                id,
                classId: activeClass.id,
                number: nextNumber,
                name: '새 학생',
                status: 'active',
                createdAt: now,
                updatedAt: now,
              });
            }}
          >
            학생 추가
          </Button>
        }
        bodyClassName="p-0"
      >
        <div className="p-4">
          <Tabs
            items={[
              { id: 'list', label: '명단', count: active.length },
              { id: 'inactive', label: '전출·제외', count: inactive.length },
              { id: 'import', label: '붙여넣기로 등록' },
            ]}
            activeId={tab}
            onChange={setTab}
          >
            {tab === 'list' ? (
              <Table
                columns={columns}
                rows={active}
                rowKey={(student) => student.id}
                caption={`${activeClass.name} 재학생 명단`}
                dense
                empty={
                  <EmptyState
                    icon={Users}
                    title="아직 등록된 학생이 없습니다"
                    description="붙여넣기로 한 번에 등록하면 자리배치·당번·보상·과제에서 모두 쓸 수 있습니다."
                    action={<Button variant="primary" onClick={() => setTab('import')}>붙여넣기로 등록</Button>}
                  />
                }
              />
            ) : null}

            {tab === 'inactive' ? (
              <Table
                columns={columns}
                rows={inactive}
                rowKey={(student) => student.id}
                caption="전출·제외 학생"
                dense
                empty={
                  <EmptyState
                    title="전출·제외된 학생이 없습니다"
                    description="전출 처리해도 학생과 기록은 지워지지 않고 이곳에 남습니다."
                  />
                }
              />
            ) : null}

            {tab === 'import' ? (
              <RosterImportPanel
                onApply={(rows, mode) => {
                  void (async () => {
                    // 명단 일괄 변경은 되돌리기 어렵다. 직전 상태를 반드시 남긴다.
                    await guard('명단 가져오기 직전');
                    update((current) => applyRosterImport(current, activeClass.id, rows, mode));
                    toast.success(`${rows.length}명을 명단에 반영했습니다.`);
                    setTab('list');
                  })();
                }}
              />
            ) : null}
          </Tabs>
        </div>
      </Card>

      <EditStudentModal
        student={editing}
        detail={editing === null ? null : readStudentDetail(data, editing.id)}
        roles={
          editing === null
            ? []
            : data.dutyRoles.filter((role) => role.classId === editing.classId)
        }
        knownTags={editing === null ? [] : collectTags(data, editing.classId)}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing === null) return;
          update((current) => {
            const renamed = updateStudent(current, editing.id, {
              number: patch.number,
              name: patch.name,
            });
            // 두 번 나눠 쓰지 않는다. 중간에 실패하면 학생 정보가 반쪽이 된다.
            return applyStudentDetail(renamed, editing.id, patch.detail);
          });
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`${deleting?.name ?? ''} 학생을 완전히 지울까요?`}
        description="이 학생의 자리배치·당번·점수·과제 기록이 모두 함께 사라집니다. 전학을 간 경우라면 삭제 대신 전출 처리를 쓰세요. 전출은 기록을 남깁니다."
        destructive
        confirmLabel="완전 삭제"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting === null) return;
          void (async () => {
            await guard('학생 완전 삭제 직전');
            update((current) => deleteStudent(current, deleting.id));
            toast.warning(`${deleting.name} 학생을 삭제했습니다.`);
            setDeleting(null);
          })();
        }}
      />
    </div>
  );
}

const GENDERS: Array<{ id: Gender; label: string }> = [
  { id: 'male', label: '남' },
  { id: 'female', label: '여' },
  { id: 'none', label: '지정 안 함' },
];

/**
 * 학생 정보 수정.
 *
 * 성별·태그는 자리 배치, 별명은 활동·보상, 고정 역할은 역할·당번이 쓴다.
 * 서로 다른 기능이지만 교사에게는 전부 "이 학생의 정보"라 한 곳에 모은다.
 * 명단을 한 번만 등록한다는 통합의 전제와 같은 논리다.
 */
function EditStudentModal({
  student,
  detail,
  roles,
  knownTags,
  onClose,
  onSave,
}: {
  student: Student | null;
  detail: StudentDetail | null;
  /** 이 학생 학급의 역할만. 다른 학급 역할을 고르면 참조가 깨진다. */
  roles: DutyRole[];
  knownTags: string[];
  onClose: () => void;
  onSave: (patch: { number: number; name: string; detail: Partial<StudentDetail> }) => void;
}) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [gender, setGender] = useState<Gender>(detail?.gender ?? 'none');
  const [tags, setTags] = useState<string[]>(detail?.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [nickname, setNickname] = useState(detail?.nickname ?? '');
  const [fixedRoleId, setFixedRoleId] = useState(detail?.fixedRoleId ?? '');

  const addTag = (value: string): void => {
    const trimmed = value.trim();
    if (trimmed === '' || tags.includes(trimmed)) return;
    setTags([...tags, trimmed]);
    setTagDraft('');
  };

  // 열릴 때마다 대상 학생의 값으로 채운다.
  const key = student?.id ?? 'none';

  return (
    <Modal
      key={key}
      open={student !== null}
      onClose={onClose}
      title="학생 정보 수정"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const parsedNumber = Number.parseInt(number, 10);
              // 태그 칸에 치다 만 것도 저장에 포함한다. 엔터를 안 눌렀다고 버리면 잃어버린다.
              const finalTags = tagDraft.trim() === '' ? tags : [...tags, tagDraft.trim()];

              onSave({
                number: Number.isFinite(parsedNumber) ? parsedNumber : (student?.number ?? 0),
                name: name.trim() === '' ? (student?.name ?? '') : name.trim(),
                detail: {
                  gender,
                  tags: finalTags,
                  nickname: nickname.trim(),
                  fixedRoleId: fixedRoleId === '' ? null : fixedRoleId,
                },
              });
            }}
          >
            저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="block text-sm">
          <span className="text-slate-700">번호</span>
          <input
            type="number"
            min={1}
            defaultValue={student?.number ?? ''}
            onChange={(event) => setNumber(event.target.value)}
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">이름</span>
          <input
            type="text"
            defaultValue={student?.name ?? ''}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
        </label>
        <p className="text-sm text-slate-500">
          번호가 이미 쓰이고 있으면 저장할 때 비어 있는 번호로 자동 조정됩니다.
        </p>

        <div className="border-t border-slate-100 pt-3">
          <span className="text-sm text-slate-700">성별</span>
          <div className="mt-1 flex gap-2">
            {GENDERS.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={gender === item.id ? 'primary' : 'secondary'}
                aria-pressed={gender === item.id}
                onClick={() => setGender(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <p className="mt-1 text-sm text-slate-500">자리·모둠에서 남녀를 섞어 앉힐 때 씁니다.</p>
        </div>

        <div>
          <label className="block text-sm">
            <span className="text-slate-700">특성 태그</span>
            <input
              type="text"
              value={tagDraft}
              placeholder="예: 앞자리, 시력, 도우미"
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                addTag(tagDraft);
              }}
              className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
            />
          </label>

          {tags.length === 0 ? null : (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-label={`${tag} 태그 빼기`}
                  onClick={() => setTags(tags.filter((item) => item !== tag))}
                >
                  <Badge tone="brand">{tag} ×</Badge>
                </button>
              ))}
            </div>
          )}

          {knownTags.filter((tag) => !tags.includes(tag)).length === 0 ? null : (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="text-sm text-slate-500">이미 쓴 태그</span>
              {knownTags
                .filter((tag) => !tags.includes(tag))
                .map((tag) => (
                  <button key={tag} type="button" onClick={() => addTag(tag)}>
                    <Badge>{tag}</Badge>
                  </button>
                ))}
            </div>
          )}
        </div>

        <label className="block text-sm">
          <span className="text-slate-700">별명</span>
          <input
            type="text"
            aria-label="별명"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          />
          <span className="mt-1 block text-slate-500">활동·보상에서 이름 대신 찾을 때 씁니다.</span>
        </label>

        <label className="block text-sm">
          <span className="text-slate-700">고정 역할</span>
          <select
            value={fixedRoleId}
            onChange={(event) => setFixedRoleId(event.target.value)}
            className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3"
          >
            <option value="">(고정 역할 없음)</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-slate-500">
            역할·당번을 자동 배정할 때 이 학생은 늘 이 역할을 맡습니다.
          </span>
        </label>

        {student !== null ? <ObservationSection student={student} /> : null}
      </div>
    </Modal>
  );
}

/**
 * 관찰 기록.
 *
 * 학생별 날짜 있는 메모의 타임라인이다. 특성 태그(한 단어 분류)와 달리
 * 쌓인다 — 학기말 생활기록부·상담 준비 때 시간순으로 꺼내 쓴다.
 *
 * 모달의 [저장]과 따로 논다. 위 필드들은 고치다 취소할 수 있는 값이지만
 * 기록은 적는 순간이 사실이라, 추가·삭제가 바로 저장된다.
 */
function ObservationSection({ student }: { student: Student }) {
  const { data, update } = useSuite();
  const [text, setText] = useState('');

  const mine = observationsOf(data.observations, student.id);

  const add = (): void => {
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
    <div className="border-t border-slate-100 pt-3">
      <span className="text-sm text-slate-700">관찰 기록</span>
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          add();
        }}
        placeholder="예: 모둠 활동에서 친구를 먼저 도왔다 — Enter로 저장"
        aria-label={`${student.name} 관찰 기록 추가`}
        className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3 text-sm"
      />
      <span className="mt-1 block text-sm text-slate-500">
        날짜와 함께 바로 저장됩니다. 생활기록부·상담 준비 때 시간순으로 봅니다.
      </span>

      {mine.length > 0 ? (
        <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
          {mine.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start gap-2 rounded-control border border-slate-200 px-2.5 py-1.5"
            >
              <span data-numeric className="shrink-0 pt-0.5 text-xs text-slate-400">
                {entry.date}
              </span>
              <span className="min-w-0 flex-1 text-sm text-slate-800">{entry.text}</span>
              <button
                type="button"
                aria-label={`${entry.date} 관찰 기록 삭제`}
                onClick={() =>
                  update((suite) => ({
                    ...suite,
                    observations: removeObservation(suite.observations, entry.id),
                  }))
                }
                className="shrink-0 rounded p-0.5 text-slate-300 hover:text-danger-500"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
