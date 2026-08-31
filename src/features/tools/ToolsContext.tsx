import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { playChime } from '../../shared/fx/sound';
import { useToast } from '../../shared/ui';
import { useTimer, type Timer } from './useTimer';

export type ToolName = 'timer' | 'curtain' | 'notice' | 'picker';

interface ToolsValue {
  /** 지금 열려 있는 것. 없으면 null. */
  openTool: ToolName | null;
  open: (tool: ToolName) => void;
  close: () => void;
}

const ToolsContext = createContext<ToolsValue | null>(null);

/*
 * 타이머는 **다른 context**에 산다. 한 context에 섞으면 200ms 틱마다
 * 값이 바뀌어, open/close만 읽는 소비자('지금' 카드)까지 초당 다섯 번
 * 다시 그린다. 갈라 두면 틱은 타이머를 실제로 그리는 곳(툴바 단추,
 * 타이머 모달)에만 닿는다.
 */
const TimerContext = createContext<Timer | null>(null);

/**
 * 도구를 여는 상태를 `ToolsBar` 바깥으로 올린다.
 *
 * '지금' 카드가 수업 중에 [타이머]·[화면 가리기]를 내미는데, 그 상태가
 * `ToolsBar` 안에 갇혀 있으면 카드가 열 길이 없다.
 *
 * `CustomEvent`를 안 쓴다. 그건 React 나무가 안 이어진 자리(저장 계층 →
 * 화면)를 잇는 수단이고, 홈과 툴바는 둘 다 `AppShell` 아래라 이어져 있다.
 * 이어진 곳을 이벤트로 잇면 누가 듣는지 추적할 수 없어진다.
 */
export function ToolsProvider({ children }: { children: ReactNode }) {
  const [openTool, setOpenTool] = useState<ToolName | null>(null);
  const toast = useToast();

  const timer = useTimer(() => {
    /*
     * durationMs: 0 — 저절로 사라지지 않는다. 다른 화면에 있다가 돌아와도
     * 끝났다는 사실이 남아 있어야 한다.
     *
     * 종소리도 함께 낸다. 학교 종은 교시를 알리는 것이고 이 종은 교사가
     * 직접 건 활동 시간을 알리는 것이라 겹칠 일이 없다. 시끄러우면
     * 툴바의 스피커 단추 하나로 전부 꺼진다.
     */
    playChime();
    toast.warning('타이머가 끝났습니다.', {
      durationMs: 0,
      actionLabel: '타이머 열기',
      onAction: () => setOpenTool('timer'),
    });
  });

  const value = useMemo<ToolsValue>(
    () => ({
      openTool,
      open: (tool) => setOpenTool(tool),
      close: () => setOpenTool(null),
    }),
    [openTool],
  );

  return (
    <ToolsContext.Provider value={value}>
      <TimerContext.Provider value={timer}>{children}</TimerContext.Provider>
    </ToolsContext.Provider>
  );
}

export function useTools(): ToolsValue {
  const value = useContext(ToolsContext);
  if (value === null) throw new Error('useTools는 ToolsProvider 안에서만 쓸 수 있습니다.');
  return value;
}

/**
 * 수업 타이머. 모달이 아니라 provider에 사는 이유는 **모달을 닫아도
 * 돌아야** 하기 때문이다 — 툴바 단추가 남은 시간을 보여 주고, 끝나면
 * 사라지지 않는 알림이 뜬다. 틱마다 다시 그려지므로 타이머를 실제로
 * 그리는 곳에서만 부를 것.
 */
export function useToolsTimer(): Timer {
  const value = useContext(TimerContext);
  if (value === null) throw new Error('useToolsTimer는 ToolsProvider 안에서만 쓸 수 있습니다.');
  return value;
}
