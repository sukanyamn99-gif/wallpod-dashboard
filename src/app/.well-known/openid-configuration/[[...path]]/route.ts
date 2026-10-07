// Some OAuth/MCP clients look for OpenID-style discovery before (or instead
// of) RFC 8414 — same metadata document, served at the alternate path.
export { GET, OPTIONS } from "../../oauth-authorization-server/[[...path]]/route";

export const dynamic = "force-dynamic";
