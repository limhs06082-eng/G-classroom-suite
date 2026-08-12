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
import type { Student } from '../domain/types';
import { RosterImportPanel } from './RosterImportPanel';
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
              className="inline-flex h-10 items-center rounded-control bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
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
              update((current) =>
                addStudent(current, activeClass.id, { number: nextNumber, name: '새 학생' }),
              );
              toast.info(`${nextNumber}번에 새 학생을 추가했습니다. 이름을 고쳐 주세요.`);
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
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing === null) return;
          update((current) => updateStudent(current, editing.id, patch));
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

function EditStudentModal({
  student,
  onClose,
  onSave,
}: {
  student: Student | null;
  onClose: () => void;
  onSave: (patch: { number: number; name: string }) => void;
}) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');

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
              onSave({
                number: Number.isFinite(parsedNumber) ? parsedNumber : (student?.number ?? 0),
                name: name.trim() === '' ? (student?.name ?? '') : name.trim(),
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
      </div>
    </Modal>
  );
}
