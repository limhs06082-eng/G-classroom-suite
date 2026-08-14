import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmptySuiteData } from '../../src/shared/domain/factories';
import type { SuiteData } from '../../src/shared/domain/types';
import { LocalStorageAdapter } from '../../src/shared/storage/LocalStorageAdapter';
import { stubAdapter } from '../helpers/stubAdapter';
import type { LoadResult, StorageAdapter } from '../../src/shared/storage/StorageAdapter';
import { addStudent } from '../../src/shared/roster/rosterOps';
import { SuiteDataProvider, useRoster, useSuite } from '../../src/shared/roster/SuiteDataProvider';
import { ToastProvider } from '../../src/shared/ui';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function Harness() {
  const { data, isLoading, isFirstRun, saveState, update } = useSuite();
  const roster = useRoster();

  return (
    <div>
      <p data-testid="loading">{String(isLoading)}</p>
      <p data-testid="first-run">{String(isFirstRun)}</p>
      <p data-testid="save-state">{saveState}</p>
      <p data-testid="student-count">{data.students.length}</p>
      <p data-testid="roster">{roster.map((s) => `${s.number}${s.name}`).join(',')}</p>
      <button
        type="button"
        onClick={() =>
          update((current) => ({
            ...current,
            terms: [
              {
                id: 'term-1',
                schoolYear: '2026',
                semester: '1학기',
                name: '2026학년도 1학기',
                startDate: '2026-03-02',
                endDate: '2026-07-20',
                status: 'active',
                createdAt: '2026-03-01T00:00:00.000Z',
              },
            ],
            classRooms: [
              {
                id: 'class-1',
                termId: 'term-1',
                name: '3학년 2반',
                createdAt: '2026-03-01T00:00:00.000Z',
                updatedAt: '2026-03-01T00:00:00.000Z',
              },
            ],
            activeTermId: 'term-1',
            activeClassId: 'class-1',
          }))
        }
      >
        학급 만들기
      </button>
      <button
        type="button"
        onClick={() => update((current) => addStudent(current, 'class-1', { number: 1, name: '김하나' }))}
      >
        학생 추가
      </button>
    </div>
  );
}

function renderProvider(adapter: StorageAdapter) {
  return render(
    <ToastProvider>
      <SuiteDataProvider adapter={adapter}>
        <Harness />
      </SuiteDataProvider>
    </ToastProvider>,
  );
}

