import { Lock, Settings, Users } from 'lucide-react';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { ToolsBar } from '../features/tools/ToolsBar';
import { ToolsProvider } from '../features/tools/ToolsContext';
import { WeatherBadge } from '../features/home/WeatherBadge';
import { loadTodayWeather, type WeatherState } from '../features/home/todayWeather';
import { regionOfAddress } from '../shared/domain/regions';
import { hasSchool } from '../shared/domain/school';
import { LockScreen } from '../shared/lock/LockScreen';
import { engageLock, tryUnlock } from '../shared/lock/lockOps';
import { isDesktop } from '../shared/platform/target';
import { useSuite } from '../shared/roster/SuiteDataProvider';
import { useNow } from '../shared/state/useNow';
import { ClassSwitcher } from './ClassSwitcher';
import { ErrorBoundary } from './ErrorBoundary';
import { FEATURE_NAV } from './navigation';
import { PageLoader } from './PageLoader';

/*
 * 헤더 내비게이션에서도 형성평가를 뺀다.
 *
 * router.tsx가 /quiz 라우트를 설치형에서 안 걸어도 FEATURE_NAV는 그대로
 * 아이콘을 보여준다 — 누르면 라우트가 없어 404로 떨어진다. router.tsx에서
 * 값을 가져오지 않는 이유는 router.tsx가 `<AppShell />`을 엘리먼트로
 * 참조하는데 AppShell이 router.tsx를 다시 import하면 순환 import가 되기
 * 때문이다. 값은 하나뿐이라 여기서 그냥 다시 적는다.
 */
const HIDDEN_NAV_IDS_ON_DESKTOP: readonly string[] = ['quiz'];

/**
 * 공통 레이아웃.
 *
 * 헤더의 학기·반·인원 표시는 5단계(roster)에서 실제 데이터와 연결한다.
 * 하단 도구 툴바(타이머·커튼 등)는 11단계에서 붙인다.
 */
