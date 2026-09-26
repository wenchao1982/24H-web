import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createGateway, type Gateway } from "../api/ws";

const GatewayContext = createContext<Gateway | null>(null);

let defaultGateway: Gateway | null = null;

function fallbackGateway(): Gateway {
  if (!defaultGateway) {
    defaultGateway = createGateway();
  }
  return defaultGateway;
}

/** 注入 L1 网关客户端；测试传 `gateway` 用 fake，生产走 `createGateway()`。 */
export function GatewayProvider({
  gateway,
  children,
}: {
  gateway?: Gateway;
  children: ReactNode;
}) {
  const value = useMemo(() => gateway ?? createGateway(), [gateway]);
  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

/** 取当前网关；无 Provider 时回退到进程级默认实例（测试由 Provider 覆盖）。 */
export function useGateway(): Gateway {
  return useContext(GatewayContext) ?? fallbackGateway();
}
