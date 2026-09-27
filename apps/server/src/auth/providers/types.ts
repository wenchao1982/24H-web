import type { Db } from "../../db";
import type { UserRow } from "../../users/repo";

/** 认证提供方类别：口令交互 vs 重定向（IdP）。 */
export type AuthProviderKind = "password" | "redirect";

/** 对外暴露的提供方描述（`GET /api/auth/providers`）。 */
export interface AuthProviderInfo {
  id: string;
  kind: AuthProviderKind;
  displayName: string;
}

export interface PasswordLoginInput {
  db: Db;
  username: string;
  password: string;
}

/**
 * 认证策略缝：业务只依赖 `req.user`。
 * 口令类实现 `login`；重定向类（OIDC）由各自的 start/callback 路由驱动。
 */
export interface AuthProvider extends AuthProviderInfo {
  kind: AuthProviderKind;
}

export interface PasswordAuthProvider extends AuthProvider {
  kind: "password";
  /** 校验凭据；成功返回已激活用户，失败返回 null。 */
  login(input: PasswordLoginInput): Promise<UserRow | null>;
}

export interface RedirectAuthProvider extends AuthProvider {
  kind: "redirect";
}

export type AnyAuthProvider = PasswordAuthProvider | RedirectAuthProvider;

export function isPasswordProvider(provider: AnyAuthProvider): provider is PasswordAuthProvider {
  return provider.kind === "password";
}
