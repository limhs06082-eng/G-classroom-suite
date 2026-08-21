import { lazy, Suspense } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { AppShell } from './AppShell';
import { NotFoundPage } from './NotFoundPage';
import { PageLoader } from './PageLoader';
import { RootErrorBoundary } from './RootErrorBoundary';

/*
 * 라우트별 lazy 분할.
 * 통합 후 번들이 44,000줄 규모가 되므로, 교사가 홈만 열었을 때
 * 자리배치·당번 코드를 내려받지 않도록 기능 단위로 쪼갠다.
 */
const HomePage = lazy(() => import('../features/home/HomePage'));
const SeatingPage = lazy(() => import('../features/seating/SeatingPage'));
const DutyPage = lazy(() => import('../features/duty/DutyPage'));
const RewardPage = lazy(() => import('../features/reward/RewardPage'));
const AssignmentPage = lazy(() => import('../features/assignment/AssignmentPage'));
const RosterPage = lazy(() => import('../shared/roster/RosterPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));
const SetupPage = lazy(() => import('../shared/setup/SetupPage'));
const LessonPage = lazy(() => import('../features/lesson/LessonPage'));
const QuizPage = lazy(() => import('../features/quiz/QuizPage'));
const TaskPage = lazy(() => import('../features/task/TaskPage'));
const MessagePage = lazy(() => import('../features/message/MessagePage'));
const BoardPage = lazy(() => import('../features/board/BoardPage'));
const JoinPage = lazy(() => import('../features/quiz/JoinPage'));

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
      { path: 'seating', element: <SeatingPage /> },
      { path: 'duty', element: <DutyPage /> },
      { path: 'reward', element: <RewardPage /> },
      { path: 'assignment', element: <AssignmentPage /> },
      { path: 'lesson', element: <LessonPage /> },
      { path: 'quiz', element: <QuizPage /> },
      { path: 'task', element: <TaskPage /> },
      { path: 'message', element: <MessagePage /> },
      { path: 'roster', element: <RosterPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'setup', element: <SetupPage /> },
      ...devRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    /*
     * 전자칠판 화면은 AppShell(헤더·네비) 밖에 둔다.
     * 별도 창이나 보조 모니터에 URL로 바로 띄우는 용도다.
     */
    path: 'board/:feature',
    element: (
      <Suspense fallback={<PageLoader />}>
        <BoardPage />
      </Suspense>
    ),
    errorElement: <RootErrorBoundary />,
  },
  {
    // 학생 화면. 셸 밖에 둔다. 폰에는 교사용 내비게이션이 필요 없다.
    path: 'join/:code',
    element: (
      <Suspense fallback={<PageLoader />}>
        <JoinPage />
      </Suspense>
    ),
    errorElement: <RootErrorBoundary />,
  },
]);
