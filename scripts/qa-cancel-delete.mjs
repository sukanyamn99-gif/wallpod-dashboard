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

const email = "qa-cancel-delete@example.com";
const password = crypto.randomBytes(12).toString("hex");
const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
await admin.from("profiles").insert({ id: created.user.id, full_name: "QA Cancel Delete", role: "owner" });
await anon.auth.signInWithPassword({ email, password });

const { data: rep } = await admin.from("sales_reps").select("id").eq("name", "ธีรวัฒน์ (โต้)").single();
const { data: cust } = await anon.from("customers").insert({ name: "บจก. ทดสอบยกเลิก QA", customer_type: "Corporate" }).select("id").single();
const { data: project } = await anon.from("projects").insert({
  job_no: "JB2607-CANCEL-TEST",
  project_date: "2026-07-17",
  customer_id: cust.id,
  project_name: "ทดสอบยกเลิก",
  sales_rep_id: rep.id,
  customer_type: "Corporate",
  stage_percent: 100,
  pre_vat: 1000,
  vat: 70,
}).select("id").single();
console.log("Created test project:", project.id);

// Cancel
const { error: cancelErr } = await anon.from("projects").update({ is_cancelled: true }).eq("id", project.id);
if (cancelErr) throw cancelErr;
const { data: visibleAfterCancel } = await anon.from("projects").select("id").eq("is_cancelled", false).eq("id", project.id);
const { data: findableByJobNo } = await anon.from("projects").select("id, is_cancelled").eq("job_no", "JB2607-CANCEL-TEST").maybeSingle();
console.log("After cancel - visible in active-only query:", visibleAfterCancel.length === 0 ? "NO (correct)" : "YES (bug)");
console.log("After cancel - still findable by job_no:", findableByJobNo ? `YES, is_cancelled=${findableByJobNo.is_cancelled} (correct)` : "NO (bug)");

// Restore
await anon.from("projects").update({ is_cancelled: false }).eq("id", project.id);
const { data: visibleAfterRestore } = await anon.from("projects").select("id").eq("is_cancelled", false).eq("id", project.id);
console.log("After restore - visible again:", visibleAfterRestore.length === 1 ? "YES (correct)" : "NO (bug)");

// Delete
const { error: delErr } = await anon.from("projects").delete().eq("id", project.id);
if (delErr) throw delErr;
const { data: afterDelete } = await admin.from("projects").select("id").eq("id", project.id).maybeSingle();
const { data: itemsAfterDelete } = await admin.from("project_items").select("id").eq("project_id", project.id);
console.log("After delete - project row gone:", afterDelete === null ? "YES (correct)" : "NO (bug)");
console.log("After delete - cascade cleaned children:", itemsAfterDelete.length === 0 ? "YES (correct, none existed anyway)" : "NO (bug)");

// cleanup
await admin.from("customers").delete().eq("id", cust.id);
await admin.from("profiles").delete().eq("id", created.user.id);
await admin.auth.admin.deleteUser(created.user.id);
console.log("\nCleaned up QA test data. All checks passed if all lines above say (correct).");
