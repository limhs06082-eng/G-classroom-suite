import { describe, expect, it } from 'vitest';

import { REGIONS, regionOfAddress, type Region } from '../../src/shared/domain/regions';

describe('시·도 좌표', () => {
  it('열일곱이다', () => {
    expect(REGIONS).toHaveLength(17);
  });

  it('전부 대한민국 범위 안이다', () => {
    /*
     * 좌표를 손으로 적는 표라 숫자 한 자리만 틀려도 바다나 중국이 된다.
     * 그러면 화면에는 멀쩡한 온도가 뜨고 아무도 못 알아챈다.
     */
    for (const region of REGIONS) {
      expect(region.lat, region.name).toBeGreaterThan(33);
      expect(region.lat, region.name).toBeLessThan(38.7);
      expect(region.lon, region.name).toBeGreaterThan(124.5);
      expect(region.lon, region.name).toBeLessThan(131);
    }
  });

  it('이름이 겹치지 않는다', () => {
    expect(new Set(REGIONS.map((r) => r.name)).size).toBe(REGIONS.length);
  });

  it('공식 시·도 이름과 글자까지 같다', () => {
    /*
     * `regionOfAddress`는 NEIS 주소 첫 낱말과 **글자 그대로** 맞춰 찾는다.
     * 그래서 표에 '충청북도' 대신 '충북'이라 적혀 있으면 충북 학교만
     * 조용히 날씨가 사라진다 — 개수도 열일곱이고 이름도 안 겹치니
     * 위의 어느 시험도 안 걸린다(변이로 확인했다).
     *
     * 아래 열일곱은 표에서 베낀 것이 아니라 행정구역 공식 명칭이다.
     * 표가 유일한 근거이면 오타를 잡을 수 없으므로 근거를 따로 둔다.
     */
    const OFFICIAL = [
      '강원특별자치도',
      '경기도',
      '경상남도',
      '경상북도',
      '광주광역시',
      '대구광역시',
      '대전광역시',
      '부산광역시',
      '서울특별시',
      '세종특별자치시',
      '울산광역시',
      '인천광역시',
      '전라남도',
      '전북특별자치도',
      '제주특별자치도',
      '충청남도',
      '충청북도',
    ];
    expect([...REGIONS].map((r) => r.name).sort()).toEqual(OFFICIAL.sort());
  });

  it('네 귀퉁이가 제자리에 있다', () => {
    /*
     * 위의 범위 시험은 대한민국 전체를 한 상자로 보므로, 두 시·도의
     * 좌표를 **서로 맞바꿔도 통과한다.** 그러면 부산 학교에 서울 날씨가
     * 뜨고, 머리띠에는 '부산광역시'라 적혀 있어 틀렸다는 표시가 어디에도
     * 없다 — 이 모듈이 지오코딩 API를 버린 바로 그 이유다(변이로 확인했다).
     *
     * 표를 그대로 베껴 오면 오타를 못 잡으니, 대표점을 어디로 잡아도
     * 뒤집히지 않는 관계만 못 박는다. 서울-부산은 남북 320km,
     * 춘천-목포는 동서 300km다. 모든 뒤바뀜을 잡지는 못한다.
     */
    const at = (name: string): Region => {
      const region = REGIONS.find((r) => r.name === name);
      if (region === undefined) throw new Error(`${name}이(가) 표에 없다`);
      return region;
    };

    // 제주는 섬이라 어느 대표점을 잡아도 뭍 열여섯보다 남쪽이다.
    for (const region of REGIONS.filter((r) => r.name !== '제주특별자치도')) {
      expect(at('제주특별자치도').lat, region.name).toBeLessThan(region.lat);
    }
    expect(at('서울특별시').lat).toBeGreaterThan(at('부산광역시').lat + 1.5);
    expect(at('강원특별자치도').lon).toBeGreaterThan(at('전라남도').lon + 1);
  });
});

describe('주소에서 시·도 뽑기', () => {
  it('첫 낱말로 찾는다', () => {
    expect(regionOfAddress('인천광역시 남동구 서창남순환로 190-28')?.name).toBe('인천광역시');
    expect(regionOfAddress('경기도 성남시 수정구 위례동로 55')?.name).toBe('경기도');
  });

  it('앞뒤 공백을 견딘다', () => {
    expect(regionOfAddress('  제주특별자치도 제주시 ... ')?.name).toBe('제주특별자치도');
  });

  it('모르는 주소는 null이다', () => {
    // 던지지 않는다. 주소 하나 때문에 머리띠가 사라지면 안 된다.
    expect(regionOfAddress('')).toBeNull();
    expect(regionOfAddress('어딘가 먼 곳')).toBeNull();
  });

  it('옛 이름도 받아 준다', () => {
    /*
     * 강원도·전라북도는 특별자치도로 바뀌었지만, 예전에 저장해 둔 주소가
     * 그대로 남아 있다. 이름이 바뀌었다고 날씨가 사라지면 안 된다.
     */
    expect(regionOfAddress('강원도 춘천시 ...')?.name).toBe('강원특별자치도');
    expect(regionOfAddress('전라북도 전주시 ...')?.name).toBe('전북특별자치도');
  });
});
