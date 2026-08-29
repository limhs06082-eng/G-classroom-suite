import { lazy } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { findFeature } from '../../app/navigation';
import { useActiveClass, useActiveTerm } from '../../shared/roster/SuiteDataProvider';
import { BoardScreen, EmptyState } from '../../shared/ui';
import { closeBoard } from '../../shared/window/openBoard';
import { AssignmentBoard } from '../assignment/AssignmentBoard';
import { DutyBoard } from '../duty/DutyBoard';
import { LessonBoard } from '../lesson/LessonBoard';
import { NoticeBoard } from '../notice/NoticeBoard';
import { RewardBoard } from '../reward/RewardBoard';
import { SeatingBoard } from '../seating/SeatingBoard';

/*
 * 형성평가 칠판만 따로 뗀다.
 *
 * QuizBoard는 학생 응답을 실시간으로 보여주려고 session/useSessionResponses를
 * 거쳐 QuizSessionRelay(학생 폰이 들어오는 통로)를 문다. 다른 칠판처럼
 * 정적 import로 두면, 자리·당번·보상·과제·수업 칠판이 전부 함께 쓰는
 * BoardPage 청크가 그 코드를 통째로 끌고 들어간다 — 설치형에서 보드를
 * 하나만 열어도 학생 참여 코드가 다운로드된다.
 *
 * isDesktop()이 아니라 import.meta.env.VITE_TARGET을 직접 비교한다.
 * isDesktop()은 함수 호출이라, 청크가 갈리는 시점에 Rollup이 상수로
 * 접지 못한다(router.tsx의 quiz 라우트 옆 주석과 같은 문제). VITE_TARGET은
 * 이 파일 안에서 빌드 시 글자로 치환되므로 삼항이 통째로 접혀 이 import()
 * 호출 자체가 설치형 청크로 갈리기 전에 사라진다.
 */
const QuizBoard =
  import.meta.env.VITE_TARGET === 'desktop'
    ? null
    : // QuizBoard는 default가 아니라 이름 있는 내보내기라 default로 감싸 준다.
      lazy(() => import('../quiz/QuizBoard').then((m) => ({ default: m.QuizBoard })));

/**
 * 전자칠판 화면.
 *
 * /board/:feature 로 열린다. 앱 셸(헤더·네비) 밖에 있어서 별도 창이나
 * 보조 모니터에 URL로 바로 띄울 수 있다.
 */
export default function BoardPage() {
  const { feature } = useParams<{ feature: string }>();
  const navigate = useNavigate();
  const activeClass = useActiveClass();
  const term = useActiveTerm();

  const item = feature === undefined ? undefined : findFeature(feature);

  if (item === undefined || !item.hasBoardView) {
    return (
      <BoardScreen title="전자칠판" onExit={() => closeBoard(() => void navigate('/'))}>
        <EmptyState
          title="표시할 화면이 없습니다"
          description="주소를 확인해 주세요. 자리·모둠, 역할·당번, 활동·보상, 과제 제출 화면을 띄울 수 있습니다."
        />
      </BoardScreen>
    );
  }

  const subtitle = [term?.name, activeClass?.name].filter(Boolean).join(' · ');

  return (
    <BoardScreen
      title={item.label}
      {...(subtitle === '' ? {} : { subtitle })}
      onExit={() => closeBoard(() => void navigate(item.path))}
    >
      {item.id === 'seating' ? (
        <SeatingBoard />
      ) : item.id === 'duty' ? (
        <DutyBoard />
      ) : item.id === 'reward' ? (
        <RewardBoard />
      ) : item.id === 'assignment' ? (
        <AssignmentBoard />
      ) : item.id === 'lesson' ? (
        <LessonBoard />
      ) : item.id === 'notice' ? (
        <NoticeBoard />
      ) : item.id === 'quiz' ? (
        QuizBoard === null ? (
          // 설치형에는 QuizBoard 자체가 번들에 없다. 아무도 여기로 오지
          // 않지만(형성평가를 여는 화면이 없다), 혹시 옛 주소가 남아 있어도
          // 조용히 죽지 않도록 안내를 남긴다.
          <EmptyState
            title="형성평가는 웹에서 열 수 있습니다"
            description="학생 폰으로 참여하는 형성평가는 설치형에 없습니다. g-classroom-suite.vercel.app 에서 열어 주세요."
          />
        ) : (
          <QuizBoard />
        )
      ) : (
        <p className="text-slate-500">
          이 화면은 {item.label} 기능을 이식할 때 실제 내용으로 채워집니다.
        </p>
      )}
    </BoardScreen>
  );
}
