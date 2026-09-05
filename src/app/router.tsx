import { createElement, lazy, Suspense } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { AppShell } from './AppShell';
import { NotFoundPage } from './NotFoundPage';
import { PageLoader } from './PageLoader';
import { RootErrorBoundary } from './RootErrorBoundary';

/*
 * 라우트별 lazy 분할.
 * 통합 후 번들이 44,000줄 규모가 되므로, 교사가 홈만 열었을 때
 * 자리배치·당번 코드를 내려받지 않도록 기능 단위로 쪼갠다.
 *
 * QuizPage·JoinPage는 여기 두지 않는다. lazy() 호출을 여기서 무조건
 * 실행해 버리면 설치형 번들에도 그대로 실린다. 아래 라우트 배열 안,
 * import.meta.env.VITE_TARGET 조건 안쪽에 둔다 — 이유는 그 자리의
 * 주석 참고.
 */
const HomePage = lazy(() => import('../features/home/HomePage'));
const AttendancePage = lazy(() => import('../features/attendance/AttendancePage'));
const NoticePage = lazy(() => import('../features/notice/NoticePage'));
const SeatingPage = lazy(() => import('../features/seating/SeatingPage'));
const DutyPage = lazy(() => import('../features/duty/DutyPage'));
const RewardPage = lazy(() => import('../features/reward/RewardPage'));
const AssignmentPage = lazy(() => import('../features/assignment/AssignmentPage'));
const RosterPage = lazy(() => import('../shared/roster/RosterPage'));
const StudentDetailPage = lazy(() => import('../shared/roster/StudentDetailPage'));
const CommentsPage = lazy(() => import('../shared/roster/CommentsPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));
const SetupPage = lazy(() => import('../shared/setup/SetupPage'));
const LessonPage = lazy(() => import('../features/lesson/LessonPage'));
const TaskPage = lazy(() => import('../features/task/TaskPage'));
const MessagePage = lazy(() => import('../features/message/MessagePage'));
const BoardPage = lazy(() => import('../features/board/BoardPage'));
const LoginPage = lazy(() => import('./LoginPage'));

/*
 * 개발 전용 컴포넌트 갤러리.
 *
 * lazy() 호출을 이 조건 안에 두는 것이 중요하다. 바깥에 두면 동적 import가
 * 무조건 실행되는 것으로 취급되어, 라우트를 등록하지 않아도 청크가 배포된다.
 * import.meta.env.DEV는 빌드 시 false로 치환되므로 이 가지 전체가 사라진다.
 */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'dev/gallery',
        Component: lazy(() => import('../features/dev/GalleryPage')),
      },
    ]
  : [];

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RootErrorBoundary />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'attendance', element: <AttendancePage /> },
      { path: 'notice', element: <NoticePage /> },
      { path: 'seating', element: <SeatingPage /> },
      { path: 'duty', element: <DutyPage /> },
      { path: 'reward', element: <RewardPage /> },
      { path: 'assignment', element: <AssignmentPage /> },
      { path: 'lesson', element: <LessonPage /> },
      /*
       * 형성평가는 설치형에서 뺀다.
       *
       * 학생 폰이 들어올 서버가 있어야 성립하는 기능인데 설치형에는 서버가
       * 없다. 반쯤 살려 두면 "되는 줄 알았는데 안 되는" 자리가 되므로
       * 라우트째 통째로 뺀다. 홈(HomePage.tsx)에는 웹으로 가는 안내 카드를
       * 둔다.
       *
       * isDesktop()이 아니라 import.meta.env.VITE_TARGET을 직접 비교한다.
       *
       * 라우트를 거르기만 한다면 isDesktop()으로도 맞다. 하지만 여기 있는
       * lazy()는 청크 그 자체를 만드는 호출이라 다르다. isDesktop()은
       * target.ts에 있는 함수이고, 그 함수가 이 파일과 다른 청크로
       * 갈리는 lazy import 앞에 서면 Rollup이 값을 상수로 접지 못한다
       * (vite.config.ts에 있는 external 설정 옆 주석이 실제로 겪은 같은
       * 문제를 설명한다). 그러면 라우트는 안 걸려도 QuizPage 청크는
       * 설치형 번들에 그대로 남는다 — 실제로 그렇게 되는 것을 빌드해서
       * 확인했다. desktopHiddenPaths라는 배열로 이 조건을 대신 시험한 적이
       * 있었는데, 그 배열은 라우터가 읽지 않아 조건을 되돌려도 시험이
       * 계속 통과했다 — 그래서 지웠다. 이제는 scripts/check-bundle-purity.mjs가
       * 설치형 번들에서 QuizSessionRelay·LocalSessionRelay 문자열을 직접
       * 찾고, tests/app/desktopRoutes.test.ts가 이 router 객체를 실제로
       * 훑어서 확인한다.
       *
       * import.meta.env.VITE_TARGET은 이 파일 안에서 빌드 시 글자로
       * 치환되므로, 이 삼항 전체가 devRoutes와 같은 방식으로 청크가
       * 갈리기 전에 사라진다. lazy() 호출도 삼항 안에 그대로 둔다 —
       * 위로 뽑아 상수에 담으면 무조건 실행되는 것으로 취급된다.
       */
      ...(import.meta.env.VITE_TARGET === 'desktop'
        ? []
        : [{ path: 'quiz', Component: lazy(() => import('../features/quiz/QuizPage')) }]),
      /*
       * 학급 게시판(교사). 설치형에서도 산다 — Firestore는 브라우저 fetch로 붙고
       * tauri.conf.json의 CSP connect-src가 그 주소를 연다. 학생 화면은 아래(셸 밖).
       */
      { path: 'classboard', Component: lazy(() => import('../features/classboard/ClassboardPage')) },
      { path: 'task', element: <TaskPage /> },
      { path: 'message', element: <MessagePage /> },
      { path: 'roster', element: <RosterPage /> },
      { path: 'roster/comments', element: <CommentsPage /> },
      { path: 'roster/:studentId', element: <StudentDetailPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'setup', element: <SetupPage /> },
      ...devRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    /*
     * 전자칠판 화면은 AppShell(헤더·네비) 밖에 둔다.
     * 별도 창이나 보조 모니터에 URL로 바로 띄우는 용도다.
     *
     * 설치형에서도 이 라우트는 감추지 않는다. board/:feature는 자리·당번·
     * 보상·과제·수업 칠판이 함께 쓰는 하나뿐인 라우트라, 여기서 감추면
     * 그것들도 다 죽는다. 설치형에서 /board/quiz로 갈 길은 형성평가
     * 화면(quiz 라우트, 위에서 뺐다)뿐인데 그 화면이 없으므로 아무도
     * 그리로 가지 않는다. BoardPage.tsx 안의 QuizBoard도 같은 이유로
     * import.meta.env.VITE_TARGET으로 따로 가른다(그 파일의 주석 참고) —
     * 이 라우트 자체는 살아 있어도 형성평가 칠판 코드까지 함께 실릴
     * 필요는 없다.
     */
    path: 'board/:feature',
    element: (
      <Suspense fallback={<PageLoader />}>
        <BoardPage />
      </Suspense>
    ),
    errorElement: <RootErrorBoundary />,
  },
  /*
   * 학생 화면. 셸 밖에 둔다. 폰에는 교사용 내비게이션이 필요 없다.
   *
   * 형성평가와 같은 이유(서버가 없다)로 설치형에서 뺀다. quiz 라우트와
   * 같은 이유로 import.meta.env.VITE_TARGET을 직접 비교한다 — isDesktop()을
   * 쓰면 JoinPage 청크가 설치형 번들에 그대로 남는다(위 quiz 라우트 옆
   * 주석 참고).
   */
  ...(import.meta.env.VITE_TARGET === 'desktop'
    ? []
    : [
        {
          path: 'join/:code',
          element: (
            <Suspense fallback={<PageLoader />}>
              {createElement(lazy(() => import('../features/quiz/JoinPage')))}
            </Suspense>
          ),
          errorElement: <RootErrorBoundary />,
        },
        /*
         * 학급 게시판 학생 화면. 형성평가 참여 화면과 같은 이유로 셸 밖·웹 전용.
         * 설치형 번들에서 빠졌는지는 check-bundle-purity가 joinStore.ts의
         * 저장소 키 글자로 본다.
         */
        {
          path: 'classboard/join/:code',
          element: (
            <Suspense fallback={<PageLoader />}>
              {createElement(lazy(() => import('../features/classboard/ClassboardJoinPage')))}
            </Suspense>
          ),
          errorElement: <RootErrorBoundary />,
        },
      ]),
]);
