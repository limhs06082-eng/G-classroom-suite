import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type ToolName = 'timer' | 'curtain' | 'notice' | 'picker';

interface ToolsValue {
  /** 지금 열려 있는 것. 없으면 null. */
  openTool: ToolName | null;
  open: (tool: ToolName) => void;
  close: () => void;
}

const ToolsContext = createContext<ToolsValue | null>(null);

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

  const value = useMemo<ToolsValue>(
    () => ({
      openTool,
      open: (tool) => setOpenTool(tool),
      close: () => setOpenTool(null),
    }),
    [openTool],
  );

  return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>;
}

export function useTools(): ToolsValue {
  const value = useContext(ToolsContext);
  if (value === null) throw new Error('useTools는 ToolsProvider 안에서만 쓸 수 있습니다.');
  return value;
}
