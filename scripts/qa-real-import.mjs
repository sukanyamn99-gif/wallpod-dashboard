import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function loadEnv(file) {
  const content = fs.readFileSync(file, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^=#]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}
loadEnv(path.resolve(process.cwd(), ".env.import.local"));
loadEnv(path.resolve(process.cwd(), ".env.local"));

const FILE_PATH = process.argv[2];
if (!FILE_PATH) throw new Error("Usage: node scripts/qa-real-import.mjs <path-to-xlsx>");

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ANON_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const BACKUP_PATH = path.resolve(process.cwd(), "scripts", "REAL-DATA-BACKUP-DO-NOT-DELETE.json");

// ---- parsing (mirrors parseLegacySheet in import-actions.ts exactly) ----
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
function normalizeCustomerType(v) {
  let s = String(v ?? "").trim();
  if (s === "Direct Owner") s = "Owner";
  return CUSTOMER_TYPES.includes(s) ? s : "Owner";
}
function normalizeStatus(v) {
  const s = String(v ?? "").trim();
  return PAYMENT_STATUSES.includes(s) ? s : "รอชำระเงิน";
}

function parseLegacySheet(sheet) {
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  const rows = [];
  const seenJobNos = new Set();

  for (let i = 6; i < rawRows.length; i++) {
    const r = rawRows[i];
    const jobNo = String(r[2] ?? "").trim();
    if (!jobNo.startsWith("JB")) continue;
    const customerName = String(r[3] ?? "").trim();
    if (!customerName) continue;
    if (seenJobNos.has(jobNo)) continue;
    seenJobNos.add(jobNo);

    const projectDate = parseDate(r[1]);
    const salesRepName = String(r[5] ?? "").trim() || "ไม่ระบุ";
    const customerType = normalizeCustomerType(r[6]);

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
    if (items.length === 0) continue;

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
    const status = amount1 > 0 || String(r[32] ?? "").trim() ? normalizeStatus(r[32]) : "รอชำระเงิน";

    const payments = [];
    if (amount1 > 0 || String(r[32] ?? "").trim()) {
      payments.push({ invoiceNo: invoiceNo1, installmentNo: 1, amount: amount1, paidDate: parseThaiBEDate(r[31]), status, outstandingAmount: outstanding });
    }
    if (amount2 > 0) {
      payments.push({ invoiceNo: invoiceNo2, installmentNo: 2, amount: amount2, paidDate: parseThaiBEDate(r[35]), status, outstandingAmount: outstanding });
    }

    rows.push({
      jobNo, projectDate: projectDate ?? new Date().toISOString().slice(0, 10), customerName, customerType,
      projectName: String(r[4] ?? "").trim() || jobNo, salesRepName, productionStatus: "",
      items, preVat, vat, costs: hasCosts ? costs : null, payments,
    });
  }
  return rows;
}

// ---- Step 1: back up current real DB state to disk before anything else ----
console.log("Step 1: backing up current real data to disk...");
const { data: projects } = await admin
  .from("projects")
  .select("id, job_no, project_date, customer_id, project_name, sales_rep_id, customer_type, pre_vat, vat, production_status");
const { data: items0 } = await admin.from("project_items").select("project_id, product_category, amount");
const { data: costs0 } = await admin.from("project_costs").select("*");
const { data: payments0 } = await admin.from("payments").select("*").order("installment_no");

const backupRows = projects.map((p) => {
  const projItems = items0.filter((it) => it.project_id === p.id);
  const projCost = costs0.find((c) => c.project_id === p.id);
  const projPayments = payments0.filter((pay) => pay.project_id === p.id);
  return {
    jobNo: p.job_no ?? "", projectDate: p.project_date, customerId: p.customer_id, projectName: p.project_name,
    salesRepId: p.sales_rep_id, customerType: p.customer_type, preVat: Number(p.pre_vat), vat: Number(p.vat),
    productionStatus: p.production_status ?? "",
    items: projItems.map((it) => ({ category: it.product_category, amount: Number(it.amount) })),
    costs: projCost ? {
      material: Number(projCost.material_cost), glue: Number(projCost.glue_cost), cutting: Number(projCost.cutting_cost),
      install: Number(projCost.install_cost), parking: Number(projCost.parking_cost), shipping: Number(projCost.shipping_cost),
    } : null,
    payments: projPayments.map((pay) => ({
      invoiceNo: pay.invoice_no ?? "", installmentNo: pay.installment_no, amount: Number(pay.amount),
      paidDate: pay.paid_date ?? "", status: pay.status, outstandingAmount: Number(pay.outstanding_amount),
    })),
  };
});
fs.writeFileSync(BACKUP_PATH, JSON.stringify(backupRows, null, 2));
console.log(`  Backed up ${backupRows.length} real projects (total PRE.VAT ${backupRows.reduce((s, r) => s + r.preVat, 0).toLocaleString()}) to ${BACKUP_PATH}`);

// ---- Step 2: parse the real user file ----
console.log("\nStep 2: parsing the real uploaded file...");
const wb = XLSX.readFile(FILE_PATH, { cellDates: true });
const parsedRows = parseLegacySheet(wb.Sheets["Project Sale 2026"]);
console.log(`  Parsed ${parsedRows.length} rows, total PRE.VAT ${parsedRows.reduce((s, r) => s + r.preVat, 0).toLocaleString()}`);

// ---- Step 3: resolve customer/sales-rep names to ids (find-or-create, same as resolveCustomerId/resolveSalesRepId) ----
console.log("\nStep 3: resolving customer/sales-rep names to ids...");
const { data: existingCustomers } = await admin.from("customers").select("id, name");
const { data: existingReps } = await admin.from("sales_reps").select("id, name");
const customerIdByName = new Map(existingCustomers.map((c) => [c.name.toLowerCase(), c.id]));
const repIdByName = new Map(existingReps.map((r) => [r.name.toLowerCase(), r.id]));

let newCustomers = 0;
let newReps = 0;
const resolvedRows = [];
for (const row of parsedRows) {
  let customerId = customerIdByName.get(row.customerName.toLowerCase());
  if (!customerId) {
    const { data: created, error } = await admin
      .from("customers")
      .insert({ name: row.customerName, customer_type: row.customerType })
      .select("id")
      .single();
    if (error) throw new Error(`Failed to create customer "${row.customerName}": ${error.message}`);
    customerId = created.id;
    customerIdByName.set(row.customerName.toLowerCase(), customerId);
    newCustomers++;
  }

  let salesRepId = repIdByName.get(row.salesRepName.toLowerCase());
  if (!salesRepId) {
    const { data: created, error } = await admin.from("sales_reps").insert({ name: row.salesRepName }).select("id").single();
    if (error) throw new Error(`Failed to create sales rep "${row.salesRepName}": ${error.message}`);
    salesRepId = created.id;
    repIdByName.set(row.salesRepName.toLowerCase(), salesRepId);
    newReps++;
  }

  resolvedRows.push({ ...row, customerId, salesRepId });
}
console.log(`  Resolved all rows. New customers created: ${newCustomers}, new sales reps created: ${newReps}`);

// ---- Step 4: disposable owner test account for the RPC call ----
console.log("\nStep 4: creating disposable owner test account to perform the replace...");
const email = `qa-real-import-${Date.now()}@example.com`;
const password = crypto.randomBytes(12).toString("hex");
const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
await admin.from("profiles").upsert({ id: created.user.id, full_name: "QA Real Import", role: "owner" });
const ownerClient = createClient(ANON_URL, ANON_KEY);
await ownerClient.auth.signInWithPassword({ email, password });

try {
  console.log("\nStep 5: calling replace_all_projects with the real parsed data...");
  const { data: count, error: rpcErr } = await ownerClient.rpc("replace_all_projects", { p_rows: resolvedRows });
  if (rpcErr) {
    console.error("IMPORT FAILED (rolled back automatically, original data untouched):", rpcErr.message);
    process.exit(1);
  }
  console.log(`  SUCCESS. Imported ${count} projects.`);

  const { count: finalCount } = await admin.from("projects").select("id", { count: "exact", head: true });
  const { data: finalTotals } = await admin.from("projects").select("pre_vat");
  const finalTotalPreVat = finalTotals.reduce((s, p) => s + Number(p.pre_vat), 0);
  console.log(`  Final state: ${finalCount} projects, total PRE.VAT ${finalTotalPreVat.toLocaleString()}`);
} finally {
  console.log("\nCleaning up disposable test account...");
  await admin.from("profiles").delete().eq("id", created.user.id);
  await admin.auth.admin.deleteUser(created.user.id);
  console.log("Done.");
}
