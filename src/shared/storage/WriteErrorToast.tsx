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
 *
 * ## 두 가지 발신자, 두 가지 detail 모양
 *
 * FileBackedStorage는 원인 문자열만 보낸다(예: "data.json: ..."). 이
 * 컴포넌트가 그 앞뒤로 "자료를 파일에 저장하지 못했습니다 / 백업을
 * 내려받으세요"라는, 저장 실패에만 맞는 안내문을 붙인다.
 *
 * 그런데 openBoard.ts·main.tsx도 같은 이벤트·같은 토스트 통로를
 * 재사용한다(전자칠판 창 열기 실패, 창 닫기 실패) — 새 통로를 또
 * 만들 이유가 없어서다. 이 둘은 이미 완성된 문장을 보낸다. 문자열
 * detail에 저장 실패용 고정 문구를 그대로 씌우면 "전자칠판을 못
 * 열었다"는데 "백업 파일을 내려받으라"는 엉뚱한 안내가 나간다.
 * 그래서 detail이 문자열이면 기존 저장 실패 문구를, 객체({message})면
 * 그 문장을 그대로 띄운다. FileBackedStorage.ts는 손대지 않으므로
 * 그쪽 detail 모양(문자열)은 그대로 유지된다.
 */
export function WriteErrorToast(): null {
  const toast = useToast();

  useEffect(() => {
    const handleWriteError = (event: Event): void => {
      const detail = (event as CustomEvent<string | { message: string }>).detail;

      if (typeof detail === 'string') {
        // FileBackedStorage: 원인만 온다. 뭐가 잘못됐는지만 말하지 않는다. 지금 뭘 해야 하는지까지 말한다.
        toast.error(
          `자료를 파일에 저장하지 못했습니다. 설정 → 백업·복원에서 백업 파일을 내려받아 주세요. (${detail})`,
        );
        return;
      }

      // openBoard.ts·main.tsx: 이미 완성된 문장이므로 그대로 띄운다.
      toast.error(detail.message);
    };

    window.addEventListener('gboard-write-error', handleWriteError);
    return () => {
      window.removeEventListener('gboard-write-error', handleWriteError);
    };
  }, [toast]);

  return null;
}
