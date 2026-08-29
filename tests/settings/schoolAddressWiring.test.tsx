import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { regionOfAddress } from '../../src/shared/domain/regions';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

/*
 * 배선을 시험한다.
 *
 * SchoolSearch는 고른 학교를 통째로 넘겨주고(주소까지), 스키마는 주소를
 * 왕복시킨다. 둘 다 초록이어도 **잇는 자리**인 SettingsPage의 onPick이
 * hit.address를 버리면 아무 시험도 안 깨진다 — 이 과제 전까지 실제로
 * 그랬다. SchoolSearch.test.tsx는 onPick을 vi.fn()으로 받으므로 진짜
 * onPick이 무엇을 하는지 영원히 안 본다.
 *
 * 그래서 여기서는 진짜 SettingsPage를 그리고, 저장소에 실제로 무엇이
 * 실려 나가는지 본다. Tauri에 닿는 조각과 빌드 대상만 바꿔 끼운다.
 */
const shared = vi.hoisted(() => ({ body: null as unknown }));

/*
 * 시험은 늘 웹 대상으로 돈다. 학교 찾기는 SettingsPage의 isDesktop() 뒤에
 * 있어서, 이걸 안 바꾸면 화면에 아예 안 그려지고 시험은 조용히 통과한다.
 */
vi.mock('../../src/shared/platform/target', () => ({
  TARGET: 'desktop',
  isDesktop: () => true,
  resolveTarget: (raw: string | undefined) => (raw === 'desktop' ? 'desktop' : 'web'),
}));

vi.mock('../../src/shared/external/TauriHttpClient', () => ({
  TauriHttpClient: class {
    getJson(): Promise<unknown> {
      return Promise.resolve(shared.body);
    }
  },
}));

const { default: SettingsPage } = await import('../../src/features/settings/SettingsPage');

const ADDRESS = '경기도 성남시 수정구 위례동로 55';
const OFFICE = 'J10';
const SCHOOL = '7551281';

/** NEIS 학교 찾기 응답. 두 겹 구조까지 진짜 모양 그대로다. */
function schoolBody(): unknown {
  return {
    schoolInfo: [
      { head: [{ list_total_count: 1 }] },
      {
        row: [
          {
            ATPT_OFCDC_SC_CODE: OFFICE,
            ATPT_OFCDC_SC_NM: '경기도교육청',
            SD_SCHUL_CODE: SCHOOL,
            SCHUL_NM: '위례한빛초등학교',
            ORG_RDNMA: ADDRESS,
            SCHUL_KND_SC_NM: '초등학교',
          },
        ],
      },
    ],
  };
}

let saved: SuiteData[] = [];

beforeEach(() => {
  saved = [];
  shared.body = schoolBody();
});

/** 학교를 찾아 고르는 데까지 간다. 저장은 늦춰지므로 기다리는 것은 부르는 쪽 몫이다. */
async function pickSchool(): Promise<void> {
  const user = userEvent.setup();

  render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({
            save: async (data) => {
              saved.push(data);
            },
          })}
        >
          <SettingsPage />
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );

  /*
   * 라벨로 못 찾는다. 이 탭에는 '학교 이름'이 둘이다 — 인쇄물에 쓰는 글자를
   * 손으로 고치는 칸과, 찾기 칸. 자리표 글자로 찾기 칸을 집는다.
   */
  await user.type(await screen.findByPlaceholderText('예: 한빛초'), '한빛초');
  await user.click(screen.getByRole('button', { name: '찾기' }));
  await user.click(await screen.findByRole('button', { name: /위례한빛초등학교/ }));
}

/** 저장은 600ms 늦춰진다. 기본 1초로는 아슬아슬해 넉넉히 준다. */
async function lastSaved(): Promise<SuiteData> {
  await waitFor(() => expect(saved.length).toBeGreaterThan(0), { timeout: 3000 });
  const last = saved[saved.length - 1];
  if (last === undefined) throw new Error('저장된 것이 없다');
  return last;
}

describe('학교를 고르면 주소도 함께 담긴다', () => {
  it('NEIS가 준 도로명 주소가 프로필에 실려 나간다', async () => {
    // 날씨 지역이 여기서 나온다. 주소를 안 담으면 교사가 지역을 따로 골라야 한다.
    await pickSchool();

    expect((await lastSaved()).profile.schoolAddress).toBe(ADDRESS);
  });

  it('담은 주소에서 날씨 지역이 나온다', async () => {
    /*
     * 이 줄이 이 과제의 존재 이유다. 주소를 담기만 하고 regionOfAddress가
     * 못 읽는 글자(학교 이름·교육청 이름)를 담으면 화면에는 아무 표시도
     * 없이 날씨만 영영 안 뜬다. 조용히 틀리는 쪽이라 여기서 못 박는다.
     */
    await pickSchool();

    const profile = (await lastSaved()).profile;

    expect(regionOfAddress(profile.schoolAddress ?? '')?.name).toBe('경기도');
  });

  it('급식이 쓰는 코드도 그대로 함께 담긴다', async () => {
    // 주소를 끼워 넣다가 옆칸을 흘리면 급식이 조용히 끊긴다.
    await pickSchool();

    const profile = (await lastSaved()).profile;

    expect(profile.officeCode).toBe(OFFICE);
    expect(profile.schoolCode).toBe(SCHOOL);
    expect(profile.schoolName).toBe('위례한빛초등학교');
  });
});
