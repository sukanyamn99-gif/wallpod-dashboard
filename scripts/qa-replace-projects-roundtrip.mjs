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
loadEnv(path.resolve(process.cwd(), ".env.local"));

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ANON_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const BACKUP_PATH = path.resolve(process.cwd(), "scripts", "REAL-DATA-BACKUP-DO-NOT-DELETE.json");

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  PASS ${label}`);
  } else {
    fail++;
    console.error(`  FAIL ${label}${extra ? " — " + extra : ""}`);
  }
}

// ---- Step 1: read every real project + children, build the exact RPC payload shape, write to disk BEFORE touching anything ----
console.log("Step 1: backing up real data to disk before any destructive call...");
const { data: projects, error: projErr } = await admin
  .from("projects")
  .select("id, job_no, project_date, customer_id, project_name, sales_rep_id, customer_type, pre_vat, vat, production_status");
if (projErr) throw projErr;
const { data: items, error: itemsErr } = await admin.from("project_items").select("project_id, product_category, amount");
if (itemsErr) throw itemsErr;
const { data: costs, error: costsErr } = await admin.from("project_costs").select("*");
if (costsErr) throw costsErr;
const { data: payments, error: paymentsErr } = await admin.from("payments").select("*").order("installment_no");
if (paymentsErr) throw paymentsErr;

const backupRows = projects.map((p) => {
  const projItems = items.filter((it) => it.project_id === p.id);
  const projCost = costs.find((c) => c.project_id === p.id);
  const projPayments = payments.filter((pay) => pay.project_id === p.id);
  return {
    jobNo: p.job_no ?? "",
    projectDate: p.project_date,
    customerId: p.customer_id,
    projectName: p.project_name,
    salesRepId: p.sales_rep_id,
    customerType: p.customer_type,
    preVat: Number(p.pre_vat),
    vat: Number(p.vat),
    productionStatus: p.production_status ?? "",
    items: projItems.map((it) => ({ category: it.product_category, amount: Number(it.amount) })),
    costs: projCost
      ? {
          material: Number(projCost.material_cost),
          glue: Number(projCost.glue_cost),
          cutting: Number(projCost.cutting_cost),
          install: Number(projCost.install_cost),
          parking: Number(projCost.parking_cost),
          shipping: Number(projCost.shipping_cost),
        }
      : null,
    payments: projPayments.map((pay) => ({
      invoiceNo: pay.invoice_no ?? "",
      installmentNo: pay.installment_no,
      amount: Number(pay.amount),
      paidDate: pay.paid_date ?? "",
      status: pay.status,
      outstandingAmount: Number(pay.outstanding_amount),
    })),
  };
});

fs.writeFileSync(BACKUP_PATH, JSON.stringify(backupRows, null, 2));
console.log(`  Backed up ${backupRows.length} real projects to ${BACKUP_PATH}`);

const originalTotalPreVat = backupRows.reduce((sum, r) => sum + r.preVat, 0);
const originalCount = backupRows.length;
console.log(`  Original: ${originalCount} projects, total PRE.VAT = ${originalTotalPreVat}`);

// ---- Step 2: disposable owner test account ----
console.log("\nStep 2: creating disposable owner test account...");
const email = `qa-replace-owner-${Date.now()}@example.com`;
const password = crypto.randomBytes(12).toString("hex");
const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (createErr) throw createErr;
await admin.from("profiles").upsert({ id: created.user.id, full_name: "QA Replace Owner", role: "owner" });
const ownerClient = createClient(ANON_URL, ANON_KEY);
const { error: signInErr } = await ownerClient.auth.signInWithPassword({ email, password });
if (signInErr) throw signInErr;

try {
  // ---- Step 3: real destructive call — backup + 1 disposable test row ----
  console.log("\nStep 3: calling replace_all_projects with real backup + 1 test row...");
  const testRow = {
    jobNo: "JBTEST001",
    projectDate: new Date().toISOString().slice(0, 10),
    customerId: backupRows[0].customerId, // reuse a real existing customer, no new row needed
    projectName: "QA ROUND-TRIP TEST ROW",
    salesRepId: backupRows[0].salesRepId,
    customerType: "Owner",
    preVat: 1234,
    vat: 86.38,
    productionStatus: "",
    items: [{ category: "OTHER", amount: 1234 }],
    costs: null,
    payments: [],
  };

  const { data: countAfterTest, error: rpcErr1 } = await ownerClient.rpc("replace_all_projects", {
    p_rows: [...backupRows, testRow],
  });
  check("replace_all_projects succeeds for disposable owner (backup + test row)", !rpcErr1, rpcErr1?.message);

  const { count: countCheck1 } = await admin.from("projects").select("id", { count: "exact", head: true });
  check(
    "project count after test call = original + 1",
    countCheck1 === originalCount + 1,
    `expected ${originalCount + 1}, got ${countCheck1}`,
  );
  check("RPC returned count = original + 1", countAfterTest === originalCount + 1, `got ${countAfterTest}`);

  const { data: testRowCheck } = await admin.from("projects").select("id, pre_vat").eq("job_no", "JBTEST001").maybeSingle();
  check("test row JBTEST001 exists after import", !!testRowCheck, "not found");
  check(
    "test row has correct pre_vat",
    testRowCheck && Number(testRowCheck.pre_vat) === 1234,
    `got ${testRowCheck?.pre_vat}`,
  );

  const { data: totalCheck } = await admin.from("projects").select("pre_vat");
  const totalAfterTest = totalCheck.reduce((sum, p) => sum + Number(p.pre_vat), 0);
  check(
    "total pre_vat after test = original + test row (1234)",
    Math.abs(totalAfterTest - (originalTotalPreVat + 1234)) < 0.01,
    `expected ${originalTotalPreVat + 1234}, got ${totalAfterTest}`,
  );

  // ---- Step 4: restore original backup ----
  console.log("\nStep 4: restoring original backup (removes JBTEST001, restores exact original state)...");
  const { data: countAfterRestore, error: rpcErr2 } = await ownerClient.rpc("replace_all_projects", {
    p_rows: backupRows,
  });
  check("replace_all_projects succeeds for restore call", !rpcErr2, rpcErr2?.message);
  check("RPC returned count = original count", countAfterRestore === originalCount, `got ${countAfterRestore}`);

  const { count: countCheck2 } = await admin.from("projects").select("id", { count: "exact", head: true });
  check("project count after restore = original", countCheck2 === originalCount, `expected ${originalCount}, got ${countCheck2}`);

  const { data: testRowGone } = await admin.from("projects").select("id").eq("job_no", "JBTEST001").maybeSingle();
  check("test row JBTEST001 is gone after restore", !testRowGone, "still present!");

  const { data: totalCheck2 } = await admin.from("projects").select("pre_vat");
  const totalAfterRestore = totalCheck2.reduce((sum, p) => sum + Number(p.pre_vat), 0);
  check(
    "total pre_vat after restore = original exactly",
    Math.abs(totalAfterRestore - originalTotalPreVat) < 0.01,
    `expected ${originalTotalPreVat}, got ${totalAfterRestore}`,
  );

  // Spot-check a specific real job survived the round trip intact
  const { data: spotCheck } = await admin
    .from("projects")
    .select("job_no, pre_vat, vat")
    .eq("job_no", "JB2603064")
    .maybeSingle();
  check(
    "spot-check real job JB2603064 restored correctly",
    spotCheck && Number(spotCheck.pre_vat) === 585062,
    `got ${JSON.stringify(spotCheck)}`,
  );
} finally {
  console.log("\nCleaning up disposable owner test account...");
  await admin.from("profiles").delete().eq("id", created.user.id);
  await admin.auth.admin.deleteUser(created.user.id);
  console.log("Cleanup done.");
}

console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  console.error(`\n!!! FAILURES DETECTED — real data backup is saved at ${BACKUP_PATH} for manual recovery if needed !!!`);
}
process.exit(fail > 0 ? 1 : 0);
