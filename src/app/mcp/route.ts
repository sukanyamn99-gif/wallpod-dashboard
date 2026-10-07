import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerKoonwayTools } from "@/lib/mcp/tools";
import { diag } from "@/lib/mcp/diag";
import { CORS_HEADERS, MCP_SCOPE, corsPreflight, getOauthSecret, publicOrigin, verifyJwt } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  headers.set("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function unauthorized(origin: string, message: string) {
  return withCors(
    new Response(JSON.stringify({ error: "unauthorized", error_description: message }), {
      status: 401,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // Tells an MCP client where to find the OAuth server (RFC 9728).
        "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", scope="${MCP_SCOPE}"`,
      },
    }),
  );
}

// Streamable HTTP MCP endpoint, STATELESS: every request is self-contained
// (no sessions), which is what makes it work on serverless hosting. Read-only
// — see src/lib/mcp/tools.ts. Requires an OAuth access token issued by this
// app's own authorization server after an owner/manager approved it.
export async function POST(request: Request) {
  const origin = publicOrigin(request.headers);
  // What the client is asking for (JSON-RPC method / tool name only).
  const rpc = await request
    .clone()
    .json()
    .then((b: { method?: string; params?: { name?: string } }) => ({ rpcMethod: b?.method, tool: b?.params?.name }))
    .catch(() => ({ rpcMethod: undefined, tool: undefined }));

  if (!getOauthSecret()) {
    return withCors(
      new Response(JSON.stringify({ error: "MCP ยังไม่ได้เปิดใช้งาน (ยังไม่ได้ตั้งค่า MCP_OAUTH_SECRET)" }), {
        status: 503,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }),
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const claims = token ? verifyJwt(token, "access") : null;
  if (!claims) {
    diag("mcp.unauthorized", request, { ...rpc, reason: token ? "invalid-or-expired-token" : "no-token" });
    return unauthorized(origin, "ต้องมี access token ที่ถูกต้อง");
  }
  if (claims.aud !== `${origin}/mcp`) {
    diag("mcp.unauthorized", request, { ...rpc, reason: "wrong-audience", derivedOrigin: origin });
    return unauthorized(origin, "token นี้ไม่ได้ออกให้ endpoint นี้");
  }
  diag("mcp.request", request, rpc);

  const server = new McpServer({ name: "koonway-os", version: "1.0.0" });
  registerKoonwayTools(server);

  // enableJsonResponse: plain JSON replies instead of an SSE stream, and no
  // sessionIdGenerator: stateless.
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    return withCors(await transport.handleRequest(request));
  } finally {
    // The response body is already fully materialized in JSON mode.
    void server.close();
  }
}

// Stateless server: no standalone SSE stream and no sessions to terminate.
function methodNotAllowed() {
  return withCors(
    new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null }), {
      status: 405,
      headers: { Allow: "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8" },
    }),
  );
}

export async function GET(request: Request) {
  diag("mcp.get-not-allowed", request);
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}

export async function OPTIONS() {
  return corsPreflight();
}
