import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WeatherBadge } from '../../src/features/home/WeatherBadge';
import type { WeatherState } from '../../src/features/home/todayWeather';

/*
 * 머리띠에 뜨는 것. 자료도 시계도 보지 않고 받은 상태를 그리기만 한다 —
 * 네 갈래를 전부 확인할 수 있어야 하기 때문이다.
 */

function ready(overrides: Partial<{ temperature: number; low: number; high: number; code: number }> = {}) {
  const state: WeatherState = {
    kind: 'ready',
    region: '경기도',
    weather: { temperature: 25.4, low: 23.6, high: 27.6, code: 1, ...overrides },
  };
  return state;
}

describe('날씨 머리띠 — 뜰 때', () => {
  it('온도와 지역 이름을 함께 띄운다', () => {
    /*
     * 지역 이름이 알맹이다. 시·도 단위라 거친 숫자인데 이름을 감추면 교사가
     * 그것을 자기 학교 마당의 온도로 여긴다. 이름이 보이면 어느 정도로
     * 믿을지 스스로 안다.
     */
    render(<WeatherBadge state={ready()} />);

    expect(screen.getByText(/25°/)).toBeInTheDocument();
    expect(screen.getByText(/경기도/)).toBeInTheDocument();
  });

  it('소수는 반올림해서 보인다', () => {
    render(<WeatherBadge state={ready({ temperature: 25.6 })} />);

    expect(screen.getByText(/26°/)).toBeInTheDocument();
  });

  it('0도도 뜬다', () => {
    /*
     * 참·거짓으로 검사하는 손이 들어오면 겨울 아침에 날씨가 사라진다.
     * 파서에서 한 번 막아 둔 함정인데 화면에서 다시 열릴 수 있다.
     */
    render(<WeatherBadge state={ready({ temperature: 0 })} />);

    expect(screen.getByText(/0°/)).toBeInTheDocument();
  });

  it('영하도 뜬다', () => {
    render(<WeatherBadge state={ready({ temperature: -3.2 })} />);

    expect(screen.getByText(/-3°/)).toBeInTheDocument();
  });

  it('아는 코드는 아이콘이 함께 뜬다', () => {
    const { container } = render(<WeatherBadge state={ready({ code: 0 })} />);

    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('모르는 코드는 아이콘 없이 온도만 보인다', () => {
    /*
     * WMO 표에 없는 숫자가 오면 빈 자리를 남기거나 던지지 않는다. 머리띠는
     * 모든 화면에 늘 있는 자리라, 여기서 던지면 날씨가 안 보이는 게 아니라
     * 앱이 안 열린다.
     */
    const { container } = render(<WeatherBadge state={ready({ code: 7777 })} />);

    expect(screen.getByText(/25°/)).toBeInTheDocument();
    expect(screen.getByText(/경기도/)).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('오늘 최저·최고를 버리지 않는다', () => {
    /*
     * 세 층(파서·캐시·되읽기)이 저 숫자 둘을 확인하며 들고 오는데 한 줄짜리
     * 머리띠에는 자리가 없다. 띄우는 대신 손에 닿는 곳에 둔다 — 버리면
     * 위층의 확인이 전부 헛일이 된다.
     */
    render(<WeatherBadge state={ready()} />);

    expect(screen.getByTitle(/최저 24° · 최고 28°/)).toBeInTheDocument();
  });
});

describe('날씨 머리띠 — 안 뜰 때', () => {
  /*
   * 셋 다 아무것도 안 그린다. 급식 카드와 반대로 간 판단이고 까닭은 자리다 —
   * 머리띠는 모든 화면에 늘 보여서, 여기 오류 문구를 띄우면 하루 종일 눈에
   * 걸린다. 그 문구로 교사가 할 수 있는 일도 없다.
   */
  it('학교를 안 정했으면 빈 자리다', () => {
    const { container } = render(<WeatherBadge state={{ kind: 'no-school' }} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('못 받아 왔으면 빈 자리다', () => {
    const { container } = render(<WeatherBadge state={{ kind: 'failed' }} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('받아 오는 동안에도 빈 자리다', () => {
    /*
     * '불러오는 중…'을 띄우면 머리띠가 켤 때마다 깜빡인다. 값이 오면 그때
     * 나타나면 된다 — 기다리라고 말해서 교사가 할 일이 없다.
     */
    const { container } = render(<WeatherBadge state={{ kind: 'loading' }} />);

    expect(container).toBeEmptyDOMElement();
  });
});
