import type { Pool } from "pg";
import * as z from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AI_VIEWS, getAiPool, loadAiCatalog, queryAiView, type AiViewName } from "@/lib/ai-api";

// Read-only tools over the same restricted ai_readonly database role the REST
// API uses. There is intentionally no tool that creates, updates or deletes
// anything, and every tool is marked readOnlyHint.

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ต้องเป็นรูปแบบ YYYY-MM-DD");
const from = DATE.optional().describe("วันที่เริ่มต้น YYYY-MM-DD");
const to = DATE.optional().describe("วันที่สิ้นสุด YYYY-MM-DD");
const limit = z.number().int().min(1).max(500).default(50).describe("จำนวนแถวสูงสุดที่คืน (ค่าเริ่มต้น 50)");

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => Number(v ?? 0);

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function fail(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

// Wraps every handler so a database problem becomes a clean tool error
// instead of leaking internals to the client.
function tool<A>(handler: (pool: Pool, args: A) => Promise<unknown>) {
  return async (args: A) => {
    const pool = getAiPool();
    if (!pool) return fail("ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล (AI_READONLY_DATABASE_URL)");
    try {
      return ok(await handler(pool, args));
    } catch (error) {
      console.error("[mcp] tool failed", error);
      return fail("อ่านข้อมูลไม่สำเร็จ");
    }
  };
}

class Where {
  private clauses: string[] = [];
  readonly values: unknown[] = [];

  raw(clause: string) {
    this.clauses.push(clause);
    return this;
  }

  // `?` in the clause becomes the next bound parameter ($1, $2, ...).
  add(clause: string, value: unknown) {
    this.values.push(value);
    this.clauses.push(clause.replace("?", `$${this.values.length}`));
    return this;
  }

  range(column: string, fromDate?: string, toDate?: string) {
    if (fromDate) this.add(`${column} >= ?`, fromDate);
    if (toDate) this.add(`${column} <= ?`, toDate);
    return this;
  }

  contains(column: string, text?: string) {
    if (text) this.add(`${column} ilike ?`, `%${text.replace(/[\\%_]/g, "\\$&")}%`);
    return this;
  }

  get sql() {
    return this.clauses.length > 0 ? `where ${this.clauses.join(" and ")}` : "";
  }
}

async function rows(pool: Pool, sql: string, values: unknown[] = []) {
  return (await pool.query(sql, values)).rows;
}

const VIEW_NAMES = Object.keys(AI_VIEWS) as [AiViewName, ...AiViewName[]];

export function registerKoonwayTools(server: McpServer) {
  server.registerTool(
    "getCatalog",
    {
      title: "ดูรายการข้อมูลที่อ่านได้",
      description:
        "ดูว่ามี dataset/view อะไรให้เรียกบ้าง พร้อมความหมายและคอลัมน์ของแต่ละ view ควรเรียกอันนี้ก่อนถ้าไม่แน่ใจว่าข้อมูลอยู่ที่ไหน",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    tool(async (pool) => ({ views: await loadAiCatalog(pool) })),
  );

  server.registerTool(
    "getView",
    {
      title: "ดึงข้อมูลจาก view ที่ระบุ",
      description:
        "ดึงแถวข้อมูลดิบจาก view ที่อนุญาต (ดูชื่อและคอลัมน์จาก getCatalog) เรียงจากใหม่ไปเก่า ใช้ offset ดึงหน้าถัดไปเมื่อ hasMore เป็น true ถ้าต้องการสรุปตัวเลขให้ใช้เครื่องมือสรุป (getSalesSummary, getGPAnalysis ฯลฯ) ก่อน",
      inputSchema: {
        view: z.enum(VIEW_NAMES).describe("ชื่อ view"),
        from,
        to,
        limit,
        offset: z.number().int().min(0).default(0).describe("ข้ามกี่แถวแรก"),
      },
      annotations: READ_ONLY,
    },
    tool(async (pool, args: { view: AiViewName; from?: string; to?: string; limit: number; offset: number }) =>
      queryAiView(pool, args.view, args),
    ),
  );

  server.registerTool(
    "getSalesSummary",
    {
      title: "สรุปยอดขาย",
      description:
        "สรุปยอดขายตามช่วงเวลา (ไม่รวมงานที่ยกเลิก) แยกตามเดือน/เซลล์/ประเภทลูกค้า/ลูกค้า ยอดขายนับที่ pre_vat (ก่อน VAT)",
      inputSchema: {
        from,
        to,
        groupBy: z.enum(["month", "sales_rep", "customer_type", "customer", "none"]).default("month").describe("แยกตามอะไร"),
        limit: z.number().int().min(1).max(500).default(100).describe("จำนวนกลุ่มสูงสุด"),
      },
      annotations: READ_ONLY,
    },
    tool(async (pool, args: { from?: string; to?: string; groupBy: string; limit: number }) => {
      const column = { month: "month", sales_rep: "sales_rep", customer_type: "customer_type", customer: "customer_name", none: "'ทั้งหมด'" }[
        args.groupBy
      ];
      const w = new Where().raw("not is_cancelled").range("project_date", args.from, args.to);
      const groups = await rows(
        pool,
        `select ${column} as group_key, count(*) as jobs, sum(pre_vat) as pre_vat, sum(vat) as vat, sum(total) as total
         from ai.sales ${w.sql} group by 1
         order by ${args.groupBy === "month" ? "1" : "sum(pre_vat) desc"} limit ${args.limit}`,
        w.values,
      );
      const totals = await rows(
        pool,
        `select count(*) as jobs, coalesce(sum(pre_vat),0) as pre_vat, coalesce(sum(vat),0) as vat, coalesce(sum(total),0) as total
         from ai.sales ${w.sql}`,
        w.values,
      );
      return {
        note: "ไม่รวมงานที่ยกเลิก; pre_vat = ยอดขายก่อน VAT",
        filters: { from: args.from ?? null, to: args.to ?? null, groupBy: args.groupBy },
        totals: totals[0],
        groups,
      };
    }),
  );

  server.registerTool(
    "getGPAnalysis",
    {
      title: "วิเคราะห์กำไรขั้นต้น (GP)",
      description:
        "ข้อมูล GP / GP% ต่อ JOB (เฉพาะงานที่มีข้อมูลต้นทุน) สรุปรวมหรือแยกกลุ่ม พร้อมรายการงานที่ margin ต่ำสุด profit = pre_vat − total_cost; total_cost รวมต้นทุนที่กรอกเอง + ใบเบิกสินค้า + ใบสำคัญจ่าย + เงินสดย่อยที่ผูก JOB",
      inputSchema: {
        from,
        to,
        groupBy: z.enum(["none", "month", "sales_rep", "customer_type"]).default("none").describe("แยกตามอะไร"),
        worstJobs: z.number().int().min(0).max(50).default(10).describe("จำนวนงานที่ margin ต่ำสุดที่ต้องการดู"),
      },
      annotations: READ_ONLY,
    },
    tool(async (pool, args: { from?: string; to?: string; groupBy: string; worstJobs: number }) => {
      const column = { none: "'ทั้งหมด'", month: "month", sales_rep: "sales_rep", customer_type: "customer_type" }[args.groupBy];
      const w = new Where().range("project_date", args.from, args.to);

      const groups = (
        await rows(
          pool,
          `select ${column} as group_key, count(*) as jobs, sum(pre_vat) as pre_vat, sum(total_cost) as total_cost, sum(profit) as profit
           from ai.gp ${w.sql} group by 1 order by ${args.groupBy === "month" ? "1" : "sum(profit) desc"}`,
          w.values,
        )
      ).map((g) => ({ ...g, margin_percent: num(g.pre_vat) > 0 ? round2((num(g.profit) / num(g.pre_vat)) * 100) : null }));

      const sum = (key: string) => groups.reduce((s, g) => s + num(g[key]), 0);
      const totals = {
        jobs: sum("jobs"),
        pre_vat: round2(sum("pre_vat")),
        total_cost: round2(sum("total_cost")),
        profit: round2(sum("profit")),
        margin_percent: sum("pre_vat") > 0 ? round2((sum("profit") / sum("pre_vat")) * 100) : null,
      };

      const worst = new Where().range("project_date", args.from, args.to).raw("pre_vat > 0");
      const worstJobs =
        args.worstJobs > 0
          ? await rows(
              pool,
              `select job_no, project_date, customer_name, sales_rep, project_name, pre_vat, manual_cost_total,
                      requisition_cost, voucher_cost, petty_cash_cost, total_cost, profit, margin_percent
               from ai.gp ${worst.sql} order by margin_percent asc limit ${args.worstJobs}`,
              worst.values,
            )
          : [];

      return {
        note: "เฉพาะงานที่ไม่ยกเลิกและมีข้อมูลต้นทุน — งานที่ยังไม่มีต้นทุนจะไม่ถูกนับ",
        filters: { from: args.from ?? null, to: args.to ?? null, groupBy: args.groupBy },
        totals,
        groups,
        lowest_margin_jobs: worstJobs,
      };
    }),
  );

  server.registerTool(
    "getAR",
    {
      title: "ลูกหนี้ค้างชำระ (AR)",
      description:
        "ลูกหนี้ที่ยังค้าง (เฉพาะ JOB ที่ไม่ยกเลิกและค้าง ≥ 1 บาท) สรุปตามช่วงอายุหนี้ 0-30/31-60/61-90/90+ วัน พร้อมรายการเรียงจากเก่าสุด อายุหนี้นับจากวันที่ของ JOB เพราะระบบไม่มีวันครบกำหนดต่อใบแจ้งหนี้",
      inputSchema: {
        minDays: z.number().int().min(0).optional().describe("เอาเฉพาะที่อายุหนี้ตั้งแต่กี่วันขึ้นไป"),
        bucket: z.enum(["0-30", "31-60", "61-90", "90+"]).optional().describe("เอาเฉพาะช่วงอายุหนี้นี้"),
        limit,
      },
      annotations: READ_ONLY,
    },
    tool(async (pool, args: { minDays?: number; bucket?: string; limit: number }) => {
      const w = new Where();
      if (args.minDays !== undefined) w.add("days_since_project_date >= ?", args.minDays);
      if (args.bucket) w.add("aging_bucket = ?", args.bucket);

      const byBucket = await rows(
        pool,
        `select aging_bucket, count(*) as jobs, sum(outstanding_amount) as outstanding
         from ai.ar ${w.sql} group by 1 order by min(days_since_project_date)`,
        w.values,
      );
      const items = await rows(
        pool,
        `select job_no, project_date, customer_name, sales_rep, project_name, total, outstanding_amount, payment_status,
                days_since_project_date, aging_bucket, last_received_date, billing_note_nos, tax_invoice_nos, receipt_nos
         from ai.ar ${w.sql} order by days_since_project_date desc, outstanding_amount desc limit ${args.limit}`,
        w.values,
      );
      return {
        totals: {
          jobs: byBucket.reduce((s, b) => s + num(b.jobs), 0),
          outstanding: round2(byBucket.reduce((s, b) => s + num(b.outstanding), 0)),
        },
        by_aging_bucket: byBucket,
        items,
      };
    }),
  );

  server.registerTool(
    "getInventory",
    {
      title: "สต๊อกสินค้า",
      description:
        "สต๊อกคงเหลือ มูลค่า สินค้าใกล้หมด/หมด และสินค้าไม่เคลื่อนไหว (dead stock = มีของแต่ไม่มีการเบิกออกเกินกี่วัน) ใช้ตัวกรองตามที่ต้องการ",
      inputSchema: {
        lowStockOnly: z.boolean().default(false).describe("เฉพาะสินค้าใกล้หมด/หมด (คงเหลือ ≤ จุดสั่งซื้อ)"),
        outOfStockOnly: z.boolean().default(false).describe("เฉพาะสินค้าที่หมดแล้ว"),
        category: z.string().optional().describe("ค้นหาจากชื่อหมวดหมู่ (บางส่วนของชื่อได้)"),
        deadStockDays: z.number().int().min(1).optional().describe("เฉพาะสินค้าที่มีของแต่ไม่มีการเบิกออกมากกว่ากี่วัน"),
        limit,
      },
      annotations: READ_ONLY,
    },
    tool(
      async (
        pool,
        args: { lowStockOnly: boolean; outOfStockOnly: boolean; category?: string; deadStockDays?: number; limit: number },
      ) => {
        const w = new Where();
        if (args.lowStockOnly) w.raw("i.is_low_stock");
        if (args.outOfStockOnly) w.raw("i.is_out_of_stock");
        w.contains("i.category", args.category);
        if (args.deadStockDays !== undefined) {
          w.raw("i.quantity_on_hand > 0");
          w.add("(lo.last_out_date is null or lo.last_out_date < current_date - ?::int)", args.deadStockDays);
        }

        // Dead-stock check joins on sku (the views deliberately expose no
        // internal ids), so products without an sku can't be matched to
        // their movements and are treated as never having moved.
        const items = await rows(
          pool,
          `with last_out as (
             select sku, max(movement_date) as last_out_date
             from ai.stock_movement where movement_type = 'out' and sku is not null group by sku
           )
           select i.sku, i.name, i.category, i.color, i.size, i.unit, i.location, i.quantity_on_hand, i.reorder_point,
                  i.unit_cost, i.stock_value, i.is_out_of_stock, i.is_low_stock, lo.last_out_date
           from ai.inventory i left join last_out lo on lo.sku = i.sku ${w.sql}
           order by ${args.lowStockOnly || args.outOfStockOnly ? "(i.quantity_on_hand - i.reorder_point) asc" : "i.stock_value desc"}
           limit ${args.limit}`,
          w.values,
        );
        const totals = await rows(
          pool,
          `with last_out as (
             select sku, max(movement_date) as last_out_date
             from ai.stock_movement where movement_type = 'out' and sku is not null group by sku
           )
           select count(*) as items, coalesce(sum(i.stock_value), 0) as stock_value,
                  count(*) filter (where i.is_low_stock) as low_stock_items,
                  count(*) filter (where i.is_out_of_stock) as out_of_stock_items
           from ai.inventory i left join last_out lo on lo.sku = i.sku ${w.sql}`,
          w.values,
        );
        return {
          note: "dead stock ตรวจจากวันที่เบิกออกล่าสุดของ sku เดียวกัน (last_out_date ว่าง = ไม่เคยเบิกออก)",
          totals: totals[0],
          items,
        };
      },
    ),
  );

  server.registerTool(
    "getProjects",
    {
      title: "งาน/โปรเจกต์ และสถานะ",
      description:
        "รายการ JOB พร้อมสถานะงาน (production_status) และสถานะการเก็บเงิน สรุปจำนวนงานตามสถานะ ไม่รวมงานที่ยกเลิกโดยค่าเริ่มต้น",
      inputSchema: {
        from,
        to,
        productionStatus: z.string().optional().describe("สถานะงานแบบตรงตัว เช่น กำลังผลิต, ส่งของแล้ว, จบงาน"),
        paymentStatus: z.enum(["เก็บเงินเรียบร้อย", "ชำระมาแล้ว 50%", "รอชำระเงิน"]).optional().describe("สถานะการชำระเงิน"),
        customer: z.string().optional().describe("ชื่อลูกค้า (บางส่วนได้)"),
        salesRep: z.string().optional().describe("ชื่อเซลล์ (บางส่วนได้)"),
        includeCancelled: z.boolean().default(false).describe("รวมงานที่ยกเลิกด้วยหรือไม่"),
        limit,
      },
      annotations: READ_ONLY,
    },
    tool(
      async (
        pool,
        args: {
          from?: string;
          to?: string;
          productionStatus?: string;
          paymentStatus?: string;
          customer?: string;
          salesRep?: string;
          includeCancelled: boolean;
          limit: number;
        },
      ) => {
        const w = new Where().range("project_date", args.from, args.to);
        if (!args.includeCancelled) w.raw("not is_cancelled");
        if (args.productionStatus) w.add("production_status = ?", args.productionStatus);
        if (args.paymentStatus) w.add("payment_status = ?", args.paymentStatus);
        w.contains("customer_name", args.customer).contains("sales_rep", args.salesRep);

        const byStatus = await rows(
          pool,
          `select coalesce(production_status, '(ไม่ระบุ)') as production_status, count(*) as jobs, sum(total) as total
           from ai.projects ${w.sql} group by 1 order by 2 desc`,
          w.values,
        );
        const items = await rows(
          pool,
          `select job_no, project_date, customer_name, customer_type, sales_rep, project_name, production_status, is_cancelled,
                  total, payment_status, outstanding_amount, installments_count, received_installments_count, last_received_date
           from ai.projects ${w.sql} order by project_date desc, job_no limit ${args.limit}`,
          w.values,
        );
        return {
          totals: {
            jobs: byStatus.reduce((s, r) => s + num(r.jobs), 0),
            total: round2(byStatus.reduce((s, r) => s + num(r.total), 0)),
          },
          by_production_status: byStatus,
          items,
        };
      },
    ),
  );

  server.registerTool(
    "getSalesActivities",
    {
      title: "กิจกรรมการขาย (Sale Report)",
      description:
        "กิจกรรม/pipeline ที่เซลล์รายงานผ่าน Sale Report: เข้าพบใคร อยู่ stage ไหน มูลค่าประมาณการเท่าไหร่ สรุปตาม stage และเซลล์ (หมายเหตุ: ข้อความ next action/บันทึกอิสระไม่เปิดให้อ่าน) ไม่ใช่ยอดขายจริง — ยอดขายจริงดูที่ getSalesSummary",
      inputSchema: {
        from,
        to,
        salesRep: z.string().optional().describe("ชื่อเซลล์ (บางส่วนได้)"),
        stage: z.enum(["นำเสนอ", "ใบเสนอราคา", "เจรจาต่อรอง", "ปิดการขาย", "ไม่สำเร็จ"]).optional(),
        limit,
      },
      annotations: READ_ONLY,
    },
    tool(async (pool, args: { from?: string; to?: string; salesRep?: string; stage?: string; limit: number }) => {
      const w = new Where().range("visit_date", args.from, args.to).contains("sales_rep", args.salesRep);
      if (args.stage) w.add("stage = ?", args.stage);

      const byStage = await rows(
        pool,
        `select stage, count(*) as activities, sum(est_value) as est_value from ai.sales_activity ${w.sql} group by 1 order by 2 desc`,
        w.values,
      );
      const bySalesRep = await rows(
        pool,
        `select sales_rep, count(*) as activities, sum(est_value) as est_value from ai.sales_activity ${w.sql} group by 1 order by 2 desc`,
        w.values,
      );
      const items = await rows(
        pool,
        `select visit_date, sales_rep, customer_name, project_name, customer_type, project_type, stage, stage_percent, est_value
         from ai.sales_activity ${w.sql} order by visit_date desc, created_at desc limit ${args.limit}`,
        w.values,
      );
      return { by_stage: byStage, by_sales_rep: bySalesRep, items };
    }),
  );
}
