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
  const email = "qa-delrev-" + role + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "@example.com";
  const password = crypto.randomBytes(12).toString("hex");
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").upsert({ id: created.user.id, full_name: "QA DelRev " + role, role });
  const client = createClient(ANON_URL, ANON_KEY);
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { client, userId: created.user.id };
}

async function cleanupUser(u) {
  await admin.from("profiles").delete().eq("id", u.userId);
  await admin.auth.admin.deleteUser(u.userId);
}

console.log("Setting up disposable test product + owner account...");
const { data: product, error: pErr } = await admin
  .from("stock_products").insert({ name: "QA DELETE-REVERSE PRODUCT", category: "OTHER", unit: "ชิ้น" }).select("id").single();
if (pErr) throw pErr;

const owner = await makeUser("owner");
const REF = "TEST-RI-DELREV-1";

try {
  console.log("\nStep 1: simulate creating a goods receipt with this product (40 @ 5)...");
  const { data: receipt, error: recErr } = await admin
    .from("goods_receipts").insert({ doc_no: REF, received_by: owner.userId }).select("id").single();
  if (recErr) throw recErr;
  const { error: itemErr } = await admin.from("goods_receipt_items").insert({
    receipt_id: receipt.id, stock_product_id: product.id, product_name_snapshot: "QA DELETE-REVERSE PRODUCT",
    unit_snapshot: "ชิ้น", quantity: 40, unit_cost: 5,
  });
  if (itemErr) throw itemErr;
  const { error: grErr } = await owner.client.rpc("record_goods_receipt", {
    p_product_id: product.id, p_qty: 40, p_unit_cost: 5, p_note: "seed", p_reference: REF,
  });
  check("goods receipt recorded", !grErr, grErr && grErr.message);

  const { data: afterCreate } = await admin.from("stock_products").select("quantity_on_hand").eq("id", product.id).single();
  check("quantity_on_hand = 40 after receipt", Number(afterCreate.quantity_on_hand) === 40, afterCreate.quantity_on_hand);

  console.log("\nStep 2: partially consume 10 units via a plain out movement (simulates a requisition)...");
  const { error: outErr } = await owner.client.rpc("record_stock_movement", {
    p_product_id: product.id, p_type: "out", p_qty: 10, p_note: "partial use", p_reference: null,
  });
  check("out movement succeeds", !outErr, outErr && outErr.message);

  const { data: lotAfterOut } = await admin
    .from("stock_product_lots").select("*").eq("stock_product_id", product.id).eq("reference_no", REF).single();
  check("lot remaining = 30 after consuming 10 of 40", Number(lotAfterOut.quantity_remaining) === 30, lotAfterOut.quantity_remaining);

  console.log("\nStep 3: call deleteGoodsReceipt's exact reversal logic (edit_goods_receipt_item -> new_qty=0) then delete the receipt row...");
  const { error: reverseErr } = await owner.client.rpc("edit_goods_receipt_item", {
    p_product_id: product.id, p_old_qty: 40, p_old_cost: 5, p_new_qty: 0, p_new_cost: 0,
    p_note: "delete test", p_reference: REF,
  });
  check("reversal RPC succeeds", !reverseErr, reverseErr && reverseErr.message);

  const { error: delErr } = await admin.from("goods_receipts").delete().eq("id", receipt.id);
  check("receipt row delete succeeds", !delErr, delErr && delErr.message);

  const { data: afterDelete } = await admin.from("stock_products").select("quantity_on_hand").eq("id", product.id).single();
  // Current on-hand before this step was 30 (40 received - 10 already
  // consumed elsewhere). Reversing subtracts the ORIGINAL received amount
  // (40) from current state, same formula edit-to-zero already uses —
  // 30 - 40 = -10 is the mathematically correct, documented-edge-case
  // outcome when stock from a deleted receipt was already used elsewhere.
  check(
    "quantity_on_hand reversed via the same formula edit-to-zero uses (30 - 40 = -10, expected when some stock was already consumed)",
    Number(afterDelete.quantity_on_hand) === -10,
    afterDelete.quantity_on_hand,
  );

  const { data: lotAfterDelete } = await admin
    .from("stock_product_lots").select("quantity_received, quantity_remaining").eq("stock_product_id", product.id).eq("reference_no", REF).single();
  check(
    "lot zeroed: received=0, remaining=0",
    Number(lotAfterDelete.quantity_received) === 0 && Number(lotAfterDelete.quantity_remaining) === 0,
    JSON.stringify(lotAfterDelete),
  );

  const { data: receiptGone } = await admin.from("goods_receipts").select("id").eq("id", receipt.id).maybeSingle();
  check("receipt row actually gone", !receiptGone, receiptGone);

  console.log("\nStep 4: the common case — a receipt with NO prior consumption, deleted immediately, should net to exactly 0...");
  const { data: product2, error: p2Err } = await admin
    .from("stock_products").insert({ name: "QA DELETE-REVERSE PRODUCT 2 (clean)", category: "OTHER", unit: "ชิ้น" }).select("id").single();
  if (p2Err) throw p2Err;
  const REF2 = "TEST-RI-DELREV-2";
  const { data: receipt2, error: rec2Err } = await admin
    .from("goods_receipts").insert({ doc_no: REF2, received_by: owner.userId }).select("id").single();
  if (rec2Err) throw rec2Err;
  await admin.from("goods_receipt_items").insert({
    receipt_id: receipt2.id, stock_product_id: product2.id, product_name_snapshot: "clean product",
    unit_snapshot: "ชิ้น", quantity: 25, unit_cost: 3,
  });
  await owner.client.rpc("record_goods_receipt", {
    p_product_id: product2.id, p_qty: 25, p_unit_cost: 3, p_note: "seed clean", p_reference: REF2,
  });
  const { error: reverse2Err } = await owner.client.rpc("edit_goods_receipt_item", {
    p_product_id: product2.id, p_old_qty: 25, p_old_cost: 3, p_new_qty: 0, p_new_cost: 0,
    p_note: "delete clean test", p_reference: REF2,
  });
  check("clean-case reversal succeeds", !reverse2Err, reverse2Err && reverse2Err.message);
  await admin.from("goods_receipts").delete().eq("id", receipt2.id);
  const { data: product2After } = await admin.from("stock_products").select("quantity_on_hand").eq("id", product2.id).single();
  check("clean case nets to exactly 0 (no prior consumption)", Number(product2After.quantity_on_hand) === 0, product2After.quantity_on_hand);
  await admin.from("stock_products").delete().eq("id", product2.id);
} finally {
  console.log("\nCleaning up...");
  await admin.from("stock_products").delete().eq("id", product.id);
  await cleanupUser(owner);
  console.log("Cleanup done.");
}

console.log("\n=== RESULTS: " + pass + " passed, " + fail + " failed ===");
process.exit(fail > 0 ? 1 : 0);
