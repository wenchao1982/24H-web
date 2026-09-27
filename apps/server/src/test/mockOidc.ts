import { once } from "node:events";
import { createServer } from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

export interface MockOidc {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** 设置下一次 /token 返回的 id_token 声明（必须含 sub，可含 nonce）。 */
  setClaims: (claims: Record<string, unknown> & { sub: string; nonce?: string }) => void;
  close: () => Promise<void>;
}

/**
 * 最小 mock OIDC 提供方（本地 http）：发现文档 / JWKS / 令牌端点。
 * 用测试期间生成的 RSA 密钥签名 id_token；**绝不连接真实 IdP**。
 */
export async function startMockOidc(): Promise<MockOidc> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  const kid = "test-key-1";
  const clientId = "test-client";
  const clientSecret = "test-secret";

  let claims: Record<string, unknown> = { sub: "test-user" };
  let issuer = "";

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", issuer || "http://127.0.0.1");
      if (url.pathname === "/.well-known/openid-configuration") {
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            issuer,
            authorization_endpoint: `${issuer}/authorize`,
            token_endpoint: `${issuer}/token`,
            jwks_uri: `${issuer}/jwks`,
          }),
        );
        return;
      }

      if (url.pathname === "/jwks") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ keys: [{ ...jwk, kid, alg: "RS256", use: "sig" }] }));
        return;
      }

      if (url.pathname === "/token" && req.method === "POST") {
        const idToken = await new SignJWT(claims)
          .setProtectedHeader({ alg: "RS256", kid })
          .setIssuer(issuer)
          .setAudience(clientId)
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(privateKey);
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            id_token: idToken,
            access_token: "mock-access-token",
            token_type: "Bearer",
          }),
        );
        return;
      }

      res.statusCode = 404;
      res.end("not found");
    })();
  });

  const listening = once(server, "listening");
  server.listen(0, "127.0.0.1");
  await listening;

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("mock oidc: no port");
  }
  issuer = `http://127.0.0.1:${address.port}`;

  return {
    issuer,
    clientId,
    clientSecret,
    redirectUri: `${issuer}/api/auth/oidc/callback`,
    setClaims(next) {
      claims = next;
    },
    close: async () => {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
