import { Delete, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { cx } from '../ui';
import { PIN_LENGTH } from './lockOps';

/**
 * 교사 잠금 화면.
 *
 * ToolsBar의 `화면 가리기`와 반대다. 그건 Esc 한 번에 걷히는 것이 목적이고,
 * 이건 **쉽게 걷히면 안 되는 것**이 목적이다. Esc를 받지 않는다.
 *
 * 숫자 키패드를 그린다. 전자칠판에는 키보드가 없는 경우가 많아
 * 입력칸만 두면 교사도 자기 앱을 못 연다.
 */
export function LockScreen({ onSubmit }: { onSubmit: (pin: string) => boolean }) {
  const [entered, setEntered] = useState('');
  const [wrong, setWrong] = useState(false);

  // 네 자리를 채우면 바로 확인한다. 확인 버튼은 순수한 낭비다.
  useEffect(() => {
    if (entered.length < PIN_LENGTH) return;

    if (!onSubmit(entered)) {
      setWrong(true);
      setEntered('');
    }
  }, [entered, onSubmit]);

  // 물리 키보드가 있으면 숫자 키로도 받는다.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      if (/^\d$/.test(event.key)) {
        setWrong(false);
        setEntered((current) => (current + event.key).slice(0, PIN_LENGTH));
      } else if (event.key === 'Backspace') {
        setEntered((current) => current.slice(0, -1));
      }
    };

    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const press = (digit: string): void => {
    setWrong(false);
    setEntered((current) => (current + digit).slice(0, PIN_LENGTH));
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="교사 잠금"
      className="ink no-print fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-slate-900 p-6"
    >
      <div className="flex flex-col items-center gap-3">
        <Lock className="size-10 text-slate-500" aria-hidden />
        <p className="text-xl font-bold text-white">잠금을 풀려면 PIN을 입력해 주세요</p>
      </div>

      <div className="flex gap-3">
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <span
            key={index}
            aria-hidden
            className={cx(
              'size-4 rounded-full border-2 transition-colors duration-[120ms]',
              index < entered.length
                ? 'border-white bg-white'
                : wrong
                  ? 'border-danger-400'
                  : 'border-slate-600',
            )}
          />
        ))}
        {/* 동그라미는 눈으로만 보인다. 몇 자리 넣었는지는 글로 따로 알린다. */}
        <span className="sr-only">{entered.length}자리 입력함</span>
      </div>

      {/*
        틀렸다는 말은 여기 한 곳에만 둔다. 위 sr-only에도 같은 문장을 넣으면
        화면 낭독기가 두 번 읽는다.
      */}
      <p
        aria-live="polite"
        className={cx('h-5 text-sm', wrong ? 'text-danger-400' : 'text-transparent')}
      >
        {wrong ? 'PIN이 맞지 않습니다' : ''}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <KeypadButton key={digit} label={digit} onClick={() => press(digit)} />
        ))}

        <span />
        <KeypadButton label="0" onClick={() => press('0')} />
        <button
          type="button"
          onClick={() => setEntered((current) => current.slice(0, -1))}
          aria-label="한 자리 지우기"
          className="flex size-16 items-center justify-center rounded-card bg-slate-800 text-slate-300 hover:bg-slate-700"
        >
          <Delete className="size-6" aria-hidden />
        </button>
      </div>
    </div>,
    document.body,
  );
}

function KeypadButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="size-16 rounded-card bg-slate-800 font-mono text-2xl font-bold text-white hover:bg-slate-700"
    >
      {label}
    </button>
  );
}
