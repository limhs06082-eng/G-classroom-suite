import { Lock, LockOpen } from 'lucide-react';
import { useState } from 'react';

import { clearPin, engageLock, isValidPin, PIN_LENGTH, setPin } from '../../shared/lock/lockOps';
import { isDesktop } from '../../shared/platform/target';
import { useSuite } from '../../shared/roster/SuiteDataProvider';
import { Button, Card, ConfirmDialog, useToast } from '../../shared/ui';

/**
 * 교사 잠금 설정.
 *
 * **이 화면에서 "안전합니다"라고 말하지 않는다.** PIN은 브라우저에 그대로
 * 저장되고 개발자 도구를 열면 보인다. 교사가 이 장치를 믿고 민감한 것을
 * 남겨 두면 안 된다.
 */
export function LockTab() {
  const { data, update } = useSuite();
  const toast = useToast();

  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const hasPin = data.lockPin !== '';
  const canSave = isValidPin(first) && first === second;

  const reset = (): void => {
    setFirst('');
    setSecond('');
  };

  return (
    <div className="flex flex-col gap-4">
      <Card title="교사 잠금" icon={Lock}>
        <p className="text-sm text-slate-600">
          자리를 비울 때 화면을 잠가 둡니다. 잠그면 새로 고쳐도 풀리지 않고, PIN을 넣어야
          다시 쓸 수 있습니다.
        </p>

        {/* 정직하게 적는다. 이 장치를 믿고 민감한 것을 남겨 두면 안 된다. */}
        <p className="mt-2 rounded-control bg-warning-50 px-3 py-2 text-sm text-warning-700">
          {isDesktop() ? (
            /*
             * "이 브라우저에"는 설치형에서는 거짓이다 — PIN은 파일(data.json)에
             * 그대로 저장된다. 자리를 옮겨도 정직함은 그대로 지킨다: "안전하다"고
             * 말하지 않고, 마음먹은 사람은 그 파일을 열어 그대로 읽을 수 있다는
             * 한계를 웹판과 똑같이 밝힌다.
             */
            <>
              학생이 지나가다 실수로 누르는 것을 막는 장치입니다. PIN은 이 컴퓨터의 파일에
              그대로 저장되므로, 마음먹고 파일을 열어 보려는 사람은 막지 못합니다.
            </>
          ) : (
            <>
              학생이 지나가다 실수로 누르는 것을 막는 장치입니다. PIN은 이 브라우저에 그대로
              저장되므로, 마음먹고 열려는 사람은 막지 못합니다.
            </>
          )}
        </p>

        <p className="mt-2 text-sm text-slate-500">
          수업 중 잠깐 화면만 가리려면 아래 도구 막대의 <strong>화면 가리기</strong>를 쓰세요.
          그쪽은 Esc 한 번으로 걷힙니다.
        </p>

        {hasPin ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="primary"
              icon={Lock}
              onClick={() => {
                update(engageLock);
                toast.info('화면을 잠갔습니다.');
              }}
            >
              지금 잠그기
            </Button>
            <Button variant="ghost" icon={LockOpen} onClick={() => setConfirmClear(true)}>
              잠금 끄기
            </Button>
          </div>
        ) : null}
      </Card>

      <Card title={hasPin ? 'PIN 바꾸기' : 'PIN 만들기'}>
        <div className="flex flex-wrap items-end gap-3">
          <PinField
            label="PIN 4자리"
            value={first}
            onChange={setFirst}
            autoComplete="new-password"
          />
          <PinField
            label="한 번 더"
            value={second}
            onChange={setSecond}
            autoComplete="new-password"
          />

          <Button
            variant="primary"
            disabled={!canSave}
            onClick={() => {
              update((current) => setPin(current, first));
              reset();
              toast.success(hasPin ? 'PIN을 바꿨습니다.' : 'PIN을 만들었습니다.');
            }}
          >
            저장
          </Button>
        </div>

        {first !== '' && !isValidPin(first) ? (
          <p className="mt-2 text-sm text-danger-700">숫자 {PIN_LENGTH}자리로 넣어 주세요.</p>
        ) : first !== '' && second !== '' && first !== second ? (
          <p className="mt-2 text-sm text-danger-700">두 번 넣은 값이 다릅니다.</p>
        ) : null}
      </Card>

      <ConfirmDialog
        open={confirmClear}
        title="잠금을 끌까요?"
        description="PIN이 지워지고 잠금 버튼도 사라집니다. 지금 잠겨 있다면 함께 풀립니다."
        confirmLabel="잠금 끄기"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          update(clearPin);
          setConfirmClear(false);
          toast.info('잠금을 껐습니다.');
        }}
      />
    </div>
  );
}

function PinField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="text-sm text-slate-600">
      {label}
      <input
        type="password"
        inputMode="numeric"
        autoComplete={autoComplete}
        value={value}
        // 숫자만 받는다. 다른 글자는 아예 안 들어가게 해서 오류 문구를 덜 본다.
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
        aria-label={label}
        className="mt-1 block h-10 w-28 rounded-control border border-slate-300 px-3 font-mono tracking-widest"
      />
    </label>
  );
}
