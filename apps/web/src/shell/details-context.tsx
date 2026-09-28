import { createContext, useContext, type ReactNode } from "react";

export interface DetailsControls {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const DEFAULT: DetailsControls = { open: false, toggle: () => {}, close: () => {} };
const DetailsContext = createContext<DetailsControls>(DEFAULT);

export function DetailsProvider({ value, children }: { value: DetailsControls; children: ReactNode }) {
  return <DetailsContext.Provider value={value}>{children}</DetailsContext.Provider>;
}

/** 读取详情面板控制；不在 Provider 内时返回 no-op 默认值（便于单测单独渲染页面）。 */
export function useDetails(): DetailsControls {
  return useContext(DetailsContext);
}
