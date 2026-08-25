import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('찾는 동안 단추를 잠근다', async () => {
    http.put(searchUrl, withHit());
    const user = userEvent.setup();

    render(<SchoolSearch source={new NeisSource(http)} onPick={() => {}} />);

    await user.type(screen.getByLabelText('학교 이름'), '한빛초');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /찾/ })).toBeEnabled();
    });
  });
});
