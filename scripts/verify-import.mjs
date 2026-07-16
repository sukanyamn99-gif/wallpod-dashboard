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

const tables = ["sales_reps", "customers", "projects", "project_items", "project_costs", "payments"];
for (const t of tables) {
  const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
  if (error) console.error(t, error.message);
  else console.log(`${t}: ${count} rows`);
}

console.log("\n--- Spot check: JB2601001 ---");
const { data: p1 } = await supabase
  .from("projects")
  .select("job_no, project_date, project_name, pre_vat, vat, total, customer_type, customers(name), sales_reps(name)")
  .eq("job_no", "JB2601001")
  .single();
console.log(p1);

console.log("\n--- Spot check: JB2601001 items/costs/payments ---");
const { data: items } = await supabase.from("project_items").select("product_category, amount").eq(
  "project_id",
  (await supabase.from("projects").select("id").eq("job_no", "JB2601001").single()).data.id,
);
console.log("items:", items);

const { data: totalPreVat } = await supabase.from("projects").select("pre_vat");
const sum = totalPreVat.reduce((s, r) => s + Number(r.pre_vat), 0);
console.log("\nSum of pre_vat across all imported projects:", sum.toLocaleString());
