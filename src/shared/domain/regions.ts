/**
 * 시·도 열일곱과 그 대표 좌표.
 *
 * **지오코딩 API를 안 쓴다.** open-meteo 지오코더로 실제 학교 주소 열둘을
 * 재 봤더니 시·군·구 이름은 대부분 못 찾고, 찾은 것 하나는 노인게이트볼
 * 구장이었으며, **부산 강서구를 물었더니 서울 강서구가 나왔다.** 못 찾는
 * 것보다 조용히 틀리는 쪽이 나쁘다 — 교사는 화면을 믿고, 틀렸다는 표시가
 * 어디에도 없다.
 *
 * 대신 거칠다. 경기도는 남북 130km라 파주와 평택이 2~3°C 차이 날 수 있다.
 * 그래서 화면에 **지역 이름을 함께** 띄운다. "경기도 25°"로 보이면 교사가
 * 그 숫자를 어느 정도로 믿을지 스스로 안다.
 *
 * 좌표는 전부 실제로 불러 응답이 오는지, 대한민국 범위 안인지 확인했다.
 */
export interface Region {
  name: string;
  lat: number;
  lon: number;
}

export const REGIONS: readonly Region[] = [
  { name: '서울특별시', lat: 37.5665, lon: 126.978 },
  { name: '부산광역시', lat: 35.1796, lon: 129.0756 },
  { name: '대구광역시', lat: 35.8714, lon: 128.6014 },
  { name: '인천광역시', lat: 37.4563, lon: 126.7052 },
  { name: '광주광역시', lat: 35.1595, lon: 126.8526 },
  { name: '대전광역시', lat: 36.3504, lon: 127.3845 },
  { name: '울산광역시', lat: 35.5384, lon: 129.3114 },
  { name: '세종특별자치시', lat: 36.48, lon: 127.289 },
  { name: '경기도', lat: 37.275, lon: 127.0095 },
  { name: '강원특별자치도', lat: 37.8854, lon: 127.7298 },
  { name: '충청북도', lat: 36.6357, lon: 127.4913 },
  { name: '충청남도', lat: 36.6588, lon: 126.6728 },
  { name: '전북특별자치도', lat: 35.8203, lon: 127.1088 },
  { name: '전라남도', lat: 34.8161, lon: 126.4629 },
  { name: '경상북도', lat: 36.576, lon: 128.5056 },
  { name: '경상남도', lat: 35.2383, lon: 128.6924 },
  { name: '제주특별자치도', lat: 33.4996, lon: 126.5312 },
] as const;

/**
 * 예전 이름으로 저장된 주소를 지금 이름에 잇는다.
 *
 * 강원도와 전라북도가 특별자치도로 바뀌었다. 이름이 바뀌었다고 그 학교
 * 날씨가 사라지면 안 된다.
 */
const ALIASES: Record<string, string> = {
  강원도: '강원특별자치도',
  전라북도: '전북특별자치도',
};

/**
 * 주소에서 시·도를 찾는다. 모르면 null.
 *
 * NEIS의 `ORG_RDNMA`는 늘 시·도로 시작한다 — `인천광역시 남동구 …`.
 * 던지지 않는다. 주소 하나를 못 읽었다고 머리띠가 사라지면 안 된다.
 */
export function regionOfAddress(address: string): Region | null {
  const head = address.trim().split(/\s+/)[0] ?? '';
  if (head === '') return null;

  const name = ALIASES[head] ?? head;
  return REGIONS.find((region) => region.name === name) ?? null;
}
