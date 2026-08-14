import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { createEmptySuiteData } from '../domain/factories';
import { validateAndRepair } from '../domain/invariants';
import type { ClassRoom, Student, SuiteData, Term } from '../domain/types';
import { LocalStorageAdapter } from '../storage/LocalStorageAdapter';
import type { BackupKind, StorageAdapter } from '../storage/StorageAdapter';
import { useExternalChanges } from '../state/useExternalChanges';
import { useToast } from '../ui';

/**
 * 앱 전역 데이터 공급자.
 *
 * 모든 기능이 여기서 학생 명단을 가져간다. 이것이 통합의 핵심이다.
 * 원본에서는 5개 앱이 각자 localStorage를 직접 읽고 썼다.
 *
 * 저장은 디바운스한다. 보상 점수 입력은 수업 중 분당 수 회 일어나므로
 * 변경마다 직렬화하면 입력이 버벅인다.
 */

const SAVE_DEBOUNCE_MS = 600;

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

interface SuiteContextValue {
  data: SuiteData;
  /** 첫 로딩이 끝나기 전에는 화면을 그리지 않는다 */
  isLoading: boolean;
  /** 저장된 데이터가 없어 설정 마법사로 보내야 하는 상태 */
  isFirstRun: boolean;
  saveState: SaveState;

  /** 데이터를 바꾼다. 반환한 객체가 새 상태가 된다. */
  update: (recipe: (current: SuiteData) => SuiteData) => void;
  /** 되돌릴 수 없는 작업 직전에 부른다. */
  guard: (reason: string) => Promise<void>;
  /** 대기 중인 저장을 즉시 밀어낸다. */
  flush: () => Promise<void>;

  adapter: StorageAdapter;
}

const SuiteContext = createContext<SuiteContextValue | null>(null);

export function useSuite(): SuiteContextValue {
  const value = useContext(SuiteContext);
  if (value === null) {
    throw new Error('useSuite는 SuiteDataProvider 안에서만 쓸 수 있습니다.');
  }
  return value;
}

interface Props {
  /** 테스트에서 주입한다. 기본은 localStorage 구현. */
  adapter?: StorageAdapter;
  children: ReactNode;
}

