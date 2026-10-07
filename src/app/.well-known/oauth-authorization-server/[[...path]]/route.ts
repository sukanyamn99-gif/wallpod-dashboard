import { MCP_SCOPE, corsPreflight, oauthJson, publicOrigin } from "@/lib/mcp/oauth";
import { diag } from "@/lib/mcp/diag";

export const dynamic = "force-dynamic";

// RFC 8414 authorization-server metadata. Public clients only (PKCE with
// S256 is mandatory, no client secret).
export async function GET(request: Request) {
  const origin = publicOrigin(request.headers);
  diag("discovery.authorization-server", request, { derivedOrigin: origin });
  return oauthJson({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [MCP_SCOPE],
  });
}

export async function OPTIONS() {
  return corsPreflight();
}
