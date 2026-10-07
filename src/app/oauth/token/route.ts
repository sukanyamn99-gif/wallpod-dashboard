import { diag } from "@/lib/mcp/diag";
import {
  ACCESS_TOKEN_TTL,
  MCP_SCOPE,
  REFRESH_TOKEN_TTL,
  corsPreflight,
  getOauthSecret,
  oauthError,
  oauthJson,
  publicOrigin,
  signJwt,
  verifyJwt,
  verifyPkce,
} from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

async function readParams(request: Request): Promise<URLSearchParams> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]));
  }
  return new URLSearchParams(await request.text());
}

function issueTokens(origin: string, clientId: string, userId: string) {
  const access = signJwt(
    "access",
    { iss: origin, aud: `${origin}/mcp`, sub: userId, scope: MCP_SCOPE, cid: clientId },
    ACCESS_TOKEN_TTL,
  );
  const refresh = signJwt("refresh", { sub: userId, scope: MCP_SCOPE, cid: clientId }, REFRESH_TOKEN_TTL);
  return oauthJson({
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL,
    refresh_token: refresh,
    scope: MCP_SCOPE,
  });
}

export async function POST(request: Request) {
  if (!getOauthSecret()) {
    return oauthError("server_error", "MCP OAuth ยังไม่ได้เปิดใช้งาน", 503);
  }

  const params = await readParams(request);
  const grantType = params.get("grant_type");
  const clientId = params.get("client_id") ?? "";
  const origin = publicOrigin(request.headers);
  diag("token.request", request, { grantType });

  if (!verifyJwt(clientId, "client")) {
    diag("token.rejected", request, { grantType, reason: "invalid-client" });
    return oauthError("invalid_client", "client_id ไม่ถูกต้องหรือหมดอายุ", 401);
  }

  if (grantType === "authorization_code") {
    const code = verifyJwt(params.get("code") ?? "", "code");
    if (!code) return oauthError("invalid_grant", "code ไม่ถูกต้องหรือหมดอายุ");
    if (code.cid !== clientId) return oauthError("invalid_grant", "code นี้ไม่ได้ออกให้ client นี้");
    if (code.ru !== params.get("redirect_uri")) return oauthError("invalid_grant", "redirect_uri ไม่ตรงกับที่ขอ");
    const verifier = params.get("code_verifier") ?? "";
    if (!verifyPkce(verifier, String(code.cc))) return oauthError("invalid_grant", "PKCE code_verifier ไม่ถูกต้อง");
    return issueTokens(origin, clientId, String(code.sub));
  }

  if (grantType === "refresh_token") {
    const refresh = verifyJwt(params.get("refresh_token") ?? "", "refresh");
    if (!refresh) return oauthError("invalid_grant", "refresh_token ไม่ถูกต้องหรือหมดอายุ");
    if (refresh.cid !== clientId) return oauthError("invalid_grant", "refresh_token นี้ไม่ได้ออกให้ client นี้");
    return issueTokens(origin, clientId, String(refresh.sub));
  }

  return oauthError("unsupported_grant_type", "รองรับเฉพาะ authorization_code และ refresh_token");
}

export async function OPTIONS() {
  return corsPreflight();
}
