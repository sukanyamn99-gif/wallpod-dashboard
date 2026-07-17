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

const { data, error } = await supabase.from("projects").select("id, is_cancelled").limit(1);
if (error) {
  console.error("Migration NOT applied yet:", error.message);
  process.exit(1);
}
console.log("Migration applied correctly. Sample row:", JSON.stringify(data[0]));
