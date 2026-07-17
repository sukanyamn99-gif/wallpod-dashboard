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

const { count, error } = await supabase.from("sales_leads").select("*", { count: "exact", head: true });
if (error) console.error("sales_leads error:", error.message);
else console.log("sales_leads table exists, rows:", count);

const { error: visitsErr } = await supabase.from("visits").select("*", { count: "exact", head: true });
console.log("visits table still exists?", visitsErr ? "no (dropped OK)" : "YES (unexpected)");
