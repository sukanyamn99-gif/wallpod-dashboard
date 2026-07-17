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

// Replicate the action's lookup logic: ilike exact match should find an existing customer
// even with different casing.
const { data: existing } = await admin.from("customers").select("id, name").limit(1).single();
console.log("Existing customer sample:", existing.name);

const { data: match, error } = await admin
  .from("customers")
  .select("id")
  .ilike("name", existing.name.toUpperCase())
  .limit(1)
  .maybeSingle();
if (error) throw error;
console.log("Case-insensitive match found:", match?.id === existing.id ? "YES (correct)" : "NO (bug)");
