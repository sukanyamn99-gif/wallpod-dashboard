import { MCP_SCOPE, corsPreflight, oauthJson, publicOrigin } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

// RFC 9728 protected-resource metadata: tells an MCP client which
// authorization server protects /mcp. Served at both
// /.well-known/oauth-protected-resource and
// /.well-known/oauth-protected-resource/mcp.
export async function GET(request: Request) {
  const origin = publicOrigin(request.headers);
  return oauthJson({
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Koonway OS (read-only)",
  });
}

export async function OPTIONS() {
  return corsPreflight();
}
