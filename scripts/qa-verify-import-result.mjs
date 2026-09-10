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
loadEnv(path.resolve(process.cwd(), ".env.local"));

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { count } = await admin.from("projects").select("id", { count: "exact", head: true });
const { data: totals } = await admin.from("projects").select("pre_vat, job_no, project_date");
const totalPreVat = totals.reduce((s, p) => s + Number(p.pre_vat), 0);
const dates = totals.map((p) => p.project_date).sort();

console.log(`projects count: ${count}`);
console.log(`total PRE.VAT: ${totalPreVat.toLocaleString()}`);
console.log(`date range: ${dates[0]} to ${dates[dates.length - 1]}`);

const hasTest = totals.some((p) => p.job_no === "JBTEST001");
console.log(`test row JBTEST001 present: ${hasTest}`);
