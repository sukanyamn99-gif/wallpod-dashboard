import XLSX from "xlsx";

// Pure dry-run: mirrors parseLegacySheet's exact logic from
// src/app/dashboard/project-sales/import-actions.ts, read-only, no DB
// calls at all. Used to sanity-check the real user file before ever
// running it through the actual import UI.

const FILE_PATH = process.argv[2];
if (!FILE_PATH) throw new Error("Usage: node scripts/qa-parse-legacy-dryrun.mjs <path>");

const CUSTOMER_TYPES = ["Owner", "Designer", "Turnkey", "Contractor", "Corporate", "Dealer", "School"];
const PAYMENT_STATUSES = ["เก็บเงินเรียบร้อย", "ชำระมาแล้ว 50%", "รอชำระเงิน"];
const LEGACY_PRODUCT_CATEGORIES = ["WALLPOD", "ACOUSHEET", "ACOUSOFT", "ACUBOX", "CNC", "SERVICE", "WALLPAPER", "OTHER"];
const LEGACY_PRODUCT_COL_START = 7;

function parseNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").replace(/,/g, "").trim();
  if (s === "") return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
function parseDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
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
function parseThaiBEDate(v) {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!m) return null;
  const [, d, mo, yy] = m;
  const ceYear = 2500 + parseInt(yy, 10) - 543;
  return `${ceYear}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
function normalizeCustomerType(v, warnings, jobNo) {
  let s = String(v ?? "").trim();
  if (s === "Direct Owner") s = "Owner";
  if (!CUSTOMER_TYPES.includes(s)) {
    warnings.push(`${jobNo}: กลุ่มลูกค้า "${s || "(ว่าง)"}" ไม่ถูกต้อง — ใช้ Owner แทน`);
    return "Owner";
  }
  return s;
}
function normalizeStatus(v, warnings, jobNo) {
  const s = String(v ?? "").trim();
  if (!PAYMENT_STATUSES.includes(s)) {
    warnings.push(`${jobNo}: สถานะการชำระ "${s || "(ว่าง)"}" ไม่ถูกต้อง — ใช้ "รอชำระเงิน" แทน`);
    return "รอชำระเงิน";
  }
  return s;
}

function parseLegacySheet(sheet, warnings) {
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  const rows = [];
  const seenJobNos = new Set();

  for (let i = 6; i < rawRows.length; i++) {
    const r = rawRows[i];
    const jobNo = String(r[2] ?? "").trim();
    if (!jobNo.startsWith("JB")) continue;
    const customerName = String(r[3] ?? "").trim();
    if (!customerName) continue;

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

    const items = [];
    for (let c = 0; c < LEGACY_PRODUCT_CATEGORIES.length; c++) {
      const amount = parseNumber(r[LEGACY_PRODUCT_COL_START + c]);
      if (amount > 0) items.push({ category: LEGACY_PRODUCT_CATEGORIES[c], amount });
    }
    if (items.length === 0) {
      warnings.push(`${jobNo}: ไม่มีรายการสินค้าที่มีมูลค่า — ข้ามแถวนี้`);
      continue;
    }

    const costs = {
      material: parseNumber(r[19]), glue: parseNumber(r[20]), cutting: parseNumber(r[21]),
      install: parseNumber(r[22]), parking: parseNumber(r[23]), shipping: parseNumber(r[24]),
    };
    const hasCosts = Object.values(costs).some((v) => v > 0);

    const outstanding = parseNumber(r[38]);
    const invoiceNo1 = String(r[28] ?? "").trim() || null;
    const amount1 = parseNumber(r[29]);
    const invoiceNo2 = String(r[33] ?? "").trim() || null;
    const amount2 = parseNumber(r[34]);
    const status = amount1 > 0 || String(r[32] ?? "").trim() ? normalizeStatus(r[32], warnings, jobNo) : "รอชำระเงิน";

    const payments = [];
    if (amount1 > 0 || String(r[32] ?? "").trim()) {
      payments.push({ invoiceNo: invoiceNo1, installmentNo: 1, amount: amount1, paidDate: parseThaiBEDate(r[31]), status, outstandingAmount: outstanding });
    }
    if (amount2 > 0) {
      payments.push({ invoiceNo: invoiceNo2, installmentNo: 2, amount: amount2, paidDate: parseThaiBEDate(r[35]), status, outstandingAmount: outstanding });
    }

    rows.push({
      jobNo, projectDate: projectDate ?? new Date().toISOString().slice(0, 10), customerName, customerType,
      projectName: String(r[4] ?? "").trim() || jobNo, salesRepName, productionStatus: null,
      items, preVat, vat, costs: hasCosts ? costs : null, payments,
    });
  }
  return rows;
}

const wb = XLSX.readFile(FILE_PATH, { cellDates: true });
const warnings = [];
const rows = parseLegacySheet(wb.Sheets["Project Sale 2026"], warnings);

const totalPreVat = rows.reduce((s, r) => s + r.preVat, 0);
const dates = rows.map((r) => r.projectDate).sort();
const duplicateJobNoWarnings = warnings.filter((w) => w.includes("ซ้ำ"));

console.log(`Parsed ${rows.length} rows`);
console.log(`Total PRE.VAT: ${totalPreVat.toLocaleString()}`);
console.log(`Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
console.log(`Warnings: ${warnings.length} (${duplicateJobNoWarnings.length} duplicate job no.)`);
console.log("\nFirst 3 rows:", JSON.stringify(rows.slice(0, 3), null, 2));
console.log("\nLast 3 rows:", JSON.stringify(rows.slice(-3), null, 2));
if (warnings.length > 0) {
  console.log("\nAll warnings:");
  warnings.forEach((w) => console.log(" -", w));
}
