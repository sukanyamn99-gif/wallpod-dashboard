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

const { data } = await supabase
  .from("projects")
  .select("id, job_no, project_date, project_name, pre_vat, created_at, customers(name)")
  .order("created_at", { ascending: false })
  .limit(5);

console.log(JSON.stringify(data, null, 2));
