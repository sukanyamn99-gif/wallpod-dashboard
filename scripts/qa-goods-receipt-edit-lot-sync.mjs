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

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log("  PASS " + label); }
  else { fail++; console.error("  FAIL " + label + (extra ? " — " + extra : "")); }
}

async function makeUser(role) {
  const email = "qa-editlot-" + role + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "@example.com";
  const password = crypto.randomBytes(12).toString("hex");
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").upsert({ id: created.user.id, full_name: "QA EditLot " + role, role });
  const client = createClient(ANON_URL, ANON_KEY);
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { client, userId: created.user.id };
}

async function cleanupUser(u) {
  await admin.from("profiles").delete().eq("id", u.userId);
  await admin.auth.admin.deleteUser(u.userId);
}

console.log("Setting up disposable test products + owner account...");
const { data: p1, error: p1Err } = await admin
  .from("stock_products").insert({ name: "QA EDITLOT PRODUCT 1", category: "OTHER", unit: "ชิ้น" }).select("id").single();
if (p1Err) throw p1Err;
const { data: p2, error: p2Err } = await admin
  .from("stock_products").insert({ name: "QA EDITLOT PRODUCT 2", category: "OTHER", unit: "ชิ้น" }).select("id").single();
if (p2Err) throw p2Err;

const owner = await makeUser("owner");
const REF = "TEST-RI-EDITLOT-1";

try {
  console.log("\nStep 1: create receipt (product1, 20 @ 10) via record_goods_receipt...");
  const { error: grErr } = await owner.client.rpc("record_goods_receipt", {
    p_product_id: p1.id, p_qty: 20, p_unit_cost: 10, p_note: "create", p_reference: REF,
  });
  check("goods receipt succeeds", !grErr, grErr && grErr.message);

  const { data: lotAfterCreate } = await admin
    .from("stock_product_lots").select("*").eq("stock_product_id", p1.id).eq("reference_no", REF).single();
  check("lot created with received=20, remaining=20, cost=10",
    Number(lotAfterCreate.quantity_received) === 20 && Number(lotAfterCreate.quantity_remaining) === 20 && Number(lotAfterCreate.unit_cost) === 10,
    JSON.stringify(lotAfterCreate));

  console.log("\nStep 2: consume 5 units via record_stock_movement 'out' (simulates a requisition against this lot)...");
  const { error: outErr } = await owner.client.rpc("record_stock_movement", {
    p_product_id: p1.id, p_type: "out", p_qty: 5, p_note: "consume some", p_reference: null,
  });
  check("out movement succeeds", !outErr, outErr && outErr.message);

  const { data: lotAfterConsume } = await admin
    .from("stock_product_lots").select("*").eq("stock_product_id", p1.id).eq("reference_no", REF).single();
  check("lot remaining reduced to 15 after consuming 5", Number(lotAfterConsume.quantity_remaining) === 15, lotAfterConsume.quantity_remaining);

  console.log("\nStep 3: edit the receipt line (product1: 20@10 -> 30@12) via edit_goods_receipt_item...");
  const { error: editErr } = await owner.client.rpc("edit_goods_receipt_item", {
    p_product_id: p1.id, p_old_qty: 20, p_old_cost: 10, p_new_qty: 30, p_new_cost: 12,
    p_note: "edit test", p_reference: REF,
  });
  check("edit_goods_receipt_item succeeds", !editErr, editErr && editErr.message);

  const { data: lotAfterEdit } = await admin
    .from("stock_product_lots").select("*").eq("stock_product_id", p1.id).eq("reference_no", REF).single();
  // consumed was 5 (20 received - 15 remaining), so new remaining should be 30 - 5 = 25
  check(
    "lot updated: received=30, remaining=25 (preserves the 5 already consumed), cost=12",
    Number(lotAfterEdit.quantity_received) === 30 && Number(lotAfterEdit.quantity_remaining) === 25 && Number(lotAfterEdit.unit_cost) === 12,
    JSON.stringify(lotAfterEdit),
  );

  console.log("\nStep 4: edit adds a brand-new line for product2 in the same receipt (old_qty=0 -> new_qty=15@8)...");
  const { error: addLineErr } = await owner.client.rpc("edit_goods_receipt_item", {
    p_product_id: p2.id, p_old_qty: 0, p_old_cost: 0, p_new_qty: 15, p_new_cost: 8,
    p_note: "add line", p_reference: REF,
  });
  check("edit_goods_receipt_item (new line) succeeds", !addLineErr, addLineErr && addLineErr.message);

  const { data: newLot } = await admin
    .from("stock_product_lots").select("*").eq("stock_product_id", p2.id).eq("reference_no", REF).maybeSingle();
  check(
    "new lot created for product2: received=15, remaining=15, cost=8",
    newLot && Number(newLot.quantity_received) === 15 && Number(newLot.quantity_remaining) === 15 && Number(newLot.unit_cost) === 8,
    JSON.stringify(newLot),
  );

  console.log("\nStep 5: edit removes product1's line entirely (new_qty=0)...");
  const { error: removeErr } = await owner.client.rpc("edit_goods_receipt_item", {
    p_product_id: p1.id, p_old_qty: 30, p_old_cost: 12, p_new_qty: 0, p_new_cost: 0,
    p_note: "remove line", p_reference: REF,
  });
  check("edit_goods_receipt_item (remove line) succeeds", !removeErr, removeErr && removeErr.message);

  const { data: lotAfterRemove } = await admin
    .from("stock_product_lots").select("*").eq("stock_product_id", p1.id).eq("reference_no", REF).single();
  check(
    "lot zeroed out after line removed: received=0, remaining=0",
    Number(lotAfterRemove.quantity_received) === 0 && Number(lotAfterRemove.quantity_remaining) === 0,
    JSON.stringify(lotAfterRemove),
  );

  console.log("\nStep 6: confirm the app's visibility query (quantity_remaining > 0) correctly hides the zeroed lot but shows product2's...");
  const { data: visible } = await admin
    .from("stock_product_lots").select("stock_product_id").gt("quantity_remaining", 0).eq("reference_no", REF);
  const visibleIds = (visible ?? []).map((r) => r.stock_product_id);
  check("product1's zeroed lot is hidden from the >0 view", !visibleIds.includes(p1.id), visibleIds);
  check("product2's lot is visible", visibleIds.includes(p2.id), visibleIds);
} finally {
  console.log("\nCleaning up...");
  await admin.from("stock_products").delete().eq("id", p1.id);
  await admin.from("stock_products").delete().eq("id", p2.id);
  await cleanupUser(owner);
  console.log("Cleanup done.");
}

console.log("\n=== RESULTS: " + pass + " passed, " + fail + " failed ===");
process.exit(fail > 0 ? 1 : 0);
