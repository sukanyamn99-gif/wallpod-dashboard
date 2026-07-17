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

const email = "qa-edit-test@example.com";
const password = crypto.randomBytes(12).toString("hex");
const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (createErr) throw createErr;
await admin.from("profiles").insert({ id: created.user.id, full_name: "QA Edit Test", role: "owner" });
await anon.auth.signInWithPassword({ email, password });

const { data: rep } = await admin.from("sales_reps").select("id").eq("name", "ธีรวัฒน์ (โต้)").single();

// --- create ---
const { data: cust } = await anon.from("customers").insert({ name: "บจก. ทดสอบแก้ไข QA", customer_type: "Corporate" }).select("id").single();
const { data: project } = await anon.from("projects").insert({
  job_no: "JB2607-EDIT-TEST",
  project_date: "2026-07-01",
  customer_id: cust.id,
  project_name: "งานก่อนแก้ไข",
  sales_rep_id: rep.id,
  customer_type: "Corporate",
  stage_percent: 100,
  pre_vat: 10000,
  vat: 700,
}).select("id").single();
await anon.from("project_items").insert({ project_id: project.id, product_category: "WALLPOD", amount: 10000 });
await anon.from("payments").insert({ project_id: project.id, installment_no: 1, amount: 5000, status: "รอชำระเงิน", outstanding_amount: 5700 });
console.log("Created initial project:", project.id);

// --- simulate updateProjectSale's logic: update + delete/reinsert children ---
await anon.from("projects").update({
  project_name: "งานหลังแก้ไข",
  pre_vat: 25000,
  vat: 1750,
}).eq("id", project.id);

await anon.from("project_items").delete().eq("project_id", project.id);
await anon.from("project_items").insert([
  { project_id: project.id, product_category: "WALLPOD", amount: 15000 },
  { project_id: project.id, product_category: "CNC", amount: 10000 },
]);

await anon.from("payments").delete().eq("project_id", project.id);
await anon.from("payments").insert([
  { project_id: project.id, installment_no: 1, amount: 15000, status: "ชำระมาแล้ว 50%", outstanding_amount: 11750 },
]);

// --- verify ---
const { data: updated } = await anon.from("projects").select("project_name, pre_vat, vat").eq("id", project.id).single();
const { data: updatedItems } = await anon.from("project_items").select("product_category, amount").eq("project_id", project.id);
const { data: updatedPayments } = await anon.from("payments").select("*").eq("project_id", project.id);

console.log("Updated project:", JSON.stringify(updated));
console.log("Updated items (should be 2 rows, WALLPOD+CNC):", JSON.stringify(updatedItems));
console.log("Updated payments (should be 1 row):", JSON.stringify(updatedPayments));

const pass =
  updated.project_name === "งานหลังแก้ไข" &&
  updatedItems.length === 2 &&
  updatedPayments.length === 1 &&
  Number(updatedPayments[0].amount) === 15000;
console.log(pass ? "\nPASS: delete+reinsert update semantics work correctly" : "\nFAIL");

// --- cleanup ---
await admin.from("payments").delete().eq("project_id", project.id);
await admin.from("project_items").delete().eq("project_id", project.id);
await admin.from("projects").delete().eq("id", project.id);
await admin.from("customers").delete().eq("id", cust.id);
await admin.from("profiles").delete().eq("id", created.user.id);
await admin.auth.admin.deleteUser(created.user.id);
console.log("Cleaned up QA test data");
