import { createHash, timingSafeEqual } from "node:crypto";
import { Pool, types } from "pg";

// Every view the AI API may read — all live in the "ai" schema (see
// supabase/migration_093_ai_readonly_views.sql). Names and columns below are
// interpolated into SQL, so they must stay hard-coded here, never user input.
export const AI_VIEWS = {
  sales: { dateColumn: "project_date", orderBy: "project_date desc, job_no" },
  sales_items: { dateColumn: "project_date", orderBy: "project_date desc, job_no, product_category" },
  projects: { dateColumn: "project_date", orderBy: "project_date desc, job_no" },
  gp: { dateColumn: "project_date", orderBy: "project_date desc, job_no" },
  ar: { dateColumn: "project_date", orderBy: "project_date, job_no" },
  inventory: { dateColumn: null, orderBy: "sku, name" },
  stock_movement: { dateColumn: "movement_date", orderBy: "moved_at desc" },
  sales_activity: { dateColumn: "visit_date", orderBy: "visit_date desc, created_at desc" },
} as const;

export type AiViewName = keyof typeof AI_VIEWS;

export function isAiViewName(name: string): name is AiViewName {
  return Object.prototype.hasOwnProperty.call(AI_VIEWS, name);
}

// numeric/bigint arrive as strings by default — the AI (and JSON) should see
// real numbers. Dates stay plain "YYYY-MM-DD" strings, not JS Date objects.
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1082, (v) => v);

const globalForPool = globalThis as unknown as { __aiReadonlyPool?: Pool };

// The ONLY database connection this feature uses: the ai_readonly role, which
// can SELECT from the ai.* views and nothing else (and its sessions are
// read-only). Never swap this for the service-role key.
export function getAiPool(): Pool | null {
  const connectionString = process.env.AI_READONLY_DATABASE_URL;
  if (!connectionString) return null;
  if (!globalForPool.__aiReadonlyPool) {
    const isLocal = /@(localhost|127\.0\.0\.1)/.test(connectionString);
    globalForPool.__aiReadonlyPool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      // Supabase's pooler certificate isn't signed by a CA Node trusts by default.
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    });
  }
  return globalForPool.__aiReadonlyPool;
}

const MIN_KEY_LENGTH = 24;

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// Returns an error Response when the request isn't allowed, null when it is.
// Accepts "Authorization: Bearer <key>" or "X-API-Key: <key>".
export function checkAiApiKey(request: Request): Response | null {
  const expected = process.env.AI_API_KEY;
  if (!expected || expected.length < MIN_KEY_LENGTH) {
    return json({ error: "AI API ยังไม่ได้เปิดใช้งาน (ยังไม่ได้ตั้งค่า AI_API_KEY อย่างน้อย 24 ตัวอักษร)" }, 503);
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const provided = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : (request.headers.get("x-api-key") ?? "").trim();

  // Compare fixed-length hashes in constant time so the key can't be guessed
  // byte-by-byte from response timing.
  if (!provided || !timingSafeEqual(sha256(provided), sha256(expected))) {
    return json({ error: "API key ไม่ถูกต้อง" }, 401);
  }
  return null;
}

export const AI_DEFAULT_LIMIT = 500;
export const AI_MAX_LIMIT = 5000;

export interface AiViewQuery {
  from?: string | null;
  to?: string | null;
  limit?: number;
  offset?: number;
}

// Shared by the REST route and the MCP getView tool. `from`/`to` must already
// be validated as YYYY-MM-DD by the caller; the view name is allowlisted by
// type, and every value is passed as a bound parameter.
export async function queryAiView(pool: Pool, view: AiViewName, query: AiViewQuery) {
  const config = AI_VIEWS[view];
  const limit = Math.min(Math.max(query.limit ?? AI_DEFAULT_LIMIT, 1), AI_MAX_LIMIT);
  const offset = Math.max(query.offset ?? 0, 0);

  const where: string[] = [];
  const values: unknown[] = [];
  if (config.dateColumn) {
    if (query.from) {
      values.push(query.from);
      where.push(`${config.dateColumn} >= $${values.length}`);
    }
    if (query.to) {
      values.push(query.to);
      where.push(`${config.dateColumn} <= $${values.length}`);
    }
  }
  const whereSql = where.length > 0 ? `where ${where.join(" and ")}` : "";

  const [countResult, rowsResult] = await Promise.all([
    pool.query(`select count(*) as total from ai.${view} ${whereSql}`, values),
    pool.query(
      `select * from ai.${view} ${whereSql} order by ${config.orderBy} limit ${limit} offset ${offset}`,
      values,
    ),
  ]);
  const total = Number(countResult.rows[0].total);
  return {
    view,
    total,
    count: rowsResult.rows.length,
    limit,
    offset,
    hasMore: offset + rowsResult.rows.length < total,
    dateFilterColumn: config.dateColumn,
    rows: rowsResult.rows,
  };
}

export interface AiCatalogView {
  description: string | null;
  dateFilterColumn: string | null;
  columns: { name: string; type: string; description: string | null }[];
}

// Every view the AI can read, with its meaning and columns — taken from the
// database's own comments so it can't drift from what actually exists. A view
// that exists in the schema but isn't allowlisted in AI_VIEWS stays hidden.
export async function loadAiCatalog(pool: Pool): Promise<Record<string, AiCatalogView>> {
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

  const views: Record<string, AiCatalogView> = {};
  for (const row of rows) {
    const name: string = row.view_name;
    if (!isAiViewName(name)) continue;
    views[name] ??= {
      description: row.description,
      dateFilterColumn: AI_VIEWS[name].dateColumn,
      columns: [],
    };
    views[name].columns.push({
      name: row.column_name,
      type: row.data_type,
      description: row.column_description,
    });
  }
  return views;
}
