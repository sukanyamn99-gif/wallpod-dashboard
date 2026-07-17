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

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PRODUCT_CATEGORIES = ["WALLPOD", "ACOUSHEET", "ACOUSOFT", "ACUBOX", "CNC", "SERVICE", "WALLPAPER", "OTHER"];

const { data: projects } = await supabase
  .from("projects")
  .select("id, job_no, project_date, project_name, customer_type, pre_vat, vat, total, customers(name), sales_reps(name)")
  .order("project_date", { ascending: true });

const projectIds = projects.map((p) => p.id);
const [{ data: items }, { data: costs }, { data: payments }] = await Promise.all([
  supabase.from("project_items").select("project_id, product_category, amount").in("project_id", projectIds),
  supabase.from("project_costs").select("*").in("project_id", projectIds),
  supabase.from("payments").select("*").in("project_id", projectIds).order("installment_no"),
]);

const rows = projects.map((p) => {
  const projectItems = items.filter((it) => it.project_id === p.id);
  const projectCosts = costs.find((c) => c.project_id === p.id);
  const projectPayments = payments.filter((pay) => pay.project_id === p.id);
  const payment1 = projectPayments.find((pay) => pay.installment_no === 1);
  const payment2 = projectPayments.find((pay) => pay.installment_no === 2);

  const row = {
    "JOB NO.": p.job_no ?? "",
    "DATE": p.project_date,
    "CUSTOMER NAMES": p.customers?.name ?? "",
    "PROJECT NAME": p.project_name,
    "SALE": p.sales_reps?.name ?? "",
    "Customer Type": p.customer_type,
  };
  for (const cat of PRODUCT_CATEGORIES) {
    const found = projectItems.find((it) => it.product_category === cat);
    row[cat] = found ? Number(found.amount) : "";
  }
  row["PRE.VAT"] = Number(p.pre_vat);
  row["VAT"] = Number(p.vat);
  row["รวมทั้งสิ้น"] = Number(p.total);
  row["สถานะ"] = payment1?.status ?? payment2?.status ?? "";
  return row;
});

const ws = XLSX.utils.json_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Project Sales");
const outPath = path.resolve(process.cwd(), "scripts", "_export_test.xlsx");
XLSX.writeFile(wb, outPath);

console.log(`Wrote ${rows.length} rows to ${outPath}`);

// Re-read it back to confirm it's valid and matches
const reread = XLSX.readFile(outPath);
const sheet = reread.Sheets["Project Sales"];
const rereadRows = XLSX.utils.sheet_to_json(sheet);
console.log("Re-parsed row count:", rereadRows.length, "(matches original:", rereadRows.length === rows.length, ")");
console.log("Sample first row:", JSON.stringify(rereadRows[0]));
console.log("Column headers:", Object.keys(rereadRows[0]).join(", "));

// sanity: sum of PRE.VAT should match what we've verified all session (7,875,803 for the 154 imported jobs)
const sumPreVat = rereadRows.reduce((s, r) => s + (Number(r["PRE.VAT"]) || 0), 0);
console.log("Sum of PRE.VAT in export:", sumPreVat.toLocaleString());

fs.unlinkSync(outPath);
console.log("Cleaned up test file");
