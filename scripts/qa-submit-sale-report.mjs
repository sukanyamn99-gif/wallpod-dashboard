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

const envLocal = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf-8");
const anonKey = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const anon = createClient(process.env.SUPABASE_URL, anonKey);
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Sign in as the QA user (same credentials the browser session is using) to exercise RLS for real,
// exactly like the actual <form action={createSaleReport}> would from an authenticated browser session.
const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
  email: "qa-verify@example.com",
  password: "c1681c5299945c757734ed8d",
});
if (signInErr) throw signInErr;

const { data: rep } = await admin.from("sales_reps").select("id").eq("name", "ธีรวัฒน์ (โต้)").single();

const { data: inserted, error } = await anon.from("sales_leads").insert({
  sales_rep_id: rep.id,
  customer_name: "บจก. ทดสอบระบบ QA",
  project_name: "ห้องประชุมชั้น 5",
  customer_type: "Corporate",
  project_type: "ออฟฟิศ",
  stage: "เจรจาต่อรอง",
  stage_percent: 50,
  est_value: 420000,
  location_text: "https://maps.google.com/?q=13.7563,100.5018",
  next_action: "รอเซ็นสัญญา",
  note: "ทดสอบระบบ Sale Report ผ่านสคริปต์ (จำลองการกดปุ่มบันทึกจากฟอร์มจริง)",
  created_by: signIn.user.id,
}).select().single();

if (error) throw error;
console.log("Inserted sales_leads row via authenticated (RLS-checked) client:", JSON.stringify(inserted, null, 2));
