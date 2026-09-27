import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { ApiError } from "../http/errors";

const FETCH_TIMEOUT_MS = 10_000;
const DISCOVERY_TTL_MS = 5 * 60 * 1000;

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

/** 从环境变量读取 OIDC 配置；缺关键项返回 null（提供方不注册）。 */
export function readOidcConfig(env: NodeJS.ProcessEnv = process.env): OidcConfig | null {
  const issuer = env.OIDC_ISSUER?.trim();
  const clientId = env.OIDC_CLIENT_ID?.trim();
  const redirectUri = env.OIDC_REDIRECT_URI?.trim();
  if (!issuer || !clientId || !redirectUri) {
    return null;
  }
  return {
    issuer: issuer.replace(/\/+$/, ""),
    clientId,
    clientSecret: env.OIDC_CLIENT_SECRET ?? "",
    redirectUri,
  };
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createStateNonce(): { state: string; nonce: string } {
  return { state: randomBytes(16).toString("hex"), nonce: randomBytes(16).toString("hex") };
}

const discoveryCache = new Map<string, { doc: OidcDiscovery; expiresAt: number }>();
const jwksCache = new Map<string, JWTVerifyGetKey>();

export function clearOidcCaches(): void {
  discoveryCache.clear();
  jwksCache.clear();
}

export async function discover(issuer: string): Promise<OidcDiscovery> {
  const now = Date.now();
  const cached = discoveryCache.get(issuer);
  if (cached && cached.expiresAt > now) {
    return cached.doc;
  }

  let response: Response;
  try {
    response = await fetch(`${issuer}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(502, "OIDC_DISCOVERY_FAILED", "无法连接 OIDC 提供方");
  }
  if (!response.ok) {
    throw new ApiError(502, "OIDC_DISCOVERY_FAILED", `OIDC 发现失败（${response.status}）`);
  }

  const doc = (await response.json()) as OidcDiscovery;
  discoveryCache.set(issuer, { doc, expiresAt: now + DISCOVERY_TTL_MS });
  return doc;
}

export function authorizationUrl(
  config: OidcConfig,
  discovery: OidcDiscovery,
  input: { state: string; nonce: string; codeChallenge: string },
): string {
  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface OidcTokenResponse {
  id_token: string;
  access_token?: string;
}

export async function exchangeCode(
  config: OidcConfig,
  discovery: OidcDiscovery,
  input: { code: string; codeVerifier: string },
): Promise<OidcTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: input.codeVerifier,
  });
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
  };
  if (config.clientSecret) {
    headers.authorization = `Basic ${Buffer.from(
      `${config.clientId}:${config.clientSecret}`,
    ).toString("base64")}`;
  }

  let response: Response;
  try {
    response = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(502, "OIDC_TOKEN_FAILED", "OIDC 令牌交换失败");
  }
  if (!response.ok) {
    throw new ApiError(502, "OIDC_TOKEN_FAILED", `OIDC 令牌交换失败（${response.status}）`);
  }

  const payload = (await response.json()) as Partial<OidcTokenResponse>;
  if (typeof payload.id_token !== "string" || payload.id_token === "") {
    throw new ApiError(502, "OIDC_TOKEN_FAILED", "OIDC 响应缺少 id_token");
  }
  return { id_token: payload.id_token, ...(payload.access_token ? { access_token: payload.access_token } : {}) };
}

/** 校验 ID token 签名/iss/aud/nonce，返回声明。绝不记录 token 内容。 */
export async function verifyIdToken(
  config: OidcConfig,
  discovery: OidcDiscovery,
  input: { idToken: string; nonce: string },
): Promise<JWTPayload> {
  let jwks = jwksCache.get(discovery.jwks_uri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(discovery.jwks_uri), {
      timeoutDuration: FETCH_TIMEOUT_MS,
    });
    jwksCache.set(discovery.jwks_uri, jwks);
  }

  let payload: JWTPayload;
  try {
    const result = await jwtVerify(input.idToken, jwks, {
      issuer: discovery.issuer,
      audience: config.clientId,
    });
    payload = result.payload;
  } catch {
    throw new ApiError(401, "OIDC_INVALID_TOKEN", "ID token 校验失败");
  }

  if (input.nonce && payload.nonce !== input.nonce) {
    throw new ApiError(401, "OIDC_INVALID_TOKEN", "ID token nonce 不匹配");
  }

  return payload;
}

export function claimString(payload: JWTPayload, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return null;
}
