import { createClient } from "@supabase/supabase-js";
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

const envLocal = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf-8");
const anonKey = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(process.env.SUPABASE_URL, anonKey);

// Create disposable QA owner (same pattern as Phase 2 testing)
const email = "qa-project-sales@example.com";
const password = crypto.randomBytes(12).toString("hex");
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
});
if (createErr) throw createErr;
await admin.from("profiles").insert({ id: created.user.id, full_name: "QA Project Sales", role: "owner" });

const { error: signInErr } = await anon.auth.signInWithPassword({ email, password });
if (signInErr) throw signInErr;

const { data: rep } = await admin.from("sales_reps").select("id").eq("name", "ธีรวัฒน์ (โต้)").single();

// 1. Create a NEW customer (exercises the "+ ลูกค้าใหม่" path)
const { data: newCustomer, error: custErr } = await anon
  .from("customers")
  .insert({ name: "บจก. ทดสอบ Project Sales QA", customer_type: "Corporate" })
  .select("id")
  .single();
if (custErr) throw custErr;
console.log("Created new customer:", newCustomer.id);

// 2. Same math as the server action: items -> pre_vat -> vat
const items = [
  { product_category: "WALLPOD", amount: 50000 },
  { product_category: "CNC", amount: 12000 },
];
const preVat = items.reduce((s, i) => s + i.amount, 0);
const vat = Math.round(preVat * 0.07 * 100) / 100;
const total = preVat + vat;

const { data: project, error: projErr } = await anon
  .from("projects")
  .insert({
    job_no: "JB2607-QA-TEST",
    project_date: new Date().toISOString().slice(0, 10),
    customer_id: newCustomer.id,
    project_name: "ทดสอบระบบ Project Sales",
    sales_rep_id: rep.id,
    customer_type: "Corporate",
    stage_percent: 100,
    pre_vat: preVat,
    vat,
  })
  .select("id, job_no, pre_vat, vat, total")
  .single();
if (projErr) throw projErr;
console.log("Created project:", JSON.stringify(project, null, 2));

const { error: itemsErr } = await anon
  .from("project_items")
  .insert(items.map((it) => ({ ...it, project_id: project.id })));
if (itemsErr) throw itemsErr;
console.log("Inserted items OK");

const { error: costErr } = await anon
  .from("project_costs")
  .insert({ project_id: project.id, material_cost: 20000, glue_cost: 1500 });
if (costErr) throw costErr;
console.log("Inserted costs OK");

const outstanding = Math.max(0, total - 30000);
const { error: payErr } = await anon.from("payments").insert([
  {
    project_id: project.id,
    invoice_no: "IV-QA-001",
    installment_no: 1,
    amount: 30000,
    paid_date: new Date().toISOString().slice(0, 10),
    status: "ชำระมาแล้ว 50%",
    outstanding_amount: outstanding,
  },
]);
if (payErr) throw payErr;
console.log("Inserted payment OK, outstanding:", outstanding);

// verify total matches expectation
console.log("\nExpected total (pre_vat+vat):", total, "| DB total:", project.total);
if (Number(project.total) !== total) throw new Error("Total mismatch!");
console.log("\nAll inserts verified via RLS-checked authenticated client.");
