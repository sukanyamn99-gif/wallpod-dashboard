import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

// A deliberately small, STATELESS OAuth 2.1 authorization server for the MCP
// endpoint: dynamic client registration, authorization-code + PKCE (S256
// only), refresh tokens. Nothing is stored in the database — clients, codes
// and tokens are all HMAC-signed JWTs. Consequences, accepted on purpose for
// a private, owner/manager-only connector:
//  - revoking access = rotating MCP_OAUTH_SECRET (invalidates everything)
//  - an authorization code could be replayed within its 5-minute life, but
//    exchanging it still requires the PKCE code_verifier

export const MCP_SCOPE = "koonway:read";

// Who may approve a connection. The data includes cost/profit figures, so
// this is the strictest tier only: owner and manager.
export function canAuthorizeMcp(role: string): boolean {
  return role === "owner" || role === "manager";
}

export const ACCESS_TOKEN_TTL = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days
export const CODE_TTL = 60 * 5;
export const REQUEST_TTL = 60 * 10;
const CLIENT_TTL = 60 * 60 * 24 * 400;

const MIN_SECRET_LENGTH = 32;

export function getOauthSecret(): string | null {
  const secret = process.env.MCP_OAUTH_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

export type TokenType = "client" | "authreq" | "code" | "access" | "refresh";
export type Claims = Record<string, unknown> & { typ: TokenType; exp: number };

export function signJwt(typ: TokenType, claims: Record<string, unknown>, ttlSeconds: number): string {
  const secret = getOauthSecret();
  if (!secret) throw new Error("MCP_OAUTH_SECRET is not configured");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ ...claims, typ, iat: now, exp: now + ttlSeconds, jti: randomUUID() }));
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

// Returns the claims only if the signature is valid, the token is not
// expired, and it is of the expected type (so e.g. a refresh token can never
// be used as an access token).
export function verifyJwt(token: string, expectedTyp: TokenType): Claims | null {
  const secret = getOauthSecret();
  if (!secret || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;

  const expected = createHmac("sha256", secret).update(`${header}.${payload}`).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const head = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
    if (head.alg !== "HS256") return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Claims;
    if (claims.typ !== expectedTyp) return null;
    if (typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export function signClient(redirectUris: string[], clientName: string): string {
  return signJwt("client", { redirect_uris: redirectUris, client_name: clientName }, CLIENT_TTL);
}

// Where authorization codes may be sent. Anyone can register a client
// (dynamic registration), so the redirect target is restricted to the known
// ChatGPT hosts plus localhost (MCP Inspector / local development). Extra
// hosts can be added with MCP_ALLOWED_REDIRECT_HOSTS (comma-separated).
function allowedRedirectHosts(): string[] {
  const extra = (process.env.MCP_ALLOWED_REDIRECT_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return ["chatgpt.com", "chat.openai.com", "platform.openai.com", ...extra];
}

export function isAllowedRedirectUri(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash) return false;
  const host = url.hostname.toLowerCase();
  if (url.protocol === "http:") return host === "localhost" || host === "127.0.0.1";
  return url.protocol === "https:" && allowedRedirectHosts().includes(host);
}

export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(codeVerifier)) return false;
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  const a = Buffer.from(computed);
  const b = Buffer.from(codeChallenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9\-_]{43}$/; // base64url(sha256) = 43 chars

// The public origin of this deployment (https://wallpod-dashboard.vercel.app
// in production). MCP_PUBLIC_URL pins it explicitly; otherwise it is taken
// from the proxy headers Vercel sets.
export function publicOrigin(headers: Headers): string {
  const pinned = process.env.MCP_PUBLIC_URL?.replace(/\/+$/, "");
  if (pinned) return pinned;
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Protocol-Version, Mcp-Session-Id",
};

export function oauthJson(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

export function oauthError(error: string, description: string, status = 400) {
  return oauthJson({ error, error_description: description }, status);
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
