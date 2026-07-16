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

// Read anon key straight from .env.local since it's not in .env.import.local
const envLocal = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf-8");
const anonKeyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
const anonKey = anonKeyMatch[1].trim();
const anonClient = createClient(process.env.SUPABASE_URL, anonKey);

const testEmail = `test-verify-${Date.now()}@example.com`;
const testPassword = crypto.randomBytes(16).toString("hex");

console.log("Creating disposable test user:", testEmail);
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: testEmail,
  password: testPassword,
  email_confirm: true,
});
if (createErr) throw createErr;

await admin.from("profiles").insert({ id: created.user.id, full_name: "Test Verify", role: "sales" });

console.log("Signing in as test user via anon client (same as the app does)...");
const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({
  email: testEmail,
  password: testPassword,
});
if (signInErr) throw signInErr;
console.log("Sign-in OK, session user id:", signIn.user.id);

console.log("\nQuerying projects as this 'sales' role user (should be blocked from seeing others' projects)...");
const { data: projects, error: projErr } = await anonClient.from("projects").select("id, job_no").limit(5);
if (projErr) console.log("Query error (expected if RLS blocks):", projErr.message);
else console.log(`Visible projects: ${projects.length} (expected 0, since this test rep has no assigned sales_rep_id)`);

// cleanup
await admin.from("profiles").delete().eq("id", created.user.id);
await admin.auth.admin.deleteUser(created.user.id);
console.log("\nCleaned up disposable test user.");
