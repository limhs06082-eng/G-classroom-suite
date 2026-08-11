import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';

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
const BoardPage = lazy(() => import('../features/board/BoardPage'));

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
      { path: 'roster', element: <RosterPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'setup', element: <SetupPage /> },
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
]);
