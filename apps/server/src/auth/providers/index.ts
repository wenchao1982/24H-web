import { passwordProvider } from "./password";
import type { AnyAuthProvider, AuthProviderInfo, PasswordAuthProvider } from "./types";

/** 已注册的认证提供方（password 为默认实现）。 */
const registry: AnyAuthProvider[] = [passwordProvider];

export function listAuthProviders(): AnyAuthProvider[] {
  return registry;
}

export function getPasswordProvider(): PasswordAuthProvider {
  return passwordProvider;
}

/** 公开的提供方列表（仅 id/kind/displayName，不含任何密钥）。 */
export function authProviderInfos(): AuthProviderInfo[] {
  return registry.map(({ id, kind, displayName }) => ({ id, kind, displayName }));
}

export type { AnyAuthProvider, AuthProviderInfo } from "./types";
