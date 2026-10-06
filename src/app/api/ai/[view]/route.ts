import type { NextRequest } from "next/server";
import { AI_VIEWS, checkAiApiKey, getAiPool, isAiViewName, json, queryAiView } from "@/lib/ai-api";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/ai/{view}?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=500&offset=0
// Read-only by construction: the view name is checked against a fixed
// allowlist, the database role can only SELECT from the ai.* views, and the
// only statements ever built here are SELECTs.
export async function GET(request: NextRequest, ctx: { params: Promise<{ view: string }> }) {
  const denied = checkAiApiKey(request);
  if (denied) return denied;

  const { view } = await ctx.params;
  if (!isAiViewName(view)) {
    return json({ error: `ไม่พบ view "${view}"`, available: Object.keys(AI_VIEWS) }, 404);
  }

  const pool = getAiPool();
  if (!pool) {
    return json({ error: "ยังไม่ได้ตั้งค่า AI_READONLY_DATABASE_URL" }, 503);
  }

  const params = request.nextUrl.searchParams;
  const from = params.get("from");
  const to = params.get("to");
  if ((from && !DATE_PATTERN.test(from)) || (to && !DATE_PATTERN.test(to))) {
    return json({ error: "from/to ต้องเป็นรูปแบบ YYYY-MM-DD" }, 400);
  }

  try {
    return json(
      await queryAiView(pool, view, {
        from,
        to,
        limit: parseInt(params.get("limit") ?? "", 10) || undefined,
        offset: parseInt(params.get("offset") ?? "", 10) || undefined,
      }),
    );
  } catch (error) {
    console.error("[ai-api] query failed", view, error);
    return json({ error: "อ่านข้อมูลไม่สำเร็จ" }, 500);
  }
}
