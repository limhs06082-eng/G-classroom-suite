import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from 'lucide-react';

import type { WeatherState } from './todayWeather';

/**
 * WMO 날씨 코드를 아이콘으로 옮긴다. 모르는 코드는 `null`.
 *
 * 표를 다 채우려 들지 않는다. open-meteo가 언제 어떤 코드를 늘릴지 모르고,
 * 안 그려지는 아이콘 하나보다 **던지는 아이콘 하나가 훨씬 비싸다** — 이건
 * 머리띠라 모든 화면에 있고, 여기서 죽으면 앱이 통째로 안 열린다.
 *
 * 소나기(80~82)를 비와, 소나기눈(85~86)을 눈과 같은 그림으로 둔 것은
 * 게을러서가 아니다. 하루 종일 켜 둔 화면을 흘긋 볼 때 가려낼 수 있는 것은
 * '비냐 눈이냐'까지고, 그보다 잘게 가른 그림은 구별되지 않는다.
 */
function iconOf(code: number): LucideIcon | null {
  if (code === 0) return Sun;
  if (code >= 1 && code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code >= 45 && code <= 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if (code >= 61 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 85 && code <= 86) return CloudSnow;
  if (code >= 95 && code <= 99) return CloudLightning;
  return null;
}

/** 머리띠에 소수 한 자리를 띄울 자리가 없다. 26.4°와 26°는 교실에서 같은 뜻이다. */
function degrees(value: number): string {
  // `Math.round(-0.4)`가 -0이라 그대로 쓰면 '-0°'가 뜬다. 0을 더해 없앤다.
  return `${Math.round(value) + 0}°`;
}

/**
 * 머리띠에 뜨는 오늘 날씨. `☁ 25° · 경기도` 한 줄이다.
 *
 * **지역 이름을 함께 띄운다.** 좌표가 시·도 대표점이라 경기도 안에서만도
 * 파주와 평택이 2~3°C 차이 난다. 이름을 감추면 교사가 그 숫자를 자기 학교
 * 마당의 온도로 여기는데, 이름이 보이면 어느 정도로 믿을지 스스로 안다.
 *
 * **`ready`가 아니면 아무것도 안 그린다.** 급식 카드와 정반대 판단이고,
 * 까닭은 자리다. 급식은 홈에 있는 카드 한 칸이라 비어 있으면 그 자체가
 * 이상해 보이고 왜 비었는지 말해 줘야 한다. 머리띠는 모든 화면에 늘 보이는
 * 자리라, 여기에 "날씨를 못 받아 왔습니다"를 걸어 두면 하루 종일 눈에
 * 걸린다 — 그리고 그 문구로 교사가 할 수 있는 일이 없다. 학교를 안 정한
 * 교사에게는 급식 카드가 이미 그 말을 하고 있다.
 *
 * 상태 자체는 넷을 그대로 가른다(`todayWeather.ts`). 화면이 셋을 같이
 * 안 그린다고 판단까지 뭉개면, 배선 시험이 '못 물어봤다'와 '묻지도
 * 않았다'를 갈라 볼 수 없어진다.
 */
export function WeatherBadge({ state }: { state: WeatherState }) {
  if (state.kind !== 'ready') return null;

  const { temperature, low, high, code } = state.weather;
  const Icon = iconOf(code);

  return (
    <p
      /* 한 시간마다 숫자가 바뀐다. tabular-nums가 아니면 옆의 지역 이름이 흔들린다. */
      data-numeric
      className="flex items-center gap-1.5 text-sm text-slate-600"
      /*
       * 최저·최고는 한 줄에 안 들어가지만 버릴 것도 아니다. 아침에 겉옷을
       * 챙길지는 지금 기온이 아니라 이 둘이 정한다.
       */
      title={`오늘 최저 ${degrees(low)} · 최고 ${degrees(high)}`}
    >
      {Icon === null ? null : <Icon className="size-4 shrink-0 text-slate-500" aria-hidden />}
      <span>{degrees(temperature)}</span>
      <span className="text-slate-400" aria-hidden>
        ·
      </span>
      <span className="text-slate-500">{state.region}</span>
    </p>
  );
}