let storage: MemoryStorage;
let adapter: LocalStorageAdapter;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  storage = new MemoryStorage();
  adapter = new LocalStorageAdapter(storage, () => '2026-03-02T09:00:00.000Z');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SuiteDataProvider', () => {
  it('저장된 것이 없으면 첫 실행으로 알린다', async () => {
    renderProvider(adapter);

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('first-run')).toHaveTextContent('true');
  });

  it('저장을 디바운스한다 — 연속 변경이 한 번만 기록된다', async () => {
    const save = vi.spyOn(adapter, 'save');
    renderProvider(adapter);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      screen.getByRole('button', { name: '학급 만들기' }).click();
      screen.getByRole('button', { name: '학생 추가' }).click();
    });

    // 아직 디바운스 대기 중
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('save-state')).toHaveTextContent('saved');
  });

  it('저장한 내용을 다음 로딩에서 그대로 읽는다', async () => {
    const { unmount } = renderProvider(adapter);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      screen.getByRole('button', { name: '학급 만들기' }).click();
      screen.getByRole('button', { name: '학생 추가' }).click();
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    unmount();

    renderProvider(new LocalStorageAdapter(storage, () => '2026-03-02T10:00:00.000Z'));

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('student-count')).toHaveTextContent('1');
    expect(screen.getByTestId('roster')).toHaveTextContent('1김하나');
  });

  it('언마운트할 때 대기 중인 변경을 잃지 않는다', async () => {
    const save = vi.spyOn(adapter, 'save');
    const { unmount } = renderProvider(adapter);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      screen.getByRole('button', { name: '학급 만들기' }).click();
    });
    // 디바운스가 끝나기 전에 탭을 닫는 상황
    unmount();

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('불러오기에서 고친 내용을 사용자에게 알린다', async () => {
    const repairing: StorageAdapter = stubAdapter({
      load: async (): Promise<LoadResult> => ({
        data: createEmptySuiteData(),
        isFirstRun: false,
        repairs: [
          {
            code: 'DUPLICATE_STUDENT_NUMBER',
            severity: 'warning',
            entityIds: [],
            message: '번호가 겹친 학생 2명에게 새 번호를 부여했습니다.',
          },
        ],
      }),
    });

    renderProvider(repairing);

    await waitFor(() => {
      expect(screen.getByText('번호가 겹친 학생 2명에게 새 번호를 부여했습니다.')).toBeInTheDocument();
    });
  });

  it('저장에 실패하면 오류를 띄우고 상태로 알린다', async () => {
    const failing: StorageAdapter = stubAdapter({
      save: async (): Promise<void> => {
        throw new Error('브라우저 저장 공간이 부족해 저장하지 못했습니다.');
      },
    });

    renderProvider(failing);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      screen.getByRole('button', { name: '학급 만들기' }).click();
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    await waitFor(() => expect(screen.getByTestId('save-state')).toHaveTextContent('failed'));
    expect(screen.getByText(/저장 공간이 부족/)).toBeInTheDocument();
  });

  it('화면에서 만든 변경도 불변조건을 통과시킨다', async () => {
    renderProvider(adapter);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      screen.getByRole('button', { name: '학급 만들기' }).click();
      // 학급이 없는 상태에서 학생을 넣으려 해도 데이터가 깨지지 않아야 한다
      screen.getByRole('button', { name: '학생 추가' }).click();
      screen.getByRole('button', { name: '학생 추가' }).click();
    });

    // 번호가 겹친 두 학생이 자동으로 정리된다
    const roster = screen.getByTestId('roster').textContent ?? '';
    const numbers = roster.split(',').map((entry) => entry.replace(/\D/g, ''));
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('화면 조작 중에 고친 내용도 사용자에게 알린다', async () => {
    /*
     * 불러올 때만 알리고 조작 중에는 조용했던 결함이 있었다.
     * 예를 들어 교실 행 수를 줄이면 밖으로 밀려난 학생의 자리가 비워지는데,
     * 알리지 않으면 교사는 왜 미배치가 됐는지 알 수 없다.
     */
    renderProvider(adapter);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      screen.getByRole('button', { name: '학급 만들기' }).click();
      // 같은 번호로 두 번 추가 → 번호 중복 복구가 일어난다
      screen.getByRole('button', { name: '학생 추가' }).click();
      screen.getByRole('button', { name: '학생 추가' }).click();
    });

    await waitFor(() => {
      expect(screen.getByText(/번호가 겹친 학생/)).toBeInTheDocument();
    });
  });

  it('같은 복구 알림이 반복해서 쌓이지 않는다', async () => {
    // 복구는 멱등이다. 한 번 고쳐진 뒤에는 같은 알림이 다시 뜨지 않아야 한다.
    renderProvider(adapter);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      screen.getByRole('button', { name: '학급 만들기' }).click();
      screen.getByRole('button', { name: '학생 추가' }).click();
      screen.getByRole('button', { name: '학생 추가' }).click();
    });
    await waitFor(() => expect(screen.getByText(/번호가 겹친 학생/)).toBeInTheDocument());

    await act(async () => {
      // 관계없는 변경을 한 번 더 일으킨다
      screen.getByRole('button', { name: '학급 만들기' }).click();
    });

    expect(screen.getAllByText(/번호가 겹친 학생/)).toHaveLength(1);
  });

  it('useSuite를 Provider 밖에서 쓰면 명확히 실패한다', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <ToastProvider>
          <Harness />
        </ToastProvider>,
      ),
    ).toThrow(/SuiteDataProvider/);
    spy.mockRestore();
  });
});

