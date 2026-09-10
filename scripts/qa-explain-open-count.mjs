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

const { data } = await admin.from("projects").select("job_no, production_status, is_cancelled");
const total = data.length;
const cancelled = data.filter((p) => p.is_cancelled).length;
const live = data.filter((p) => !p.is_cancelled);
const open = live.filter((p) => p.production_status !== "เก็บเงินงวดสุดท้าย");
const closed = live.filter((p) => p.production_status === "เก็บเงินงวดสุดท้าย");
const noStatus = live.filter((p) => !p.production_status || p.production_status.trim() === "");

console.log(`total projects (incl. cancelled): ${total}`);
console.log(`cancelled: ${cancelled}`);
console.log(`live (not cancelled): ${live.length}`);
console.log(`  open (production_status != "เก็บเงินงวดสุดท้าย"): ${open.length}`);
console.log(`  closed (production_status == "เก็บเงินงวดสุดท้าย"): ${closed.length}`);
console.log(`  of which "open" have no status set at all: ${noStatus.length}`);
