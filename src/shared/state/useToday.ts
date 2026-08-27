import { useEffect, useState } from 'react';

/**
 * `YYYY-MM-DD`.
 *
 * `toISOString()`을 안 쓴다. 그건 UTC라 우리 자정과 아홉 시간 어긋난다.
 * 아침 여덟 시에 어제 날짜가 나오면 급식이 하루 밀린다.
 */
function stamp(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 다음 자정까지 남은 밀리초. 1초를 더해 경계에 아슬아슬하게 걸치지 않게 한다.
 *
 * **`useNow`와 같은 여유를 쓴다.** 여기가 1분이고 저기가 1초이던 때가 있었는데,
 * 그러면 자정 뒤 59초 동안 `useNow`는 새 날이라 하고 이쪽은 어제라고 한다.
 * 두 갈고리를 함께 보는 화면(오늘 요일로 시간표를 고르고 지금 분으로 교시를
 * 고르는 '지금' 카드)에서 그 틈이 곧 어긋남이 된다.
 *
 * 1초면 넉넉하다. setTimeout은 늦게 올지언정 일찍 오지 않으므로, 1초를 더하면
 * 깨어났을 때 자정이 확실히 지나 있다.
 */
function untilTomorrow(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime() + 1000;
}

/**
 * 오늘 날짜를 준다. 자정이 지나면 저절로 바뀐다.
 *
 * G-board는 교실 컴퓨터에서 하루 종일, 주말을 끼면 며칠씩 켜져 있다.
 * 그릴 때 날짜를 한 번만 재면 다음 날 아침 화면에 어제 급식이 걸려 있다.
 * 마침 그 시각이 선생님이 교실에 들어와 화면을 한 번 보는 때다.
 * **'오늘 급식'이 어제 것이면 이 카드는 없느니만 못하다.**
 *
 * 시계를 계속 재지 않고 자정에 한 번만 깨운다. 하루 종일 켜 두는
 * 프로그램에서 1초짜리 타이머는 그 자체로 비용이다.
 */
export function useToday(): string {
  const [date, setDate] = useState(() => stamp(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = (): void => {
      timer = setTimeout(() => {
        // 잰 값을 더하지 않고 시계를 다시 본다. 컴퓨터가 자다 깨면
        // 타이머는 늦게 오는데, 그때 맞는 날짜는 지금 시계에만 있다.
        setDate(stamp(new Date()));
        schedule();
      }, untilTomorrow(new Date()));
    };

    schedule();
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return date;
}
