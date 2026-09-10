import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.import.local" });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Pick a real fully-collected project (from the browser: JB2603064, พฤษภาคม 2569, preVat 585,062.40)
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, job_no, pre_vat")
    .eq("job_no", "JB2603064")
    .single();
  if (projErr) throw projErr;
  console.log("Project:", project);

  const discountPercent = 25;
  const { data: tier, error: tierErr } = await supabase
    .from("commission_rate_tiers")
    .select("commission_rate_percent")
    .eq("discount_percent", discountPercent)
    .maybeSingle();
  if (tierErr) throw tierErr;
  console.log("Tier for 25%:", tier);
  if (!tier) throw new Error("No tier found for 25% discount");

  const commissionAmount = Math.round(project.pre_vat * (tier.commission_rate_percent / 100) * 100) / 100;
  console.log("Computed commission amount:", commissionAmount);

  const { data: upserted, error: upsertErr } = await supabase
    .from("commission_entries")
    .upsert(
      {
        project_id: project.id,
        discount_percent: discountPercent,
        commission_rate_percent: tier.commission_rate_percent,
        commission_amount: commissionAmount,
      },
      { onConflict: "project_id" },
    )
    .select()
    .single();
  if (upsertErr) throw upsertErr;
  console.log("Upserted commission_entries row:", upserted);

  // Verify readback matches
  const { data: readback, error: readErr } = await supabase
    .from("commission_entries")
    .select("*")
    .eq("project_id", project.id)
    .single();
  if (readErr) throw readErr;
  console.log("Readback:", readback);
  console.log(
    "MATCH:",
    readback.commission_amount === commissionAmount && readback.discount_percent === discountPercent,
  );

  // Clean up
  const { error: delErr } = await supabase.from("commission_entries").delete().eq("project_id", project.id);
  if (delErr) throw delErr;
  console.log("Cleaned up commission_entries row for", project.job_no);

  const { data: afterDelete } = await supabase
    .from("commission_entries")
    .select("*")
    .eq("project_id", project.id);
  console.log("After delete, rows remaining:", afterDelete.length);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
