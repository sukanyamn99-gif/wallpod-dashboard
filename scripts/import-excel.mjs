import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnv(file) {
  const content = fs.readFileSync(file, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^=#]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}
loadEnv(path.resolve(process.cwd(), ".env.import.local"));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.import.local");
}

const EXCEL_PATH = process.argv[2];
if (!EXCEL_PATH) throw new Error("Usage: node scripts/import-excel.mjs <path-to-xlsx>");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const CUSTOMER_TYPES = ["Owner", "Designer", "Turnkey", "Contractor", "Corporate", "Dealer", "School"];
const STATUSES = ["เก็บเงินเรียบร้อย", "ชำระมาแล้ว 50%", "รอชำระเงิน"];
const PRODUCT_CATEGORIES = ["WALLPOD", "ACOUSHEET", "ACOUSOFT", "ACUBOX", "CNC", "SERVICE", "WALLPAPER", "OTHER"];
const PRODUCT_COL_START = 7; // columns 7..14 in the "Project Sale 2026" sheet

function parseNumber(v) {
  const s = String(v ?? "").replace(/,/g, "").trim();
  if (s === "") return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// DATE column, e.g. "8/1/2026" -> Gregorian D/M/YYYY
function parseGregorianDate(v) {
  const m = String(v ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// payment date columns, e.g. "30/01/69" -> Thai Buddhist-era D/M/YY
function parseThaiBEDate(v) {
  const m = String(v ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!m) return null;
  const [, d, mo, yy] = m;
  const ceYear = 2500 + parseInt(yy, 10) - 543;
  return `${ceYear}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function normalizeCustomerType(v, warnings, jobNo) {
  let s = String(v ?? "").trim();
  if (s === "Direct Owner") s = "Owner";
  if (!CUSTOMER_TYPES.includes(s)) {
    warnings.push(`${jobNo}: customer_type "${s || "(blank)"}" -> defaulted to Owner`);
    return "Owner";
  }
  return s;
}

function normalizeStatus(v, warnings, jobNo) {
  const s = String(v ?? "").trim();
  if (!STATUSES.includes(s)) {
    warnings.push(`${jobNo}: status "${s || "(blank)"}" -> defaulted to รอชำระเงิน`);
    return "รอชำระเงิน";
  }
  return s;
}

const wb = XLSX.readFile(EXCEL_PATH, { cellDates: false });
const sheet = wb.Sheets["Project Sale 2026"];
if (!sheet) throw new Error('Sheet "Project Sale 2026" not found');
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

const warnings = [];
const salesRepNames = new Set();
const customersByName = new Map();
const parsedRows = [];

for (let i = 6; i < rows.length; i++) {
  const r = rows[i];
  const jobNo = String(r[2] ?? "").trim();
  if (!jobNo.startsWith("JB")) continue; // skips "Week N" subtotal rows / blanks
  const customerName = String(r[3] ?? "").trim();
  if (!customerName) continue; // reserved job number with no data yet

  const salesRepName = String(r[5] ?? "").trim() || "ไม่ระบุ";
  const customerType = normalizeCustomerType(r[6], warnings, jobNo);

  salesRepNames.add(salesRepName);
  if (!customersByName.has(customerName)) customersByName.set(customerName, customerType);

  const preVat = parseNumber(r[15]);
  const totalInclVat = parseNumber(r[16]); // the "VAT" column actually holds pre_vat + vat
  let vat = totalInclVat - preVat;
  if (totalInclVat === 0 && preVat > 0) vat = Math.round(preVat * 0.07 * 100) / 100;
  if (vat < 0) vat = 0;

  const items = [];
  for (let c = 0; c < PRODUCT_CATEGORIES.length; c++) {
    const amount = parseNumber(r[PRODUCT_COL_START + c]);
    if (amount > 0) items.push({ product_category: PRODUCT_CATEGORIES[c], amount });
  }

  const costs = {
    material_cost: parseNumber(r[19]),
    glue_cost: parseNumber(r[20]),
    cutting_cost: parseNumber(r[21]),
    install_cost: parseNumber(r[22]),
    parking_cost: parseNumber(r[23]),
    shipping_cost: parseNumber(r[24]),
  };
  const hasCosts = Object.values(costs).some((v) => v > 0);

  const outstanding = parseNumber(r[38]);
  const status = normalizeStatus(r[32], warnings, jobNo);

  const payments = [];
  const inst1Amount = parseNumber(r[29]);
  if (inst1Amount > 0 || String(r[32] ?? "").trim()) {
    payments.push({
      invoice_no: String(r[28] ?? "").trim() || null,
      installment_no: 1,
      amount: inst1Amount,
      paid_date: parseThaiBEDate(r[31]),
      status,
      outstanding_amount: outstanding,
    });
  }
  const inst2Amount = parseNumber(r[34]);
  if (inst2Amount > 0) {
    payments.push({
      invoice_no: String(r[33] ?? "").trim() || null,
      installment_no: 2,
      amount: inst2Amount,
      paid_date: parseThaiBEDate(r[35]),
      status,
      outstanding_amount: outstanding,
    });
  }

  parsedRows.push({
    jobNo,
    projectDate: parseGregorianDate(r[1]) ?? new Date().toISOString().slice(0, 10),
    customerName,
    customerType,
    projectName: String(r[4] ?? "").trim() || jobNo,
    salesRepName,
    preVat,
    vat,
    items,
    costs: hasCosts ? costs : null,
    payments,
  });
}

console.log(`Parsed ${parsedRows.length} real project rows from "Project Sale 2026".`);
if (warnings.length) {
  console.log(`\n${warnings.length} warnings:`);
  warnings.forEach((w) => console.log(" -", w));
}

// ---- 1. sales_reps ----
const { data: existingReps, error: repErr } = await supabase.from("sales_reps").select("id, name");
if (repErr) throw new Error(`Reading sales_reps failed (did you run supabase/schema.sql yet?): ${repErr.message}`);
const repIdByName = new Map(existingReps.map((r) => [r.name, r.id]));
const newReps = [...salesRepNames].filter((n) => !repIdByName.has(n));
if (newReps.length) {
  const { data: inserted, error } = await supabase
    .from("sales_reps")
    .insert(newReps.map((name) => ({ name })))
    .select("id, name");
  if (error) throw error;
  inserted.forEach((r) => repIdByName.set(r.name, r.id));
}
console.log(`\nSales reps: ${repIdByName.size} total (${newReps.length} new)`);

// ---- 2. customers ----
const { data: existingCustomers, error: custErr } = await supabase.from("customers").select("id, name");
if (custErr) throw custErr;
const custIdByName = new Map(existingCustomers.map((c) => [c.name, c.id]));
const newCustomers = [...customersByName.entries()].filter(([name]) => !custIdByName.has(name));
if (newCustomers.length) {
  const { data: inserted, error } = await supabase
    .from("customers")
    .insert(newCustomers.map(([name, customer_type]) => ({ name, customer_type })))
    .select("id, name");
  if (error) throw error;
  inserted.forEach((c) => custIdByName.set(c.name, c.id));
}
console.log(`Customers: ${custIdByName.size} total (${newCustomers.length} new)`);

// ---- 3. projects + children (skip job_no already imported) ----
const { data: existingProjects, error: projErr } = await supabase.from("projects").select("id, job_no");
if (projErr) throw projErr;
const existingJobNos = new Set(existingProjects.map((p) => p.job_no));

let insertedCount = 0;
let skippedCount = 0;

for (const row of parsedRows) {
  if (existingJobNos.has(row.jobNo)) {
    skippedCount++;
    continue;
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      job_no: row.jobNo,
      project_date: row.projectDate,
      customer_id: custIdByName.get(row.customerName),
      project_name: row.projectName,
      sales_rep_id: repIdByName.get(row.salesRepName),
      customer_type: row.customerType,
      stage_percent: 100,
      pre_vat: row.preVat,
      vat: row.vat,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`Failed to insert project ${row.jobNo}:`, error.message);
    continue;
  }

  if (row.items.length) {
    const { error: itemsErr } = await supabase
      .from("project_items")
      .insert(row.items.map((it) => ({ ...it, project_id: project.id })));
    if (itemsErr) console.error(`  items error for ${row.jobNo}:`, itemsErr.message);
  }

  if (row.costs) {
    const { error: costErr } = await supabase
      .from("project_costs")
      .insert({ ...row.costs, project_id: project.id });
    if (costErr) console.error(`  costs error for ${row.jobNo}:`, costErr.message);
  }

  if (row.payments.length) {
    const { error: payErr } = await supabase
      .from("payments")
      .insert(row.payments.map((p) => ({ ...p, project_id: project.id })));
    if (payErr) console.error(`  payments error for ${row.jobNo}:`, payErr.message);
  }

  insertedCount++;
}

console.log(`\nDone. Inserted ${insertedCount} new projects, skipped ${skippedCount} already in the database.`);
