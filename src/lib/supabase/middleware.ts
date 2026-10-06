import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // The AI read-only API authenticates with its own API key (see
  // src/lib/ai-api.ts), and the MCP endpoint + its OAuth machinery (/mcp,
  // /.well-known, /oauth/register, /oauth/token) authenticate with OAuth
  // tokens — none use a browser login session, so redirecting them to
  // /login would make them unreachable for ChatGPT/other tools.
  // (/oauth/authorize is NOT listed: it needs the logged-in session.)
  const path = request.nextUrl.pathname;
  if (
    path.startsWith("/api/ai") ||
    path === "/mcp" ||
    path.startsWith("/.well-known/") ||
    path === "/oauth/register" ||
    path === "/oauth/token"
  ) {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Supabase not configured yet — let requests through so the app is still browsable
    // (dashboard pages fall back to sample data, see src/lib/data).
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Only the OAuth consent page comes back after login (so connecting
    // ChatGPT can continue); every other page keeps its existing behavior.
    const returnTo = path.startsWith("/oauth/") ? `${path}${request.nextUrl.search}` : null;
    url.search = "";
    if (returnTo) url.searchParams.set("next", returnTo);
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/sales";
    return NextResponse.redirect(url);
  }

  return response;
}
