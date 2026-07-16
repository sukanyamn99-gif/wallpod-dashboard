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

const email = process.argv[2];
const fullName = process.argv[3] || email.split("@")[0];
const role = process.argv[4] || "owner";

if (!email) throw new Error("Usage: node scripts/create-profile.mjs <email> [fullName] [role]");

const { data: userList, error: listErr } = await supabase.auth.admin.listUsers();
if (listErr) throw listErr;

const user = userList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No auth user found with email ${email}. Create it in Supabase Studio > Authentication > Users first.`);
  process.exit(1);
}

const { error: upsertErr } = await supabase
  .from("profiles")
  .upsert({ id: user.id, full_name: fullName, role }, { onConflict: "id" });

if (upsertErr) throw upsertErr;

console.log(`Linked profile: ${email} -> role="${role}", full_name="${fullName}" (user id ${user.id})`);
