import { MCP_SCOPE, corsPreflight, getOauthSecret, isAllowedRedirectUri, oauthError, oauthJson, signClient } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

// RFC 7591 dynamic client registration. Stateless: the "client_id" returned
// is a signed token that carries the registered redirect URIs, so nothing is
// stored. Only public (PKCE) clients, and only allowlisted redirect targets.
export async function POST(request: Request) {
  if (!getOauthSecret()) {
    return oauthError("server_error", "MCP OAuth ยังไม่ได้เปิดใช้งาน (ยังไม่ได้ตั้งค่า MCP_OAUTH_SECRET)", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return oauthError("invalid_client_metadata", "ต้องส่งเป็น JSON");
  }
  const data = (body ?? {}) as { redirect_uris?: unknown; client_name?: unknown };

  const redirectUris = data.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.length > 5) {
    return oauthError("invalid_redirect_uri", "ต้องระบุ redirect_uris 1-5 รายการ");
  }
  if (!redirectUris.every((u) => typeof u === "string" && isAllowedRedirectUri(u))) {
    return oauthError("invalid_redirect_uri", "redirect_uri ไม่อยู่ในรายการที่อนุญาต");
  }

  const clientName = typeof data.client_name === "string" && data.client_name.trim() ? data.client_name.trim().slice(0, 100) : "MCP client";

  return oauthJson(
    {
      client_id: signClient(redirectUris as string[], clientName),
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: MCP_SCOPE,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    201,
  );
}

export async function OPTIONS() {
  return corsPreflight();
}
