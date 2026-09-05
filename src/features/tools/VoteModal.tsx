import { Maximize2, Minus, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button, cx, Modal } from '../../shared/ui';
import { bump, createVote, leaders, MAX_OPTIONS, resetCounts, total, type Vote } from './voteCore';

/**
 * 거수 투표. 설정 창(질문·선택지) → [크게 띄우기] → 큰 숫자 화면에서 교사가
 * 손 든 수를 탭한다. NoticeModal의 '크게 띄우기'와 같은 틀이다.
 *
 * 집계는 이 컴포넌트 안에 산다. 띄웠다 내려도 남고, 같은 질문·선택지로 다시
 * 띄우면 이어서 센다. 도구를 닫아도(ToolsBar가 늘 마운트) 남는다.
 */
export function VoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [vote, setVote] = useState<Vote | null>(null);
  const [showing, setShowing] = useState(false);

  const draft = createVote(question, options);

  const show = (): void => {
    if (draft === null) return;
    setVote((current) =>
      current !== null &&
      current.question === draft.question &&
      current.options.join('\n') === draft.options.join('\n')
        ? current
        : draft,
    );
    setShowing(true);
  };

  // 큰 화면일 때 Esc로 내린다. 교탁에서 리모컨·키보드로 다룬다.
  useEffect(() => {
    if (!showing) return;
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setShowing(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [showing]);

  const setOption = (index: number, value: string): void =>
    setOptions((current) => current.map((option, i) => (i === index ? value : option)));

  return (
    <>
      <Modal
        open={open && !showing}
        onClose={onClose}
        title="거수 투표"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              닫기
            </Button>
            <Button variant="primary" icon={Maximize2} disabled={draft === null} onClick={show}>
              크게 띄우기
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-500">
            질문과 선택지를 적고 크게 띄운 뒤, 손 든 수를 탭해 세세요. 기록하지 않습니다.
          </p>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="예: 다음 학급 활동은 무엇으로 할까요?"
            aria-label="질문"
            className="h-10 w-full rounded-control border border-slate-300 px-3 text-sm"
          />
          <div className="flex flex-col gap-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <span data-numeric className="w-5 shrink-0 text-right text-sm text-slate-400">
                  {index + 1}
                </span>
                <input
                  value={option}
                  onChange={(event) => setOption(index, event.target.value)}
                  placeholder={`선택지 ${index + 1}`}
                  aria-label={`선택지 ${index + 1}`}
                  className="h-10 min-w-0 flex-1 rounded-control border border-slate-300 px-3 text-sm"
                />
                {options.length > 2 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    iconOnly
                    aria-label={`선택지 ${index + 1} 빼기`}
                    onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}
                  />
                ) : null}
              </div>
            ))}
          </div>
          {options.length < MAX_OPTIONS ? (
            <Button size="sm" variant="ghost" icon={Plus} onClick={() => setOptions((current) => [...current, ''])}>
              선택지 추가
            </Button>
          ) : null}
        </div>
      </Modal>

      {showing && vote !== null
        ? createPortal(
            <div
              role="dialog"
              aria-label="거수 투표 결과"
              className="no-print fixed inset-0 z-50 flex flex-col gap-8 bg-surface p-8"
            >
              <p className="text-center text-board-lg font-black text-slate-900">
                {vote.question === '' ? '손 들어 주세요' : vote.question}
              </p>
              <div
                className="grid flex-1 gap-6"
                style={{ gridTemplateColumns: `repeat(${vote.options.length}, minmax(0, 1fr))` }}
              >
                {vote.options.map((option, index) => {
                  const lead = leaders(vote).includes(index);
                  return (
                    <div
                      key={index}
                      className={cx(
                        'flex flex-col items-center justify-center gap-4 rounded-card border-4 p-6',
                        lead ? 'border-brand-500 bg-brand-50' : 'border-slate-200',
                      )}
                    >
                      <p className="text-center text-board-base font-bold text-slate-800">{option}</p>
                      <p
                        data-numeric
                        aria-label={`${option} 손 든 수`}
                        className="text-board-xl font-black text-slate-900"
                      >
                        {vote.counts[index] ?? 0}
                      </p>
                      <div className="flex gap-3">
                        <Button
                          size="lg"
                          variant="secondary"
                          icon={Minus}
                          iconOnly
                          aria-label={`${option} 하나 빼기`}
                          onClick={() => setVote((current) => (current === null ? null : bump(current, index, -1)))}
                        />
                        <Button
                          size="lg"
                          variant="primary"
                          icon={Plus}
                          iconOnly
                          aria-label={`${option} 하나 더`}
                          onClick={() => setVote((current) => (current === null ? null : bump(current, index, 1)))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <p data-numeric className="text-board-sm text-slate-500">
                  모두 {total(vote)}명
                </p>
                <Button
                  size="lg"
                  variant="secondary"
                  icon={RotateCcw}
                  onClick={() => setVote((current) => (current === null ? null : resetCounts(current)))}
                >
                  다시 세기
                </Button>
                <Button size="lg" icon={X} onClick={() => setShowing(false)}>
                  닫기
                </Button>
                <p className="text-sm text-slate-400">Esc 키를 눌러도 닫힙니다</p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
