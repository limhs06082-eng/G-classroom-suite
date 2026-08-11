import { useNavigate, useParams } from 'react-router-dom';

import { findFeature } from '../../app/navigation';
import { BoardScreen, EmptyState } from '../../shared/ui';

/**
 * 전자칠판 화면.
 *
 * /board/:feature 로 열린다. 앱 셸(헤더·네비) 밖에 있어서 별도 창이나
 * 보조 모니터에 URL로 바로 띄울 수 있다.
 *
 * 각 기능의 실제 칠판 내용은 7~10단계에서 이식하며 여기에 연결된다.
 */
export default function BoardPage() {
  const { feature } = useParams<{ feature: string }>();
  const navigate = useNavigate();

  const item = feature === undefined ? undefined : findFeature(feature);

  if (item === undefined || !item.hasBoardView) {
    return (
      <BoardScreen title="전자칠판" onExit={() => void navigate('/')}>
        <EmptyState
          title="표시할 화면이 없습니다"
          description="주소를 확인해 주세요. 자리·모둠, 역할·당번, 활동·보상, 과제 제출 화면을 띄울 수 있습니다."
        />
      </BoardScreen>
    );
  }

  return (
    <BoardScreen title={item.label} subtitle="학급 정보 미설정" onExit={() => void navigate(item.path)}>
      <p className="text-slate-500">
        이 화면은 {item.label} 기능을 이식할 때 실제 내용으로 채워집니다.
      </p>
    </BoardScreen>
  );
}
