import { findUserByUsername, type UserRow } from "../../users/repo";
import { verifyPassword } from "../password";
import type { PasswordAuthProvider, PasswordLoginInput } from "./types";

export const PASSWORD_PROVIDER_ID = "password";

/**
 * 用户名 + 口令提供方（当前默认实现）。
 * 未知用户 / 已禁用 / 口令错误统一返回 null，由路由决定错误码与限流。
 */
export const passwordProvider: PasswordAuthProvider = {
  id: PASSWORD_PROVIDER_ID,
  kind: "password",
  displayName: "用户名密码",

  async login({ db, username, password }: PasswordLoginInput): Promise<UserRow | null> {
    const user = findUserByUsername(db, username);
    if (!user || user.status !== "active") {
      return null;
    }
    const valid = await verifyPassword(password, user.password_hash);
    return valid ? user : null;
  },
};
