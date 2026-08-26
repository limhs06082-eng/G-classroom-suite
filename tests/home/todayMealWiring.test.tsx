import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmptySuiteData } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { SuiteDataProvider } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';
import { stubAdapter } from '../helpers/stubAdapter';

/*
 * 배선을 시험한다.
 *
 * 아래 층은 저마다 잘 시험되어 있다. 그런데 그것들을 **잇는 자리**는
 * 아무도 안 봤다. HomePage에서 시도코드와 학교코드를 맞바꿔 넘겨도,
 * 캐시 임자 글자를 엉뚱하게 지어도 시험은 전부 통과한다. 그리고 선생님은
 * 아무 말 없이 "오늘은 급식이 없습니다"만 보게 된다 — 캐시에 담겨 하루 종일.
 *
 * 그래서 여기서는 Tauri에 닿는 두 조각만 바꿔 끼우고 나머지는 진짜를 쓴다.
 * NeisSource·neisParse·CacheStore·loadTodayMeal·MealCard가 다 실제로 돈다.
 */
const shared = vi.hoisted(() => ({
  disk: new Map<string, string>(),
  asked: [] as string[],
  reply: { body: null as unknown, fail: false },
}));

vi.mock('../../src/shared/storage/TauriFileStore', () => ({
  TauriFileStore: class {
    read(path: string): Promise<string | null> {
      return Promise.resolve(shared.disk.get(path) ?? null);
    }
    writeAtomic(path: string, text: string): Promise<void> {
      shared.disk.set(path, text);
      return Promise.resolve();
    }
    remove(path: string): Promise<void> {
      shared.disk.delete(path);
      return Promise.resolve();
    }
  },
}));

vi.mock('../../src/shared/external/TauriHttpClient', () => ({
  TauriHttpClient: class {
    getJson(url: string): Promise<unknown> {
      shared.asked.push(url);
      return shared.reply.fail
        ? Promise.reject(new Error('인터넷 연결 없음'))
        : Promise.resolve(shared.reply.body);
    }
  },
}));

const { TodayMeal } = await import('../../src/features/home/HomePage');

const OFFICE = 'J10';
const SCHOOL = '7551281';

function withSchool(): SuiteData {
  const data = createEmptySuiteData();
  return {
    ...data,
    profile: { ...data.profile, officeCode: OFFICE, schoolCode: SCHOOL },
  };
}

/** 오늘 날짜여야 한다. 카드가 시계를 보고 묻기 때문이다. */
function todayCompact(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

function mealBody(dish: string): unknown {
  return {
    mealServiceDietInfo: [
      { head: [{ list_total_count: 1 }, { RESULT: { CODE: 'INFO-000' } }] },
      {
        row: [
          {
            MMEAL_SC_NM: '중식',
            MLSV_YMD: todayCompact(),
            DDISH_NM: `${dish}<br/>배추김치 (9.13)`,
            CAL_INFO: '598.2 Kcal',
          },
        ],
      },
    ],
  };
}

function show(data: SuiteData = withSchool()) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteDataProvider
          adapter={stubAdapter({ load: async () => ({ data, repairs: [], isFirstRun: false }) })}
        >
          <TodayMeal />
        </SuiteDataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  shared.disk.clear();
  shared.asked = [];
  shared.reply = { body: null, fail: false };
});

describe('오늘 급식 배선', () => {
  it('설정한 학교의 급식이 화면에 뜬다', async () => {
    shared.reply.body = mealBody('기장밥');

    show();

    expect(await screen.findByText(/기장밥/)).toBeTruthy();
  });

  it('시도코드와 학교코드를 제자리에 넣어 부른다', async () => {
    shared.reply.body = mealBody('기장밥');

    show();
    await screen.findByText(/기장밥/);

    /*
     * 둘 다 짧은 글자라 맞바꿔도 타입 검사가 안 잡는다. 바뀌면 NEIS가
     * INFO-200을 주고, 화면은 아무 일 없다는 듯 "급식이 없습니다"가 된다.
     */
    expect(shared.asked[0]).toContain(`ATPT_OFCDC_SC_CODE=${OFFICE}`);
    expect(shared.asked[0]).toContain(`SD_SCHUL_CODE=${SCHOOL}`);
  });

  it('받아 온 것을 그 학교 이름으로 캐시에 담는다', async () => {
    shared.reply.body = mealBody('기장밥');

    show();
    await screen.findByText(/기장밥/);

    const raw: unknown = JSON.parse(shared.disk.get('cache.json') ?? '{}');
    // 임자를 엉뚱하게 지으면 다음에 열 때마다 남의 것으로 보고 통째로 버린다.
    expect((raw as { school?: string }).school).toBe(`${OFFICE}:${SCHOOL}`);
  });

  it('두 번째로 그릴 때는 NEIS에 다시 묻지 않는다', async () => {
    shared.reply.body = mealBody('기장밥');
    show();
    await screen.findByText(/기장밥/);

    show();
    await waitFor(() => expect(screen.getAllByText(/기장밥/).length).toBeGreaterThan(1));

    // 캐시가 파일까지 갔다 와야 진짜다. 껐다 켜도 인터넷 없이 보여야 한다.
    expect(shared.asked).toHaveLength(1);
  });

  it('학교를 안 정했으면 묻지 않고 안내한다', async () => {
    show(createEmptySuiteData());

    expect(await screen.findByText(/학교를 정하면/)).toBeTruthy();
    expect(shared.asked).toEqual([]);
  });

  it('인터넷이 끊기면 없다고 하지 않는다', async () => {
    shared.reply.fail = true;

    show();

    expect(await screen.findByText(/받아 오지 못했습니다/)).toBeTruthy();
    // 실패를 담아 버리면 인터넷이 돌아와도 오늘은 영영 빈 카드다.
    expect(shared.disk.get('cache.json')).toBeUndefined();
  });

  it('NEIS가 200에 오류를 실어 보내도 없다고 하지 않는다', async () => {
    shared.reply.body = {
      RESULT: { CODE: 'ERROR-337', MESSAGE: '일별 트래픽 제한을 넘은 호출입니다.' },
    };

    show();

    /*
     * 이 갈래가 이 판에서 가장 조용한 결함이었다. 오류가 HTTP 200으로 오니
     * 파싱은 빈 배열을 내고, 그것이 '방학'으로 읽혀 캐시에 굳는다. NEIS가
     * 아침에 잠깐 막혔을 뿐인데 온종일 급식이 없는 날이 된다.
     */
    expect(await screen.findByText(/받아 오지 못했습니다/)).toBeTruthy();
    expect(shared.disk.get('cache.json')).toBeUndefined();
  });

  it('진짜 방학이면 없다고 말한다', async () => {
    shared.reply.body = { RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } };

    show();

    expect(await screen.findByText(/급식이 없습니다/)).toBeTruthy();
    // 방학은 담아 둬야 한다. 안 그러면 방학 내내 NEIS를 두드린다.
    expect(shared.disk.get('cache.json')).toBeTruthy();
  });
});