describe('useRoster', () => {
  it('활성 학급의 학생만 번호순으로 돌려준다', async () => {
    const seeded: SuiteData = {
      ...createEmptySuiteData(),
      terms: [
        {
          id: 'term-1',
          schoolYear: '2026',
          semester: '1학기',
          name: '2026학년도 1학기',
          startDate: '2026-03-02',
          endDate: '2026-07-20',
          status: 'active',
          createdAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      classRooms: [
        {
          id: 'class-1',
          termId: 'term-1',
          name: '3학년 2반',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
        {
          id: 'class-2',
          termId: 'term-1',
          name: '3학년 3반',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      students: [
        { id: 'a', classId: 'class-1', number: 3, name: '박세찬', status: 'active', createdAt: '', updatedAt: '' },
        { id: 'b', classId: 'class-1', number: 1, name: '김하나', status: 'active', createdAt: '', updatedAt: '' },
        { id: 'c', classId: 'class-1', number: 2, name: '전출생', status: 'inactive', createdAt: '', updatedAt: '' },
        { id: 'd', classId: 'class-2', number: 1, name: '남의반', status: 'active', createdAt: '', updatedAt: '' },
      ],
      activeTermId: 'term-1',
      activeClassId: 'class-1',
    };

    const seededAdapter: StorageAdapter = stubAdapter({
      load: async (): Promise<LoadResult> => ({ data: seeded, isFirstRun: false, repairs: [] }),
    });

    renderProvider(seededAdapter);

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    // 번호순, 전출생 제외, 다른 반 제외
    expect(screen.getByTestId('roster')).toHaveTextContent('1김하나,3박세찬');
  });
});

describe('SuiteDataProvider — 다른 창의 변경', () => {
  /** 컨텍스트 값을 그대로 잡아 둔다. update를 직접 불러야 한다. */
  function renderProbe(probeAdapter: StorageAdapter) {
    const seen: { current: ReturnType<typeof useSuite> | null } = { current: null };

    function Probe() {
      seen.current = useSuite();
      return null;
    }

    render(
      <ToastProvider>
        <SuiteDataProvider adapter={probeAdapter}>
          <Probe />
        </SuiteDataProvider>
      </ToastProvider>,
    );

    return seen;
  }

  /** 밖에서 외부 변경을 밀어 넣을 수 있는 스텁 */
  function pushableAdapter() {
    const box: { push: ((data: SuiteData) => void) | null } = { push: null };
    const pushable = stubAdapter({
      subscribe: (listener) => {
        box.push = listener;
        return () => {
          box.push = null;
        };
      },
    });
    return { adapter: pushable, box };
  }

  /**
   * 다른 창이 보냈다고 할 만한 **온전한** 데이터.
   *
   * activeClassId만 넣고 학급을 빼면 참조 무결성 검사가 정당하게 null로
   * 되돌린다. 그러면 통과해야 할 테스트가 엉뚱한 이유로 실패한다.
   */
  function incoming(): SuiteData {
    return {
      ...createEmptySuiteData(),
      terms: [
        {
          id: 'term-1',
          schoolYear: '2026',
          semester: '1학기',
          name: '2026학년도 1학기',
          startDate: '2026-03-02',
          endDate: '2026-07-20',
          status: 'active',
          createdAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      classRooms: [
        {
          id: 'class-1',
          termId: 'term-1',
          name: '3학년 2반',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      activeTermId: 'term-1',
      activeClassId: 'class-1',
    };
  }

  it('다른 창의 변경을 화면에 반영한다', async () => {
    const { adapter: pushable, box } = pushableAdapter();
    const seen = renderProbe(pushable);

    /*
     * load()가 비동기다. 이걸 흘려보내지 않고 외부 변경을 밀어 넣으면
     * 뒤늦게 끝난 load가 그것을 덮어 테스트가 간헐적으로 실패한다.
     */
    await act(async () => {});
    expect(box.push).not.toBeNull();

    act(() => box.push?.(incoming()));

    await waitFor(() => expect(seen.current?.data.activeClassId).toBe('class-1'));
  });

  it('반영한 뒤 update가 낡은 값에서 출발하지 않는다', async () => {
    // 이것이 원래 버그다. 칠판이 넘긴 값을 메인 창의 다음 저장이 되돌렸다.
    const { adapter: pushable, box } = pushableAdapter();
    const seen = renderProbe(pushable);

    await act(async () => {});
    expect(box.push).not.toBeNull();

    act(() => box.push?.(incoming()));
    await waitFor(() => expect(seen.current?.data.activeClassId).toBe('class-1'));

    // 다른 창에서 온 것과 상관없는 작업을 한다
    act(() =>
      seen.current?.update((current) => ({
        ...current,
        classRooms: [
          ...current.classRooms,
          {
            id: 'class-2',
            termId: 'term-1',
            name: '3학년 3반',
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
        ],
      })),
    );

    // 외부에서 온 학급 선택이 살아 있어야 한다.
    expect(seen.current?.data.activeClassId).toBe('class-1');
    expect(seen.current?.data.classRooms).toHaveLength(2);
  });
});
