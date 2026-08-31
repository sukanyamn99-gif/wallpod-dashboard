"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import { resolveCustomerId } from "./actions";
import type { CustomerType, PaymentStatus, ProductionStatus } from "@/lib/types";
import { PRODUCTION_STATUSES } from "@/lib/types";

const CUSTOMER_TYPES: CustomerType[] = ["Owner", "Designer", "Turnkey", "Contractor", "Corporate", "Dealer", "School"];
const PAYMENT_STATUSES: PaymentStatus[] = ["เก็บเงินเรียบร้อย", "ชำระมาแล้ว 50%", "รอชำระเงิน"];

// Columns produced by /api/export-projects — everything else in the sheet
// is treated as a dynamic product-category column.
const KNOWN_COLUMNS = new Set([
  "JOB NO.", "DATE", "CUSTOMER NAMES", "PROJECT NAME", "SALE", "Customer Type", "สถานะของงาน",
  "PRE.VAT", "VAT", "รวมทั้งสิ้น",
  "ค่าวัสดุ", "ค่ากาว", "ค่าตัด", "ค่าติดตั้งผู้รับเหมา", "ค่าเดินทาง+ค่าที่จอดรถ", "ค่าขนส่ง", "รวมต้นทุน", "กำไร",
  "เลขที่เอกสาร (งวด 1)", "งวดที่ 1 จำนวนเงิน", "วันที่ออกเอกสาร (งวด 1)", "เลขที่ใบเสร็จ (งวด 1)", "วันที่รับชำระเงิน (งวด 1)",
  "เลขที่เอกสาร (งวด 2)", "งวดที่ 2 จำนวนเงิน", "วันที่ออกเอกสาร (งวด 2)", "เลขที่ใบเสร็จ (งวด 2)", "วันที่รับชำระเงิน (งวด 2)",
  // Legacy export column names (pre-received_date rename, pre-ค่าที่จอดรถ
  // rename) — accepted for backward compatibility with files exported
  // before these changes so an old backup file still imports cleanly
  // instead of being misread as dynamic product-category columns.
  "วันที่รับชำระ (งวด 1)", "วันที่รับชำระ (งวด 2)", "ค่าที่จอดรถ",
  "สถานะ", "ยอดคงค้าง",
]);

export interface ParsedImportRow {
  jobNo: string | null;
  projectDate: string;
  customerName: string;
  customerType: CustomerType;
  projectName: string;
  salesRepName: string;
  productionStatus: ProductionStatus | null;
  items: { category: string; amount: number }[];
  preVat: number;
  vat: number;
  costs: {
    material: number; glue: number; cutting: number; install: number; parking: number; shipping: number;
  } | null;
  payments: {
    invoiceNo: string | null; installmentNo: number; amount: number; paidDate: string | null;
    receiptNo: string | null; receivedDate: string | null; status: PaymentStatus; outstandingAmount: number;
  }[];
}

export interface ImportPreview {
  rows: ParsedImportRow[];
  summary: {
    rowCount: number;
    totalPreVat: number;
    dateFrom: string | null;
    dateTo: string | null;
    newCustomerNames: string[];
    newSalesRepNames: string[];
  };
  warnings: string[];
}

function parseNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").replace(/,/g, "").trim();
  if (s === "") return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v ?? "").trim();
  if (s === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function normalizeCustomerType(v: unknown, warnings: string[], jobNo: string): CustomerType {
  let s = String(v ?? "").trim();
  if (s === "Direct Owner") s = "Owner";
  if (!CUSTOMER_TYPES.includes(s as CustomerType)) {
    warnings.push(`${jobNo || "(ไม่มีเลข JOB)"}: กลุ่มลูกค้า "${s || "(ว่าง)"}" ไม่ถูกต้อง — ใช้ Owner แทน`);
    return "Owner";
  }
  return s as CustomerType;
}

function normalizeStatus(v: unknown, warnings: string[], jobNo: string): PaymentStatus {
  const s = String(v ?? "").trim();
  if (!PAYMENT_STATUSES.includes(s as PaymentStatus)) {
    warnings.push(`${jobNo || "(ไม่มีเลข JOB)"}: สถานะการชำระ "${s || "(ว่าง)"}" ไม่ถูกต้อง — ใช้ "รอชำระเงิน" แทน`);
    return "รอชำระเงิน";
  }
  return s as PaymentStatus;
}

function normalizeProductionStatus(v: unknown): ProductionStatus | null {
  const s = String(v ?? "").trim();
  return PRODUCTION_STATUSES.includes(s as ProductionStatus) ? (s as ProductionStatus) : null;
}

// Payment-date columns in the legacy sheet use Thai Buddhist-era D/M/YY
// (e.g. "30/01/69"), unlike the DATE column's Gregorian D/M/YYYY —
// matches scripts/import-excel.mjs's parseThaiBEDate exactly.
function parseThaiBEDate(v: unknown): string | null {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!m) return null;
  const [, d, mo, yy] = m;
  const ceYear = 2500 + parseInt(yy, 10) - 543;
  return `${ceYear}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

const LEGACY_PRODUCT_CATEGORIES = ["WALLPOD", "ACOUSHEET", "ACOUSOFT", "ACUBOX", "CNC", "SERVICE", "WALLPAPER", "OTHER"];
const LEGACY_PRODUCT_COL_START = 7; // columns 7..14 in the original "Project Sale 2026" sheet

// Parses the ORIGINAL master tracking sheet format (same layout scripts/
// import-excel.mjs was built for: fixed columns by index, data starting
// row 7, one row per JOB NO.) — distinct from the named-column format
// /api/export-projects produces. Detected automatically in
// previewProjectImport by sheet name + absence of the export's headers.
function parseLegacySheet(sheet: XLSX.WorkSheet, warnings: string[]): ParsedImportRow[] {
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  const rows: ParsedImportRow[] = [];
  const seenJobNos = new Set<string>();

  for (let i = 6; i < rawRows.length; i++) {
    const r = rawRows[i];
    const jobNo = String(r[2] ?? "").trim();
    if (!jobNo.startsWith("JB")) continue; // skips "Week N" subtotal rows / blanks
    const customerName = String(r[3] ?? "").trim();
    if (!customerName) continue; // reserved job number with no data yet

    if (seenJobNos.has(jobNo)) {
      warnings.push(`${jobNo}: เลข JOB ซ้ำในไฟล์ — ใช้แถวแรกที่พบ ข้ามแถวนี้`);
      continue;
    }
    seenJobNos.add(jobNo);

    const projectDate = parseDate(r[1]);
    if (!projectDate) warnings.push(`${jobNo}: วันที่ไม่ถูกต้อง — ใช้วันที่วันนี้แทน`);

    const salesRepName = String(r[5] ?? "").trim() || "ไม่ระบุ";
    const customerType = normalizeCustomerType(r[6], warnings, jobNo);

    const preVat = parseNumber(r[15]);
    const totalInclVat = parseNumber(r[16]);
    let vat = totalInclVat - preVat;
    if (totalInclVat === 0 && preVat > 0) vat = Math.round(preVat * 0.07 * 100) / 100;
    if (vat < 0) vat = 0;

    const items: { category: string; amount: number }[] = [];
    for (let c = 0; c < LEGACY_PRODUCT_CATEGORIES.length; c++) {
      const amount = parseNumber(r[LEGACY_PRODUCT_COL_START + c]);
      if (amount > 0) items.push({ category: LEGACY_PRODUCT_CATEGORIES[c], amount });
    }
    if (items.length === 0) {
      warnings.push(`${jobNo}: ไม่มีรายการสินค้าที่มีมูลค่า — ข้ามแถวนี้`);
      continue;
    }

    const costs = {
      material: parseNumber(r[19]),
      glue: parseNumber(r[20]),
      cutting: parseNumber(r[21]),
      install: parseNumber(r[22]),
      parking: parseNumber(r[23]),
      shipping: parseNumber(r[24]),
    };
    const hasCosts = Object.values(costs).some((v) => v > 0);

    const outstanding = parseNumber(r[38]);
    const invoiceNo1 = String(r[28] ?? "").trim() || null;
    const amount1 = parseNumber(r[29]);
    const invoiceNo2 = String(r[33] ?? "").trim() || null;
    const amount2 = parseNumber(r[34]);
    const status =
      amount1 > 0 || String(r[32] ?? "").trim() ? normalizeStatus(r[32], warnings, jobNo) : "รอชำระเงิน";

    // The legacy master sheet predates receipt_no/received_date entirely —
    // both stay null for every row parsed through this path.
    const payments: ParsedImportRow["payments"] = [];
    if (amount1 > 0 || String(r[32] ?? "").trim()) {
      payments.push({
        invoiceNo: invoiceNo1, installmentNo: 1, amount: amount1,
        paidDate: parseThaiBEDate(r[31]), receiptNo: null, receivedDate: null, status, outstandingAmount: outstanding,
      });
    }
    if (amount2 > 0) {
      payments.push({
        invoiceNo: invoiceNo2, installmentNo: 2, amount: amount2,
        paidDate: parseThaiBEDate(r[35]), receiptNo: null, receivedDate: null, status, outstandingAmount: outstanding,
      });
    }

    rows.push({
      jobNo,
      projectDate: projectDate ?? new Date().toISOString().slice(0, 10),
      customerName,
      customerType,
      projectName: String(r[4] ?? "").trim() || jobNo,
      salesRepName,
      productionStatus: null, // not tracked in the legacy sheet
      items,
      preVat,
      vat,
      costs: hasCosts ? costs : null,
      payments,
    });
  }

  return rows;
}

function parseExportFormatSheet(sheet: XLSX.WorkSheet, warnings: string[]): ParsedImportRow[] {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  const seenJobNos = new Set<string>();
  const rows: ParsedImportRow[] = [];

  for (const r of rawRows) {
    const jobNo = String(r["JOB NO."] ?? "").trim() || null;
    const customerName = String(r["CUSTOMER NAMES"] ?? "").trim();
    if (!customerName) {
      warnings.push(`${jobNo ?? "(แถวไม่ทราบเลข JOB)"}: ไม่มีชื่อลูกค้า — ข้ามแถวนี้`);
      continue;
    }
    if (jobNo) {
      if (seenJobNos.has(jobNo)) {
        warnings.push(`${jobNo}: เลข JOB ซ้ำในไฟล์ — ใช้แถวแรกที่พบ ข้ามแถวนี้`);
        continue;
      }
      seenJobNos.add(jobNo);
    }

    const projectDate = parseDate(r["DATE"]);
    if (!projectDate) {
      warnings.push(`${jobNo ?? customerName}: วันที่ไม่ถูกต้อง — ใช้วันที่วันนี้แทน`);
    }

    const items: { category: string; amount: number }[] = [];
    for (const [key, value] of Object.entries(r)) {
      if (KNOWN_COLUMNS.has(key)) continue;
      const amount = parseNumber(value);
      if (amount > 0) items.push({ category: key, amount });
    }
    if (items.length === 0) {
      warnings.push(`${jobNo ?? customerName}: ไม่มีรายการสินค้าที่มีมูลค่า — ข้ามแถวนี้`);
      continue;
    }

    const preVat = Math.round(items.reduce((sum, it) => sum + it.amount, 0) * 100) / 100;
    const vat = Math.round(preVat * 0.07 * 100) / 100;
    const total = preVat + vat;

    const costs = {
      material: parseNumber(r["ค่าวัสดุ"]),
      glue: parseNumber(r["ค่ากาว"]),
      cutting: parseNumber(r["ค่าตัด"]),
      install: parseNumber(r["ค่าติดตั้งผู้รับเหมา"]),
      parking: parseNumber(r["ค่าเดินทาง+ค่าที่จอดรถ"] ?? r["ค่าที่จอดรถ"]),
      shipping: parseNumber(r["ค่าขนส่ง"]),
    };
    const hasCosts = Object.values(costs).some((v) => v > 0);

    const amount1 = parseNumber(r["งวดที่ 1 จำนวนเงิน"]);
    const invoiceNo1 = String(r["เลขที่เอกสาร (งวด 1)"] ?? "").trim() || null;
    const receiptNo1 = String(r["เลขที่ใบเสร็จ (งวด 1)"] ?? "").trim() || null;
    const amount2 = parseNumber(r["งวดที่ 2 จำนวนเงิน"]);
    const invoiceNo2 = String(r["เลขที่เอกสาร (งวด 2)"] ?? "").trim() || null;
    const receiptNo2 = String(r["เลขที่ใบเสร็จ (งวด 2)"] ?? "").trim() || null;
    const amount3 = parseNumber(r["งวดที่ 3 จำนวนเงิน"]);
    const invoiceNo3 = String(r["เลขที่เอกสาร (งวด 3)"] ?? "").trim() || null;
    const receiptNo3 = String(r["เลขที่ใบเสร็จ (งวด 3)"] ?? "").trim() || null;
    // Matches the create/edit form's rule (project-sale-form.tsx): an
    // installment only counts as paid once its receipt number is filled
    // in, not just because an invoice/amount was entered.
    const paidAmount = (receiptNo1 ? amount1 : 0) + (receiptNo2 ? amount2 : 0) + (receiptNo3 ? amount3 : 0);
    // Not floored at 0 — matches parseForm's rule (actions.ts): a real
    // overpayment should round-trip as a negative outstanding, not silently
    // reset to ฿0 on export/reimport. Snapped to exactly 0 when the gap is
    // sub-satang so floating-point drift can't land on -0.
    const outstandingRaw = total - paidAmount;
    const outstanding = Math.abs(outstandingRaw) < 0.005 ? 0 : Math.round(outstandingRaw * 100) / 100;
    const status =
      amount1 > 0 || amount2 > 0 || amount3 > 0 || invoiceNo1 || invoiceNo2 || invoiceNo3
        ? normalizeStatus(r["สถานะ"], warnings, jobNo ?? customerName)
        : "รอชำระเงิน";

    // "วันที่รับชำระ (งวด N)" is the pre-rename column name — accepted as a
    // fallback so a backup file exported before this change still imports
    // its document-issue date correctly instead of dropping it.
    const payments: ParsedImportRow["payments"] = [];
    if (amount1 > 0 || invoiceNo1) {
      payments.push({
        invoiceNo: invoiceNo1, installmentNo: 1, amount: amount1,
        paidDate: parseDate(r["วันที่ออกเอกสาร (งวด 1)"] || r["วันที่รับชำระ (งวด 1)"]),
        receiptNo: receiptNo1,
        receivedDate: parseDate(r["วันที่รับชำระเงิน (งวด 1)"]),
        status, outstandingAmount: outstanding,
      });
    }
    if (amount2 > 0 || invoiceNo2) {
      payments.push({
        invoiceNo: invoiceNo2, installmentNo: 2, amount: amount2,
        paidDate: parseDate(r["วันที่ออกเอกสาร (งวด 2)"] || r["วันที่รับชำระ (งวด 2)"]),
        receiptNo: receiptNo2,
        receivedDate: parseDate(r["วันที่รับชำระเงิน (งวด 2)"]),
        status, outstandingAmount: outstanding,
      });
    }
    if (amount3 > 0 || invoiceNo3) {
      payments.push({
        invoiceNo: invoiceNo3, installmentNo: 3, amount: amount3,
        paidDate: parseDate(r["วันที่ออกเอกสาร (งวด 3)"]),
        receiptNo: receiptNo3,
        receivedDate: parseDate(r["วันที่รับชำระเงิน (งวด 3)"]),
        status, outstandingAmount: outstanding,
      });
    }

    rows.push({
      jobNo,
      projectDate: projectDate ?? new Date().toISOString().slice(0, 10),
      customerName,
      customerType: normalizeCustomerType(r["Customer Type"], warnings, jobNo ?? customerName),
      projectName: String(r["PROJECT NAME"] ?? "").trim() || jobNo || customerName,
      salesRepName: String(r["SALE"] ?? "").trim() || "ไม่ระบุ",
      productionStatus: normalizeProductionStatus(r["สถานะของงาน"]),
      items,
      preVat,
      vat,
      costs: hasCosts ? costs : null,
      payments,
    });
  }

  return rows;
}

export async function previewProjectImport(formData: FormData): Promise<ImportPreview | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") {
    return { error: "เฉพาะเจ้าของกิจการเท่านั้นที่ import ข้อมูลได้" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "กรุณาเลือกไฟล์ Excel" };
  }

  let workbook: XLSX.WorkBook;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    workbook = XLSX.read(buffer, { cellDates: true });
  } catch {
    return { error: "ไม่สามารถอ่านไฟล์นี้ได้ — กรุณาตรวจสอบว่าเป็นไฟล์ .xlsx ที่ถูกต้อง" };
  }

  const warnings: string[] = [];
  let rows: ParsedImportRow[];

  // Two supported formats: the named-column layout /api/export-projects
  // produces (sheet "Project Sales"), and the original master tracking
  // sheet layout ("Project Sale 2026", fixed columns by position — the
  // same format scripts/import-excel.mjs was built for). Detected by
  // sheet name; the legacy sheet has no usable header row to check for
  // named columns, so presence of "Project Sale 2026" takes priority.
  if (workbook.SheetNames.includes("Project Sale 2026")) {
    rows = parseLegacySheet(workbook.Sheets["Project Sale 2026"], warnings);
  } else {
    const sheetName = workbook.SheetNames.includes("Project Sales") ? "Project Sales" : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return { error: "ไม่พบข้อมูลในไฟล์นี้" };
    rows = parseExportFormatSheet(sheet, warnings);
  }

  if (rows.length === 0) {
    return { error: "ไม่พบข้อมูลที่นำเข้าได้ในไฟล์นี้" };
  }

  const supabase = await createClient();
  const [{ data: existingCustomers }, { data: existingReps }] = await Promise.all([
    supabase.from("customers").select("name"),
    supabase.from("sales_reps").select("name"),
  ]);
  const existingCustomerNames = new Set((existingCustomers ?? []).map((c) => c.name.toLowerCase()));
  const existingRepNames = new Set((existingReps ?? []).map((r) => r.name.toLowerCase()));

  const distinctCustomerNames = Array.from(new Set(rows.map((r) => r.customerName)));
  const distinctRepNames = Array.from(new Set(rows.map((r) => r.salesRepName)));

  const dates = rows.map((r) => r.projectDate).sort();

  return {
    rows,
    summary: {
      rowCount: rows.length,
      totalPreVat: rows.reduce((sum, r) => sum + r.preVat, 0),
      dateFrom: dates[0] ?? null,
      dateTo: dates[dates.length - 1] ?? null,
      newCustomerNames: distinctCustomerNames.filter((n) => !existingCustomerNames.has(n.toLowerCase())),
      newSalesRepNames: distinctRepNames.filter((n) => !existingRepNames.has(n.toLowerCase())),
    },
    warnings,
  };
}

async function resolveSalesRepId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  salesRepName: string,
): Promise<{ salesRepId: string } | { error: string }> {
  const { data: existing, error: lookupErr } = await supabase
    .from("sales_reps")
    .select("id")
    .ilike("name", salesRepName)
    .limit(1)
    .maybeSingle();
  if (lookupErr) return { error: `ค้นหาเซลล์ไม่สำเร็จ: ${lookupErr.message}` };
  if (existing?.id) return { salesRepId: existing.id };

  const { data: created, error: createErr } = await supabase
    .from("sales_reps")
    .insert({ name: salesRepName })
    .select("id")
    .single();
  if (createErr) return { error: `สร้างเซลล์ใหม่ไม่สำเร็จ: ${createErr.message}` };
  return { salesRepId: created.id };
}

export async function commitProjectImport(rowsJson: string): Promise<{ error: string | null; count?: number }> {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถ import ได้ในโหมดทดลอง" };
  }

  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") {
    return { error: "เฉพาะเจ้าของกิจการเท่านั้นที่ import ข้อมูลได้" };
  }

  let rows: ParsedImportRow[];
  try {
    rows = JSON.parse(rowsJson);
  } catch {
    return { error: "ข้อมูลที่จะ import ไม่ถูกต้อง กรุณาอัปโหลดไฟล์ใหม่อีกครั้ง" };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "ไม่มีข้อมูลที่จะ import" };
  }

  const supabase = await createClient();

  const resolvedRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    const customerResult = await resolveCustomerId(supabase, row.customerName, row.customerType);
    if ("error" in customerResult) return { error: customerResult.error };
    const repResult = await resolveSalesRepId(supabase, row.salesRepName);
    if ("error" in repResult) return { error: repResult.error };

    resolvedRows.push({
      jobNo: row.jobNo ?? "",
      projectDate: row.projectDate,
      customerId: customerResult.customerId,
      projectName: row.projectName,
      salesRepId: repResult.salesRepId,
      customerType: row.customerType,
      preVat: row.preVat,
      vat: row.vat,
      productionStatus: row.productionStatus ?? "",
      items: row.items,
      costs: row.costs,
      payments: row.payments.map((p) => ({
        invoiceNo: p.invoiceNo ?? "",
        installmentNo: p.installmentNo,
        amount: p.amount,
        paidDate: p.paidDate ?? "",
        receiptNo: p.receiptNo ?? "",
        receivedDate: p.receivedDate ?? "",
        status: p.status,
        outstandingAmount: p.outstandingAmount,
      })),
    });
  }

  const { data: count, error: rpcErr } = await supabase.rpc("replace_all_projects", { p_rows: resolvedRows });
  if (rpcErr) return { error: `แทนที่ข้อมูลไม่สำเร็จ: ${rpcErr.message}` };

  revalidatePath("/dashboard/project-sales");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/gp");
  revalidatePath("/dashboard/ar");
  return { error: null, count: count ?? undefined };
}
