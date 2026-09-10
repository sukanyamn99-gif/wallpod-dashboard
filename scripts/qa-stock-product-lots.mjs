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
  const email = "qa-lots-" + role + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "@example.com";
  const password = crypto.randomBytes(12).toString("hex");
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").upsert({ id: created.user.id, full_name: "QA Lots " + role, role });
  const client = createClient(ANON_URL, ANON_KEY);
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { client, userId: created.user.id };
}

async function cleanupUser(u) {
  await admin.from("profiles").delete().eq("id", u.userId);
  await admin.auth.admin.deleteUser(u.userId);
}

console.log("Setting up disposable test product + accounts...");
const { data: product, error: prodErr } = await admin
  .from("stock_products")
  .insert({ name: "QA LOTS TEST PRODUCT", category: "OTHER", unit: "ชิ้น" })
  .select("id")
  .single();
if (prodErr) throw prodErr;
const productId = product.id;

const owner = await makeUser("owner");
const salesUser = await makeUser("sales");
const productionUser = await makeUser("production");

try {
  console.log("\nStep 1: two goods receipts at different costs...");
  const { error: gr1Err } = await owner.client.rpc("record_goods_receipt", {
    p_product_id: productId, p_qty: 20, p_unit_cost: 8, p_note: "lot1", p_reference: "TEST-GR-1",
  });
  check("first goods receipt succeeds", !gr1Err, gr1Err && gr1Err.message);

  const { error: gr2Err } = await owner.client.rpc("record_goods_receipt", {
    p_product_id: productId, p_qty: 30, p_unit_cost: 15, p_note: "lot2", p_reference: "TEST-GR-2",
  });
  check("second goods receipt succeeds", !gr2Err, gr2Err && gr2Err.message);

  const { data: lotsAfterReceipts } = await admin
    .from("stock_product_lots")
    .select("*")
    .eq("stock_product_id", productId)
    .order("received_at", { ascending: true });
  check("2 lots created", lotsAfterReceipts && lotsAfterReceipts.length === 2, "got " + (lotsAfterReceipts && lotsAfterReceipts.length));
  check(
    "lot 1 has qty 20 @ cost 8",
    lotsAfterReceipts && Number(lotsAfterReceipts[0].quantity_remaining) === 20 && Number(lotsAfterReceipts[0].unit_cost) === 8,
    JSON.stringify(lotsAfterReceipts && lotsAfterReceipts[0]),
  );
  check(
    "lot 2 has qty 30 @ cost 15",
    lotsAfterReceipts && Number(lotsAfterReceipts[1].quantity_remaining) === 30 && Number(lotsAfterReceipts[1].unit_cost) === 15,
    JSON.stringify(lotsAfterReceipts && lotsAfterReceipts[1]),
  );

  const { data: productAfterReceipts } = await admin.from("stock_products").select("quantity_on_hand, unit_cost").eq("id", productId).single();
  check("aggregate quantity_on_hand = 50", Number(productAfterReceipts.quantity_on_hand) === 50, productAfterReceipts.quantity_on_hand);
  const expectedAvgCost = (20 * 8 + 30 * 15) / 50;
  check("aggregate unit_cost = weighted avg (12.2)", Math.abs(Number(productAfterReceipts.unit_cost) - expectedAvgCost) < 0.01, productAfterReceipts.unit_cost);

  console.log("\nStep 2: partial out movement consuming FIFO across both lots (25 units: exhausts lot1's 20, takes 5 from lot2)...");
  const { error: outErr } = await productionUser.client.rpc("record_stock_movement", {
    p_product_id: productId, p_type: "out", p_qty: 25, p_note: "test consume", p_reference: "TEST-OUT-1",
  });
  check("out movement succeeds", !outErr, outErr && outErr.message);

  const { data: lotsAfterOut } = await admin
    .from("stock_product_lots")
    .select("*")
    .eq("stock_product_id", productId)
    .order("received_at", { ascending: true });
  check("lot 1 (oldest) fully consumed to 0", Number(lotsAfterOut[0].quantity_remaining) === 0, lotsAfterOut[0].quantity_remaining);
  check("lot 2 reduced from 30 to 25", Number(lotsAfterOut[1].quantity_remaining) === 25, lotsAfterOut[1].quantity_remaining);

  const { data: productAfterOut } = await admin.from("stock_products").select("quantity_on_hand").eq("id", productId).single();
  check("aggregate quantity_on_hand = 25 after out", Number(productAfterOut.quantity_on_hand) === 25, productAfterOut.quantity_on_hand);

  console.log("\nStep 3: out movement larger than remaining lots (30 units, only 25 remain in lots)...");
  const { error: out2Err } = await productionUser.client.rpc("record_stock_movement", {
    p_product_id: productId, p_type: "out", p_qty: 30, p_note: "overdraw test", p_reference: "TEST-OUT-2",
  });
  check("overdraw out movement still succeeds (no crash)", !out2Err, out2Err && out2Err.message);

  const { data: lotsAfterOverdraw } = await admin
    .from("stock_product_lots")
    .select("quantity_remaining")
    .eq("stock_product_id", productId);
  const totalLotRemaining = lotsAfterOverdraw.reduce((s, l) => s + Number(l.quantity_remaining), 0);
  check("all lots drained to 0 (no negative lot quantities)", totalLotRemaining === 0, totalLotRemaining);

  const { data: productAfterOverdraw } = await admin.from("stock_products").select("quantity_on_hand").eq("id", productId).single();
  check(
    "aggregate quantity_on_hand went negative as expected (-5), lots just floor at 0",
    Number(productAfterOverdraw.quantity_on_hand) === -5,
    productAfterOverdraw.quantity_on_hand,
  );

  console.log("\nStep 4: RLS checks on stock_product_lots...");
  const { data: salesRead, error: salesReadErr } = await salesUser.client.from("stock_product_lots").select("id").eq("stock_product_id", productId);
  check(
    "sales role denied read (0 rows, no hard error)",
    !salesReadErr && (salesRead ? salesRead.length : 0) === 0,
    JSON.stringify({ salesReadErr, count: salesRead && salesRead.length }),
  );

  const { data: ownerRead, error: ownerReadErr } = await owner.client.from("stock_product_lots").select("id").eq("stock_product_id", productId);
  check(
    "owner role can read lots",
    !ownerReadErr && (ownerRead ? ownerRead.length : 0) > 0,
    JSON.stringify({ ownerReadErr, count: ownerRead && ownerRead.length }),
  );

  const { error: salesInsertErr } = await salesUser.client.from("stock_product_lots").insert({
    stock_product_id: productId, quantity_received: 1, quantity_remaining: 1, unit_cost: 1,
  });
  check("sales role denied direct insert (no policy)", !!salesInsertErr, "expected an error but insert succeeded");

  console.log("\nStep 5: confirm plain in movement (non-goods-receipt) still works and does not create a lot...");
  const { error: inErr } = await productionUser.client.rpc("record_stock_movement", {
    p_product_id: productId, p_type: "in", p_qty: 10, p_note: "plain in, no cost", p_reference: null,
  });
  check("plain in movement still works", !inErr, inErr && inErr.message);
  const { data: lotsAfterPlainIn } = await admin.from("stock_product_lots").select("id").eq("stock_product_id", productId);
  check("plain in movement does NOT create a new lot", (lotsAfterPlainIn ? lotsAfterPlainIn.length : 0) === 2, lotsAfterPlainIn && lotsAfterPlainIn.length);
} finally {
  console.log("\nCleaning up...");
  await admin.from("stock_products").delete().eq("id", productId);
  await cleanupUser(owner);
  await cleanupUser(salesUser);
  await cleanupUser(productionUser);
  console.log("Cleanup done.");
}

console.log("\n=== RESULTS: " + pass + " passed, " + fail + " failed ===");
process.exit(fail > 0 ? 1 : 0);