export function SuiteDataProvider({ adapter: injected, children }: Props) {
  const toast = useToast();

  const adapter = useMemo<StorageAdapter>(() => injected ?? new LocalStorageAdapter(), [injected]);

  const [data, setData] = useState<SuiteData>(createEmptySuiteData);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 저장 대기 중인 최신 상태. 디바운스 도중 값이 또 바뀔 수 있다. */
  const pendingRef = useRef<SuiteData | null>(null);
  /**
   * 최신 상태의 거울.
   *
   * setData의 함수형 갱신 안에서 복구 결과를 알리면 부수효과가 렌더 중에 일어나고,
   * StrictMode에서 갱신 함수가 두 번 불려 알림이 두 번 뜬다.
   * 그래서 다음 상태를 갱신 함수 밖에서 계산한다. 연속 호출에도 값이 밀리지 않도록
   * 여기에 즉시 반영한다.
   */
  const dataRef = useRef<SuiteData>(data);

  // ── 최초 로딩 ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await adapter.load();
        if (cancelled) return;

        dataRef.current = result.data;
        setData(result.data);
        setIsFirstRun(result.isFirstRun);

        // 자동으로 고친 내용은 반드시 알린다. 조용히 고치지 않는다.
        for (const repair of result.repairs) {
          if (repair.severity === 'warning') toast.warning(repair.message);
          else toast.info(repair.message);
        }
      } catch (error) {
        if (cancelled) return;
        toast.error(
          error instanceof Error ? error.message : '저장된 데이터를 불러오지 못했습니다.',
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // toast는 Provider 수명 동안 안정적이다. adapter만 의존성으로 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter]);

  // ── 저장 ─────────────────────────────────────────────────
  const persist = useCallback(
    async (next: SuiteData): Promise<void> => {
      setSaveState('saving');
      try {
        await adapter.save(next);
        setSaveState('saved');
      } catch (error) {
        setSaveState('failed');
        // 저장 실패는 데이터를 잃는 사고로 이어진다. 자동으로 닫히지 않는 오류로 띄운다.
        toast.error(
          error instanceof Error ? error.message : '저장하지 못했습니다. 데이터를 내보내 백업해 주세요.',
        );
      }
    },
    [adapter, toast],
  );

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending !== null) await persist(pending);
  }, [persist]);

  const update = useCallback(
    (recipe: (current: SuiteData) => SuiteData): void => {
      // 화면에서 만든 변경도 불변조건을 지켜야 한다. 여기가 마지막 관문이다.
      const { data: next, repairs } = validateAndRepair(recipe(dataRef.current));

      dataRef.current = next;
      setData(next);

      /*
       * 여기서 고친 내용도 반드시 알린다.
       *
       * 예: 교실 행 수를 줄이면 밖으로 밀려난 학생의 자리가 비워진다.
       * 알리지 않으면 교사는 학생 몇 명이 왜 갑자기 미배치가 됐는지 알 수 없다.
       * 복구는 멱등이므로 같은 알림이 반복해서 뜨지 않는다.
       */
      for (const repair of repairs) {
        if (repair.severity === 'warning') toast.warning(repair.message);
      }

      pendingRef.current = next;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending !== null) void persist(pending);
      }, SAVE_DEBOUNCE_MS);
    },
    [persist, toast],
  );

  const guard = useCallback(
    async (reason: string): Promise<void> => {
      // 백업은 현재 화면 상태 기준이어야 하므로 대기 중인 저장을 먼저 밀어낸다.
      await flush();
      await adapter.createBackup(reason, 'guard' satisfies BackupKind);
    },
    [adapter, flush],
  );

  /*
   * 칠판은 별도 창으로 뜬다. 이 구독이 없으면 각 창이 자기 사본을 들고
   * 문서 전체를 덮어써서, 서로 다른 곳을 고쳐도 한쪽이 조용히 사라진다.
   */
  useExternalChanges<SuiteData>(adapter, {
    // 내 것이 곧 나가고 상대가 그것을 구독으로 받는다. 상태는 갈라지지 않는다.
    shouldIgnore: () => pendingRef.current !== null,
    onApply: (next) => {
      // 둘 다 갱신해야 한다. dataRef만 낡으면 다음 update가 같은 문제를 되풀이한다.
      dataRef.current = next;
      setData(next);
    },
    onDefer: () =>
      toast.info('다른 창에서 바뀐 내용이 있습니다. 지금 하시던 편집을 마치면 반영됩니다.'),
  });

  // 탭을 닫을 때 대기 중인 변경을 잃지 않는다.
  useEffect(() => {
    const handleBeforeUnload = (): void => {
      const pending = pendingRef.current;
      if (pending !== null) void adapter.save(pending);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [adapter]);

  const value = useMemo<SuiteContextValue>(
    () => ({ data, isLoading, isFirstRun, saveState, update, guard, flush, adapter }),
    [data, isLoading, isFirstRun, saveState, update, guard, flush, adapter],
  );

  return <SuiteContext.Provider value={value}>{children}</SuiteContext.Provider>;
}

// ─────────────────────────────────────────────────────────────
// 파생 셀렉터
// 기능 화면들이 매번 같은 필터링을 반복하지 않도록 여기서 한 번만 정의한다.
// ─────────────────────────────────────────────────────────────

export function useActiveTerm(): Term | null {
  const { data } = useSuite();
  return useMemo(
    () => data.terms.find((term) => term.id === data.activeTermId) ?? null,
    [data.terms, data.activeTermId],
  );
}

export function useActiveClass(): ClassRoom | null {
  const { data } = useSuite();
  return useMemo(
    () => data.classRooms.find((room) => room.id === data.activeClassId) ?? null,
    [data.classRooms, data.activeClassId],
  );
}

/** 활성 학급의 학생. 번호순으로 정렬해 돌려준다. */
export function useRoster(options: { includeInactive?: boolean } = {}): Student[] {
  const { data } = useSuite();
  const includeInactive = options.includeInactive ?? false;

  return useMemo(() => {
    if (data.activeClassId === null) return [];
    return data.students
      .filter((student) => student.classId === data.activeClassId)
      .filter((student) => includeInactive || student.status === 'active')
      .sort((a, b) => a.number - b.number);
  }, [data.students, data.activeClassId, includeInactive]);
}
