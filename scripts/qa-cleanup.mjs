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

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { error: delLeadsErr } = await admin.from("sales_leads").delete().eq("customer_name", "บจก. ทดสอบระบบ QA");
if (delLeadsErr) throw delLeadsErr;
console.log("Deleted QA test sales_leads rows");

const { data: userList } = await admin.auth.admin.listUsers();
const qaUser = userList.users.find((u) => u.email === "qa-verify@example.com");
if (qaUser) {
  await admin.from("profiles").delete().eq("id", qaUser.id);
  await admin.auth.admin.deleteUser(qaUser.id);
  console.log("Deleted QA test user account");
}
