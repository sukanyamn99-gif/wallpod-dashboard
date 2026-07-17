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

const { data: project } = await admin.from("projects").select("id").eq("job_no", "JB2607-QA-TEST").single();
if (project) {
  await admin.from("payments").delete().eq("project_id", project.id);
  await admin.from("project_costs").delete().eq("project_id", project.id);
  await admin.from("project_items").delete().eq("project_id", project.id);
  await admin.from("projects").delete().eq("id", project.id);
  console.log("Deleted QA test project and children");
}

await admin.from("customers").delete().eq("name", "บจก. ทดสอบ Project Sales QA");
console.log("Deleted QA test customer");

const { data: userList } = await admin.auth.admin.listUsers();
const qaUser = userList.users.find((u) => u.email === "qa-project-sales@example.com");
if (qaUser) {
  await admin.from("profiles").delete().eq("id", qaUser.id);
  await admin.auth.admin.deleteUser(qaUser.id);
  console.log("Deleted QA test user account");
}