export function AppShell() {
  const { data, update } = useSuite();

  /*
   * update의 콜백은 반환값을 밖으로 낼 수 없다. 맞았는지는 지금 자료로
   * 미리 판정하고, 저장은 update 안에서 한 번 더 계산한다.
   * 순수 함수라 두 번 불러도 같은 답이 나온다.
   */
  const handleUnlock = useCallback(
    (pin: string): boolean => {
      const { ok } = tryUnlock(data, pin);
      if (ok) update((current) => tryUnlock(current, pin).data);

      return ok;
    },
    [data, update],
  );

  /*
   * ToolsProvider가 <Outlet/>까지 함께 감싼다.
   *
   * 툴바만 감싸면 컴파일도 되고 툴바도 멀쩡히 도는데, 라우트 화면(홈의 '지금'
   * 카드)이 useTools()를 부르는 순간 provider를 못 찾아 죽는다. 도구를 여는
   * 쪽이 툴바 밖에 있다는 것이 이 context를 만든 이유이므로, 여는 쪽과 그리는
   * 쪽이 한 provider 아래 있어야 한다.
   */
  return (
    <ToolsProvider>
      <div className="flex min-h-full flex-col">
        {/* 반투명 헤더는 스크롤할 때 본문 한글이 비쳐 읽기 어려워진다. 불투명으로 둔다. */}
        <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-surface">
          {/*
            머리띠는 두 줄이 기본이다. 윗줄: 로고 · 학급 전환 · (날씨) · 아이콘들.
            아랫줄: 기능 내비게이션을 **왼쪽으로 몰아** 한 줄로.

            처음에는 전부 한 줄이었는데, 기능이 11개가 되자 기본 창(1280px)에서
            flex가 항목을 쥐어짜 한글 라벨이 세로로 꺾였다 — '출결'이 '출/결'로.
            글자가 꺾이는 머리띠보다 줄이 하나 더 있는 머리띠가 낫다.
            아주 넓은 화면(2xl≥1536px)에서만 다시 한 줄로 합친다.
          */}
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-0.5 px-4 py-2">
            <Link to="/" className="shrink-0 text-base font-bold tracking-tight text-slate-900">
              우리 반
            </Link>

            <ClassSwitcher />

            <nav
              /*
               * 좁은 창의 안전망으로 overflow-x-auto를 둔다. 항목마다
               * shrink-0·whitespace-nowrap이라 무슨 일이 있어도 글자는
               * 안 꺾인다 — 모자라면 꺾이는 대신 넘쳐서 스크롤된다.
               */
              className="order-last -mx-1 flex basis-full items-center gap-1 overflow-x-auto px-1 pb-0.5 2xl:order-0 2xl:ml-1 2xl:basis-auto 2xl:pb-0"
            >
              {FEATURE_NAV.filter(
                ({ id }) => !(isDesktop() && HIDDEN_NAV_IDS_ON_DESKTOP.includes(id)),
              ).map(({ id, path, label, icon: Icon }) => (
                <NavLink
                  key={id}
                  to={path}
                  end={path === '/'}
                  // 좁은 화면에서는 라벨이 숨겨져 아이콘만 남으므로 이름을 따로 준다
                  aria-label={label}
                  className={({ isActive }) =>
                    [
                      'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control px-2.5 py-1.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    ].join(' ')
                  }
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="hidden md:inline">{label}</span>
                </NavLink>
              ))}
            </nav>

            {/*
              오른쪽 끝 묶음. `ml-auto`가 여기 있으므로 **웹에서도 이 묶음은
              그린다** — 날씨가 비어도 아이콘들이 오른쪽 끝을 잡아야 한다.
            */}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {/*
                설치형에서만 그린다. 급식과 같은 사정이다 — 학교 주소를
                NEIS에 물어야 하는데 브라우저는 그 요청을 직접 못 보낸다.
              */}
              {isDesktop() ? <TodayWeather /> : null}

              <NavLink
                to="/roster"
                aria-label="학생 명단"
                className={({ isActive }) =>
                  [
                    'ml-1 rounded-control p-1.5 transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                  ].join(' ')
                }
              >
                <Users className="size-4" aria-hidden />
              </NavLink>

              {/* PIN을 만든 교사에게만 보인다. 누를 수 없는 버튼을 보일 이유가 없다. */}
              {data.lockPin === '' ? null : (
                <button
                  type="button"
                  onClick={() => update(engageLock)}
                  aria-label="화면 잠그기"
                  title="화면 잠그기"
                  className="ml-1 rounded-control p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <Lock className="size-4" aria-hidden />
                </button>
              )}

              <NavLink
                to="/settings"
                aria-label="설정"
                className={({ isActive }) =>
                  [
                    'ml-1 rounded-control p-1.5 transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                  ].join(' ')
                }
              >
                <Settings className="size-4" aria-hidden />
              </NavLink>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          {/* 라우트 단위 격리: 한 기능이 죽어도 헤더와 다른 기능은 살아 있다 */}
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>

        <ToolsBar />

        {/* 전자칠판(/board/*)은 이 껍데기를 쓰지 않는다. 보여 주려고 띄운 화면이라 덮지 않는다. */}
        {data.isLocked ? <LockScreen onSubmit={handleUnlock} /> : null}
      </div>
    </ToolsProvider>
  );
}

/**
 * 낡았는지 다시 재는 주기(분).
 *
 * 낡음 검사는 `CacheStore.getWeather()` **안에** 있다. 한 시간이 지났다고
 * 저절로 무슨 일이 일어나지 않고, 다시 물으러 가지 않으면 아침 기온이
 * 하루 종일 머리띠에 박혀 있는다 — G-board는 교실 컴퓨터에서 종일 켜져
 * 있는 것이 전제라 이건 실제로 일어난다.
 *
 * 값이 10인 까닭은 양쪽 끝이 다 나쁘기 때문이다.
 *
 *   매분: `useNow()`가 깨우는 대로 물으면 바깥 요청은 여전히 한 시간에 한
 *   번이지만(캐시가 신선하면 곧바로 돌려주므로), `CacheStore.open()`이
 *   하루 1,440번 돌아 `cache.json`을 그만큼 읽는다. 한 번 나갈 요청 때문에
 *   파일을 천사백 번 여는 것은 값이 안 맞는다.
 *
 *   한 시간: 아홉 시 오십구 분에 받아 온 것은 열 시 정각에 아직 신선해서
 *   그대로 두고, 다음 검사는 열한 시다. **두 시간 가까이 묵은 숫자**가
 *   머리띠에 남는데 낡았다는 표시는 어디에도 없다.
 *
 * 열 분이면 파일 읽기는 하루 144번이고 화면에 뜬 숫자는 아무리 묵어도
 * 한 시간 십 분을 안 넘는다.
 */
const WEATHER_CHECK_MINUTES = 10;

/**
 * 머리띠의 오늘 날씨.
 *
 * 캐시를 먼저 보고, 없거나 낡았으면 open-meteo에 묻는다. 홈의 `TodayMeal`과
 * 같은 결이고, 다른 것이 셋이다.
 *
 * 1. **시계를 본다.** 급식은 날짜가 바뀔 때만 다시 물으면 되지만 날씨는
 *    같은 날 안에서도 낡는다. 위 `WEATHER_CHECK_MINUTES` 주석 참고.
 * 2. **다시 물을 때 `loading`으로 되돌리지 않는다.** 그러면 머리띠가 열 분
 *    마다 깜빡인다. 새 값이 올 때까지 앞의 값을 그대로 두는 편이 낫다 —
 *    열 분 묵은 기온이 빈자리보다 낫다.
 * 3. **주소가 없으면 한 번 받아 와서 채운다.** 아래 효과 둘 중 첫째다.
 *
 * `useNow()`를 AppShell 본체가 아니라 여기서 부른다. 저기서 부르면 1분마다
 * 껍데기가 다시 그려지고 `<Outlet/>` 아래 화면 전체가 딸려 온다.
 */
export function TodayWeather() {
  const { data, update } = useSuite();
  const [state, setState] = useState<WeatherState>({ kind: 'loading' });

  const officeCode = data.profile.officeCode ?? '';
  const schoolCode = data.profile.schoolCode ?? '';
  const address = data.profile.schoolAddress ?? '';

  const tick = Math.floor(useNow() / WEATHER_CHECK_MINUTES);

  /**
   * 이번에 켠 동안 주소를 물어본 학교.
   *
   * 없는 학교이거나 NEIS가 안 받아 주면 주소는 계속 비어 있고, 그 상태로
   * 효과가 다시 돌면 켜 둔 내내 같은 것을 되묻는다. 한 번 물었으면 이 판이
   * 끝날 때까지 안 묻는다 — 다시 켜면 다시 해 본다.
   */
  const askedAddress = useRef<string | null>(null);

  /*
   * 주소 메우기.
   *
   * 학교를 고를 때 주소를 함께 담기 시작한 것은 이 판부터다. 그 전에 고른
   * 교사에게는 주소가 없고, 그대로 두면 **이미 학교를 고른 사람 전원에게
   * 이 기능이 안 보인다.** 다시 고르라고 하지 않는다.
   *
   * 실패하면 조용히 넘어간다. 날씨가 안 뜰 뿐이고, 교사가 무엇을 부탁받지
   * 않은 일이 어긋났다고 머리띠에 알림이 뜨는 것이 더 나쁘다.
   */
  useEffect(() => {
    if (address !== '') return;
    if (!hasSchool(officeCode, schoolCode)) return;

    const key = `${officeCode}:${schoolCode}`;
    if (askedAddress.current === key) return;
    askedAddress.current = key;

    let cancelled = false;

    void (async () => {
      const [{ NeisSource }, { TauriHttpClient }] = await Promise.all([
        import('../shared/external/NeisSource'),
        import('../shared/external/TauriHttpClient'),
      ]);

      let found: string;
      try {
        found = await new NeisSource(new TauriHttpClient()).fetchAddress(officeCode, schoolCode);
      } catch {
        /*
         * 다음 tick에 다시 해 본다.
         *
         * 표시를 안 지우면 이 프로세스가 사는 동안 다시는 안 묻는다. 그런데
         * **이 효과가 도는 때가 하필 부팅 직후**다 — 교실 컴퓨터가 켜지고
         * G-board가 자동으로 뜨는 그 순간이 학교 네트워크가 아직 안 붙어
         * 있을 확률이 가장 높은 때다. 한 번 실패하고 끝내면, 이 판 이전에
         * 학교를 고른 선생님은 **날씨를 영영 못 본다.** 그 길이 이것뿐이다.
         *
         * 표시는 그대로 두고 실패했을 때만 지운다. 표시가 막는 것은
         * 같은 tick 안에서 두 번 묻는 것이고, 열 분 뒤에 다시 묻는 것은
         * 막을 일이 아니다.
         */
        askedAddress.current = null;
        return;
      }

      // 빈 글자를 담으면 '물어봤다'는 표시가 파일에 남지 않는다. 담을 것이 없다.
      if (cancelled || found === '') return;

      update((current) => ({
        ...current,
        profile: { ...current.profile, schoolAddress: found },
      }));
    })();

    return () => {
      cancelled = true;
    };
    // tick이 있어야 실패한 뒤 열 분마다 다시 해 본다. 위 catch와 짝이다.
  }, [officeCode, schoolCode, address, update, tick]);

  useEffect(() => {
    /*
     * 물을 좌표가 없으면 여기서 끝낸다. `loadTodayWeather`도 같은 것을 다시
     * 보지만, 그 앞에 `CacheStore.open()`이 있어서 그냥 두면 물을 데도 없는데
     * Tauri 조각을 들이고 파일을 연다. 홈의 급식 카드가 `hasSchool()`로 같은
     * 자리를 막는 것과 같은 까닭이다.
     */
    if (regionOfAddress(address) === null) {
      setState({ kind: 'no-school' });
      return;
    }

    let cancelled = false;

    void (async () => {
      const [{ WeatherSource }, { TauriHttpClient }, { CacheStore }, { TauriFileStore }] =
        await Promise.all([
          import('../shared/external/WeatherSource'),
          import('../shared/external/TauriHttpClient'),
          import('../shared/storage/CacheStore'),
          import('../shared/storage/TauriFileStore'),
        ]);

      /*
       * 임자 글자는 급식과 같아야 한다. `cache.json` 하나에 급식과 날씨가
       * 함께 살고, 다른 글자로 열면 이 store는 남의 급식이라 보고 통째로
       * 버린 채 열린다 — 그리고 날씨를 담을 때 그 빈 급식이 파일에 덮인다.
       */
      const cache = await CacheStore.open(new TauriFileStore(), `${officeCode}:${schoolCode}`);

      const next = await loadTodayWeather(cache, new WeatherSource(new TauriHttpClient()), address);

      if (cancelled) return;

      /*
       * 이미 받아 둔 것이 있으면 실패로 지우지 않는다.
       *
       * 위에서 "다시 물을 때 loading으로 되돌리지 않는다"고 해 놓고 실패는
       * 그대로 덮고 있었다. 그러면 학교 공유기가 십오 초 끊긴 것만으로
       * **온 화면의 머리띠에서 날씨가 사라지고**, 다음에 성공할 때까지
       * 안 돌아온다. 오후 내내 끊기면 하교할 때까지 빈자리다.
       *
       * 열 분 묵은 기온이 빈자리보다 낫다는 판단이 loading에만 걸릴
       * 이유가 없다. 화면에서 보면 둘 다 '사라짐'이다.
       */
      setState((prev) => (next.kind === 'failed' && prev.kind === 'ready' ? prev : next));
    })();

    return () => {
      cancelled = true;
    };
  }, [address, officeCode, schoolCode, tick]);

  return <WeatherBadge state={state} />;
}
