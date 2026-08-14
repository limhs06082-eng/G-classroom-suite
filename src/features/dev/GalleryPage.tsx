import { Printer, Save, Trash2, Users } from 'lucide-react';
import { useState } from 'react';

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Modal,
  PrintLayout,
  Table,
  Tabs,
  usePrint,
  useToast,
  type Column,
} from '../../shared/ui';

/**
 * 공통 컴포넌트 갤러리 (개발 전용).
 *
 * 기능을 이식하기 전에 디자인 시스템이 실제로 어떻게 보이는지 한자리에서 확인한다.
 * 프로덕션 빌드에서는 라우트가 등록되지 않는다(router.tsx의 import.meta.env.DEV).
 */

interface Row {
  id: string;
  number: number;
  name: string;
  status: '제출' | '미제출' | '보완';
}

const ROWS: Row[] = [
  { id: '1', number: 1, name: '김하나', status: '제출' },
  { id: '2', number: 2, name: '이두리', status: '미제출' },
  { id: '3', number: 3, name: '박세찬', status: '보완' },
];

const COLUMNS: Column<Row>[] = [
  { key: 'number', header: '번호', align: 'center', widthClass: 'w-16', render: (r) => r.number },
  { key: 'name', header: '이름', render: (r) => r.name },
  {
    key: 'status',
    header: '상태',
    align: 'center',
    render: (r) => (
      <Badge tone={r.status === '제출' ? 'success' : r.status === '미제출' ? 'danger' : 'warning'}>
        {r.status}
      </Badge>
    ),
  },
];

export default function GalleryPage() {
  const toast = useToast();
  const print = usePrint();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tab, setTab] = useState('all');

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-slate-900">공통 컴포넌트 갤러리</h1>

      <Card title="Button">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">기본</Button>
          <Button variant="secondary">보조</Button>
          <Button variant="ghost">고스트</Button>
          <Button variant="danger" icon={Trash2}>
            삭제
          </Button>
          <Button variant="primary" icon={Save} loading>
            저장 중
          </Button>
          <Button size="sm">작게</Button>
          <Button size="lg">크게</Button>
          <Button icon={Users} iconOnly aria-label="명단" />
          <Button disabled>비활성</Button>
        </div>
      </Card>

      <Card title="Badge">
        <div className="flex flex-wrap gap-2">
          <Badge>기본</Badge>
          <Badge tone="success">제출</Badge>
          <Badge tone="warning">보완</Badge>
          <Badge tone="danger">미제출</Badge>
          <Badge tone="info">안내</Badge>
          <Badge tone="brand">강조</Badge>
        </div>
      </Card>

      <Card title="Toast — 실행 취소가 핵심">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => toast.success('저장했습니다.')}>성공</Button>
          <Button onClick={() => toast.warning('번호가 겹칩니다.')}>경고</Button>
          <Button onClick={() => toast.error('저장 공간이 부족합니다.')}>오류 (자동으로 안 닫힘)</Button>
          <Button
            variant="primary"
            onClick={() =>
              toast.info('김하나에게 +1점을 주었습니다.', {
                actionLabel: '실행 취소',
                onAction: () => toast.success('되돌렸습니다.'),
              })
            }
          >
            실행 취소가 있는 알림
          </Button>
        </div>
      </Card>

      <Card title="Table + Tabs">
        <Tabs
          items={[
            { id: 'all', label: '전체', count: 3 },
            { id: 'todo', label: '미제출', count: 1 },
          ]}
          activeId={tab}
          onChange={setTab}
        >
          <Table
            columns={COLUMNS}
            rows={tab === 'all' ? ROWS : ROWS.filter((r) => r.status === '미제출')}
            rowKey={(r) => r.id}
            caption="과제 제출 현황 예시"
          />
        </Tabs>
      </Card>

      <Card title="EmptyState">
        <EmptyState
          icon={Users}
          title="아직 등록된 학생이 없습니다"
          description="명단을 붙여넣거나 CSV 파일을 불러오면 5개 기능에서 모두 쓸 수 있습니다."
          action={<Button variant="primary">명단 등록하기</Button>}
        />
      </Card>

      <Card title="Modal · ConfirmDialog · 인쇄">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModalOpen(true)}>모달 열기</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            되돌릴 수 없는 작업
          </Button>
          <Button icon={Printer} onClick={print}>
            인쇄 미리보기
          </Button>
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="학생 정보 수정"
        description="Esc 키나 배경 클릭으로 닫을 수 있고, Tab 포커스가 안에 갇힙니다."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              저장
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="block text-sm">
            이름
            <input className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3" defaultValue="김하나" />
          </label>
          <label className="block text-sm">
            번호
            <input className="mt-1 h-10 w-full rounded-control border border-slate-300 px-3" defaultValue="1" />
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="학기 전체를 삭제할까요?"
        description="2026학년도 1학기의 자리배치·당번·점수·과제 기록이 모두 지워집니다. 되돌릴 수 없습니다."
        destructive
        confirmPhrase="삭제"
        confirmLabel="영구 삭제"
        onConfirm={() => setConfirmOpen(false)}
        onCancel={() => setConfirmOpen(false)}
      />

      <PrintLayout title="3학년 2반 과제 제출 현황" subtitle="2026학년도 1학기 · 2026-03-02" footer="한빛초등학교 · 임한솔">
        <Table columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />
      </PrintLayout>
    </div>
  );
}
