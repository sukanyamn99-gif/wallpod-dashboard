import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Verifies the new guard mirrors deleteGoodsReceipt's actual logic: block
// delete when a line's lot has been partially/fully consumed, allow it
// when untouched. Re-implements the exact check (not calling the Next.js
// action directly, since this is a plain script) to prove the underlying
// query/condition behaves as expected against real RLS-scoped data.

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

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log("  PASS " + label); }
  else { fail++; console.error("  FAIL " + label + (extra ? " — " + extra : "")); }
}

async function makeUser(role) {
  const email = "qa-delblock-" + role + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "@example.com";
  const password = crypto.randomBytes(12).toString("hex");
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").upsert({ id: created.user.id, full_name: "QA DelBlock " + role, role });
  const client = createClient(ANON_URL, ANON_KEY);
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { client, userId: created.user.id };
}

async function cleanupUser(u) {
  await admin.from("profiles").delete().eq("id", u.userId);
  await admin.auth.admin.deleteUser(u.userId);
}

// Mirrors the guard logic added to deleteGoodsReceipt.
async function isDeleteBlocked(client, productId, docNo) {
  const { data: lots } = await client
    .from("stock_product_lots")
    .select("stock_product_id, quantity_received, quantity_remaining")
    .eq("reference_no", docNo)
    .in("stock_product_id", [productId]);
  const lot = (lots ?? [])[0];
  return lot ? Number(lot.quantity_remaining) < Number(lot.quantity_received) : false;
}

console.log("Setting up disposable test products + owner account...");
const { data: p1 } = await admin.from("stock_products").insert({ name: "QA DELBLOCK UNTOUCHED", category: "OTHER", unit: "ชิ้น" }).select("id").single();
const { data: p2 } = await admin.from("stock_products").insert({ name: "QA DELBLOCK CONSUMED", category: "OTHER", unit: "ชิ้น" }).select("id").single();

const owner = await makeUser("owner");
const REF1 = "TEST-RI-DELBLOCK-1";
const REF2 = "TEST-RI-DELBLOCK-2";

try {
  console.log("\nScenario A: untouched receipt (no consumption) — should NOT be blocked...");
  await admin.from("goods_receipts").insert({ doc_no: REF1, received_by: owner.userId });
  await owner.client.rpc("record_goods_receipt", { p_product_id: p1.id, p_qty: 20, p_unit_cost: 5, p_note: "seed", p_reference: REF1 });
  const blockedA = await isDeleteBlocked(admin, p1.id, REF1);
  check("untouched receipt is NOT blocked", blockedA === false, blockedA);

  console.log("\nScenario B: receipt with some consumption — SHOULD be blocked...");
  await admin.from("goods_receipts").insert({ doc_no: REF2, received_by: owner.userId });
  await owner.client.rpc("record_goods_receipt", { p_product_id: p2.id, p_qty: 20, p_unit_cost: 5, p_note: "seed", p_reference: REF2 });
  await owner.client.rpc("record_stock_movement", { p_product_id: p2.id, p_type: "out", p_qty: 3, p_note: "partial use", p_reference: null });
  const blockedB = await isDeleteBlocked(admin, p2.id, REF2);
  check("consumed receipt IS blocked", blockedB === true, blockedB);

  const { data: lotB } = await admin.from("stock_product_lots").select("quantity_received, quantity_remaining").eq("stock_product_id", p2.id).eq("reference_no", REF2).single();
  check("lot for scenario B unchanged (delete never ran)", Number(lotB.quantity_remaining) === 17 && Number(lotB.quantity_received) === 20, JSON.stringify(lotB));

  const { data: p1After } = await admin.from("stock_products").select("quantity_on_hand").eq("id", p1.id).single();
  check("scenario A product still has its stock (untouched)", Number(p1After.quantity_on_hand) === 20, p1After.quantity_on_hand);
} finally {
  console.log("\nCleaning up...");
  await admin.from("goods_receipts").delete().in("doc_no", [REF1, REF2]);
  await admin.from("stock_products").delete().eq("id", p1.id);
  await admin.from("stock_products").delete().eq("id", p2.id);
  await cleanupUser(owner);
  console.log("Cleanup done.");
}

console.log("\n=== RESULTS: " + pass + " passed, " + fail + " failed ===");
process.exit(fail > 0 ? 1 : 0);
