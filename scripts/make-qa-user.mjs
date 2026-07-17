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

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const email = "qa-verify@example.com";
const password = crypto.randomBytes(12).toString("hex");

const { data: created, error } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
});
if (error) throw error;

await admin.from("profiles").upsert({ id: created.user.id, full_name: "QA Verify", role: "owner" });

console.log(JSON.stringify({ email, password }));
