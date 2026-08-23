import { useEffect } from 'react';

import { useToast } from '../ui';

/**
 * FileBackedStorage가 파일에 쓰지 못했을 때 화면에 알린다.
 *
 * SuiteDataProvider.tsx는 손대지 않는다. 그 파일은 저장을 시도하고 실패를
 * 알리는 흐름을 이미 갖고 있지만(persist의 catch), 그건 `adapter.save()`가
 * 던져야 걸린다. FileBackedStorage.setItem은 Map에 쓰고 디바운스된 쓰기를
 * 예약할 뿐 절대 던지지 않으므로 — 설치형에서는 `adapter.save()`가 늘
 * 성공으로 끝나 그 토스트가 결코 뜨지 않는다. 실제 디스크 실패(용량 꽉 참,
 * `%APPDATA%` 잠김, 백신 차단)는 FileBackedStorage 안, writeDirty의 catch
 * 에서만 드러나고, 지금까지는 console.warn(main.tsx의 onWriteError)으로만
 * 새 나갔다. 교사는 "저장됨"만 보면서 하루 종일 자료를 잃을 수 있었다.
 *
 * 이 컴포넌트는 FileBackedStorage가 던지는 `gboard-write-error` 이벤트를
 * 받아, SuiteDataProvider의 저장 실패와 같은 자리 — 자동으로 닫히지 않는
 * 오류 토스트 — 에 띄운다.
 *
 * 웹에서는 이 이벤트가 한 번도 던져지지 않는다(FileBackedStorage 자체가
 * 웹 번들에 없다). 그래서 target 분기 없이 main.tsx에 무조건 마운트해도
 * 웹에서는 그냥 아무 일도 하지 않는다.
 */
export function WriteErrorToast(): null {
  const toast = useToast();

  useEffect(() => {
    const handleWriteError = (event: Event): void => {
      const message = (event as CustomEvent<string>).detail;
      // 뭐가 잘못됐는지만 말하지 않는다. 지금 뭘 해야 하는지까지 말한다.
      toast.error(
        `자료를 파일에 저장하지 못했습니다. 설정 → 백업·복원에서 백업 파일을 내려받아 주세요. (${message})`,
      );
    };

    window.addEventListener('gboard-write-error', handleWriteError);
    return () => {
      window.removeEventListener('gboard-write-error', handleWriteError);
    };
  }, [toast]);

  return null;
}
