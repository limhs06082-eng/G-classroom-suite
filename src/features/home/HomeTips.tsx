import { Lightbulb, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '../../shared/ui';
import { isTipsSeen, setTipsSeen } from './tipsStore';

interface Step {
  /** 강조할 홈 카드 id. 없으면 카드 강조 없이 글만. */
  card: string | null;
  title: string;
  text: string;
}

const STEPS: readonly Step[] = [
  {
    card: 'now',
    title: "'지금' 카드",
    text: '몇 교시인지, 다음 수업까지 남은 시간이 여기 있어요. 카드에 마우스를 올리면 나오는 손잡이로 끌어 옮기고, 넓히거나 숨길 수 있어요.',
  },
  {
    card: 'attendance',
    title: "'오늘 출결' 카드",
    text: '아침에 이름을 탭해 찍어요. 한 번에 찍기·전원 X도 있고, 학기말에는 집계와 사유 분류가 나이스 양식으로 나와요.',
  },
  {
    card: null,
    title: '오늘 보드',
    text: '오른쪽 위 [오늘 보드]를 누르면 학급 TV용 화면이 새 창으로 떠요. 시간표·급식·당번·알림장·생일이 한 화면. F로 전체 화면, Esc로 닫아요.',
  },
  {
    card: null,
    title: '막히면 ?',
    text: '어디서나 ? 키를 누르면 단축키 도움이 떠요. 이 안내는 설정 → 화면에서 다시 볼 수 있어요.',
  },
];

/**
 * 첫 화면 안내 — 네 걸음. 한 번 다 보면(또는 그만 보면) 이 기기에서 다시 안 뜬다.
 * 카드 강조는 홈이 한다(onHighlight). 여기는 글과 걸음만 안다.
 */
export function HomeTips({ onHighlight }: { onHighlight: (cardId: string | null) => void }) {
  const [open, setOpen] = useState(() => !isTipsSeen());
  const [step, setStep] = useState(0);
  const current = STEPS[step] ?? STEPS[0];

  useEffect(() => {
    onHighlight(open ? (current?.card ?? null) : null);
  }, [open, current, onHighlight]);

  if (!open || current === undefined) return null;

  const finish = (): void => {
    setTipsSeen(true);
    setOpen(false);
  };
  const last = step === STEPS.length - 1;

  return (
    <section
      role="region"
      aria-label="처음 안내"
      className="flex flex-wrap items-start gap-3 rounded-card border border-brand-200 bg-brand-50 p-4"
    >
      <Lightbulb className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">
          처음이신가요? {current.title}
          <span className="ml-2 font-normal text-slate-500">
            {step + 1} / {STEPS.length}
          </span>
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{current.text}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="ghost" onClick={finish}>
          그만 보기
        </Button>
        {last ? (
          <Button size="sm" variant="primary" onClick={finish}>
            마치기
          </Button>
        ) : (
          <Button size="sm" variant="primary" onClick={() => setStep((value) => value + 1)}>
            다음
          </Button>
        )}
        <button type="button" onClick={finish} aria-label="안내 닫기" className="rounded p-1 text-slate-400 hover:text-slate-700">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
