import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpClient } from '../../src/shared/external/HttpClient';
import { MemoryHttpClient } from '../../src/shared/external/MemoryHttpClient';
import { NeisSource } from '../../src/shared/external/NeisSource';
import { SchoolSearch } from '../../src/features/settings/SchoolSearch';
import type { SchoolHit } from '../../src/shared/external/neisParse';

const hit: SchoolHit = {
  officeCode: 'J10',
  officeName: '경기도교육청',
  schoolCode: '7551281',
  schoolName: '위례한빛초등학교',
  address: '경기도 성남시 수정구 위례동로 55',
  kind: '초등학교',
};

const searchUrl =
  'https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=20' +
  '&SCHUL_NM=%ED%95%9C%EB%B9%9B%EC%B4%88';

function withHit() {
  return {
    schoolInfo: [
      { head: [] },
      {
        row: [
          {
            ATPT_OFCDC_SC_CODE: hit.officeCode,
            ATPT_OFCDC_SC_NM: hit.officeName,
            SD_SCHUL_CODE: hit.schoolCode,
            SCHUL_NM: hit.schoolName,
            ORG_RDNMA: hit.address,
            SCHUL_KND_SC_NM: hit.kind,
          },
        ],
      },
    ],
  };
}

let http: MemoryHttpClient;

beforeEach(() => {
  http = new MemoryHttpClient();
});

describe('학교 이름으로 찾기', () => {
  it('찾은 학교를 목록으로 보여 준다', async () => {
    http.put(searchUrl, withHit());
    const user = userEvent.setup();

    render(<SchoolSearch source={new NeisSource(http)} onPick={() => {}} />);

    await user.type(screen.getByLabelText('학교 이름'), '한빛초');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(await screen.findByText('위례한빛초등학교')).toBeInTheDocument();
    // 같은 이름의 학교가 여럿이라 교육청과 주소가 있어야 고를 수 있다.
    expect(screen.getByText(/경기도교육청/)).toBeInTheDocument();
  });

  it('고르면 코드까지 한꺼번에 넘긴다', async () => {
    http.put(searchUrl, withHit());
    const picked = vi.fn();
    const user = userEvent.setup();

    render(<SchoolSearch source={new NeisSource(http)} onPick={picked} />);

    await user.type(screen.getByLabelText('학교 이름'), '한빛초');
    await user.click(screen.getByRole('button', { name: '찾기' }));
    await user.click(await screen.findByRole('button', { name: /위례한빛초등학교/ }));

    // 교사가 코드를 알 필요가 없어야 한다는 것이 이 화면의 존재 이유다.
    expect(picked).toHaveBeenCalledWith(hit);
  });

  it('결과가 없으면 그렇게 말한다', async () => {
    http.put(searchUrl, { RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } });
    const user = userEvent.setup();

    render(<SchoolSearch source={new NeisSource(http)} onPick={() => {}} />);

    await user.type(screen.getByLabelText('학교 이름'), '한빛초');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(await screen.findByText(/찾지 못했습니다/)).toBeInTheDocument();
  });

  it('통신이 실패하면 결과 없음과 다르게 말한다', async () => {
    http.fail(searchUrl, '인터넷 연결 없음');
    const user = userEvent.setup();

    render(<SchoolSearch source={new NeisSource(http)} onPick={() => {}} />);

    await user.type(screen.getByLabelText('학교 이름'), '한빛초');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    /*
     * 이름을 잘못 친 것과 인터넷이 끊긴 것은 선생님이 할 일이 다르다.
     * 둘 다 "찾지 못했습니다"로 보이면 이름만 자꾸 고쳐 보게 된다.
     */
    expect(await screen.findByText(/연결하지 못했습니다/)).toBeInTheDocument();
  });

  it('찾는 동안 단추가 잠기고, 끝나면 풀린다', async () => {
    /*
     * 요청을 붙들어 둬야 잠긴 상태를 볼 수 있다. MemoryHttpClient는 곧바로
     * 값을 돌려주므로 잠기는 순간이 지나가 버려, 끝난 뒤의 모습만 보게 된다.
     * 그러면 애초에 잠근 적이 없어도 시험이 통과한다.
     */
    let release: (body: unknown) => void = () => {};
    const held: HttpClient = {
      getJson: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    };
    const user = userEvent.setup();

    render(<SchoolSearch source={new NeisSource(held)} onPick={() => {}} />);

    await user.type(screen.getByLabelText('학교 이름'), '한빛초');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(screen.getByRole('button', { name: '찾는 중' })).toBeDisabled();

    release(withHit());
    expect(await screen.findByText('위례한빛초등학교')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '찾기' })).toBeEnabled();
  });
});

describe('결과가 스무 곳에서 잘렸을 때', () => {
  /** `head`에 전체 개수를 담아 준다. NEIS가 실제로 이렇게 보낸다. */
  function withTotal(total: number) {
    const body = withHit();
    body.schoolInfo[0] = { head: [{ list_total_count: total }] } as never;
    return body;
  }

  it('모두 몇 곳인지 알려 주고 이름을 더 길게 넣으라고 한다', async () => {
    http.put(searchUrl, withTotal(34));
    const user = userEvent.setup();

    render(<SchoolSearch source={new NeisSource(http)} onPick={() => {}} />);
    await user.type(screen.getByLabelText('학교 이름'), '한빛초');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    /*
     * 잘렸다고 말해 주지 않으면, 자기 학교가 없는 목록을 보고 이름을 잘못
     * 쳤다고 여긴다. 그러면 더 짧게 고쳐서 더 많이 자른다. 빠져나올 수 없다.
     */
    expect(await screen.findByText(/모두 34곳 중/)).toBeInTheDocument();
    expect(screen.getByText(/더 길게/)).toBeInTheDocument();
  });

  it('다 보여 준 때는 군더더기를 안 붙인다', async () => {
    http.put(searchUrl, withTotal(1));
    const user = userEvent.setup();

    render(<SchoolSearch source={new NeisSource(http)} onPick={() => {}} />);
    await user.type(screen.getByLabelText('학교 이름'), '한빛초');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    await screen.findByText('위례한빛초등학교');
    expect(screen.queryByText(/모두 1곳 중/)).not.toBeInTheDocument();
  });

  it('NEIS가 200에 오류를 실어 보내면 못 찾았다고 하지 않는다', async () => {
    http.put(searchUrl, {
      RESULT: { CODE: 'ERROR-337', MESSAGE: '일별 트래픽 제한을 넘은 호출입니다.' },
    });
    const user = userEvent.setup();

    render(<SchoolSearch source={new NeisSource(http)} onPick={() => {}} />);
    await user.type(screen.getByLabelText('학교 이름'), '한빛초');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    // '못 찾았다'로 보이면 있지도 않은 오타를 찾아 이름만 자꾸 고쳐 보게 된다.
    expect(await screen.findByRole('alert')).toHaveTextContent('NEIS에 연결하지 못했습니다');
    expect(screen.queryByText(/찾지 못했습니다\./)).not.toBeInTheDocument();
  });
});
