import { useEffect, useState } from 'react';

/** 자정부터 지금까지의 분. */
function minutesNow(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** 다음 분이 될 때까지 남은 밀리초. 1초를 더해 경계에 아슬아슬하게 걸치지 않게 한다. */
function untilNextMinute(now: Date): number {
  return (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 1000;
}

/**
 * 지금 몇 분인가. 1분마다 저절로 바뀐다.
 *
 * `useToday`가 자정에 한 번 깨는 것과 다르다. '지금' 카드는 '12분 남음'을
 * 말하므로 분 단위로 깨야 한다.
 *
 * **초마다 깨우지 않는다.** 하루 종일 켜 두는 프로그램에서 1초짜리 타이머는
 * 그 자체로 비용이고, 화면에 초가 나오지도 않는다. 다음 분이 될 때까지만
 * 재웠다가 깨우면 하루에 1,440번이면 된다.
 */
export function useNow(): number {
  const [minutes, setMinutes] = useState(() => minutesNow(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = (): void => {
      timer = setTimeout(() => {
        // 잰 값을 더하지 않고 시계를 다시 본다. 컴퓨터가 자다 깨면
        // 타이머는 늦게 오는데, 맞는 값은 지금 시계에만 있다.
        setMinutes(minutesNow(new Date()));
        schedule();
      }, untilNextMinute(new Date()));
    };

    schedule();
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return minutes;
}
