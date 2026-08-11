import { useEffect, useState } from 'react';

import { Button } from './Button';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  title: string;
  /** 무엇이 어떻게 되는지 구체적으로 쓴다. "정말 삭제할까요?"만으로는 부족하다. */
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 되돌릴 수 없는 작업. 확인 버튼이 위험색이 되고 문구 입력을 요구할 수 있다. */
  destructive?: boolean;
  /**
   * 지정하면 사용자가 이 문구를 그대로 입력해야 확인 버튼이 열린다.
   * 학기 전체 삭제처럼 정말 되돌릴 수 없는 작업에만 쓴다.
   */
  confirmPhrase?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive = false,
  confirmPhrase,
  onConfirm,
  onCancel,
}: Props) {
  const [typed, setTyped] = useState('');

  // 다시 열 때 이전 입력이 남아 있으면 안 된다.
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const locked = confirmPhrase !== undefined && typed.trim() !== confirmPhrase;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      dismissible={!destructive}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={locked}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {confirmPhrase === undefined ? null : (
        <label className="block">
          <span className="text-sm text-slate-700">
            계속하려면 <strong className="font-semibold">{confirmPhrase}</strong> 를 그대로
            입력해 주세요.
          </span>
          <input
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            className="mt-2 h-10 w-full rounded-control border border-slate-300 px-3 text-sm"
          />
        </label>
      )}
    </Modal>
  );
}
