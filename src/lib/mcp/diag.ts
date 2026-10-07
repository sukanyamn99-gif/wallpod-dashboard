// One-line JSON diagnostics for the MCP/OAuth handshake, readable in Vercel's
// Runtime Logs (search for "mcp-diag"). Records what each client asked for
// and how we answered — never tokens, codes, secrets or request bodies.
export function diag(event: string, request: Request | null, fields: Record<string, unknown> = {}) {
  const headers = request?.headers;
  console.log(
    JSON.stringify({
      tag: "mcp-diag",
      event,
      method: request?.method,
      path: request ? new URL(request.url).pathname : undefined,
      ua: headers?.get("user-agent")?.slice(0, 120),
      origin: headers?.get("origin") ?? undefined,
      hasAuthHeader: headers ? !!headers.get("authorization") : undefined,
      ...fields,
    }),
  );
}
