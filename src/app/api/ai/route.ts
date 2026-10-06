import type { NextRequest } from "next/server";
import { checkAiApiKey, getAiPool, json, loadAiCatalog } from "@/lib/ai-api";

export const dynamic = "force-dynamic";

// GET /api/ai — a catalog of every view the AI can read: what it means, its
// columns (with types and Thai descriptions, taken from the database's own
// comments), and which column the from/to date filter applies to.
export async function GET(request: NextRequest) {
  const denied = checkAiApiKey(request);
  if (denied) return denied;

  const pool = getAiPool();
  if (!pool) {
    return json({ error: "ยังไม่ได้ตั้งค่า AI_READONLY_DATABASE_URL" }, 503);
  }

  try {
    return json({
      usage:
        "GET /api/ai/{view}?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=500&offset=0 — ส่ง header Authorization: Bearer <API key>. อ่านได้อย่างเดียว",
      views: await loadAiCatalog(pool),
    });
  } catch (error) {
    console.error("[ai-api] catalog failed", error);
    return json({ error: "อ่านรายการ view ไม่สำเร็จ" }, 500);
  }
}
