import type { RedirectAuthProvider } from "./types";

export const OIDC_PROVIDER_ID = "oidc";

/** OIDC（授权码 + PKCE）重定向提供方；实际流程见 `routes/auth.ts` 的 start/callback。 */
export function oidcProvider(): RedirectAuthProvider {
  return {
    id: OIDC_PROVIDER_ID,
    kind: "redirect",
    displayName: "企业 OIDC 登录",
  };
}
