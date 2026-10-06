import type { NextRequest } from "next/server";
import { AI_VIEWS, checkAiApiKey, getAiPool, json } from "@/lib/ai-api";

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
    const { rows } = await pool.query(`
      select c.relname as view_name,
             obj_description(c.oid, 'pg_class') as description,
             a.attname as column_name,
             format_type(a.atttypid, a.atttypmod) as data_type,
             col_description(c.oid, a.attnum) as column_description
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      where n.nspname = 'ai' and c.relkind = 'v'
      order by c.relname, a.attnum
    `);

    const views: Record<
      string,
      { description: string | null; dateFilterColumn: string | null; columns: { name: string; type: string; description: string | null }[] }
    > = {};
    for (const row of rows) {
      const config = AI_VIEWS[row.view_name as keyof typeof AI_VIEWS];
      if (!config) continue; // a view added to the schema but not yet allowlisted in code stays hidden
      views[row.view_name] ??= {
        description: row.description,
        dateFilterColumn: config.dateColumn,
        columns: [],
      };
      views[row.view_name].columns.push({
        name: row.column_name,
        type: row.data_type,
        description: row.column_description,
      });
    }

    return json({
      usage:
        "GET /api/ai/{view}?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=500&offset=0 — ส่ง header Authorization: Bearer <API key>. อ่านได้อย่างเดียว",
      views,
    });
  } catch (error) {
    console.error("[ai-api] catalog failed", error);
    return json({ error: "อ่านรายการ view ไม่สำเร็จ" }, 500);
  }
}
