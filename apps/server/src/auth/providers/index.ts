import { readOidcConfig } from "../oidc";
import { oidcProvider } from "./oidc";
import { passwordProvider } from "./password";
import type { AnyAuthProvider, AuthProviderInfo, PasswordAuthProvider } from "./types";

export function getPasswordProvider(): PasswordAuthProvider {
  return passwordProvider;
}

/**
 * 已注册的认证提供方：`password` 恒在；`oidc` 仅在配置齐全时注册
 * （每次读取环境变量，便于测试与运行时切换）。
 */
export function listAuthProviders(): AnyAuthProvider[] {
  const providers: AnyAuthProvider[] = [passwordProvider];
  if (readOidcConfig()) {
    providers.push(oidcProvider());
  }
  return providers;
}

/** 公开的提供方列表（仅 id/kind/displayName，不含任何密钥）。 */
export function authProviderInfos(): AuthProviderInfo[] {
  return listAuthProviders().map(({ id, kind, displayName }) => ({ id, kind, displayName }));
}

export type { AnyAuthProvider, AuthProviderInfo } from "./types";
